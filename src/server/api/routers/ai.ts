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
import {
  saveSessionToDB,
  restoreSessionFromDB,
} from '~/lib/integrations/claude/session-cache';

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

      // Get user plan for rate limiting
      const userPlan = await getUserPlanFromClerk();

      // Check rate limits
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

      // Create a pending generation record
      const generation = await ctx.db.aIGeneration.create({
        data: {
          prompt: input.prompt,
          response: '', // Will be filled during streaming
          clerkUserId: ctx.auth.userId,
          projectId: input.projectId ?? null,
        },
      });

      console.log(
        `[AI Router] Initialized generation ${generation.id} for user ${ctx.auth.userId}`
      );

      return {
        generationId: generation.id,
        projectId: input.projectId,
        useSandbox: input.useSandbox,
      };
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
      // Fetch the generation record to get the prompt
      const generation = await ctx.db.aIGeneration.findFirst({
        where: {
          id: input.generationId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!generation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Generation not found or you do not have access to it',
        });
      }

      const prompt = generation.prompt;
      const projectId = generation.projectId ?? undefined;
      const useSandbox = true; // Default to true

      console.log(
        `[AI Stream] Starting generation ${input.generationId} for user ${ctx.auth.userId}`
      );
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
              project = await ctx.db.project.findFirst({
                where: {
                  id: projectId,
                  clerkUserId: ctx.auth.userId,
                },
              });

              if (!project) {
                emit.error(
                  new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                      'Project not found or you do not have access to it',
                  })
                );
                return;
              }

              // Get existing session ID for continuity
              const lastGeneration = await ctx.db.aIGeneration.findFirst({
                where: {
                  projectId: projectId,
                  sessionId: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                select: { sessionId: true },
              });

              sessionId = lastGeneration?.sessionId ?? undefined;

              // Restore session from database if resuming
              if (sessionId && projectId) {
                console.log(
                  `[AI Router] Attempting to restore session ${sessionId} from database...`
                );
                const restored = await restoreSessionFromDB(
                  ctx.db,
                  sessionId,
                  projectId
                );
                if (restored) {
                  console.log(`[AI Router] ✅ Session restored successfully`);
                } else {
                  console.log(
                    `[AI Router] ⚠️ Could not restore session - Claude will start fresh`
                  );
                  // Don't fail the request, just log and continue
                  // Claude will start a new session if the old one isn't found
                }
              }

              // Gather project context
              const gatherer = new ProjectContextGatherer(ctx.db);
              context = await gatherer.gatherContext(projectId, {
                maxFiles: 5,
                maxFileSize: 3000,
              });

              // Set up E2B sandbox if enabled
              if (useSandbox) {
                emit.next(
                  createSandboxEvent(
                    'creating',
                    undefined,
                    'Creating development environment'
                  )
                );

                const sandboxResult = await sandboxManager.getOrCreateSandbox(
                  ctx.db,
                  projectId,
                  ctx.auth.userId,
                  E2B_CONFIG.maxTimeoutMs
                );

                if (!sandboxResult.success || !sandboxResult.data) {
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

                emit.next(
                  createSandboxEvent('created', sandboxId, 'Environment ready')
                );

                // Set up infrastructure
                emit.next(
                  createSandboxEvent(
                    'installing_deps',
                    sandboxId,
                    'Setting up project infrastructure'
                  )
                );

                const infraResult = await setupInfrastructure(
                  sandboxInstance,
                  project.name
                );

                if (infraResult.success) {
                  // Run npm install
                  try {
                    await sandboxInstance.commands.run(
                      'cd /project && npm install',
                      { timeoutMs: 600000 } // 10 minutes
                    );
                    emit.next(
                      createSandboxEvent(
                        'deps_installed',
                        sandboxId,
                        'Dependencies installed'
                      )
                    );
                  } catch (installError) {
                    console.warn(
                      '[AI Stream] npm install failed:',
                      installError
                    );
                    emit.next(
                      createSandboxEvent(
                        'deps_installed',
                        sandboxId,
                        'Dependency installation pending'
                      )
                    );
                  }
                }

                emit.next(
                  createSandboxEvent(
                    'setup_complete',
                    sandboxId,
                    'Environment ready'
                  )
                );
              }
            } else {
              context = { existingFiles: [], dependencies: [] };
            }

            // Start streaming generation
            console.log(
              '[AI Stream] 🚀 Calling Claude generateCodeStreaming...'
            );
            console.log(
              `[AI Stream] Context: ${context?.existingFiles?.length ?? 0} existing files, Session: ${sessionId ?? 'new'}`
            );

            const streamIterator = claudeClient.generateCodeStreaming(
              {
                prompt: prompt,
                context,
                sessionId,
              },
              ctx.db,
              sandboxId
            );

            let eventCount = 0;
            // Yield all events from the stream and capture completion data
            for await (const event of streamIterator) {
              eventCount++;
              if (
                eventCount <= 3 ||
                event.type === 'complete' ||
                event.type.startsWith('error')
              ) {
                console.log(
                  `[AI Stream] 📨 Event #${eventCount}: ${event.type}`
                );
              }

              emit.next(event);

              // Capture completion data for database persistence
              if (event.type === 'complete' && event.result) {
                completionResult = event.result;
              }
            }

            console.log(
              `[AI Stream] ✅ Stream completed. Total events: ${eventCount}`
            );
            console.log(
              `[AI Stream] Completion result:`,
              completionResult
                ? {
                    tokensUsed: completionResult.tokensUsed,
                    duration: completionResult.duration,
                    contentLength: completionResult.content?.length ?? 0,
                  }
                : 'none'
            );

            // CRITICAL: Update the existing generation record after stream completes
            if (completionResult && projectId && project) {
              console.log('[AI Stream] Updating generation in database...');

              try {
                // Update the existing generation record with results
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

                console.log('[AI Stream] ✅ AI generation saved to database');

                // Save session to database for future resumption
                if (completionResult.sessionId && projectId) {
                  console.log(
                    `[AI Stream] Saving session ${completionResult.sessionId} to database...`
                  );
                  const saved = await saveSessionToDB(
                    ctx.db,
                    completionResult.sessionId,
                    projectId
                  );
                  if (saved) {
                    console.log('[AI Stream] ✅ Session saved to database');
                  } else {
                    console.log(
                      '[AI Stream] ⚠️ Failed to save session to database (non-critical)'
                    );
                  }
                }

                // Save files to database (supports both E2B sandbox and direct response)
                await saveGeneratedFilesToDatabase(
                  ctx.db,
                  projectId,
                  sandboxInstance,
                  [], // Empty array - will read from sandbox if needed
                  '[AI Stream]'
                );

                // Increment usage counters
                await Promise.all([
                  rateLimiter.incrementCount(ctx.auth.userId),
                  UsageTrackingService.incrementGenerationCount(
                    ctx.auth.userId
                  ),
                ]);
              } catch (dbError) {
                console.error(
                  '[AI Stream] ❌ Failed to persist to database:',
                  dbError
                );
                // Don't throw - stream already completed successfully
              }
            }

            // Mark as complete
            emit.complete();
          } catch (error) {
            console.error('[AI Stream] Error:', error);
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
        void streamGeneration();

        // Cleanup function
        return () => {
          console.log('[AI Stream] Client disconnected');
        };
      });
    }),
});
