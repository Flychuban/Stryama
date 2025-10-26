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
import { classifyError, getUserFriendlyErrorMessage } from './errors';

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
    const startTime = Date.now();
    const generationId = this.generateId();

    try {
      console.log(`[Claude] Starting generation ${generationId}`);

      const enhancedPrompt = this.buildEnhancedPrompt(request);

      let resultText = '';

      for await (const message of query({
        prompt: enhancedPrompt,
        options: {
          model: request.options?.model ?? DEFAULT_MODEL,
          maxTurns: request.options?.maxTurns ?? GENERATION_CONFIG.maxTurns,
          allowedTools: [...GENERATION_CONFIG.allowedTools],
        },
      })) {
        if (message.type === 'result' && message.subtype === 'success') {
          resultText = message.result;
        }
      }

      const parsedResponse = this.parseResponse(resultText, generationId);

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

    // Add project context if available
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

  /**
   * Parse Claude response into structured format
   *
   * TODO: Enhance this in Story 2.4 with proper file extraction
   *
   * @param responseText - Raw response from Claude
   * @param generationId - Unique generation ID
   * @returns Parsed generation response
   */
  private parseResponse(
    responseText: string,
    generationId: string
  ): Omit<AIGenerationResponse, 'duration'> {
    // Basic parsing - will be enhanced in Story 2.4
    return {
      id: generationId,
      status: GenerationStatus.SUCCESS,
      files: [],
      explanation: responseText,
      tokensUsed: 0, // Will be calculated properly later
    };
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const claudeClient = ClaudeClient.getInstance();
