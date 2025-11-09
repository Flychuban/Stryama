import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CheckoutPageClient } from './checkout-client';

/**
 * Checkout Page - Protected route for subscription purchase
 *
 * This page uses Clerk's official Billing integration with PricingTable component.
 *
 * Setup:
 * 1. Configure plans in Clerk Dashboard (https://dashboard.clerk.com -> Billing)
 * 2. Connect your Stripe account
 * 3. Define plan features and pricing
 * 4. Clerk automatically handles:
 *    - Checkout sessions
 *    - Payment processing
 *    - Subscription management
 *    - Customer portal access
 *    - Entitlement syncing
 *
 * No webhooks required - Clerk handles subscription sync automatically.
 *
 * Resources:
 * - Clerk Billing Docs: https://clerk.com/docs/billing
 * - PricingTable Component: https://clerk.com/docs/components/billing/pricing-table
 */
export default async function CheckoutPage() {
  // Verify user is authenticated
  const { userId } = await auth();

  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect('/sign-in?redirect_url=/checkout');
  }

  return <CheckoutPageClient />;
}
