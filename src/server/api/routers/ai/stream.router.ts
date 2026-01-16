import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import {
  claudeClient,
  rateLimiter,
  ProjectContextGatherer,
} from '~/lib/integrations/claude';
import type { ProjectContext } from '~/lib/integrations/claude';
import type { StreamEvent } from '~/lib/integrations/claude/types/stream-events';
import { createSandboxEvent } from '~/lib/integrations/claude/stream-manager';
import { sandboxManager } from '~/lib/integrations/e2b/services/sandbox-manager';
import { setupInfrastructure } from '~/lib/integrations/e2b/services/preview';
import { E2B_CONFIG } from '~/lib/integrations/e2b/config';
import type { Sandbox } from '@e2b/code-interpreter';
import { UsageTrackingService } from '~/lib/services/usageTracking';
import { ModelSelectionService } from '~/lib/services/modelSelection';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
import { saveGeneratedFilesToDatabase } from '~/lib/integrations/e2b/utils/file-saver';
import { saveSessionToDB } from '~/lib/integrations/claude/session-cache';
import { logger } from '~/lib/utils/logger';
import { TIMEOUTS, FILE_LIMITS } from '~/lib/config/timeouts';
import type { PrismaClient, File } from '@prisma/client';

export const streamRouter = createTRPCRouter({
  streamGeneration: protectedProcedure
    .input(
      z.object({
        generationId: z.string(),
      })
    )
    .subscription(async ({ ctx, input }) => {
      logger.debug(
        `[AI Stream] Stream generation start - ID: ${input.generationId}`
      );

      const generation = await ctx.db.aIGeneration.findFirst({
        where: {
          id: input.generationId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!generation) {
        logger.error(`[AI Stream] Generation not found: ${input.generationId}`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Generation not found or you do not have access to it',
        });
      }

      logger.debug(`[AI Stream] Generation record found`);
      const prompt = generation.prompt;
      const projectId = generation.projectId ?? undefined;
      const useSandbox = true;

      const userPlan = await getUserPlanFromClerk();
      const selectedModel = ModelSelectionService.selectModel(prompt, userPlan);
      const modelId = ModelSelectionService.getModelId(selectedModel);

      logger.debug(
        `[AI Stream] Using model: ${selectedModel} (${modelId}) for plan: ${userPlan}`
      );

      return observable<StreamEvent>((emit) => {
        const streamGeneration = async () => {
          try {
            let context: ProjectContext | undefined;
            let sessionId: string | undefined;
            let sandboxId: string | undefined;
            let sandboxInstance: Sandbox | undefined;
            let project: Awaited<ReturnType<typeof ctx.db.project.findFirst>> =
              null;

            let completionResult: {
              content: string;
              sessionId: string;
              tokensUsed: number;
              totalCost: number;
              duration: number;
            } | null = null;

            if (projectId) {
              logger.debug(`[AI Stream] Looking up project: ${projectId}...`);
              project = await ctx.db.project.findFirst({
                where: {
                  id: projectId,
                  clerkUserId: ctx.auth.userId,
                },
              });

              if (!project) {
                logger.error(`[AI Stream] Project not found: ${projectId}`);
                emit.error(
                  new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                      'Project not found or you do not have access to it',
                  })
                );
                return;
              }

              logger.debug(`[AI Stream] Project found: "${project.name}"`);

              const lastGeneration = await ctx.db.aIGeneration.findFirst({
                where: {
                  projectId: projectId,
                  sessionId: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                select: { sessionId: true },
              });

              sessionId = lastGeneration?.sessionId ?? undefined;

              if (sessionId) {
                logger.debug(`[AI Stream] Found previous session ${sessionId}`);
              } else {
                logger.debug(
                  `[AI Stream] No previous session - starting fresh`
                );
              }

              logger.debug(`[AI Stream] Gathering project context...`);
              const gatherer = new ProjectContextGatherer(ctx.db);
              context = await gatherer.gatherContext(projectId, {
                maxFiles: FILE_LIMITS.MAX_CONTEXT_FILES,
                maxFileSize: FILE_LIMITS.MAX_FILE_SIZE_CHARS,
              });
              logger.debug(
                `[AI Stream] Context gathered: ${context.existingFiles?.length ?? 0} files`
              );

              if (useSandbox) {
                logger.debug(`[AI Stream] Starting sandbox setup...`);
                emit.next(
                  createSandboxEvent(
                    'creating',
                    undefined,
                    'Creating development environment'
                  )
                );

                const sandboxResult = await Sentry.startSpan(
                  {
                    name: 'e2b.sandbox.getOrCreate',
                    op: 'sandbox.create',
                    attributes: {
                      'sandbox.provider': 'e2b',
                      'sandbox.project_id': projectId,
                    },
                  },
                  async () =>
                    await sandboxManager.getOrCreateSandbox(
                      ctx.db,
                      projectId,
                      ctx.auth.userId,
                      E2B_CONFIG.maxTimeoutMs
                    )
                );

                if (!sandboxResult.success || !sandboxResult.data) {
                  logger.error(
                    `[AI Stream] Sandbox creation failed: ${sandboxResult.error}`
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

                logger.debug(`[AI Stream] Sandbox ready - ID: ${sandboxId}`);
                emit.next(
                  createSandboxEvent('created', sandboxId, 'Environment ready')
                );

                logger.debug(`[AI Stream] Setting up infrastructure...`);
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
                  logger.debug(`[AI Stream] Infrastructure setup complete`);
                  try {
                    logger.debug(`[AI Stream] Installing dependencies...`);
                    await sandboxInstance.commands.run(
                      'cd /project && npm install',
                      {
                        timeoutMs: TIMEOUTS.NPM_INSTALL_MS,
                      }
                    );
                    logger.debug(`[AI Stream] npm install completed`);
                    emit.next(
                      createSandboxEvent(
                        'deps_installed',
                        sandboxId,
                        'Dependencies installed'
                      )
                    );
                  } catch (installError) {
                    logger.error(
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
                } else {
                  logger.error(
                    `[AI Stream] Infrastructure setup failed: ${infraResult.error}`
                  );
                }

                logger.debug(`[AI Stream] Sandbox fully configured`);
                emit.next(
                  createSandboxEvent(
                    'setup_complete',
                    sandboxId,
                    'Environment ready'
                  )
                );
              }
            } else {
              logger.debug(`[AI Stream] No project ID - using empty context`);
              context = { existingFiles: [], dependencies: [] };
            }

            logger.debug('[AI Stream] Starting Claude stream...');

            const streamIterator = await Sentry.startSpan(
              {
                name: 'claude.generateCodeStreaming',
                op: 'ai.chat',
                attributes: {
                  'ai.model': selectedModel,
                  'ai.provider': 'anthropic',
                  'ai.prompt_length': prompt.length,
                },
              },
              async () =>
                claudeClient.generateCodeStreaming(
                  {
                    prompt: prompt,
                    context,
                    sessionId,
                  },
                  ctx.db,
                  sandboxId
                )
            );
            logger.debug(`[AI Stream] Stream iterator created`);

            let eventCount = 0;
            for await (const event of streamIterator) {
              eventCount++;
              emit.next(event);

              if (event.type === 'complete' && event.result) {
                logger.debug(`[AI Stream] Completion event received`);
                completionResult = event.result;
              }
            }

            logger.debug(`[AI Stream] Stream completed - ${eventCount} events`);

            if (completionResult && projectId && project) {
              logger.debug(`[AI Stream] Saving to database...`);

              try {
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
                logger.debug(`[AI Stream] AI generation saved to database`);

                if (completionResult.sessionId) {
                  logger.debug(
                    `[AI Stream] Saving session ${completionResult.sessionId}...`
                  );
                  await saveSessionToDB(ctx.db, completionResult.sessionId);
                }

                logger.debug(`[AI Stream] Saving generated files...`);
                await Sentry.startSpan(
                  {
                    name: 'database.saveGeneratedFiles',
                    op: 'db.operation',
                    attributes: {
                      'db.operation': 'upsert',
                      'project.id': projectId,
                    },
                  },
                  async () =>
                    await saveGeneratedFilesToDatabase(
                      ctx.db,
                      projectId,
                      sandboxInstance,
                      [],
                      '[AI Stream]'
                    )
                );
                logger.debug(`[AI Stream] Files saved to database`);

                if (sandboxInstance && sandboxId) {
                  await handlePreviewServer(
                    ctx.db,
                    sandboxId,
                    sandboxInstance,
                    projectId,
                    emit
                  );
                }

                await Promise.all([
                  rateLimiter.incrementCount(ctx.auth.userId),
                  UsageTrackingService.incrementGenerationCount(
                    ctx.auth.userId
                  ),
                ]);
                logger.debug(`[AI Stream] Usage counters updated`);

                logger.debug(`[AI Stream] Database save complete`);

                emit.next({
                  type: 'database_persisted',
                  sessionId: completionResult.sessionId,
                  projectId,
                  timestamp: Date.now(),
                  message: 'All database operations complete - safe to refetch',
                });
              } catch (dbError) {
                logger.error(
                  '[AI Stream] Failed to persist to database:',
                  dbError
                );
              }
            } else {
              logger.warn(
                `[AI Stream] Skipping database save - missing required data`
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 500));

            logger.debug(`[AI Stream] Emitting completion...`);
            emit.complete();
            logger.debug(`[AI Stream] Stream generation end`);
          } catch (error) {
            logger.error('[AI Stream] Unhandled error:', error);
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message:
                  error instanceof Error ? error.message : 'Stream error',
              })
            );
          }
        };

        logger.debug(
          `[AI Stream] Launching async streamGeneration function...`
        );
        void streamGeneration();

        return () => {
          logger.debug(
            `[AI Stream] Client disconnected - cleaning up subscription`
          );
        };
      });
    }),
});

