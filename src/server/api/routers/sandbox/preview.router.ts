import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';
import { E2B_CONFIG } from '~/lib/integrations/e2b';
import { FileSync } from '~/lib/integrations/e2b/services/file-sync';
import {
  startPreviewServer,
  getPreviewLogs,
  restartPreviewServer,
  isPreviewHealthy,
} from '~/lib/integrations/e2b/services/preview';
import { logger } from '~/lib/utils/logger';

export const previewRouter = createTRPCRouter({
  /**
   * Start preview server for a project
   */
  startPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        sandboxId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          files: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      let sandboxResult;

      if (input.sandboxId) {
        logger.debug(
          `[Preview] Using specific sandbox from AI generation: ${input.sandboxId}`
        );

        const dbSandbox = await ctx.db.sandbox.findUnique({
          where: { id: input.sandboxId },
        });

        if (!dbSandbox) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Sandbox not found',
          });
        }

        let instance = sandboxManager.getCachedInstance(input.sandboxId);

        if (!instance) {
          const { Sandbox } = await import('@e2b/code-interpreter');
          const { E2B_CONFIG } = await import('~/lib/integrations/e2b/config');

          instance = await Sandbox.connect(dbSandbox.e2bId, {
            apiKey: E2B_CONFIG.apiKey,
            timeoutMs: E2B_CONFIG.maxTimeoutMs,
          });
        }

        sandboxResult = {
          success: true,
          data: {
            id: dbSandbox.id,
            e2bId: dbSandbox.e2bId,
            status: dbSandbox.status,
            expiresAt: dbSandbox.expiresAt,
            instance,
          },
          error: null,
        };
      } else {
        logger.debug(
          `[Preview] No sandboxId provided, using getOrCreateSandbox`
        );
        sandboxResult = await sandboxManager.getOrCreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId
        );
      }

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

      logger.debug(
        `[Preview] Starting preview server (files already in sandbox from MCP tools)`
      );

      const previewResult = await startPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files,
        sandboxResult.data.id
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to start preview server',
        });
      }

      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        port: previewResult.data.port,
        sandboxId: sandboxResult.data.id,
      };
    }),

  /**
   * Get existing preview URL for a project
   */
  getPreviewUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          sandboxes: {
            where: {
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      const sandbox = project.sandboxes[0];

      if (!sandbox?.previewUrl) {
        return {
          url: null,
          port: null,
        };
      }

      const metadata = sandbox.metadata as Record<string, unknown> | null;

      return {
        url: sandbox.previewUrl,
        port: metadata?.previewPort as number | null,
      };
    }),

  /**
   * Regenerate preview from database files
   */
  regeneratePreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      logger.debug(
        `[Sandbox Router] 🔄 Regenerating preview for project: ${input.projectId}`
      );

      try {
        const project = await ctx.db.project.findUnique({
          where: {
            id: input.projectId,
            clerkUserId: ctx.auth.userId,
          },
          include: {
            files: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or access denied',
          });
        }

        if (project.files.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'No files found for this project. Please generate code first.',
          });
        }

        logger.debug(
          `[Sandbox Router] Found ${project.files.length} files to sync`
        );

        logger.debug(
          `[Sandbox Router] Creating fresh sandbox for regeneration (ensures clean npm environment)...`
        );
        const sandboxResult = await sandboxManager.recreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId,
          E2B_CONFIG.maxTimeoutMs
        );

        if (!sandboxResult.success || !sandboxResult.data) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: sandboxResult.error ?? 'Failed to create sandbox',
          });
        }

        const { instance: sandbox, id: sandboxId } = sandboxResult.data;

        logger.debug(`[Sandbox Router] Sandbox ready: ${sandboxId}`);

        logger.debug(`[Sandbox Router] 📂 Syncing files to sandbox...`);

        const fileSyncResult = await FileSync.syncAllFiles(
          sandbox,
          sandboxId,
          input.projectId,
          ctx.db
        );

        if (!fileSyncResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: fileSyncResult.error ?? 'Failed to sync files to sandbox',
          });
        }

        logger.debug(
          `[Sandbox Router] ✅ Synced ${fileSyncResult.data?.syncedFiles ?? 0} files`
        );

        logger.debug(`[Sandbox Router] 🚀 Starting preview server...`);

        const previewResult = await startPreviewServer(
          sandbox,
          input.projectId,
          project.files,
          sandboxId,
          true
        );

        if (!previewResult.success || !previewResult.data) {
          const errorMsg =
            previewResult.error ?? 'Failed to start preview server';

          if (errorMsg.includes('npm command not found')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message:
                'npm command not found in sandbox environment. Please try regenerating the preview again.',
            });
          }

          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('deadline_exceeded')
          ) {
            throw new TRPCError({
              code: 'TIMEOUT',
              message:
                'Preview generation timed out while installing dependencies. This usually happens with large projects. Please try again or contact support if the issue persists.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMsg,
          });
        }

        logger.debug(`[Sandbox Router] 💾 Saving preview URL to database...`);
        await ctx.db.sandbox.update({
          where: { id: sandboxId },
          data: {
            previewUrl: previewResult.data.url,
            lastActivity: new Date(),
          },
        });
        logger.debug(`[Sandbox Router] ✅ Preview URL saved to database`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.debug(
          `[Sandbox Router] ✅ Preview ready in ${duration}s: ${previewResult.data.url}`
        );

        return {
          url: previewResult.data.url,
          sandboxId,
          filesSynced: fileSyncResult.data?.syncedFiles ?? 0,
        };
      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(
          `[Sandbox Router] ❌ Preview regeneration failed after ${duration}s:`,
          error
        );

        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof Error) {
          const errorMsg = error.message;

          if (
            errorMsg.includes('npm command not found') ||
            errorMsg.includes('exit status 127') ||
            errorMsg.includes('command not found')
          ) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message:
                'npm command not found in sandbox environment. Please try regenerating the preview again.',
            });
          }

          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('deadline_exceeded')
          ) {
            throw new TRPCError({
              code: 'TIMEOUT',
              message:
                'Operation timed out. The preview server took too long to start (likely due to npm install). Please try again.',
            });
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during preview regeneration',
        });
      }
    }),

  /**
   * Reconnect to warm sandbox and reuse preview if healthy
   */
  reconnectPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      logger.debug(
        `[Sandbox Router] 🔄 Attempting to reconnect to warm sandbox for project: ${input.projectId}`
      );

      try {
        const project = await ctx.db.project.findUnique({
          where: {
            id: input.projectId,
            clerkUserId: ctx.auth.userId,
          },
          include: {
            files: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or access denied',
          });
        }

        if (project.files.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'No files found for this project. Please generate code first.',
          });
        }

        logger.debug(
          `[Sandbox Router] Found ${project.files.length} files for project`
        );

        logger.debug(
          `[Sandbox Router] Attempting to reconnect to existing sandbox...`
        );
        const sandboxResult = await sandboxManager.getOrCreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId,
          E2B_CONFIG.maxTimeoutMs
        );

        if (!sandboxResult.success || !sandboxResult.data) {
          logger.error(
            `[Sandbox Router] Failed to get/create sandbox:`,
            sandboxResult.error
          );
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message:
              sandboxResult.error ?? 'Failed to connect to sandbox environment',
          });
        }

        const sandbox = sandboxResult.data.instance;
        const sandboxId = sandboxResult.data.id;
        logger.debug(
          `[Sandbox Router] Successfully connected to sandbox: ${sandboxId}`
        );

        const existingPreview = await ctx.db.sandbox.findUnique({
          where: { id: sandboxId },
          select: { previewUrl: true, metadata: true },
        });

        if (existingPreview?.previewUrl) {
          logger.debug(
            `[Sandbox Router] 🔍 Found existing preview URL, validating health...`
          );
          logger.debug(
            `[Sandbox Router] Preview URL: ${existingPreview.previewUrl}`
          );

          const healthStartTime = Date.now();
          const isHealthy = await isPreviewHealthy(existingPreview.previewUrl);
          const healthDuration = Date.now() - healthStartTime;

          if (isHealthy) {
            const totalDuration = Date.now() - startTime;
            logger.debug(
              `[Sandbox Router] ✅ Warm sandbox reconnected successfully! (health check: ${healthDuration}ms, total: ${totalDuration}ms)`
            );
            return {
              url: existingPreview.previewUrl,
              sandboxId,
              reconnected: true,
            };
          }

          logger.debug(
            `[Sandbox Router] ❌ Preview server not responding (checked in ${healthDuration}ms), needs restart`
          );
        } else {
          logger.debug(
            `[Sandbox Router] No existing preview URL found, starting new server`
          );
        }

        logger.debug(
          `[Sandbox Router] 🚀 Starting preview server on reconnected sandbox...`
        );

        const previewResult = await startPreviewServer(
          sandbox,
          input.projectId,
          project.files,
          sandboxId,
          false
        );

        if (!previewResult.success || !previewResult.data) {
          logger.error(
            `[Sandbox Router] Failed to start preview server:`,
            previewResult.error
          );
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: previewResult.error ?? 'Failed to start preview server',
          });
        }

        await ctx.db.sandbox.update({
          where: { id: sandboxId },
          data: { previewUrl: previewResult.data.url },
        });

        const totalDuration = Date.now() - startTime;
        logger.debug(
          `[Sandbox Router] ✅ Preview server started on reconnected sandbox (${totalDuration}ms)`
        );
        logger.debug(`[Sandbox Router] Preview URL: ${previewResult.data.url}`);

        return {
          url: previewResult.data.url,
          sandboxId,
          reconnected: false,
        };
      } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(
          `[Sandbox Router] ❌ Reconnect preview failed after ${totalDuration}ms:`,
          error
        );

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during preview reconnection',
        });
      }
    }),

  /**
   * Get preview server logs
   */
  getPreviewLogs: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get sandbox',
        });
      }

      const logsResult = await getPreviewLogs(sandboxResult.data.instance);

      if (!logsResult.success || !logsResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: logsResult.error ?? 'Failed to get preview logs',
        });
      }

      return {
        logs: logsResult.data,
      };
    }),

  /**
   * Restart preview server
   */
  restartPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          files: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get sandbox',
        });
      }

      logger.debug(
        `[Preview] Restarting preview server (files already in sandbox from MCP tools)`
      );

      const previewResult = await restartPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files,
        sandboxResult.data.id
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to restart preview server',
        });
      }

      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        port: previewResult.data.port,
        sandboxId: sandboxResult.data.id,
      };
    }),
});
