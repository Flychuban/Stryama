/**
 * Usage Router
 *
 * Handles user usage tracking and plan limit queries
 */

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { UsageTrackingService } from '~/lib/services/usageTracking';
import { PLAN_LIMITS, type UserPlan } from '~/types/pricing';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';

export const usageRouter = createTRPCRouter({
  /**
   * Get current user's usage statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await UsageTrackingService.getUsageStats(ctx.auth.userId);
    return stats;
  }),

  /**
   * Get plan limits for current user
   */
  getLimits: protectedProcedure.query(async () => {
    // Get current plan from Clerk session (source of truth)
    const clerkPlan = await getUserPlanFromClerk();
    const limits = PLAN_LIMITS[clerkPlan as UserPlan];

    return {
      plan: clerkPlan,
      generationsPerMonth: limits.generationsPerMonth,
      projectLimit: limits.projectLimit,
      e2bConcurrent: limits.e2bConcurrent,
      e2bTimeoutSeconds: limits.e2bTimeoutSeconds,
      models: limits.models,
      supportLevel: limits.supportLevel,
    };
  }),

  /**
   * Get sandbox limits for current user
   */
  getSandboxLimits: protectedProcedure.query(async ({ ctx }) => {
    const limits = await UsageTrackingService.getSandboxLimits(ctx.auth.userId);
    return limits;
  }),
});
