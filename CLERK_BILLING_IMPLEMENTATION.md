# Clerk Billing Implementation Guide

This document explains how subscription management is implemented using Clerk's official Billing integration.

## Overview

**Implementation Approach**: Clerk Official Billing (No Webhooks)

This project uses Clerk's built-in billing system which integrates directly with Stripe. Clerk handles all subscription management, payment processing, and entitlement syncing automatically.

**Key Benefits**:

- ✅ No webhook infrastructure needed
- ✅ Automatic subscription sync
- ✅ Built-in customer portal
- ✅ Real-time authorization via session
- ✅ Simpler codebase (~1,500 fewer lines of code)

---

## Setup Steps

### 1. Configure Clerk Dashboard

1. **Navigate to Billing Settings**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Select your application
   - Navigate to "Billing" in the sidebar

2. **Connect Stripe Account**:
   - Click "Connect Stripe"
   - Follow the OAuth flow to connect your Stripe account
   - Clerk will create a separate Stripe account for development and production

3. **Create Plans**:
   - Click "Add Plan"
   - Configure each plan (FREE, BUILDER, PRO):

   **FREE Plan** (Optional - handled automatically):
   - No configuration needed
   - Users without subscriptions default to FREE

   **BUILDER Plan**:
   - Name: "Builder"
   - Description: "Perfect for growing projects"
   - Monthly Price: $19/month
   - Annual Price: $182/year (20% discount)
   - Features:
     - 100 AI generations per month
     - 5 active projects
     - Smart AI (Haiku + Sonnet)
     - E2B sandbox (30min timeout)
     - Email support (48hr)
   - Permissions: Set to `org:billing:builder`

   **PRO Plan**:
   - Name: "Pro"
   - Description: "For power users and teams"
   - Monthly Price: $49/month
   - Annual Price: $470/year (20% discount)
   - Features:
     - 350 AI generations per month
     - 20 active projects
     - Smart AI with priority routing
     - E2B sandbox (2hr timeout)
     - Priority support + chat
   - Permissions: Set to `org:billing:pro`

4. **Configure Success/Cancel URLs**:
   - Success URL: `/checkout/success`
   - Cancel URL: `/checkout/cancel`

### 2. Environment Variables

Your `.env` file only needs standard Clerk keys (no webhook secrets):

```bash
# Clerk Authentication
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# Standard Clerk configuration
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

**Note**: No `CLERK_WEBHOOK_SIGNING_SECRET` needed!

### 3. Test the Integration

1. **Start Development Server**:

   ```bash
   pnpm dev
   ```

2. **Test Checkout Flow**:
   - Navigate to `/checkout`
   - Select a plan from the PricingTable
   - Complete checkout with Stripe test card: `4242 4242 4242 4242`
   - Verify redirect to success page

3. **Test Authorization**:
   - After subscribing, test that features unlock
   - Check that `auth().has({ permission: 'org:billing:builder' })` returns true
   - Verify AI generation limits match the new plan

---

## Architecture

### Authorization Flow

```typescript
// Old (Webhook-based):
// 1. User subscribes
// 2. Stripe sends webhook to our endpoint
// 3. We verify webhook signature
// 4. We update database with subscription status
// 5. We check database on every request

// New (Clerk Billing):
// 1. User subscribes via Clerk's PricingTable
// 2. Clerk automatically updates user session
// 3. We check session with has() on every request
```

### File Structure

**Core Files**:

- `src/app/checkout/page.tsx` - Checkout page with PricingTable component
- `src/lib/clerk/authorization.ts` - Helper functions for plan checks
- `src/server/api/routers/subscription.ts` - Minimal tRPC router (read-only)
- `src/components/subscription/SubscriptionManager.tsx` - Subscription UI

**Removed Files** (from webhook-based approach):

- ~~`src/app/api/webhooks/clerk-billing/route.ts`~~ - No longer needed
- ~~`src/lib/clerk/billing.ts`~~ - No longer needed
- ~~`src/components/checkout/PaymentForm.tsx`~~ - Replaced by PricingTable

---

## Code Examples

### Checking User's Plan

**Server-side (API Routes, Server Components)**:

```typescript
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';

// Get user's current plan
const plan = await getUserPlanFromClerk(); // 'FREE' | 'BUILDER' | 'PRO'

// Check if user has access to a plan
import { hasAccessToPlan } from '~/lib/clerk/authorization';
if (await hasAccessToPlan('BUILDER')) {
  // User has Builder or Pro plan
}
```

**Using Clerk's has() helper directly**:

```typescript
import { auth } from '@clerk/nextjs/server';

const { has } = await auth();

if (has({ permission: 'org:billing:pro' })) {
  // User has Pro plan
}

if (has({ permission: 'org:billing:builder' })) {
  // User has Builder plan or higher
}
```

**Client-side (React Components)**:

```typescript
import { useAuth } from '@clerk/nextjs';

export function FeatureGate() {
  const { has } = useAuth();

  const canUseFeature = has({ permission: 'org:billing:builder' });

  return (
    <div>
      {canUseFeature ? (
        <PremiumFeature />
      ) : (
        <UpgradePrompt />
      )}
    </div>
  );
}
```

### Displaying Subscription in UI

```typescript
import { SubscriptionManager } from '@/components/subscription/SubscriptionManager';

export function ProfilePage() {
  return (
    <div>
      <h1>My Profile</h1>
      <SubscriptionManager />
    </div>
  );
}
```

### Usage Tracking

Usage limits are still tracked in the database, but plan authorization comes from Clerk:

```typescript
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
import { UsageTrackingService } from '~/lib/services/usageTracking';