type DbClient = PrismaClient;

async function handlePreviewServer(
  db: DbClient,
  sandboxId: string,
  sandboxInstance: Sandbox,
  projectId: string,
  emit: { next: (event: StreamEvent) => void }
) {
  logger.debug(`[AI Stream] Checking preview server status...`);

  const dbSandbox = await db.sandbox.findUnique({
    where: { id: sandboxId },
    select: { previewUrl: true, createdAt: true, metadata: true },
  });

  let serverIsHealthy = false;

  if (dbSandbox?.previewUrl) {
    logger.debug(`[AI Stream] URL exists in DB, performing health check...`);
    try {
      const { isPreviewHealthy } = await import(
        '~/lib/integrations/e2b/services/preview'
      );
      serverIsHealthy = await isPreviewHealthy(dbSandbox.previewUrl);
      logger.debug(
        `[AI Stream] Health check result: ${serverIsHealthy ? 'HEALTHY' : 'NOT HEALTHY'}`
      );
    } catch (healthError) {
      logger.error(`[AI Stream] Health check failed:`, healthError);
    }
  }

  const urlExistedBefore = !!dbSandbox?.previewUrl;

  if (urlExistedBefore) {
    if (serverIsHealthy && dbSandbox.previewUrl) {
      logger.debug(`[AI Stream] Server is healthy - no restart needed`);
      emit.next({
        type: 'status',
        status: 'executing',
        message: 'Preview server ready, loading preview...',
        timestamp: Date.now(),
      });

      emit.next({
        type: 'preview_url_updated',
        url: dbSandbox.previewUrl,
        sandboxId: sandboxId,
        message: 'Preview server is ready - Vite HMR will update automatically',
        timestamp: Date.now(),
        skipReload: false,
      });
    } else {
      logger.debug(`[AI Stream] Server has died - restarting...`);
      await restartPreviewServer(
        db,
        sandboxId,
        sandboxInstance,
        projectId,
        emit
      );
    }
  } else {
    logger.debug(`[AI Stream] First prompt - starting preview server...`);
    await startNewPreviewServer(
      db,
      sandboxId,
      sandboxInstance,
      projectId,
      emit
    );
  }
}

