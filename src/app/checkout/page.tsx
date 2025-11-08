import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CheckoutPageClient } from './checkout-client';

/**
 * Checkout Page - Protected route for subscription purchase
 *
 * URL Parameters:
 * - plan: 'pro' | 'enterprise' (defaults to 'pro')
 * - billing: 'monthly' | 'annual' (defaults to 'monthly')
 *
 * Example: /checkout?plan=pro&billing=annual
 *
 * TODO: When ready to integrate Clerk Billing:
 * 1. Configure plans in Clerk Dashboard (https://dashboard.clerk.com)
 * 2. Add environment variables:
 *    - CLERK_SECRET_KEY (already configured)
 *    - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (already configured)
 * 3. Install Clerk Billing if using components: npm install @clerk/clerk-react
 * 4. Update checkout-client.tsx to use Clerk's subscription API
 * 5. Add webhook handler for subscription events at /api/webhooks/clerk
 * 6. Store subscription status in Clerk user metadata or database
 *
 * Clerk Billing Resources:
 * - Docs: https://clerk.com/docs/billing
 * - Guide: https://clerk.com/blog/add-subscriptions-to-your-saas-with-clerk-billing
 * - API: https://clerk.com/docs/reference/backend-api/tag/subscriptions
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
  // Verify user is authenticated
  const { userId } = await auth();

  // Redirect to sign-in if not authenticated
  // Note: Middleware should also protect this route, but this is a safety check
  if (!userId) {
    redirect('/sign-in?redirect_url=/checkout');
  }

  // Parse and validate query parameters
  const params = await searchParams;
  const planParam = params.plan?.toLowerCase();
  const billingParam = params.billing?.toLowerCase();

  // Validate plan parameter
  const validPlans = ['pro', 'enterprise'] as const;
  type ValidPlan = (typeof validPlans)[number];
  const plan: ValidPlan = validPlans.includes(planParam as ValidPlan)
    ? (planParam as ValidPlan)
    : 'pro';

  // Validate billing parameter
  const validBilling = ['monthly', 'annual'] as const;
  type ValidBilling = (typeof validBilling)[number];
  const billing: ValidBilling = validBilling.includes(
    billingParam as ValidBilling
  )
    ? (billingParam as ValidBilling)
    : 'monthly';

  return <CheckoutPageClient initialPlan={plan} initialBilling={billing} />;
}
