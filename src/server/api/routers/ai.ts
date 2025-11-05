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
import { setupInfrastructure } from '~/lib/integrations/e2b/services/preview-manager';
import { E2B_CONFIG } from '~/lib/integrations/e2b/config';

export const aiRouter = createTRPCRouter({
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
      let sandboxId: string | undefined;
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
            console.log(`[AI Router] Using sandbox: ${sandboxId}`);

            // PHASE 2: Setup infrastructure BEFORE Claude runs
            // This creates package.json, vite.config.ts, tsconfig.json
            // Claude will create ALL application files (index.html, src/*, etc.)
            console.log('[AI Router] Setting up infrastructure in sandbox');
            const infraResult = await setupInfrastructure(
              sandboxResult.data.instance,
              project.framework,
              project.name
            );

            if (infraResult.success) {
              console.log(
                '[AI Router] ✅ Infrastructure ready - running npm install'
              );

              // Run npm install to prepare dependencies
              try {
                await sandboxResult.data.instance.commands.run(
                  'cd /project && npm install',
                  { timeoutMs: 180000 } // 3 minutes
                );
                console.log(
                  '[AI Router] ✅ Dependencies installed - sandbox ready for Claude'
                );
              } catch (installError) {
                console.warn(
                  '[AI Router] npm install failed (will retry during preview):',
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
          clerkUserId: ctx.auth.userId,
          projectId: input.projectId ?? null,
          sessionId: result.data.sessionId ?? null,
          totalCost: result.data.totalCost ?? null,
        },
      });

      await rateLimiter.incrementCount(ctx.auth.userId);

      // Enhanced logging for file generation
      console.log(`[AI Router] Generation result:`, {
        filesGenerated: result.data.files.length,
        filesPaths: result.data.files.map((f) => f.path),
        hasProjectId: !!input.projectId,
      });

      // Save generated files to database
      if (input.projectId && result.data.files.length > 0) {
        try {
          console.log(
            `[AI Router] Saving ${result.data.files.length} generated file(s) to database`
          );

          // Use upsert to handle both creation and updates
          await Promise.all(
            result.data.files.map((file) =>
              ctx.db.file.upsert({
                where: {
                  projectId_path: {
                    projectId: input.projectId!,
                    path: file.path,
                  },
                },
                create: {
                  path: file.path,
                  content: file.content,
                  language: file.language,
                  projectId: input.projectId!,
                },
                update: {
                  content: file.content,
                  language: file.language,
                  updatedAt: new Date(),
                },
              })
            )
          );

          console.log(
            `[AI Router] ✅ Successfully saved ${result.data.files.length} file(s) to database`
          );

          // NOTE: When using E2B sandbox mode, files are written directly to the sandbox
          // via MCP tools. No cleanup needed as files never touch the local filesystem.
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
      } else if (input.projectId && result.data.files.length === 0) {
        console.warn(
          '[AI Router] ⚠️ No files generated - nothing to save to database'
        );
      } else if (!input.projectId) {
        console.log(
          '[AI Router] No projectId provided - skipping database save'
        );
      }

      // NOTE: When using E2B sandbox mode, files are written directly to the sandbox
      // via Claude's MCP tools. No manual sync needed!
      // The database save is optional and kept for history/versioning purposes.

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
