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
import { resolveClaudeCLIPath } from './utils/resolve-cli-path';
import { getCleanEnvironment } from './utils/env-cleaner';
import { restoreSessionFromDB, verifySessionFileExists } from './session-cache';
import { logger } from '~/lib/utils/logger';

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
      logger.debug(`[Claude] Starting streaming generation ${generationId}`);

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(request, sandboxId);

      // Emit initializing status
      yield createStatusEvent('initializing', 'Preparing AI agent');

      // Handle session restoration just-in-time (critical for serverless environments)
      const sessionId = request.sessionId;
      let canResumeSession = false;

      if (sessionId && db) {
        logger.debug(
          `[Claude] 🔄 Attempting to restore session ${sessionId} (process ${process.pid})...`
        );

        // Restore session from database to filesystem
        const restored = await restoreSessionFromDB(db, sessionId);

        if (restored) {
          // Small delay to ensure filesystem sync completes (prevents race conditions)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Verify the session file actually exists in THIS process
          const verification = await verifySessionFileExists(sessionId);

          if (verification.exists) {
            logger.debug(
              `[Claude] ✅ Session ${sessionId} verified and ready (path: ${verification.path})`
            );
            canResumeSession = true;
          } else {
            console.warn(
              `[Claude] ⚠️ Session ${sessionId} restored but file not found in process ${verification.processId}`
            );
            console.warn(
              `[Claude] This indicates a serverless container mismatch - starting fresh session`
            );
            canResumeSession = false;
          }
        } else {
          logger.debug(
            `[Claude] ℹ️ No session data found in database for ${sessionId} - starting fresh`
          );
          canResumeSession = false;
        }
      } else if (sessionId && !db) {
        console.warn(
          `[Claude] ⚠️ Session ID provided but no database client - cannot restore session`
        );
        canResumeSession = false;
      }

      const mcpServers =
        sandboxId && db ? { 'e2b-sandbox': createE2BTools(db) } : undefined;

      const cliPath = resolveClaudeCLIPath();

      logger.debug(
        `[Claude] Starting query with resume=${canResumeSession ? sessionId : 'none'}`
      );

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
          resume: canResumeSession ? sessionId : undefined,
          pathToClaudeCodeExecutable: cliPath,
          env: getCleanEnvironment(),
          stderr: (data: string) => {
            console.error(`[Claude CLI stderr] ${data}`);
          },
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      // Process and yield stream events, passing sandboxId for completion event
      yield* processSDKStream(sdkStream, sandboxId);

      const duration = Date.now() - startTime;
      logger.debug(
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
      logger.debug(`[Claude] Starting generation ${generationId}`);
      if (sandboxId) {
        logger.debug(`[Claude] Using E2B sandbox mode with ID: ${sandboxId}`);
      }

      const enhancedPrompt = this.buildEnhancedPrompt(request, sandboxId);

      // Handle session restoration just-in-time (critical for serverless environments)
      const sessionId = request.sessionId;
      let canResumeSession = false;

      if (sessionId && db) {
        logger.debug(
          `[Claude] 🔄 Attempting to restore session ${sessionId} (process ${process.pid})...`
        );

        // Restore session from database to filesystem
        const restored = await restoreSessionFromDB(db, sessionId);

        if (restored) {
          // Small delay to ensure filesystem sync completes (prevents race conditions)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Verify the session file actually exists in THIS process
          const verification = await verifySessionFileExists(sessionId);

          if (verification.exists) {
            logger.debug(
              `[Claude] ✅ Session ${sessionId} verified and ready (path: ${verification.path})`
            );
            canResumeSession = true;
          } else {
            console.warn(
              `[Claude] ⚠️ Session ${sessionId} restored but file not found in process ${verification.processId}`
            );
            console.warn(
              `[Claude] This indicates a serverless container mismatch - starting fresh session`
            );
            canResumeSession = false;
          }
        } else {
          logger.debug(
            `[Claude] ℹ️ No session data found in database for ${sessionId} - starting fresh`
          );
          canResumeSession = false;
        }
      } else if (sessionId && !db) {
        console.warn(
          `[Claude] ⚠️ Session ID provided but no database client - cannot restore session`
        );
        canResumeSession = false;
      }

      let resultText = '';
      let resultSessionId: string | undefined;
      let tokensUsed = 0;
      let totalCost = 0;

      const mcpServers =
        sandboxId && db ? { 'e2b-sandbox': createE2BTools(db) } : undefined;

      if (mcpServers) {
        logger.debug(`[Claude] E2B mode enabled for sandbox: ${sandboxId}`);
      } else {
        logger.debug(`[Claude] Local mode enabled`);
      }

      const cliPath = resolveClaudeCLIPath();

      logger.debug(
        `[Claude] Starting query with resume=${canResumeSession ? sessionId : 'none'}`
      );

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
          resume: canResumeSession ? sessionId : undefined,
          pathToClaudeCodeExecutable: cliPath,
          env: getCleanEnvironment(),
          stderr: (data: string) => {
            console.error(`[Claude CLI stderr] ${data}`);
          },
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      })) {
        if (message.type === 'system' && message.subtype === 'init') {
          resultSessionId = message.session_id;
          if (request.sessionId && resultSessionId === request.sessionId) {
            logger.debug(`[Claude] ✅ Resumed session ${resultSessionId}`);
          } else {
            logger.debug(`[Claude] Session ${resultSessionId} initialized`);
          }
        }

        if (message.type === 'result') {
          if (message.subtype === 'success') {
            resultText = message.result;
            const usage = message.usage;
            tokensUsed =
              Number(usage.input_tokens) + Number(usage.output_tokens);
            totalCost = Number(message.total_cost_usd);
            logger.debug(
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
        resultSessionId,
        sandboxId // Pass sandbox ID to skip markdown parsing in E2B mode
      );

      const duration = Date.now() - startTime;
      logger.debug(
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
- ✅ components.json (Shadcn UI configuration)
- ✅ src/lib/utils.ts (cn() utility for Shadcn components)
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

**QUALITY STANDARDS (CRITICAL):**

Apply to ALL files you create:

Design (NO AI "tells"):
- ❌ NO purple/indigo defaults - analyze context for appropriate colors (Business→blues/greens, Creative→warm, Technical→slate+emerald)
- ❌ NO emojis (unless casual brand), NO "Transform your business" copy, NO fake testimonials
- ❌ NO cookie-cutter layouts, inconsistent spacing/shadows/borders
- ✅ ONE border radius system, 2-3 shadow levels, consistent Tailwind spacing (py-12/24, p-6/8, gap-4/6/8)

Functionality (All MUST work):
- All buttons need onClick, all forms need onSubmit with preventDefault()
- THREE states: Loading (skeleton UI), Error (message + retry), Empty ("No items" + CTA)
- Proper TypeScript types (avoid 'any'), validation with specific errors

Content:
- SPECIFIC copy for actual use case, NO buzzwords
- Action-specific CTAs: "Create Project" not "Get Started"
- Concrete language: "Deploy in 5 minutes" not "fast"

Technical:
- Semantic HTML, aria-labels, WCAG AA contrast
- Mobile responsive: <640px stack, hamburger menu, h-10+ buttons

**SHADCN UI COMPONENTS (Pre-configured & Ready to Use):**

All Shadcn infrastructure is set up. Use Shadcn components for professional UI!

SETUP COMPLETE:
- ✅ components.json configured with proper aliases
- ✅ src/lib/utils.ts with cn() utility function created
- ✅ All @radix-ui packages installed (Dialog, Dropdown, Select, Tabs, etc.)
- ✅ Tailwind configured for Shadcn

HOW TO USE SHADCN COMPONENTS:
1. Create component files in src/components/ui/ directory
2. Import Radix UI primitives and use cn() for className merging
3. Follow Shadcn patterns: CVA for variants, forwardRef, proper TypeScript types

EXAMPLE - Button Component (src/components/ui/button.tsx):
\`\`\`typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
\`\`\`

COMMONLY USED SHADCN COMPONENTS:
- Button: Primary actions, secondary actions, destructive actions
- Dialog: Modals, forms, confirmations
- Card: Content containers, dashboard widgets
- Table: Data tables with sorting and filtering
- Form components: Input, Label, Select, Checkbox, Switch, Textarea
- Dropdown Menu: User menus, action menus
- Tabs: Tabbed interfaces
- Tooltip: Hover information
- Badge: Status indicators, tags
- Alert: Success/error/warning messages

IMPORTANT RULES:
- ✅ ALWAYS use cn() utility for className props
- ✅ Create components in src/components/ui/ directory
- ✅ Import from "@/lib/utils" (alias is configured)
- ✅ Use proper TypeScript types and forwardRef
- ❌ DON'T create components.json or src/lib/utils.ts (already exist)
- ❌ DON'T install Shadcn packages (already installed)

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

**VERIFICATION WORKFLOW (CRITICAL - MANDATORY STEPS):**

After creating all files, you MUST verify the app builds successfully:

STEP 1: CREATE ALL FILES
- Use E2B_Write for index.html, src/*, components

STEP 2: RUN BUILD CHECK (MANDATORY)
- Command: E2B_Bash(sandbox_id="${sandboxId}", command="cd /project && npm run build 2>&1 | tail -50")
- Wait for build to complete
- Check for errors in output

STEP 3: ANALYZE BUILD OUTPUT
Look for these error patterns:
- ❌ "The \`xxx\` class does not exist" → Tailwind config issue
- ❌ "Cannot find module" → Missing import or dependency
- ❌ "Type error" → TypeScript issue
- ❌ "Unexpected token" → Syntax error
- ✅ "built in XXXms" → Build successful

STEP 4: FIX ERRORS IF FOUND
If build fails:
1. Read the error messages carefully
2. Identify the root cause:
   - Missing Tailwind class? Check if it's defined in tailwind.config.ts
   - Missing import? Add the import statement
   - Type error? Fix TypeScript types
3. Fix the issue using E2B_Write
4. Run build check again (STEP 2)
5. ONE RETRY ONLY - if still failing, inform user with clear error message

STEP 5: START DEV SERVER (Only if build succeeds)
- Command: E2B_Bash(sandbox_id="${sandboxId}", command="npm run dev")
- Wait for "ready" or "Local:" message

STEP 6: GET PREVIEW URL
- E2B_GetPreviewURL(sandbox_id="${sandboxId}", port=5173)
- Return URL to user

CRITICAL ERROR PATTERNS TO WATCH FOR:
1. **Tailwind Class Not Found**:
   - Error: "The \`bg-background\` class does not exist"
   - Cause: Using classes not defined in tailwind.config.ts
   - Fix: ONLY use classes that are defined (bg-primary, bg-secondary, etc.)

2. **Missing Imports**:
   - Error: "Cannot find module '@/lib/utils'"
   - Cause: File doesn't exist or wrong path
   - Fix: Verify file exists, correct import path

3. **TypeScript Errors**:
   - Error: "Type 'string' is not assignable to type 'number'"
   - Cause: Type mismatch
   - Fix: Correct types or add proper type assertions

DO NOT SKIP BUILD CHECK! Always run npm run build BEFORE npm run dev.
DO NOT return preview URL if build fails! Fix errors first or inform user.

**CRITICAL REMINDERS:**
- Always use sandbox_id="${sandboxId}" in all E2B tool calls
- Do NOT use the local Write, Edit, or Bash tools
- Do NOT create package.json or config files (already exist)
- Do NOT run npm install (already done)
- Focus ONLY on creating application/source files
- VERIFY compilation before declaring success

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
      logger.debug(
        `[Claude] E2B mode: files written directly to sandbox via MCP tools`
      );
      logger.debug(
        `[Claude] Skipping markdown parsing - files already in sandbox ${sandboxId}`
      );
      files = [];
    } else {
      // Local mode: parse markdown code blocks from response text
      logger.debug(
        `[Claude] Local mode: parsing markdown code blocks from response`
      );
      files = CodeParser.parseClaudeResponse(responseText);

      logger.debug(`[Claude] Parsed ${files.length} files from response`);

      if (files.length === 0) {
        logger.debug(`[Claude] ⚠️ WARNING: No files parsed from response`);
        logger.debug(`[Claude] This might indicate:`);
        logger.debug(`[Claude]   1. Response format issue ❌`);
        logger.debug(`[Claude]   2. Claude didn't generate any code ⚠️`);
        logger.debug(
          `[Claude] Response preview (first 500 chars):`,
          responseText.substring(0, 500)
        );
      } else {
        logger.debug(
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
