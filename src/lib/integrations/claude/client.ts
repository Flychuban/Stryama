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
  GeneratedFile,
} from './types';
import { GenerationStatus, ProgrammingLanguage } from './types';
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

      // Track files created via Write tool
      const toolGeneratedFiles: Array<{ path: string; content: string }> = [];

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

        // CRITICAL FIX: Capture files from tool_use blocks
        if (message.type === 'assistant') {
          console.log(`[Claude] Assistant thinking...`);

          // Extract tool use blocks from assistant message
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const content = message.message.content as unknown;
          if (Array.isArray(content)) {
            for (const block of content) {
              // Type guard for tool_use blocks
              if (
                typeof block === 'object' &&
                block !== null &&
                'type' in block &&
                (block as { type: string }).type === 'tool_use' &&
                'name' in block &&
                (block as { name: string }).name === 'Write' &&
                'input' in block
              ) {
                const input = (block as { input: unknown }).input as {
                  file_path?: string;
                  content?: string;
                };
                if (input.file_path && input.content) {
                  console.log(
                    `[Claude] Capturing file from Write tool: ${input.file_path}`
                  );
                  toolGeneratedFiles.push({
                    path: input.file_path,
                    content: input.content,
                  });
                }
              }
            }
          }
        }
      }

      if (!resultText) {
        throw new ClaudeGenerationError(
          'No response received from AI. Please try again.',
          ClaudeErrorType.INVALID_RESPONSE
        );
      }

      console.log(
        `[Claude] Tool-generated files: ${toolGeneratedFiles.length}`
      );

      const parsedResponse = this.parseResponse(
        resultText,
        generationId,
        tokensUsed,
        totalCost,
        sessionId,
        toolGeneratedFiles
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
    sessionId?: string,
    toolGeneratedFiles: Array<{ path: string; content: string }> = []
  ): Omit<AIGenerationResponse, 'duration'> {
    let files: GeneratedFile[] = [];

    // PRIORITY 1: Use files from tool_use (Write tool)
    if (toolGeneratedFiles.length > 0) {
      console.log(
        `[Claude] Processing ${toolGeneratedFiles.length} tool-generated files`
      );
      files = toolGeneratedFiles.map((file) => ({
        path: file.path,
        content: file.content,
        language: this.detectLanguageFromPath(file.path),
      }));
    } else {
      // FALLBACK: Try to parse markdown code blocks from response text
      console.log(`[Claude] No tool files found, attempting markdown parsing`);
      files = CodeParser.parseClaudeResponse(responseText);
    }

    console.log(`[Claude] Final file count: ${files.length}`);

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

  private detectLanguageFromPath(filePath: string): ProgrammingLanguage {
    const extension = filePath.split('.').pop()?.toLowerCase() ?? '';

    switch (extension) {
      case 'ts':
      case 'tsx':
        return ProgrammingLanguage.TYPESCRIPT;
      case 'js':
      case 'jsx':
        return ProgrammingLanguage.JAVASCRIPT;
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return ProgrammingLanguage.CSS;
      case 'html':
      case 'htm':
        return ProgrammingLanguage.HTML;
      case 'json':
        return ProgrammingLanguage.JSON;
      case 'md':
      case 'markdown':
        return ProgrammingLanguage.MARKDOWN;
      default:
        // Default to TypeScript for code files
        return ProgrammingLanguage.TYPESCRIPT;
    }
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const claudeClient = ClaudeClient.getInstance();