async function restartPreviewServer(
  db: DbClient,
  sandboxId: string,
  sandboxInstance: Sandbox,
  projectId: string,
  emit: { next: (event: StreamEvent) => void }
) {
  try {
    const updatedFiles: File[] = await db.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });

    logger.debug(`[AI Stream] Found ${updatedFiles.length} files to serve`);

    emit.next({
      type: 'status',
      status: 'executing',
      message: 'Restarting preview server with updated files...',
      timestamp: Date.now(),
    });

    const { startPreviewServer } = await import(
      '~/lib/integrations/e2b/services/preview'
    );

    const previewResult = await startPreviewServer(
      sandboxInstance,
      projectId,
      updatedFiles,
      sandboxId,
      true
    );

    if (!previewResult.success || !previewResult.data) {
      const errorMessage = `Preview server restart failed: ${previewResult.error}`;
      logger.error(`[AI Stream] ${errorMessage}`);
      emit.next({
        type: 'error',
        error: { message: errorMessage, code: 'PREVIEW_RESTART_FAILED' },
        timestamp: Date.now(),
      });
    } else {
      logger.debug(`[AI Stream] Preview server restarted successfully`);
      emit.next({
        type: 'preview_url_updated',
        url: previewResult.data.url,
        sandboxId: sandboxId,
        message: 'Dev server restarted with updated files',
        timestamp: Date.now(),
        skipReload: false,
      });
    }
  } catch (previewError) {
    const errorMessage =
      previewError instanceof Error
        ? previewError.message
        : 'Unknown preview restart error';
    logger.error(`[AI Stream] Preview restart exception: ${errorMessage}`);
    emit.next({
      type: 'error',
      error: {
        message: `Failed to restart preview server: ${errorMessage}`,
        code: 'PREVIEW_RESTART_EXCEPTION',
      },
      timestamp: Date.now(),
    });
  }
}

