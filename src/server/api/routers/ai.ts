/**
 * AI Generation Router
 *
 * Handles AI code generation requests, history management, and rate limiting.
 */

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
import type { UserPlan, ProjectContext } from '~/lib/integrations/claude';
import { sandboxManager } from '~/lib/integrations/e2b/services/sandbox-manager';
import { FileSync } from '~/lib/integrations/e2b/services/file-sync';

export const aiRouter = createTRPCRouter({
  generateCode: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1, 'Prompt cannot be empty'),
        projectId: z.string().optional(),
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

      // Get user plan (default to 'free' since there's no User model yet)
      const userPlan: UserPlan = 'free';

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

      let context: ProjectContext | undefined;
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

        const gatherer = new ProjectContextGatherer(ctx.db);
        context = await gatherer.gatherContext(input.projectId, {
          maxFiles: 5, // Limit for token efficiency
          maxFileSize: 3000,
        });
      }

      const result = await claudeClient.generateCode({
        prompt: input.prompt,
        projectId: input.projectId,
        context,
      });

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
          clerkUserId: ctx.auth.userId,
          projectId: input.projectId ?? null,
          sessionId: result.data.sessionId ?? null,
          totalCost: result.data.totalCost ?? null,
        },
      });

      await rateLimiter.incrementCount(ctx.auth.userId);

      let syncStatus: 'not_attempted' | 'success' | 'partial' | 'failed' =
        'not_attempted';
      if (input.projectId && result.data.files.length > 0) {
        try {
          // Get or create sandbox for project
          const sandboxResult = await sandboxManager.getOrCreateSandbox(
            ctx.db,
            input.projectId,
            ctx.auth.userId
          );

          if (sandboxResult.success && sandboxResult.data) {
            console.log(
              `[AI Router] Syncing ${result.data.files.length} generated file(s) to sandbox`
            );

            // Get the file IDs that were just generated
            // Note: We need to fetch the files that were saved from this generation
            const savedFiles = await ctx.db.file.findMany({
              where: {
                projectId: input.projectId,
                path: {
                  in: result.data.files.map((f) => f.path),
                },
              },
            });

            if (savedFiles.length > 0) {
              // Sync the files to sandbox
              const syncResult = await FileSync.syncIncrementalFiles(
                sandboxResult.data.instance,
                sandboxResult.data.id,
                savedFiles.map((f) => f.id),
                ctx.db
              );

              if (syncResult.success && syncResult.data) {
                if (syncResult.data.failedFiles.length === 0) {
                  syncStatus = 'success';
                  console.log(
                    `[AI Router] Successfully synced all ${syncResult.data.syncedFiles} file(s)`
                  );
                } else {
                  syncStatus = 'partial';
                  console.warn(
                    `[AI Router] Partial sync: ${syncResult.data.syncedFiles} succeeded, ${syncResult.data.failedFiles.length} failed`
                  );
                }
              } else {
                syncStatus = 'failed';
                console.error(
                  '[AI Router] File sync failed:',
                  syncResult.error
                );
              }
            }
          } else {
            console.warn(
              '[AI Router] Could not create/get sandbox for file sync:',
              sandboxResult.error
            );
          }
        } catch (error) {
          // Don't fail AI generation if sync fails
          console.error('[AI Router] Error during file sync:', error);
          syncStatus = 'failed';
        }
      }

      return {
        ...result.data,
        databaseId: aiGeneration.id,
        conflicts,
        warning,
        syncStatus, // Return sync status to frontend
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
    // Get user plan (default to 'free' since there's no User model yet)
    const userPlan: UserPlan = 'free';

    // Get usage stats
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
});
