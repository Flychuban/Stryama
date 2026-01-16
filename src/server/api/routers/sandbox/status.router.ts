import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';

export const statusRouter = createTRPCRouter({
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
   * Get detailed sandbox information
   */
  getInfo: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
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

  /**
   * Get project sandbox status and health
   * Used to check if project's sandbox is alive or expired
   */
  getProjectStatus: protectedProcedure
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

      if (!sandbox) {
        return {
          hasActiveSandbox: false,
          isExpired: true,
          status: 'STOPPED' as const,
          sandboxId: null,
        };
      }

      const isExpired = sandbox.expiresAt
        ? sandbox.expiresAt < new Date()
        : false;

      if (isExpired) {
        await ctx.db.sandbox.update({
          where: { id: sandbox.id },
          data: { status: 'STOPPED' },
        });

        return {
          hasActiveSandbox: false,
          isExpired: true,
          status: 'STOPPED' as const,
          sandboxId: sandbox.id,
        };
      }

      return {
        hasActiveSandbox: true,
        isExpired: false,
        status: sandbox.status,
        sandboxId: sandbox.id,
        expiresAt: sandbox.expiresAt,
      };
    }),
});
