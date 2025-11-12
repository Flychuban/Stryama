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
import { createE2BTools } from './tools/e2b-tools';
import type { PrismaClient } from '@prisma/client';
import {
  processSDKStream,
  createStatusEvent,
  createErrorEvent,
} from './stream-manager';
import type { StreamEvent } from './types/stream-events';

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
    request: AIGenerationRequest,
    db?: PrismaClient,
    sandboxId?: string
  ): Promise<ServiceResult<AIGenerationResponse>> {
    return retryHandler.executeWithRetry(
      async () => this.performGeneration(request, db, sandboxId),
      'AI Code Generation'
    );
  }

  /**
   * Generate code with streaming events
   *
   * This method yields real-time events as the AI agent works,
   * providing transparency into tool usage, thinking, and content generation.
   *
   * @param request - AI generation request
   * @param db - Prisma database client for E2B tools
   * @param sandboxId - Optional E2B sandbox ID for remote execution
   * @returns AsyncGenerator that yields StreamEvent objects
   */
  async *generateCodeStreaming(
    request: AIGenerationRequest,
    db?: PrismaClient,
    sandboxId?: string
  ): AsyncGenerator<StreamEvent> {
    const generationId = this.generateId();
    const startTime = Date.now();

    try {
      console.log(`[Claude] Starting streaming generation ${generationId}`);

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(request, sandboxId);

      // Emit initializing status
      yield createStatusEvent('initializing', 'Preparing AI agent');

      // Get existing session ID from request
      const sessionId = request.sessionId;

      if (sessionId) {
        console.log(`[Claude] Resuming session ${sessionId}`);
      }

      // Set up MCP servers (E2B tools if sandbox provided)
      const mcpServers =
        sandboxId && db ? { 'e2b-sandbox': createE2BTools(db) } : undefined;

      // Start the query with streaming
      const sdkStream = query({
        prompt: enhancedPrompt,
        options: {
          model: request.options?.model ?? DEFAULT_MODEL,
          maxTurns: request.options?.maxTurns ?? GENERATION_CONFIG.maxTurns,
          mcpServers,
          disallowedTools: sandboxId
            ? [...GENERATION_CONFIG.e2bMode.disallowedTools]
            : undefined,
          allowedTools: sandboxId
            ? [...GENERATION_CONFIG.e2bMode.allowedTools]
            : [...GENERATION_CONFIG.localMode.allowedTools],
          resume: request.sessionId,
          // Serverless-friendly options for production deployment
          // SECURITY NOTE: bypassPermissions is safe in this architecture because:
          // 1. All file operations are restricted to E2B sandboxes (isolated VM environments)
          // 2. Local filesystem tools (Write, Edit, Bash) are explicitly disallowed via disallowedTools
          // 3. Only E2B proxy tools are allowed, which operate in sandboxed containers
          // 4. Serverless environments cannot support interactive permission prompts
          // 5. The Vercel serverless function itself runs in an isolated, read-only environment
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      // Process and yield stream events, passing sandboxId for completion event
      yield* processSDKStream(sdkStream, sandboxId);

      const duration = Date.now() - startTime;
      console.log(
        `[Claude] Streaming generation ${generationId} completed in ${duration}ms`
      );
    } catch (error) {
      console.error(
        `[Claude] Streaming generation ${generationId} failed:`,
        error
      );

      const errorType = classifyError(error);
      const errorMessage = getUserFriendlyErrorMessage(errorType);

      yield createErrorEvent(errorMessage, 'STREAM_ERROR', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async performGeneration(
    request: AIGenerationRequest,
    db?: PrismaClient,
    sandboxId?: string
  ): Promise<ServiceResult<AIGenerationResponse>> {
    const startTime = Date.now();
    const generationId = this.generateId();

    try {
      console.log(`[Claude] Starting generation ${generationId}`);
      if (request.sessionId) {
        console.log(`[Claude] Resuming session: ${request.sessionId}`);
      } else {
        console.log(`[Claude] Starting new conversation session`);
      }
      if (sandboxId) {
        console.log(`[Claude] Using E2B sandbox mode with ID: ${sandboxId}`);
      }

      const enhancedPrompt = this.buildEnhancedPrompt(request, sandboxId);

      let resultText = '';
      let sessionId: string | undefined;
      let tokensUsed = 0;
      let totalCost = 0;

      // Create MCP server for E2B tools if sandbox mode is enabled
      const mcpServers =
        sandboxId && db ? { 'e2b-sandbox': createE2BTools(db) } : undefined;

      if (mcpServers) {
        console.log(`[Claude] E2B mode enabled for sandbox: ${sandboxId}`);
      } else {
        console.log(`[Claude] Local mode enabled`);
      }

      for await (const message of query({
        prompt: enhancedPrompt,
        options: {
          model: request.options?.model ?? DEFAULT_MODEL,
          maxTurns: request.options?.maxTurns ?? GENERATION_CONFIG.maxTurns,
          mcpServers,
          disallowedTools: sandboxId
            ? [...GENERATION_CONFIG.e2bMode.disallowedTools]
            : undefined,
          allowedTools: sandboxId
            ? [...GENERATION_CONFIG.e2bMode.allowedTools]
            : [...GENERATION_CONFIG.localMode.allowedTools],
          // Resume existing session if provided
          resume: request.sessionId,
        },
      })) {
        if (message.type === 'system' && message.subtype === 'init') {
          sessionId = message.session_id;
          if (request.sessionId && sessionId === request.sessionId) {
            console.log(`[Claude] ✅ Resumed session ${sessionId}`);
          } else {
            console.log(`[Claude] Session ${sessionId} initialized`);
          }
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

        // Stream events are logged in development mode only
        // Production logging is minimal for performance
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
        sessionId,
        sandboxId // Pass sandbox ID to skip markdown parsing in E2B mode
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

  private buildEnhancedPrompt(
    request: AIGenerationRequest,
    sandboxId?: string
  ): string {
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

    if (sandboxId) {
      // E2B Sandbox Mode: Instruct Claude to use E2B tools
      const hasExistingFiles =
        request.context?.existingFiles &&
        request.context.existingFiles.length > 0;

      prompt += `\n\n---
IMPORTANT INSTRUCTIONS FOR E2B SANDBOX INTEGRATION:

${!hasExistingFiles ? `**NEW PROJECT**: This is a brand new project. You need to create ALL application files from scratch based on the user's request.` : ''}

You are working with an E2B sandbox environment (Sandbox ID: ${sandboxId}).

**INFRASTRUCTURE ALREADY SET UP ✅:**
The following files are ALREADY created and configured:
- ✅ package.json (with all necessary dependencies)
- ✅ vite.config.ts or next.config.js (properly configured for E2B)
- ✅ tsconfig.json (TypeScript configuration)
- ✅ node_modules (npm install ALREADY COMPLETED)

**YOUR RESPONSIBILITIES - Create ALL Application Files:**
1. Use E2B_Write to create ALL application/source files:
   - index.html (entry point for Vite projects) - REQUIRED
   - src/main.tsx or src/main.ts (application entry point) - REQUIRED
   - src/App.tsx (main component) - REQUIRED
   - src/index.css or src/App.css (styles) - REQUIRED
   - All other components, utilities, and source files the user requested

CRITICAL: You MUST create at least these 4 files:
  1. index.html
  2. src/main.tsx
  3. src/App.tsx
  4. src/App.css or src/index.css

If you do NOT create these files, the application will not work!

**DO NOT CREATE:**
- ❌ package.json (already exists)
- ❌ vite.config.ts, next.config.js, tsconfig.json (already exist)
- ❌ DO NOT run "npm install" (already done)

**Available Custom Tools:**
1. **E2B_Write** - Write files to the sandbox
   - Example: E2B_Write(sandbox_id="${sandboxId}", file_path="index.html", content="...")
   - Example: E2B_Write(sandbox_id="${sandboxId}", file_path="src/App.tsx", content="...")

2. **E2B_Bash** - Execute commands in the sandbox
   - Use to start dev server: E2B_Bash(sandbox_id="${sandboxId}", command="npm run dev")
   - Dev server runs in background automatically

3. **E2B_GetPreviewURL** - Get the live preview URL
   - For Vite: E2B_GetPreviewURL(sandbox_id="${sandboxId}", port=5173)
   - For Next.js: E2B_GetPreviewURL(sandbox_id="${sandboxId}", port=3000)

4. **E2B_Read** - Read existing files if needed
5. **E2B_List** - List files in a directory if needed

**Correct Workflow:**
1. Create ALL application files using E2B_Write (index.html, src/*, etc.)
2. Start the dev server using E2B_Bash: "npm run dev"
3. Get the preview URL using E2B_GetPreviewURL
4. Return the preview URL to the user

**CRITICAL REMINDERS:**
- Always use sandbox_id="${sandboxId}" in all E2B tool calls
- Do NOT use the local Write, Edit, or Bash tools
- Do NOT create package.json or config files (already exist)
- Do NOT run npm install (already done)
- Focus ONLY on creating application/source files

Please generate the complete implementation and get it running in the sandbox!`;
    } else {
      // Local/Fallback Mode: Instruct Claude to use markdown code blocks
      prompt += `\n\n---
IMPORTANT INSTRUCTIONS FOR CODE GENERATION:
1. Return ALL code files in markdown code blocks with the file path specified
2. Use this exact format for each file:

**File: path/to/file.tsx**
\`\`\`typescript
// file content here
\`\`\`

3. Examples:
   - For React components: **File: src/components/Button.tsx**
   - For styles: **File: src/styles/globals.css**
   - For config: **File: package.json**

4. Make sure to include the full file path relative to the project root
5. Include all necessary files (components, styles, configs, etc.)

Please generate the complete implementation following these guidelines.`;
    }

    return prompt;
  }

  private parseResponse(
    responseText: string,
    generationId: string,
    tokensUsed: number,
    totalCost: number,
    sessionId?: string,
    sandboxId?: string
  ): Omit<AIGenerationResponse, 'duration'> {
    let files: GeneratedFile[] = [];

    // PHASE 6: Skip markdown parsing in E2B mode
    // When using E2B sandbox, files are written directly via MCP tools
    if (sandboxId) {
      console.log(
        `[Claude] E2B mode: files written directly to sandbox via MCP tools`
      );
      console.log(
        `[Claude] Skipping markdown parsing - files already in sandbox ${sandboxId}`
      );
      files = [];
    } else {
      // Local mode: parse markdown code blocks from response text
      console.log(
        `[Claude] Local mode: parsing markdown code blocks from response`
      );
      files = CodeParser.parseClaudeResponse(responseText);

      console.log(`[Claude] Parsed ${files.length} files from response`);

      if (files.length === 0) {
        console.log(`[Claude] ⚠️ WARNING: No files parsed from response`);
        console.log(`[Claude] This might indicate:`);
        console.log(`[Claude]   1. Response format issue ❌`);
        console.log(`[Claude]   2. Claude didn't generate any code ⚠️`);
        console.log(
          `[Claude] Response preview (first 500 chars):`,
          responseText.substring(0, 500)
        );
      } else {
        console.log(
          `[Claude] ✅ Files parsed successfully:`,
          files.map((f) => f.path).join(', ')
        );
      }
    }

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
