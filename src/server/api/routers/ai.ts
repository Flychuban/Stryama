/**
 * AI Generation Router
 *
 * Handles AI code generation requests, history management, and rate limiting.
 */

import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import {
  claudeClient,
  rateLimiter,
  validatePrompt,
  ProjectContextGatherer,
  ConflictDetector,
} from '~/lib/integrations/claude';
import type { ProjectContext } from '~/lib/integrations/claude';
import type { StreamEvent } from '~/lib/integrations/claude/types/stream-events';
import { createSandboxEvent } from '~/lib/integrations/claude/stream-manager';
import { sandboxManager } from '~/lib/integrations/e2b/services/sandbox-manager';
import { setupInfrastructure } from '~/lib/integrations/e2b/services/preview-manager';
import { E2B_CONFIG } from '~/lib/integrations/e2b/config';
import type { Sandbox } from '@e2b/code-interpreter';
import { UsageTrackingService } from '~/lib/services/usageTracking';
import { ModelSelectionService } from '~/lib/services/modelSelection';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
import { saveGeneratedFilesToDatabase } from '~/lib/integrations/e2b/utils/file-saver';
import { saveSessionToDB } from '~/lib/integrations/claude/session-cache';

export const aiRouter = createTRPCRouter({
  /**
   * Initialize a generation with prompt data
   *
   * This mutation creates a pending generation record with the prompt.
   * Used to avoid sending large prompts via URL parameters in subscriptions.
   *
   * Returns a generationId that can be used with streamGeneration.
   */
  initializeGeneration: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1, 'Prompt cannot be empty'),
        projectId: z.string().optional(),
        useSandbox: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          `[AI Router] 🚀 Initializing generation for user ${ctx.auth.userId}...`
        );

        // Validate prompt
        const validation = validatePrompt(input.prompt);
        if (!validation.valid) {
          console.error(
            `[AI Router] ❌ Prompt validation failed:`,
            validation.errors
          );
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: validation.errors[0] ?? 'Invalid prompt',
            cause: { type: 'VALIDATION_ERROR', errors: validation.errors },
          });
        }

        // Check generation limit (monthly usage)
        try {
          await UsageTrackingService.checkGenerationLimit(ctx.auth.userId);
        } catch (error) {
          console.error(`[AI Router] ❌ Generation limit check failed:`, error);
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              error instanceof Error
                ? error.message
                : 'Generation limit exceeded',
            cause: { type: 'LIMIT_EXCEEDED' },
          });
        }

        // Get user plan for rate limiting
        const userPlan = await getUserPlanFromClerk();

        // Check rate limits
        const rateLimit = await rateLimiter.checkRateLimit(
          ctx.auth.userId,
          userPlan
        );

        if (!rateLimit.allowed) {
          console.warn(
            `[AI Router] ⚠️ Rate limit exceeded for user ${ctx.auth.userId}`
          );
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Rate limit exceeded. You can make ${rateLimit.limit} requests per minute. Try again after ${rateLimit.resetAt.toISOString()}`,
            cause: {
              type: 'RATE_LIMIT_EXCEEDED',
              limit: rateLimit.limit,
              resetAt: rateLimit.resetAt.toISOString(),
            },
          });
        }

        // Create a pending generation record
        let generation;
        try {
          generation = await ctx.db.aIGeneration.create({
            data: {
              prompt: input.prompt,
              response: '', // Will be filled during streaming
              clerkUserId: ctx.auth.userId,
              projectId: input.projectId ?? null,
            },
          });
        } catch (error) {
          console.error(
            `[AI Router] ❌ Database error creating generation:`,
            error
          );
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to initialize generation. Please try again.',
            cause: {
              type: 'DATABASE_ERROR',
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }

        console.log(
          `[AI Router] ✅ Initialized generation ${generation.id} for user ${ctx.auth.userId}`
        );

        return {
          generationId: generation.id,
          projectId: input.projectId,
          useSandbox: input.useSandbox,
        };
      } catch (error) {
        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }

        // Unexpected errors
        console.error(
          `[AI Router] ❌ Unexpected error during initialization:`,
          error
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again.',
          cause: {
            type: 'UNKNOWN_ERROR',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }),

  generateCode: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1, 'Prompt cannot be empty'),
        projectId: z.string().optional(),
        useSandbox: z.boolean().default(true), // Enable E2B sandbox mode by default
      })
    )
    .mutation(async ({ ctx, input }) => {
      const validation = validatePrompt(input.prompt);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.errors[0] ?? 'Invalid prompt',
        });
      }

      // Check generation limit (monthly usage)
      try {
        await UsageTrackingService.checkGenerationLimit(ctx.auth.userId);
      } catch (error) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            error instanceof Error
              ? error.message
              : 'Generation limit exceeded',
        });
      }

      // Get user plan from Clerk session entitlements (no database query needed)
      const userPlan = await getUserPlanFromClerk();

      console.log(
        `[AI Router] User ${ctx.auth.userId} has plan: ${userPlan} (from Clerk session)`
      );

      // Check rate limits (minute/day limits for anti-spam)
      const rateLimit = await rateLimiter.checkRateLimit(
        ctx.auth.userId,
        userPlan
      );

      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit exceeded. You can make ${rateLimit.limit} requests per minute. Try again after ${rateLimit.resetAt.toISOString()}`,
        });
      }

      // Select appropriate model based on prompt complexity and user plan
      const selectedModel = ModelSelectionService.selectModel(
        input.prompt,
        userPlan
      );
      const modelId = ModelSelectionService.getModelId(selectedModel);

      console.log(
        `[AI Router] Using model: ${selectedModel} (${modelId}) for plan: ${userPlan}`
      );

      let context: ProjectContext | undefined;
      let sandboxId: string | undefined;
      let sandboxInstance: Sandbox | undefined; // E2B Sandbox instance
      let sessionId: string | undefined;

      if (input.projectId) {
        const project = await ctx.db.project.findFirst({
          where: {
            id: input.projectId,
            clerkUserId: ctx.auth.userId,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or you do not have access to it',
          });
        }

        // Retrieve the last session ID for conversation continuity
        const lastGeneration = await ctx.db.aIGeneration.findFirst({
          where: {
            projectId: input.projectId,
            sessionId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { sessionId: true },
        });

        if (lastGeneration?.sessionId) {
          sessionId = lastGeneration.sessionId;
          console.log(`[AI Router] Resuming session: ${sessionId}`);
        } else {
          console.log(
            '[AI Router] No previous session found - starting new conversation'
          );
        }

        const gatherer = new ProjectContextGatherer(ctx.db);
        context = await gatherer.gatherContext(input.projectId, {
          maxFiles: 5, // Limit for token efficiency
          maxFileSize: 3000,
        });

        // CRITICAL: Create E2B sandbox BEFORE calling Claude
        // This allows Claude to write directly to the sandbox using MCP tools
        if (input.useSandbox) {
          console.log(
            '[AI Router] Creating/getting E2B sandbox before generation'
          );
          const sandboxResult = await sandboxManager.getOrCreateSandbox(
            ctx.db,
            input.projectId,
            ctx.auth.userId,
            E2B_CONFIG.maxTimeoutMs // Use max timeout for AI generation (30 min)
          );

          if (sandboxResult.success && sandboxResult.data) {
            sandboxId = sandboxResult.data.id;
            sandboxInstance = sandboxResult.data.instance; // Store instance for later use
            console.log(`[AI Router] Using sandbox: ${sandboxId}`);

            // PHASE 2: Setup infrastructure BEFORE Claude runs
            // This creates package.json, vite.config.ts, tsconfig.json
            // Claude will create ALL application files (index.html, src/*, etc.)
            console.log('[AI Router] Setting up infrastructure in sandbox');
            const infraResult = await setupInfrastructure(
              sandboxResult.data.instance,
              project.name
            );

            if (infraResult.success) {
              console.log(
                '[AI Router] ✅ Infrastructure ready - running npm install'
              );

              // Run npm install to prepare dependencies
              try {
                console.log(
                  '[AI Router] 📦 Installing dependencies (may take 5-10 minutes)...'
                );
                await sandboxResult.data.instance.commands.run(
                  'cd /project && npm install',
                  { timeoutMs: 600000 } // 10 minutes (matches preview-manager timeout)
                );
                console.log(
                  '[AI Router] ✅ Dependencies installed - sandbox ready for Claude'
                );
              } catch (installError) {
                console.warn(
                  '[AI Router] ⚠️ npm install failed (will retry during preview):',
                  installError
                );
                // Continue - preview manager will handle npm install if needed
              }
            } else {
              console.warn(
                `[AI Router] Failed to setup infrastructure: ${infraResult.error}`
              );
              // Continue - Claude can still work, preview manager will handle setup
            }
          } else {
            console.warn(
              `[AI Router] Failed to create sandbox: ${sandboxResult.error}`
            );
            // Continue without sandbox mode
          }
        }
      }

      // Generate code with optional sandbox integration
      const result = await claudeClient.generateCode(
        {
          prompt: input.prompt,
          projectId: input.projectId,
          context,
          sessionId,
        },
        ctx.db,
        sandboxId
      );

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to generate code',
        });
      }

      let conflicts;
      let warning;
      if (context?.existingFiles && context.existingFiles.length > 0) {
        conflicts = ConflictDetector.detectConflicts(
          result.data.files,
          context.existingFiles
        );

        const hasCriticalConflicts =
          ConflictDetector.hasCriticalConflicts(conflicts);

        if (hasCriticalConflicts) {
          console.warn('[AI] Critical conflicts detected:', conflicts);
          warning =
            'Some generated files will overwrite existing files. Review carefully.';
        }
      }

      const aiGeneration = await ctx.db.aIGeneration.create({
        data: {
          prompt: input.prompt,
          response: result.data.explanation ?? '',
          tokens: result.data.tokensUsed,
          duration: result.data.duration,
          model: selectedModel, // Track which model was used
          clerkUserId: ctx.auth.userId,
          projectId: input.projectId ?? null,
          sessionId: result.data.sessionId ?? null,
          totalCost: result.data.totalCost ?? null,
        },
      });

      // Increment usage counters
      await Promise.all([
        rateLimiter.incrementCount(ctx.auth.userId),
        UsageTrackingService.incrementGenerationCount(ctx.auth.userId),
      ]);

      // Enhanced logging for file generation
      console.log(`[AI Router] Generation result:`, {
        filesGenerated: result.data.files.length,
        filesPaths: result.data.files.map((f) => f.path),
        hasProjectId: !!input.projectId,
        usedSandbox: !!sandboxId,
        hasInstance: !!sandboxInstance,
      });

      // Save generated files to database
      if (input.projectId) {
        try {
          await saveGeneratedFilesToDatabase(
            ctx.db,
            input.projectId,
            sandboxInstance,
            result.data.files,
            '[AI Router]'
          );
        } catch (error) {
          console.error(
            '[AI Router] ❌ Error saving files to database:',
            error
          );
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save generated files to database',
          });
        }
      } else {
        console.log(
          '[AI Router] No projectId provided - skipping database save'
        );
      }

      return {
        ...result.data,
        databaseId: aiGeneration.id,
        sandboxId, // Return sandbox ID to frontend
        conflicts,
        warning,
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const generations = await ctx.db.aIGeneration.findMany({
        where: {
          clerkUserId: ctx.auth.userId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return generations;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const generation = await ctx.db.aIGeneration.findFirst({
        where: {
          id: input.id,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!generation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Generation not found or you do not have access to it',
        });
      }

      return generation;
    }),

  getRateLimitStatus: protectedProcedure.query(async ({ ctx }) => {
    // Get user plan from Clerk session (source of truth)
    const userPlan = await getUserPlanFromClerk();

    // Get rate limit stats
    const stats = await rateLimiter.getUsageStats(ctx.auth.userId, userPlan);

    return {
      plan: userPlan,
      minuteCount: stats.minuteCount,
      dayCount: stats.dayCount,
      minuteLimit: stats.limits.requestsPerMinute,
      dayLimit: stats.limits.requestsPerDay,
      minuteRemaining: Math.max(
        0,
        stats.limits.requestsPerMinute - stats.minuteCount
      ),
      dayRemaining: Math.max(0, stats.limits.requestsPerDay - stats.dayCount),
    };
  }),

  /**
   * Stream AI code generation with real-time events
   *
   * Provides live updates as Claude works, including:
   * - Status updates (thinking, writing, executing)
   * - Tool usage (file writes, commands)
   * - Content streaming
   * - Token usage updates
   * - Completion/error notifications
   *
   * IMPORTANT: This subscription accepts a generationId (from initializeGeneration)
   * instead of the full prompt to avoid 431 errors with large prompts.
   */
  streamGeneration: protectedProcedure
    .input(
      z.object({
        generationId: z.string(),
      })
    )
    .subscription(async ({ ctx, input }) => {
      console.log(
        `[AI Stream] 🚀 ========== STREAM GENERATION START ==========`
      );
      console.log(`[AI Stream] Generation ID: ${input.generationId}`);
      console.log(`[AI Stream] User ID: ${ctx.auth.userId}`);
      console.log(`[AI Stream] Timestamp: ${new Date().toISOString()}`);

      // Fetch the generation record to get the prompt
      console.log(`[AI Stream] 🔍 Fetching generation record from database...`);
      const generation = await ctx.db.aIGeneration.findFirst({
        where: {
          id: input.generationId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!generation) {
        console.error(
          `[AI Stream] ❌ Generation not found: ${input.generationId}`
        );
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Generation not found or you do not have access to it',
        });
      }

      console.log(`[AI Stream] ✅ Generation record found`);
      const prompt = generation.prompt;
      const projectId = generation.projectId ?? undefined;
      const useSandbox = true; // Default to true

      console.log(
        `[AI Stream] 📝 User prompt (${prompt.length} chars):`,
        prompt.substring(0, 200) + (prompt.length > 200 ? '...' : '')
      );
      console.log(
        `[AI Stream] 📦 Project ID: ${projectId ?? 'none'}, Use Sandbox: ${useSandbox}`
      );

      // Get user plan from Clerk session entitlements
      const userPlan = await getUserPlanFromClerk();

      // Select appropriate model based on prompt complexity and user plan
      const selectedModel = ModelSelectionService.selectModel(prompt, userPlan);
      const modelId = ModelSelectionService.getModelId(selectedModel);

      console.log(
        `[AI Stream] Using model: ${selectedModel} (${modelId}) for plan: ${userPlan}`
      );

      // Create observable stream
      return observable<StreamEvent>((emit) => {
        const streamGeneration = async () => {
          try {
            let context: ProjectContext | undefined;
            let sessionId: string | undefined;
            let sandboxId: string | undefined;
            let sandboxInstance: Sandbox | undefined;
            let project: Awaited<ReturnType<typeof ctx.db.project.findFirst>> =
              null;

            // Track completion data for database persistence
            let completionResult: {
              content: string;
              sessionId: string;
              tokensUsed: number;
              totalCost: number;
              duration: number;
            } | null = null;

            // Gather project context if project ID provided
            if (projectId) {
              console.log(`[AI Stream] 🔍 Looking up project: ${projectId}...`);
              project = await ctx.db.project.findFirst({
                where: {
                  id: projectId,
                  clerkUserId: ctx.auth.userId,
                },
              });

              if (!project) {
                console.error(`[AI Stream] ❌ Project not found: ${projectId}`);
                emit.error(
                  new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                      'Project not found or you do not have access to it',
                  })
                );
                return;
              }

              console.log(
                `[AI Stream] ✅ Project found: "${project.name}" (${projectId})`
              );

              // Get existing session ID for continuity
              console.log(
                `[AI Stream] 🔍 Checking for previous session to restore...`
              );
              const lastGeneration = await ctx.db.aIGeneration.findFirst({
                where: {
                  projectId: projectId,
                  sessionId: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                select: { sessionId: true },
              });

              sessionId = lastGeneration?.sessionId ?? undefined;

              // Session restoration now happens just-in-time in Claude client
              // This ensures the session file is restored in the same execution context
              // where the Claude CLI subprocess runs (critical for serverless environments)
              if (sessionId) {
                console.log(
                  `[AI Stream] 🔄 Found previous session ${sessionId} - will attempt to restore in Claude client`
                );
              } else {
                console.log(
                  `[AI Stream] 📝 No previous session found - starting fresh conversation`
                );
              }

              // Gather project context
              console.log(
                `[AI Stream] 🔍 Gathering project context (existing files, dependencies)...`
              );
              const gatherer = new ProjectContextGatherer(ctx.db);
              context = await gatherer.gatherContext(projectId, {
                maxFiles: 5,
                maxFileSize: 3000,
              });
              console.log(
                `[AI Stream] ✅ Context gathered: ${context.existingFiles?.length ?? 0} existing files, ${context.dependencies?.length ?? 0} dependencies`
              );

              // Set up E2B sandbox if enabled
              if (useSandbox) {
                console.log(
                  `[AI Stream] 🏗️  Starting sandbox setup for project...`
                );
                emit.next(
                  createSandboxEvent(
                    'creating',
                    undefined,
                    'Creating development environment'
                  )
                );

                const sandboxStartTime = Date.now();
                console.log(
                  `[AI Stream] 🔍 Calling sandboxManager.getOrCreateSandbox...`
                );
                const sandboxResult = await sandboxManager.getOrCreateSandbox(
                  ctx.db,
                  projectId,
                  ctx.auth.userId,
                  E2B_CONFIG.maxTimeoutMs
                );
                const sandboxDuration = Date.now() - sandboxStartTime;
                console.log(
                  `[AI Stream] ⏱️  Sandbox operation took ${sandboxDuration}ms`
                );

                if (!sandboxResult.success || !sandboxResult.data) {
                  console.error(
                    `[AI Stream] ❌ Sandbox creation failed: ${sandboxResult.error}`
                  );
                  emit.error(
                    new TRPCError({
                      code: 'INTERNAL_SERVER_ERROR',
                      message:
                        sandboxResult.error ?? 'Failed to create sandbox',
                    })
                  );
                  return;
                }

                sandboxId = sandboxResult.data.id;
                sandboxInstance = sandboxResult.data.instance;

                console.log(
                  `[AI Stream] ✅ Sandbox ready - DB ID: ${sandboxId}, E2B ID: ${sandboxResult.data.e2bId}`
                );
                emit.next(
                  createSandboxEvent('created', sandboxId, 'Environment ready')
                );

                // Set up infrastructure
                console.log(
                  `[AI Stream] 🏗️  Setting up infrastructure (package.json, configs)...`
                );
                emit.next(
                  createSandboxEvent(
                    'installing_deps',
                    sandboxId,
                    'Setting up project infrastructure'
                  )
                );

                const infraStartTime = Date.now();
                const infraResult = await setupInfrastructure(
                  sandboxInstance,
                  project.name
                );
                const infraDuration = Date.now() - infraStartTime;
                console.log(
                  `[AI Stream] ⏱️  Infrastructure setup took ${infraDuration}ms`
                );

                if (infraResult.success) {
                  console.log(`[AI Stream] ✅ Infrastructure setup complete`);
                  // Run npm install
                  try {
                    console.log(
                      `[AI Stream] 📦 Installing dependencies (timeout: 10 minutes)...`
                    );
                    const npmStartTime = Date.now();
                    await sandboxInstance.commands.run(
                      'cd /project && npm install',
                      { timeoutMs: 600000 } // 10 minutes
                    );
                    const npmDuration = Date.now() - npmStartTime;
                    console.log(
                      `[AI Stream] ✅ npm install completed in ${(npmDuration / 1000).toFixed(1)}s`
                    );
                    emit.next(
                      createSandboxEvent(
                        'deps_installed',
                        sandboxId,
                        'Dependencies installed'
                      )
                    );
                  } catch (installError) {
                    console.error(
                      '[AI Stream] ❌ npm install failed:',
                      installError
                    );
                    console.error(
                      '[AI Stream] Error details:',
                      installError instanceof Error
                        ? installError.message
                        : 'Unknown error'
                    );
                    emit.next(
                      createSandboxEvent(
                        'deps_installed',
                        sandboxId,
                        'Dependency installation pending'
                      )
                    );
                  }
                } else {
                  console.error(
                    `[AI Stream] ❌ Infrastructure setup failed: ${infraResult.error}`
                  );
                }

                console.log(
                  `[AI Stream] ✅ Sandbox fully configured and ready`
                );
                emit.next(
                  createSandboxEvent(
                    'setup_complete',
                    sandboxId,
                    'Environment ready'
                  )
                );
              }
            } else {
              console.log(
                `[AI Stream] ℹ️  No project ID - using empty context`
              );
              context = { existingFiles: [], dependencies: [] };
            }

            // Start streaming generation
            console.log(
              '[AI Stream] 🚀 ========== STARTING CLAUDE STREAM =========='
            );
            console.log(
              `[AI Stream] Context: ${context?.existingFiles?.length ?? 0} existing files`
            );
            console.log(`[AI Stream] Session: ${sessionId ?? 'NEW SESSION'}`);
            console.log(`[AI Stream] Sandbox ID: ${sandboxId ?? 'none'}`);
            console.log(`[AI Stream] Model: ${selectedModel}`);
            console.log(`[AI Stream] Timestamp: ${new Date().toISOString()}`);

            const streamStartTime = Date.now();
            let streamIterator;
            try {
              console.log(
                `[AI Stream] 🔄 Calling claudeClient.generateCodeStreaming...`
              );
              streamIterator = claudeClient.generateCodeStreaming(
                {
                  prompt: prompt,
                  context,
                  sessionId,
                },
                ctx.db,
                sandboxId
              );
              console.log(
                `[AI Stream] ✅ Stream iterator created successfully`
              );
            } catch (error) {
              console.error(
                `[AI Stream] ❌ CRITICAL: Failed to create stream iterator:`,
                error
              );
              console.error(
                `[AI Stream] Error details:`,
                error instanceof Error ? error.message : 'Unknown error'
              );
              console.error(`[AI Stream] Error stack:`, error);
              throw error;
            }

            let eventCount = 0;
            let lastEventTime = Date.now();
            // Yield all events from the stream and capture completion data
            try {
              console.log(
                `[AI Stream] 🔄 Starting to iterate over stream events...`
              );
              for await (const event of streamIterator) {
                eventCount++;
                const now = Date.now();
                const timeSinceLastEvent = now - lastEventTime;
                lastEventTime = now;

                // Log all events with timing info
                const shouldLogDetails =
                  eventCount <= 5 || // First 5 events
                  event.type === 'complete' ||
                  event.type.startsWith('error') ||
                  event.type === 'tool_use' ||
                  event.type === 'tool_result' ||
                  timeSinceLastEvent > 5000; // Log if >5s since last event

                if (shouldLogDetails) {
                  console.log(
                    `[AI Stream] 📨 Event #${eventCount} (+${timeSinceLastEvent}ms): ${event.type}`,
                    event.type === 'tool_use'
                      ? `| Tool: ${event.toolName}`
                      : event.type === 'tool_result'
                        ? `| Tool: ${event.toolName} | Error: ${event.isError}`
                        : event.type === 'usage'
                          ? `| Tokens: ${event.inputTokens + event.outputTokens}`
                          : ''
                  );
                } else if (eventCount % 10 === 0) {
                  // Log every 10th event to show progress
                  console.log(
                    `[AI Stream] 📊 Progress: ${eventCount} events received (${event.type})`
                  );
                }

                emit.next(event);

                // Capture completion data for database persistence
                if (event.type === 'complete' && event.result) {
                  console.log(
                    `[AI Stream] 🎯 Completion event received - capturing result data`
                  );
                  completionResult = event.result;
                }
              }

              const streamDuration = Date.now() - streamStartTime;
              console.log(
                `[AI Stream] ✅ ========== STREAM COMPLETED ========== `
              );
              console.log(`[AI Stream] Total events: ${eventCount}`);
              console.log(
                `[AI Stream] Total duration: ${(streamDuration / 1000).toFixed(1)}s`
              );
              console.log(
                `[AI Stream] Completion result:`,
                completionResult
                  ? {
                      tokensUsed: completionResult.tokensUsed,
                      duration: completionResult.duration,
                      contentLength: completionResult.content?.length ?? 0,
                      sessionId: completionResult.sessionId,
                    }
                  : 'NONE - NO COMPLETION RESULT!'
              );
            } catch (streamError) {
              const streamDuration = Date.now() - streamStartTime;
              console.error(
                `[AI Stream] ❌ ========== STREAM ERROR ========== `
              );
              console.error(
                `[AI Stream] Error occurred after ${eventCount} events in ${(streamDuration / 1000).toFixed(1)}s`
              );
              console.error(`[AI Stream] Error:`, streamError);
              console.error(
                `[AI Stream] Error message:`,
                streamError instanceof Error
                  ? streamError.message
                  : 'Unknown error'
              );
              console.error(
                `[AI Stream] Error stack:`,
                streamError instanceof Error ? streamError.stack : 'No stack'
              );
              throw streamError;
            }

            // CRITICAL: Update the existing generation record after stream completes
            if (completionResult && projectId && project) {
              console.log(
                `[AI Stream] 💾 ========== SAVING TO DATABASE ==========`
              );
              console.log(`[AI Stream] Generation ID: ${input.generationId}`);
              console.log(
                `[AI Stream] Session ID: ${completionResult.sessionId ?? 'none'}`
              );
              console.log(
                `[AI Stream] Tokens used: ${completionResult.tokensUsed}`
              );

              try {
                // Update the existing generation record with results
                console.log(`[AI Stream] 🔄 Updating AIGeneration record...`);
                const updateStartTime = Date.now();
                await ctx.db.aIGeneration.update({
                  where: { id: input.generationId },
                  data: {
                    response: completionResult.content ?? '',
                    tokens: completionResult.tokensUsed,
                    duration: completionResult.duration,
                    model: selectedModel,
                    sessionId: completionResult.sessionId ?? null,
                    totalCost: completionResult.totalCost ?? null,
                  },
                });
                const updateDuration = Date.now() - updateStartTime;
                console.log(
                  `[AI Stream] ✅ AI generation saved to database (${updateDuration}ms)`
                );

                // Save session to database for future resumption
                if (completionResult.sessionId) {
                  console.log(
                    `[AI Stream] 💾 Saving session ${completionResult.sessionId} to database...`
                  );
                  const sessionStartTime = Date.now();
                  const saved = await saveSessionToDB(
                    ctx.db,
                    completionResult.sessionId
                  );
                  const sessionDuration = Date.now() - sessionStartTime;
                  if (saved) {
                    console.log(
                      `[AI Stream] ✅ Session saved to database (${sessionDuration}ms)`
                    );
                  } else {
                    console.warn(
                      `[AI Stream] ⚠️ Failed to save session to database after ${sessionDuration}ms (non-critical)`
                    );
                  }
                } else {
                  console.warn(
                    `[AI Stream] ⚠️ No session ID in completion result - cannot save session`
                  );
                }

                // Save files to database (supports both E2B sandbox and direct response)
                console.log(
                  `[AI Stream] 💾 Saving generated files to database...`
                );
                console.log(
                  `[AI Stream] Sandbox instance available: ${!!sandboxInstance}`
                );
                const filesStartTime = Date.now();
                await saveGeneratedFilesToDatabase(
                  ctx.db,
                  projectId,
                  sandboxInstance,
                  [], // Empty array - will read from sandbox if needed
                  '[AI Stream]'
                );
                const filesDuration = Date.now() - filesStartTime;
                console.log(
                  `[AI Stream] ✅ Files saved to database (${filesDuration}ms)`
                );

                // Check if preview server is already running
                // Strategy: Check if server is ACTUALLY responding, not just if URL exists in DB
                if (sandboxInstance && sandboxId) {
                  console.log(
                    `[AI Stream] 🔍 Checking preview server status...`
                  );

                  // Check if preview server was already started (exists in database)
                  const dbSandbox = await ctx.db.sandbox.findUnique({
                    where: { id: sandboxId },
                    select: {
                      previewUrl: true,
                      createdAt: true,
                      metadata: true,
                    },
                  });

                  console.log(
                    `[AI Stream] 🔍 Database sandbox check result:`,
                    dbSandbox
                      ? {
                          hasPreviewUrl: !!dbSandbox.previewUrl,
                          previewUrl: dbSandbox.previewUrl,
                          metadata: dbSandbox.metadata,
                        }
                      : 'NULL'
                  );

                  // CRITICAL FIX: Don't just check if URL exists - verify the server is ACTUALLY responding
                  // Servers can die unexpectedly (E2B hibernation, Vite crash, etc.)
                  // so we need to do a real HTTP health check
                  let hasRunningServer = false;
                  let serverIsHealthy = false;

                  if (dbSandbox?.previewUrl) {
                    console.log(
                      `[AI Stream] 🔍 URL exists in DB, performing health check on: ${dbSandbox.previewUrl}`
                    );
                    try {
                      // Import isPreviewHealthy from preview-manager
                      const { isPreviewHealthy } = await import(
                        '~/lib/integrations/e2b/services/preview-manager'
                      );

                      const healthCheckStart = Date.now();
                      serverIsHealthy = await isPreviewHealthy(
                        dbSandbox.previewUrl
                      );
                      const healthCheckDuration = Date.now() - healthCheckStart;

                      console.log(
                        `[AI Stream] 🏥 Health check result: ${serverIsHealthy ? '✅ HEALTHY' : '❌ NOT HEALTHY'} (${healthCheckDuration}ms)`
                      );

                      hasRunningServer = serverIsHealthy;
                    } catch (healthError) {
                      console.error(
                        `[AI Stream] ❌ Health check failed:`,
                        healthError
                      );
                      hasRunningServer = false;
                    }
                  } else {
                    console.log(
                      `[AI Stream] ℹ️ No preview URL in database - first prompt scenario`
                    );
                  }

                  // Determine action: restart if URL existed before (even if unhealthy), start fresh if first prompt
                  const urlExistedBefore = !!dbSandbox?.previewUrl;

                  if (urlExistedBefore) {
                    // Server was previously started (URL exists in DB)
                    // CRITICAL FIX: Vite HMR is unreliable and slow (60+ seconds, often gets stuck with 502 errors)
                    // Instead of waiting for HMR, RESTART the dev server for predictable, fast results
                    console.log(
                      `[AI Stream] 🔄 Previous server ${serverIsHealthy ? 'is healthy but' : 'has died -'} restarting for clean rebuild (HMR is unreliable)...`
                    );
                    const previewStartTime = Date.now();

                    try {
                      // Get updated files from database (Claude just wrote them)
                      const updatedFiles = await ctx.db.file.findMany({
                        where: { projectId },
                        orderBy: { path: 'asc' },
                      });

                      console.log(
                        `[AI Stream] 📁 Found ${updatedFiles.length} files to serve`
                      );

                      // Emit status update so frontend can show progress
                      emit.next({
                        type: 'status',
                        status: 'executing',
                        message:
                          'Restarting preview server with updated files...',
                        timestamp: Date.now(),
                      });

                      // Import and call startPreviewServer - it handles killing old server and starting new one
                      const { startPreviewServer } = await import(
                        '~/lib/integrations/e2b/services/preview-manager'
                      );

                      const previewResult = await startPreviewServer(
                        sandboxInstance,
                        projectId,
                        updatedFiles,
                        sandboxId,
                        true // forceRestart = true to kill old server and start fresh
                      );

                      if (!previewResult.success || !previewResult.data) {
                        const errorMessage = `Preview server restart failed: ${previewResult.error}`;
                        console.error(`[AI Stream] ❌ ${errorMessage}`);

                        // Emit explicit error event to frontend instead of throwing
                        // This ensures the error reaches the client even if they're still connected
                        emit.next({
                          type: 'error',
                          error: {
                            message: errorMessage,
                            code: 'PREVIEW_RESTART_FAILED',
                          },
                          timestamp: Date.now(),
                        });

                        // Don't throw - let the generation complete but preview failed
                        // User can manually restart preview using the button
                        console.log(
                          '[AI Stream] ⚠️ Preview failed but continuing with generation'
                        );
                      } else {
                        const previewDuration = Date.now() - previewStartTime;
                        console.log(
                          `[AI Stream] ✅ Preview server restarted successfully in ${(previewDuration / 1000).toFixed(1)}s`
                        );
                        console.log(
                          `[AI Stream] Preview URL: ${previewResult.data.url}`
                        );

                        // Emit preview URL update event to frontend
                        console.log(
                          `[AI Stream] 📡 Emitting preview_url_updated event to client`
                        );
                        emit.next({
                          type: 'preview_url_updated',
                          url: previewResult.data.url,
                          sandboxId: sandboxId,
                          message: 'Dev server restarted with updated files',
                          timestamp: Date.now(),
                          skipReload: false, // Always reload iframe to show fresh content
                        });
                      }
                    } catch (previewError) {
                      const errorMessage =
                        previewError instanceof Error
                          ? previewError.message
                          : 'Unknown preview restart error';
                      console.error(
                        `[AI Stream] ❌ Preview restart exception: ${errorMessage}`
                      );

                      // Emit error event to frontend
                      emit.next({
                        type: 'error',
                        error: {
                          message: `Failed to restart preview server: ${errorMessage}`,
                          code: 'PREVIEW_RESTART_EXCEPTION',
                        },
                        timestamp: Date.now(),
                      });

                      // Don't throw - let generation complete
                      console.log(
                        '[AI Stream] ⚠️ Preview error handled, continuing with generation'
                      );
                    }
                  } else {
                    // First prompt - need to start preview server (no URL in database yet)
                    console.log(
                      `[AI Stream] 🚀 First prompt - starting preview server (no previous URL in DB)...`
                    );
                    const previewStartTime = Date.now();

                    try {
                      const updatedFiles = await ctx.db.file.findMany({
                        where: { projectId },
                        orderBy: { path: 'asc' },
                      });

                      // Emit status update so frontend can show progress
                      emit.next({
                        type: 'status',
                        status: 'executing',
                        message: 'Starting preview server...',
                        timestamp: Date.now(),
                      });

                      const { startPreviewServer } = await import(
                        '~/lib/integrations/e2b/services/preview-manager'
                      );

                      const previewResult = await startPreviewServer(
                        sandboxInstance,
                        projectId,
                        updatedFiles,
                        sandboxId,
                        false // forceRestart: false - clean start, no need to force
                      );

                      const previewDuration = Date.now() - previewStartTime;

                      if (previewResult.success && previewResult.data) {
                        await ctx.db.sandbox.update({
                          where: { id: sandboxId },
                          data: {
                            previewUrl: previewResult.data.url,
                            lastActivity: new Date(),
                          },
                        });

                        console.log(
                          `[AI Stream] ✅ Preview server started successfully in ${(previewDuration / 1000).toFixed(1)}s`
                        );
                        console.log(
                          `[AI Stream] Preview URL: ${previewResult.data.url}`
                        );

                        // Emit preview URL update event to frontend
                        console.log(
                          `[AI Stream] 📡 Emitting preview_url_updated event to client`
                        );
                        emit.next({
                          type: 'preview_url_updated',
                          url: previewResult.data.url,
                          sandboxId: sandboxId,
                          message: 'Preview server started and ready',
                          timestamp: Date.now(),
                        });
                      } else {
                        const errorMessage = `Preview server start failed: ${previewResult.error}`;
                        console.error(`[AI Stream] ❌ ${errorMessage}`);

                        // Emit explicit error event to frontend
                        emit.next({
                          type: 'error',
                          error: {
                            message: errorMessage,
                            code: 'PREVIEW_START_FAILED',
                          },
                          timestamp: Date.now(),
                        });

                        // Don't throw - let generation complete
                        console.log(
                          '[AI Stream] ⚠️ Preview failed but generation completed successfully'
                        );
                      }
                    } catch (previewError) {
                      const errorMessage =
                        previewError instanceof Error
                          ? previewError.message
                          : 'Unknown preview start error';
                      console.error(
                        `[AI Stream] ❌ Preview start exception: ${errorMessage}`
                      );

                      // Emit error event to frontend
                      emit.next({
                        type: 'error',
                        error: {
                          message: `Failed to start preview server: ${errorMessage}`,
                          code: 'PREVIEW_START_EXCEPTION',
                        },
                        timestamp: Date.now(),
                      });

                      // Don't throw - let generation complete
                      console.log(
                        '[AI Stream] ⚠️ Preview error handled, generation completed'
                      );
                    }
                  }
                } else {
                  console.log(
                    `[AI Stream] ℹ️ Skipping preview check - sandbox not available`
                  );
                }

                // Increment usage counters
                console.log(`[AI Stream] 📊 Updating usage counters...`);
                const usageStartTime = Date.now();
                await Promise.all([
                  rateLimiter.incrementCount(ctx.auth.userId),
                  UsageTrackingService.incrementGenerationCount(
                    ctx.auth.userId
                  ),
                ]);
                const usageDuration = Date.now() - usageStartTime;
                console.log(
                  `[AI Stream] ✅ Usage counters updated (${usageDuration}ms)`
                );

                console.log(
                  `[AI Stream] ✅ ========== DATABASE SAVE COMPLETE ==========`
                );

                // CRITICAL: Emit database_persisted event to signal client that all DB operations are complete
                // This prevents race condition where client refetches before files are saved to DB
                console.log(
                  `[AI Stream] 📡 Emitting database_persisted event to client`
                );
                emit.next({
                  type: 'database_persisted',
                  sessionId: completionResult.sessionId,
                  projectId,
                  timestamp: Date.now(),
                  message: 'All database operations complete - safe to refetch',
                });
              } catch (dbError) {
                console.error(
                  `[AI Stream] ❌ ========== DATABASE ERROR ==========`
                );
                console.error(
                  '[AI Stream] Failed to persist to database:',
                  dbError
                );
                console.error(
                  '[AI Stream] Error details:',
                  dbError instanceof Error ? dbError.message : 'Unknown error'
                );
                console.error(
                  '[AI Stream] Error stack:',
                  dbError instanceof Error ? dbError.stack : 'No stack'
                );
                // Don't throw - stream already completed successfully
              }
            } else {
              console.warn(
                `[AI Stream] ⚠️ Skipping database save - missing required data:`
              );
              console.warn(
                `[AI Stream]   - completionResult: ${!!completionResult}`
              );
              console.warn(`[AI Stream]   - projectId: ${!!projectId}`);
              console.warn(`[AI Stream]   - project: ${!!project}`);
            }

            // Mark as complete
            console.log(
              `[AI Stream] 🏁 Emitting completion event to client...`
            );
            emit.complete();
            console.log(
              `[AI Stream] 🏁 ========== STREAM GENERATION END ==========`
            );
          } catch (error) {
            console.error(`[AI Stream] ❌ ========== FATAL ERROR ==========`);
            console.error('[AI Stream] Unhandled error:', error);
            console.error(
              '[AI Stream] Error type:',
              error?.constructor?.name ?? 'Unknown'
            );
            console.error(
              '[AI Stream] Error message:',
              error instanceof Error ? error.message : 'Unknown error'
            );
            console.error(
              '[AI Stream] Error stack:',
              error instanceof Error ? error.stack : 'No stack'
            );
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message:
                  error instanceof Error ? error.message : 'Stream error',
              })
            );
          }
        };

        // Start streaming
        console.log(
          `[AI Stream] 🔄 Launching async streamGeneration function...`
        );
        void streamGeneration();

        // Cleanup function
        return () => {
          console.log(
            `[AI Stream] 🔌 Client disconnected - cleaning up subscription`
          );
        };
      });
    }),
});
