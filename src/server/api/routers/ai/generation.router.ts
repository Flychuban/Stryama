import { TRPCError } from '@trpc/server';
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
import { sandboxManager } from '~/lib/integrations/e2b/services/sandbox-manager';
import { setupInfrastructure } from '~/lib/integrations/e2b/services/preview';
import { E2B_CONFIG } from '~/lib/integrations/e2b/config';
import type { Sandbox } from '@e2b/code-interpreter';
import { UsageTrackingService } from '~/lib/services/usageTracking';
import { ModelSelectionService } from '~/lib/services/modelSelection';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
import { saveGeneratedFilesToDatabase } from '~/lib/integrations/e2b/utils/file-saver';
import { logger } from '~/lib/utils/logger';
import { TIMEOUTS, FILE_LIMITS } from '~/lib/config/timeouts';
import {
  trackUsageLimitHitServer,
  trackRateLimitHitServer,
} from '~/lib/analytics/server-tracking';

export const generationRouter = createTRPCRouter({
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
        logger.debug(
          `[AI Router] Initializing generation for user ${ctx.auth.userId}...`
        );

        const validation = validatePrompt(input.prompt);
        if (!validation.valid) {
          logger.error(
            `[AI Router] Prompt validation failed:`,
            validation.errors
          );
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: validation.errors[0] ?? 'Invalid prompt',
            cause: { type: 'VALIDATION_ERROR', errors: validation.errors },
          });
        }

        try {
          await UsageTrackingService.checkGenerationLimit(ctx.auth.userId);
        } catch (error) {
          logger.error(`[AI Router] Generation limit check failed:`, error);
          const userPlan = await getUserPlanFromClerk();
          trackUsageLimitHitServer(ctx.auth.userId, {
            plan_type: userPlan,
            limit: 0,
            attempted_action: 'ai_generation',
          });

          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              error instanceof Error
                ? error.message
                : 'Generation limit exceeded',
            cause: { type: 'LIMIT_EXCEEDED' },
          });
        }

        const userPlan = await getUserPlanFromClerk();
        const rateLimit = await rateLimiter.checkRateLimit(
          ctx.auth.userId,
          userPlan
        );

        if (!rateLimit.allowed) {
          logger.warn(
            `[AI Router] Rate limit exceeded for user ${ctx.auth.userId}`
          );
          trackRateLimitHitServer(ctx.auth.userId, {
            plan_type: userPlan,
            requests_in_window: rateLimit.limit - rateLimit.remaining,
            limit: rateLimit.limit,
            retry_after_seconds: Math.ceil(
              (rateLimit.resetAt.getTime() - Date.now()) / 1000
            ),
          });

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

        let generation;
        try {
          generation = await ctx.db.aIGeneration.create({
            data: {
              prompt: input.prompt,
              response: '',
              clerkUserId: ctx.auth.userId,
              projectId: input.projectId ?? null,
            },
          });
        } catch (error) {
          logger.error(
            `[AI Router] Database error creating generation:`,
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

        logger.debug(
          `[AI Router] Initialized generation ${generation.id} for user ${ctx.auth.userId}`
        );

        return {
          generationId: generation.id,
          projectId: input.projectId,
          useSandbox: input.useSandbox,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error(
          `[AI Router] Unexpected error during initialization:`,
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

      try {
        await UsageTrackingService.checkGenerationLimit(ctx.auth.userId);
      } catch (error) {
        const userPlan = await getUserPlanFromClerk();
        trackUsageLimitHitServer(ctx.auth.userId, {
          plan_type: userPlan,
          limit: 0,
          attempted_action: 'ai_generation',
        });

        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            error instanceof Error
              ? error.message
              : 'Generation limit exceeded',
        });
      }

      const userPlan = await getUserPlanFromClerk();
      logger.debug(
        `[AI Router] User ${ctx.auth.userId} has plan: ${userPlan} (from Clerk session)`
      );

      const rateLimit = await rateLimiter.checkRateLimit(
        ctx.auth.userId,
        userPlan
      );

      if (!rateLimit.allowed) {
        trackRateLimitHitServer(ctx.auth.userId, {
          plan_type: userPlan,
          requests_in_window: rateLimit.limit - rateLimit.remaining,
          limit: rateLimit.limit,
          retry_after_seconds: Math.ceil(
            (rateLimit.resetAt.getTime() - Date.now()) / 1000
          ),
        });

        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit exceeded. You can make ${rateLimit.limit} requests per minute. Try again after ${rateLimit.resetAt.toISOString()}`,
        });
      }

      const selectedModel = ModelSelectionService.selectModel(
        input.prompt,
        userPlan
      );
      const modelId = ModelSelectionService.getModelId(selectedModel);

      logger.debug(
        `[AI Router] Using model: ${selectedModel} (${modelId}) for plan: ${userPlan}`
      );

      let context: ProjectContext | undefined;
      let sandboxId: string | undefined;
      let sandboxInstance: Sandbox | undefined;
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
          logger.debug(`[AI Router] Resuming session: ${sessionId}`);
        } else {
          logger.debug(
            '[AI Router] No previous session found - starting new conversation'
          );
        }

        const gatherer = new ProjectContextGatherer(ctx.db);
        context = await gatherer.gatherContext(input.projectId, {
          maxFiles: FILE_LIMITS.MAX_CONTEXT_FILES,
          maxFileSize: FILE_LIMITS.MAX_FILE_SIZE_CHARS,
        });

        if (input.useSandbox) {
          logger.debug(
            '[AI Router] Creating/getting E2B sandbox before generation'
          );
          const sandboxResult = await sandboxManager.getOrCreateSandbox(
            ctx.db,
            input.projectId,
            ctx.auth.userId,
            E2B_CONFIG.maxTimeoutMs
          );

          if (sandboxResult.success && sandboxResult.data) {
            sandboxId = sandboxResult.data.id;
            sandboxInstance = sandboxResult.data.instance;
            logger.debug(`[AI Router] Using sandbox: ${sandboxId}`);

            logger.debug('[AI Router] Setting up infrastructure in sandbox');
            const infraResult = await setupInfrastructure(
              sandboxResult.data.instance,
              project.name
            );

            if (infraResult.success) {
              logger.debug(
                '[AI Router] Infrastructure ready - running npm install'
              );
              try {
                logger.debug('[AI Router] Installing dependencies...');
                await sandboxResult.data.instance.commands.run(
                  'cd /project && npm install',
                  { timeoutMs: TIMEOUTS.NPM_INSTALL_MS }
                );
                logger.debug(
                  '[AI Router] Dependencies installed - sandbox ready for Claude'
                );
              } catch (installError) {
                logger.warn(
                  '[AI Router] npm install failed (will retry during preview):',
                  installError
                );
              }
            } else {
              logger.warn(
                `[AI Router] Failed to setup infrastructure: ${infraResult.error}`
              );
            }
          } else {
            logger.warn(
              `[AI Router] Failed to create sandbox: ${sandboxResult.error}`
            );
          }
        }
      }

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
          logger.warn('[AI] Critical conflicts detected:', conflicts);
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
          model: selectedModel,
          clerkUserId: ctx.auth.userId,
          projectId: input.projectId ?? null,
          sessionId: result.data.sessionId ?? null,
          totalCost: result.data.totalCost ?? null,
        },
      });

      await Promise.all([
        rateLimiter.incrementCount(ctx.auth.userId),
        UsageTrackingService.incrementGenerationCount(ctx.auth.userId),
      ]);

      logger.debug(`[AI Router] Generation result:`, {
        filesGenerated: result.data.files.length,
        filesPaths: result.data.files.map((f) => f.path),
        hasProjectId: !!input.projectId,
        usedSandbox: !!sandboxId,
        hasInstance: !!sandboxInstance,
      });

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
          logger.error('[AI Router] Error saving files to database:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save generated files to database',
          });
        }
      } else {
        logger.debug(
          '[AI Router] No projectId provided - skipping database save'
        );
      }

      return {
        ...result.data,
        databaseId: aiGeneration.id,
        sandboxId,
        conflicts,
        warning,
      };
    }),
});
