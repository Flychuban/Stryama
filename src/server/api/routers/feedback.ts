import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { FeedbackType, FeedbackStatus } from '@prisma/client';
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from '~/server/api/trpc';
import { clerkClient } from '@clerk/nextjs/server';
import { getUserPlanFromClerk, isAdmin } from '~/lib/clerk/authorization';

export const feedbackRouter = createTRPCRouter({
  /**
   * Check if current user is an admin
   * Available to all authenticated users
   */
  checkIsAdmin: protectedProcedure.query(async () => {
    return await isAdmin();
  }),
  /**
   * Create new feedback
   * Available to all authenticated users
   */
  create: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(FeedbackType),
        message: z
          .string()
          .min(10, 'Message must be at least 10 characters')
          .max(2000, 'Message must be less than 2000 characters'),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user email from Clerk
      const client = await clerkClient();
      const user = await client.users.getUser(ctx.auth.userId);
      const userEmail = user.emailAddresses[0]?.emailAddress ?? 'unknown';

      // Get user's subscription plan
      const userPlan = await getUserPlanFromClerk();

      // Create feedback with enriched metadata
      const feedback = await ctx.db.feedback.create({
        data: {
          clerkUserId: ctx.auth.userId,
          type: input.type,
          message: input.message,
          metadata: {
            ...(input.metadata ?? {}),
            userEmail,
            userPlan,
            submittedAt: new Date().toISOString(),
          },
        },
      });

      return feedback;
    }),

  /**
   * Get all feedback submitted by the current user
   * Available to authenticated users
   */
  getMyFeedback: protectedProcedure.query(async ({ ctx }) => {
    const feedback = await ctx.db.feedback.findMany({
      where: {
        clerkUserId: ctx.auth.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return feedback;
  }),

  /**
   * Get all feedback (admin only)
   * Supports filtering by type and status
   */
  getAll: adminProcedure
    .input(
      z
        .object({
          type: z.nativeEnum(FeedbackType).optional(),
          status: z.nativeEnum(FeedbackStatus).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const feedback = await ctx.db.feedback.findMany({
        where: {
          ...(input?.type && { type: input.type }),
          ...(input?.status && { status: input.status }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return feedback;
    }),

  /**
   * Get single feedback by ID (admin only)
   */
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const feedback = await ctx.db.feedback.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!feedback) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        });
      }

      return feedback;
    }),

  /**
   * Update feedback status (admin only)
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(FeedbackStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.db.feedback.update({
        where: {
          id: input.id,
        },
        data: {
          status: input.status,
        },
      });

      return feedback;
    }),

  /**
   * Get feedback statistics (admin only)
   * Returns counts by type and status
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [total, byType, byStatus] = await Promise.all([
      // Total count
      ctx.db.feedback.count(),

      // Count by type
      ctx.db.feedback.groupBy({
        by: ['type'],
        _count: true,
      }),

      // Count by status
      ctx.db.feedback.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      total,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<FeedbackType, number>
      ),
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<FeedbackStatus, number>
      ),
    };
  }),
});