// Check if user can make a generation
await UsageTrackingService.checkGenerationLimit(userId);

// Get plan for limit calculation
const plan = await getUserPlanFromClerk();

// Increment usage counter
await UsageTrackingService.incrementGenerationCount(userId);
```

---

## Database Schema

Simplified schema - only tracks usage, not subscription state:

```prisma
model UserUsage {
  id                   String   @id @default(cuid())
  clerkUserId          String   @unique
  plan                 UserPlan @default(FREE) // Cached from Clerk (optional)

  // Billing period tracking (for usage reset)
  currentPeriodStart   DateTime @default(now())
  currentPeriodEnd     DateTime

  // Usage tracking
  generationsThisMonth Int      @default(0)
  lastGenerationAt     DateTime?

  // Metadata
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([clerkUserId])
  @@index([currentPeriodEnd])
}

enum UserPlan {
  FREE
  BUILDER
  PRO
}
```

**Removed fields**:

- ~~`stripeSubscriptionId`~~ - Managed by Clerk
- ~~`stripeCustomerId`~~ - Managed by Clerk
- ~~`subscriptionStatus`~~ - From Clerk session
- ~~`cancelAtPeriodEnd`~~ - Managed by Clerk
- ~~`billingCycle`~~ - Managed by Clerk

---

## Security Considerations

### How Clerk Billing is Secure

1. **Session-based Authorization**:
   - Permissions stored in encrypted Clerk session
   - Cannot be tampered with by client
   - Automatically updated when subscription changes

2. **No Webhook Verification Needed**:
   - Clerk handles Stripe webhooks internally
   - No public webhook endpoint to secure
   - No signature verification code

3. **Server-side Enforcement**:
   - `has()` checks happen on every request
   - Authorization cannot be bypassed
   - Real-time subscription status

### Best Practices

```typescript
// ✅ Good: Always check server-side
export async function generateAI() {
  const plan = await getUserPlanFromClerk(); // Server-side check
  if (plan === 'FREE') {
    throw new Error('Upgrade required');
  }
  // ... proceed with generation
}

// ❌ Bad: Don't trust client-side checks alone
// Client-side checks are for UX only, always verify server-side
```

---

## Testing

### Test Cards (Stripe)

Use these test cards in development mode:

| Card Number         | Scenario                            |
| ------------------- | ----------------------------------- |
| 4242 4242 4242 4242 | Successful payment                  |
| 4000 0000 0000 9995 | Failed payment                      |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) |

**Expiry**: Any future date
**CVC**: Any 3 digits
**ZIP**: Any 5 digits

### Manual Testing Checklist

- [ ] Free user can access free features
- [ ] Free user sees upgrade prompts for premium features
- [ ] User can subscribe to Builder plan via PricingTable
- [ ] After subscribing, user immediately has access to premium features
- [ ] Subscription shows correctly in SubscriptionManager component
- [ ] User can change plan via /checkout
- [ ] User can access Clerk's customer portal (via Clerk's UserProfile component)
- [ ] Usage limits respect the new plan's limits
- [ ] AI router uses correct models based on plan

---

## Troubleshooting

### Issue: PricingTable not showing plans

**Solution**: Verify plans are configured in Clerk Dashboard and permissions are set correctly.

```typescript
// Check permissions in Clerk Dashboard:
// Builder plan: org:billing:builder
// Pro plan: org:billing:pro
```

### Issue: Authorization not working (always FREE)

**Solution**: Ensure user has completed checkout and check Clerk session:

```typescript
import { auth } from '@clerk/nextjs/server';

const { has } = await auth();
console.log('Has builder?', has({ permission: 'org:billing:builder' }));
console.log('Has pro?', has({ permission: 'org:billing:pro' }));
```

### Issue: User can't access features after subscribing

**Solution**: Session may need to refresh. Try:

1. Logging out and back in
2. Waiting ~60 seconds for session to refresh
3. Checking Clerk Dashboard to verify subscription is active

### Issue: Database plan doesn't match Clerk plan

**Solution**: Database `plan` field is optional cache. Clerk session is source of truth:

```typescript
// Always use Clerk session as source of truth
const clerkPlan = await getUserPlanFromClerk(); // From session
const dbPlan = userUsage.plan; // Cached (may be stale)

// Use clerkPlan for authorization
```

---

## Migration from Webhook-based Approach

If you previously had a webhook-based implementation:

1. **Database Migration**:

   ```bash
   npx prisma db push --accept-data-loss
   ```

2. **Remove Environment Variables**:
   - Remove `CLERK_WEBHOOK_SIGNING_SECRET` from .env

3. **Update Code**:
   - Replace `subscription.cancel.useMutation()` with links to /checkout
   - Replace database subscription checks with `has()` helper
   - Update UI components to use simplified SubscriptionManager

4. **Test Thoroughly**:
   - Verify all authorization still works
   - Check that existing paid users retain access
   - Test new subscription flow

---

## Resources

- **Clerk Billing Docs**: https://clerk.com/docs/billing
- **PricingTable Component**: https://clerk.com/docs/components/billing/pricing-table
- **Clerk Authorization**: https://clerk.com/docs/authorization/overview
- **Stripe Test Cards**: https://stripe.com/docs/testing

---

## Support

For implementation questions:

- **Clerk Discord**: https://clerk.com/discord
- **Clerk Support**: support@clerk.com
- **GitHub Issues**: Open an issue in this repository

---

**Last Updated**: November 9, 2025
**Implementation Version**: 2.0 (Clerk Official Billing)
