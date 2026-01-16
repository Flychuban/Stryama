import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { rateLimiter } from '~/lib/integrations/claude';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';

export const historyRouter = createTRPCRouter({
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
    const userPlan = await getUserPlanFromClerk();
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
