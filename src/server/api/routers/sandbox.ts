import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';
import { E2B_CONFIG } from '~/lib/integrations/e2b';
import { FileSync } from '~/lib/integrations/e2b/services/file-sync';
import {
  startPreviewServer,
  getPreviewLogs,
  restartPreviewServer,
} from '~/lib/integrations/e2b/services/preview-manager';
import { sandboxPool } from '~/lib/integrations/e2b/services/sandbox-pool';
import { logStreamer } from '~/lib/integrations/e2b/services/log-streamer';

export const sandboxRouter = createTRPCRouter({
  /**
   * Get existing sandbox or create new one for a project
   */
  getOrCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
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

      // Get or create sandbox
      const result = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to create sandbox',
        });
      }

      return {
        sandboxId: result.data.id,
        e2bId: result.data.e2bId,
        status: result.data.status,
        expiresAt: result.data.expiresAt,
      };
    }),

  /**
   * Get sandbox status and health
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership through project
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.getHealth(ctx.db, input.sandboxId);

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to get sandbox status',
        });
      }

      return result.data;
    }),

  /**
   * Destroy a sandbox
   */
  destroy: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.destroySandbox(
        ctx.db,
        input.sandboxId
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to destroy sandbox',
        });
      }

      return { success: true };
    }),

  /**
   * Extend sandbox timeout
   */
  extendTimeout: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        additionalMs: z
          .number()
          .min(60_000, 'Minimum extension is 1 minute')
          .max(E2B_CONFIG.maxTimeoutMs, 'Extension exceeds maximum allowed'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.extendTimeout(
        ctx.db,
        input.sandboxId,
        input.additionalMs
      );

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to extend timeout',
        });
      }

      return {
        newExpiresAt: result.data,
      };
    }),

  /**
   * Get detailed sandbox information
   */
  getInfo: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      return {
        id: sandbox.id,
        e2bId: sandbox.e2bId,
        status: sandbox.status,
        projectId: sandbox.projectId,
        templateId: sandbox.templateId,
        previewUrl: sandbox.previewUrl,
        lastActivity: sandbox.lastActivity,
        expiresAt: sandbox.expiresAt,
        createdAt: sandbox.createdAt,
        metadata: sandbox.metadata,
      };
    }),

  syncFiles: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        fileIds: z.array(z.string()).optional(), // If not provided, sync all files
        syncType: z.enum(['all', 'incremental', 'changed']).default('all'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
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

      // Get or create sandbox
      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

      // Perform sync based on type
      let syncResult;
      switch (input.syncType) {
        case 'all':
          syncResult = await FileSync.syncAllFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.projectId,
            ctx.db
          );
          break;

        case 'incremental':
          if (!input.fileIds || input.fileIds.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'fileIds required for incremental sync',
            });
          }
          syncResult = await FileSync.syncIncrementalFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.fileIds,
            ctx.db
          );
          break;

        case 'changed':
          syncResult = await FileSync.syncChangedFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.projectId,
            ctx.db
          );
          break;

        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid sync type',
          });
      }

      if (!syncResult.success || !syncResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: syncResult.error ?? 'Failed to sync files',
        });
      }

      return {
        sandboxId: sandboxResult.data.id,
        totalFiles: syncResult.data.totalFiles,
        syncedFiles: syncResult.data.syncedFiles,
        failedFiles: syncResult.data.failedFiles,
        duration: syncResult.data.duration,
        timestamp: syncResult.data.timestamp,
      };
    }),

  startPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
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

      // Get or create sandbox
      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

      // Start preview server
      const previewResult = await startPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to start preview server',
        });
      }

      // Get current sandbox metadata from database
      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      // Update sandbox with preview URL in database
      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewFramework: previewResult.data.framework,
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        framework: previewResult.data.framework,
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
      // Verify project ownership and get sandbox
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
          framework: null,
          port: null,
        };
      }

      const metadata = sandbox.metadata as Record<string, unknown> | null;

      return {
        url: sandbox.previewUrl,
        framework: metadata?.previewFramework as string | null,
        port: metadata?.previewPort as number | null,
      };
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
      // Verify project ownership
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

      // Get sandbox
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

      // Get preview logs
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
      // Verify project ownership
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

      // Get sandbox
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

      // Restart preview server
      const previewResult = await restartPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to restart preview server',
        });
      }

      // Get current sandbox metadata from database
      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      // Update sandbox with new preview URL
      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewFramework: previewResult.data.framework,
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        framework: previewResult.data.framework,
        port: previewResult.data.port,
        sandboxId: sandboxResult.data.id,
      };
    }),

  pause: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.pauseSandbox(ctx.db, input.sandboxId);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to pause sandbox',
        });
      }

      return { success: true };
    }),

  resume: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.resumeSandbox(
        ctx.db,
        input.sandboxId
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to resume sandbox',
        });
      }

      return { success: true };
    }),

  release: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.releaseToPool(
        ctx.db,
        input.sandboxId
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to release sandbox to pool',
        });
      }

      return { success: true, pooled: result.data ?? false };
    }),

  getPoolStatus: protectedProcedure.query(async ({ ctx }) => {
    const status = await sandboxPool.getStatus(ctx.db);

    return {
      totalPooled: status.totalPooled,
      available: status.available,
      assigned: status.assigned,
      metrics: {
        poolHitRate: status.metrics.poolHitRate,
        avgResumeTime: status.metrics.avgResumeTime,
        totalAssignments: status.metrics.totalAssignments,
        totalCreations: status.metrics.totalCreations,
      },
    };
  }),

  /**
   * Subscribe to real-time console logs for a sandbox
   * Uses tRPC subscriptions to stream log entries as they arrive
   */
  subscribeLogs: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        includeHistory: z.boolean().default(true),
      })
    )
    .subscription(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      // Create observable from async iterator
      return observable<{
        id: string;
        sandboxId: string;
        level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
        message: string;
        timestamp: number;
        source?: 'preview' | 'build' | 'install' | 'command';
      }>((emit) => {
        // Start streaming logs
        const streamLogs = async () => {
          try {
            for await (const log of logStreamer.subscribe(
              input.sandboxId,
              input.includeHistory
            )) {
              emit.next(log);
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Log streaming error: ${errorMessage}`,
              })
            );
          }
        };

        void streamLogs();

        // Cleanup on unsubscribe
        return () => {
          // The async iterator cleanup happens automatically when the generator is closed
          console.log(
            `[Logs] Client unsubscribed from sandbox ${input.sandboxId}`
          );
        };
      });
    }),

  /**
   * Get historical logs for a sandbox (non-streaming)
   */
  getLogHistory: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        limit: z.number().min(1).max(1000).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const logs = logStreamer.getHistory(input.sandboxId, input.limit);

      return {
        logs,
        total: logs.length,
      };
    }),

  /**
   * Clear all logs for a sandbox
   */
  clearLogs: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      logStreamer.clearLogs(input.sandboxId);

      return { success: true };
    }),

  /**
   * Get log streaming statistics
   */
  getLogStats: protectedProcedure.query(() => {
    const stats = logStreamer.getStats();

    return {
      activeBuffers: stats.activeBuffers,
      activeSubscribers: stats.activeSubscribers,
      totalLogs: stats.totalLogs,
    };
  }),
});
