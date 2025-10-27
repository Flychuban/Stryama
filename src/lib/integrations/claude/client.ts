/**
 * Claude Client
 *
 * Singleton client for interacting with Claude AI via the Agent SDK.
 * Handles code generation, error handling, and response parsing.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { DEFAULT_MODEL, GENERATION_CONFIG } from './config';
import type {
  AIGenerationRequest,
  AIGenerationResponse,
  ServiceResult,
} from './types';
import { GenerationStatus } from './types';
import {
  classifyError,
  getUserFriendlyErrorMessage,
  ClaudeGenerationError,
} from './errors';
import { ClaudeErrorType } from './types';
import { CodeParser } from './parser';
import { retryHandler } from './errors/retry-handler';

export class ClaudeClient {
  private static instance: ClaudeClient;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): ClaudeClient {
    if (!ClaudeClient.instance) {
      ClaudeClient.instance = new ClaudeClient();
    }
    return ClaudeClient.instance;
  }

  async generateCode(
    request: AIGenerationRequest
  ): Promise<ServiceResult<AIGenerationResponse>> {
    return retryHandler.executeWithRetry(
      async () => this.performGeneration(request),
      'AI Code Generation'
    );
  }

  private async performGeneration(
    request: AIGenerationRequest
  ): Promise<ServiceResult<AIGenerationResponse>> {
    const startTime = Date.now();
    const generationId = this.generateId();

    try {
      console.log(`[Claude] Starting generation ${generationId}`);

      const enhancedPrompt = this.buildEnhancedPrompt(request);

      let resultText = '';
      let sessionId: string | undefined;
      let tokensUsed = 0;
      let totalCost = 0;

      for await (const message of query({
        prompt: enhancedPrompt,
        options: {
          model: request.options?.model ?? DEFAULT_MODEL,
          maxTurns: request.options?.maxTurns ?? GENERATION_CONFIG.maxTurns,
          allowedTools: [...GENERATION_CONFIG.allowedTools],
        },
      })) {
        if (message.type === 'system' && message.subtype === 'init') {
          sessionId = message.session_id;
          console.log(`[Claude] Session ${sessionId} initialized`);
        }

        if (message.type === 'result') {
          if (message.subtype === 'success') {
            resultText = message.result;
            const usage = message.usage;
            tokensUsed =
              Number(usage.input_tokens) + Number(usage.output_tokens);
            totalCost = Number(message.total_cost_usd);
            console.log(
              `[Claude] Success: ${tokensUsed} tokens, $${totalCost.toFixed(4)}`
            );
          } else if (message.subtype === 'error_max_turns') {
            console.warn(`[Claude] Generation hit max turns limit`);
            throw new ClaudeGenerationError(
              'Generation exceeded maximum conversation turns. Try simplifying your prompt.',
              ClaudeErrorType.TIMEOUT,
              {
                numTurns: message.num_turns,
                sessionId: message.session_id,
              } as Record<string, unknown>
            );
          } else if (message.subtype === 'error_during_execution') {
            console.error(`[Claude] Error during execution`);
            throw new ClaudeGenerationError(
              'An error occurred during code generation. Please try again.',
              ClaudeErrorType.API_ERROR,
              { sessionId: message.session_id } as Record<string, unknown>
            );
          }
        }

        if (message.type === 'assistant') {
          console.log(`[Claude] Assistant thinking...`);
        }
      }

      if (!resultText) {
        throw new ClaudeGenerationError(
          'No response received from AI. Please try again.',
          ClaudeErrorType.INVALID_RESPONSE
        );
      }

      const parsedResponse = this.parseResponse(
        resultText,
        generationId,
        tokensUsed,
        totalCost,
        sessionId
      );

      const duration = Date.now() - startTime;
      console.log(
        `[Claude] Generation ${generationId} completed in ${duration}ms`
      );

      return {
        success: true,
        data: {
          ...parsedResponse,
          duration,
        },
        error: null,
      };
    } catch (error: unknown) {
      const errorType = classifyError(error);
      const errorMessage = getUserFriendlyErrorMessage(errorType);

      console.error(`[Claude] Generation ${generationId} failed:`, error);

      return {
        success: false,
        data: null,
        error: errorMessage,
      };
    }
  }

  private buildEnhancedPrompt(request: AIGenerationRequest): string {
    let prompt = request.prompt;

    if (
      request.context?.existingFiles &&
      request.context.existingFiles.length > 0
    ) {
      const fileContext = request.context.existingFiles
        .map((file) => `File: ${file.path}\n${file.content}`)
        .join('\n\n');

      prompt = `${prompt}\n\nExisting Project Files:\n${fileContext}`;
    }

    // Add framework context
    if (request.context?.framework) {
      prompt = `${prompt}\n\nTarget Framework: ${request.context.framework}`;
    }

    // Add dependencies context
    if (
      request.context?.dependencies &&
      request.context.dependencies.length > 0
    ) {
      const depsContext = request.context.dependencies.join(', ');
      prompt = `${prompt}\n\nAvailable Dependencies: ${depsContext}`;
    }

    return prompt;
  }

  private parseResponse(
    responseText: string,
    generationId: string,
    tokensUsed: number,
    totalCost: number,
    sessionId?: string
  ): Omit<AIGenerationResponse, 'duration'> {
    const files = CodeParser.parseClaudeResponse(responseText);

    return {
      id: generationId,
      status: GenerationStatus.SUCCESS,
      files,
      explanation: responseText,
      tokensUsed,
      totalCost,
      sessionId,
    };
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const claudeClient = ClaudeClient.getInstance();