async function startNewPreviewServer(
  db: DbClient,
  sandboxId: string,
  sandboxInstance: Sandbox,
  projectId: string,
  emit: { next: (event: StreamEvent) => void }
) {
  try {
    const updatedFiles: File[] = await db.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });

    emit.next({
      type: 'status',
      status: 'executing',
      message: 'Starting preview server...',
      timestamp: Date.now(),
    });

    const { startPreviewServer } = await import(
      '~/lib/integrations/e2b/services/preview'
    );

    const previewResult = await startPreviewServer(
      sandboxInstance,
      projectId,
      updatedFiles,
      sandboxId,
      false
    );

    if (previewResult.success && previewResult.data) {
      await db.sandbox.update({
        where: { id: sandboxId },
        data: {
          previewUrl: previewResult.data.url,
          lastActivity: new Date(),
        },
      });

      logger.debug(`[AI Stream] Preview server started successfully`);
      emit.next({
        type: 'preview_url_updated',
        url: previewResult.data.url,
        sandboxId: sandboxId,
        message: 'Preview server started and ready',
        timestamp: Date.now(),
      });
    } else {
      const errorMessage = `Preview server start failed: ${previewResult.error}`;
      logger.error(`[AI Stream] ${errorMessage}`);
      emit.next({
        type: 'error',
        error: { message: errorMessage, code: 'PREVIEW_START_FAILED' },
        timestamp: Date.now(),
      });
    }
  } catch (previewError) {
    const errorMessage =
      previewError instanceof Error
        ? previewError.message
        : 'Unknown preview start error';
    logger.error(`[AI Stream] Preview start exception: ${errorMessage}`);
    emit.next({
      type: 'error',
      error: {
        message: `Failed to start preview server: ${errorMessage}`,
        code: 'PREVIEW_START_EXCEPTION',
      },
      timestamp: Date.now(),
    });
  }
}
