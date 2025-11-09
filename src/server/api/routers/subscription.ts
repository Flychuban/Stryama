import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { UsageTrackingService } from '~/lib/services/usageTracking';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
import { TRPCError } from '@trpc/server';

/**
 * Subscription Router (Clerk Billing)
 *
 * With Clerk's official billing:
 * - Subscriptions are managed via <PricingTable /> component
 * - Plan changes handled through Clerk's customer portal
 * - Authorization uses Clerk's has() helper (no database sync needed)
 * - This router provides read-only subscription info for UI display
 *
 * Key changes from webhook-based approach:
 * - No createCheckout mutation (use <PricingTable /> instead)
 * - No cancel/reactivate mutations (use Clerk's portal)
 * - No getPortalUrl query (Clerk provides built-in portal access)
 */
export const subscriptionRouter = createTRPCRouter({
  /**
   * Get current subscription details for UI display
   * Combines Clerk session plan with database usage period
   */
  getDetails: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get plan from Clerk session (source of truth)
      const clerkPlan = await getUserPlanFromClerk();

      // Get usage period from database
      const details = await UsageTrackingService.getSubscriptionDetails(
        ctx.auth.userId
      );

      // Return combined data with Clerk plan taking precedence
      return {
        ...details,
        plan: clerkPlan, // Always use Clerk session as source of truth
      };
    } catch (error) {
      console.error('[Subscription] Error fetching details:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch subscription details',
      });
    }
  }),
});
