/**
 * Subscription Types for Clerk Billing Integration
 *
 * With Clerk's official billing, subscription state is managed by Clerk
 * and accessed via the `has()` helper in the user's session.
 * These types are simplified to only track usage periods in our database.
 */

/**
 * Subscription details for UI display
 * Plan comes from Clerk session via has() helper
 * Period tracking stored in database for usage reset
 */
export interface SubscriptionDetails {
  plan: 'FREE' | 'BUILDER' | 'PRO';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Subscription update result for tRPC responses
 */
export interface SubscriptionUpdateResult {
  success: boolean;
  message: string;
  subscription?: SubscriptionDetails;
}
