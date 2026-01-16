import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { logStreamer } from '~/lib/integrations/e2b/services/log-streamer';
import { logger } from '~/lib/utils/logger';

export const logsRouter = createTRPCRouter({
  /**
   * Subscribe to real-time console logs for a sandbox
   */
  subscribeLogs: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        includeHistory: z.boolean().default(true),
      })
    )
    .subscription(async ({ ctx, input }) => {
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

      return observable<{
        id: string;
        sandboxId: string;
        level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
        message: string;
        timestamp: number;
        source?: 'preview' | 'build' | 'install' | 'command';
      }>((emit) => {
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

        return () => {
          logger.debug(
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
