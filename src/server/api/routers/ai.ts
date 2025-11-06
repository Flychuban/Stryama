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
import type { Sandbox } from '@e2b/code-interpreter';

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
              project.framework,
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
        usedSandbox: !!sandboxId,
        hasInstance: !!sandboxInstance,
      });

      // Save generated files to database
      if (input.projectId) {
        try {
          let filesToSave: Array<{
            path: string;
            content: string;
            language: string;
          }> = [...result.data.files];

          // If using E2B mode and no files in response, read from sandbox
          if (sandboxId && sandboxInstance && result.data.files.length === 0) {
            console.log(
              '[AI Router] 🔄 E2B mode: No files in response, reading from sandbox filesystem...'
            );

            const sandboxFilesResult =
              await sandboxManager.readAllFiles(sandboxInstance);

            if (sandboxFilesResult.success && sandboxFilesResult.data) {
              filesToSave = sandboxFilesResult.data;
              console.log(
                `[AI Router] ✅ Found ${filesToSave.length} files in sandbox to save:`,
                filesToSave.map((f) => f.path)
              );
            } else {
              console.error(
                `[AI Router] ❌ Failed to read files from sandbox: ${sandboxFilesResult.error}`
              );
            }
          } else if (
            sandboxId &&
            !sandboxInstance &&
            result.data.files.length === 0
          ) {
            console.error(
              '[AI Router] ❌ CRITICAL: Sandbox ID exists but instance is missing - cannot read files',
              {
                sandboxId,
                hasSandboxId: !!sandboxId,
                hasInstance: !!sandboxInstance,
              }
            );
          } else if (result.data.files.length > 0) {
            console.log(
              `[AI Router] ✅ Using ${result.data.files.length} files from Claude response`
            );
          }

          if (filesToSave.length > 0) {
            console.log(
              `[AI Router] 💾 Saving ${filesToSave.length} file(s) to database for project ${input.projectId}`
            );

            // Use upsert to handle both creation and updates
            await Promise.all(
              filesToSave.map((file) =>
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
              `[AI Router] ✅ Successfully saved ${filesToSave.length} file(s) to database:`,
              filesToSave.map((f) => `${f.path} (${f.language})`)
            );
          } else {
            console.warn(
              '[AI Router] ⚠️ No files to save to database - this may cause issues when regenerating preview'
            );
          }
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
