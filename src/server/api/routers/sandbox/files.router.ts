import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';
import { FileSync } from '~/lib/integrations/e2b/services/file-sync';

export const filesRouter = createTRPCRouter({
  /**
   * Sync files from database to sandbox
   */
  syncFiles: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        fileIds: z.array(z.string()).optional(),
        syncType: z.enum(['all', 'incremental', 'changed']).default('all'),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

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
});
