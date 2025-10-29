import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';
import { E2B_CONFIG } from '~/lib/integrations/e2b';

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

      if (!sandbox || sandbox.project.clerkUserId !== ctx.auth.userId) {
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

      if (!sandbox || sandbox.project.clerkUserId !== ctx.auth.userId) {
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

      if (!sandbox || sandbox.project.clerkUserId !== ctx.auth.userId) {
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

      if (!sandbox || sandbox.project.clerkUserId !== ctx.auth.userId) {
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
});
