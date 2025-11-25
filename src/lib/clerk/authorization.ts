import { auth } from '@clerk/nextjs/server';
import { type UserPlan } from '@prisma/client';

/**
 * Authorization helper for Clerk Billing (B2C User Plans)
 *
 * This module provides functions to check user subscription status
 * using Clerk's session-based authorization with the has() helper.
 *
 * Clerk Billing automatically sets plan entitlements for B2C user subscriptions:
 * - starter - Free plan (default) - $0/month
 * - builder - Builder plan subscription - $19/month
 * - pro - Pro plan subscription - $49/month
 *
 * Plan keys match the "Key" field in Clerk Dashboard → Billing → Plans for Users
 *
 * These entitlements are set automatically by Clerk when a user subscribes.
 * No webhook handling or database sync required.
 */

/**
 * BETA TESTERS - Temporary Allowlist for MVP Testing
 *
 * Add Clerk user IDs here to grant them free access to paid plans
 * without requiring a subscription.
 *
 * IMPORTANT:
 * - Use Clerk User ID (not email) - more reliable
 * - User IDs are case-sensitive (use exact format from Clerk Dashboard)
 * - To get userId: Clerk Dashboard → Users → Select user → Copy User ID
 *
 * TODO: Remove this after beta testing period ends
 */
const BETA_TESTERS: Record<string, UserPlan> = {
  // Map Clerk user ID to the plan they should have
  // Example: 'user_2NNEqL2nrIRdJ194ndJqAHtrx': 'BUILDER',
  // Example: 'user_2XYZ789abc': 'PRO',

  // Add your beta testers here (get userId from Clerk Dashboard):
  // 'user_YOUR_BETA_TESTER_ID_HERE': 'BUILDER',
  user_35fdFZFhUmja838TWCP2gtT1wrp: 'BUILDER',
  user_35zB9LjrMyBGyrCNrZdnL5DEkv7: 'BUILDER',
  user_35miscS7uvTh6zxzo10f4o4eZuY: 'BUILDER',
};

/**
 * Get the user's effective plan from Clerk's session entitlements
 *
 * @returns The highest plan the user has access to
 *
 * @example
 * ```ts
 * const plan = await getUserPlanFromClerk();
 * if (plan === 'PRO') {
 *   // User has pro features
 * }
 * ```
 */
export async function getUserPlanFromClerk(): Promise<UserPlan> {
  const { userId, has } = await auth();

  // BETA TESTING: Check if user is in the beta tester allowlist
  // Using userId for reliable identification (sessionClaims.email is not always available)
  if (userId && userId in BETA_TESTERS) {
    // Only log in development to avoid PII in production logs
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] Beta tester detected: ${userId}`);
    }
    // Safe to use ! because we checked 'userId in BETA_TESTERS'
    return BETA_TESTERS[userId]!;
  }

  // B2C user plans use plan-based checks (not org permissions)
  // Plan keys match the "Key" field in Clerk Dashboard → Billing → Plans for Users
  const hasProPlan = has({ plan: 'pro' });
  const hasBuilderPlan = has({ plan: 'builder' });

  // Check in order from highest to lowest tier
  if (hasProPlan) return 'PRO';
  if (hasBuilderPlan) return 'BUILDER';
  return 'FREE';
}

/**
 * Check if user has access to a specific plan tier
 *
 * @param plan - The plan tier to check access for
 * @returns True if user has access to this plan or higher
 *
 * @example
 * ```ts
 * if (await hasAccessToPlan('BUILDER')) {
 *   // User can access builder features
 * }
 * ```
 */
export async function hasAccessToPlan(plan: UserPlan): Promise<boolean> {
  const userPlan = await getUserPlanFromClerk();

  // Define plan hierarchy
  const planHierarchy: Record<UserPlan, number> = {
    FREE: 0,
    BUILDER: 1,
    PRO: 2,
  };

  return planHierarchy[userPlan] >= planHierarchy[plan];
}

/**
 * Check if user has access to a specific Clerk permission/feature
 *
 * @param permission - The permission string to check (e.g., 'org:billing:pro')
 * @returns True if user has this permission
 *
 * @example
 * ```ts
 * if (await canAccessFeature('org:billing:pro')) {
 *   // User has pro plan
 * }
 * ```
 */
export async function canAccessFeature(permission: string): Promise<boolean> {
  const { has } = await auth();
  return has({ permission });
}

/**
 * Require a specific plan or throw an error
 *
 * @param plan - The minimum required plan
 * @throws Error if user doesn't have access
 *
 * @example
 * ```ts
 * await requirePlan('BUILDER');
 * // Code here only runs if user has builder or higher
 * ```
 */
export async function requirePlan(plan: UserPlan): Promise<void> {
  const hasAccess = await hasAccessToPlan(plan);
  if (!hasAccess) {
    throw new Error(
      `This feature requires the ${plan} plan. Please upgrade your subscription.`
    );
  }
}

/**
 * Get plan-specific limits for a user
 *
 * @returns Object with generation limits and features based on current plan
 *
 * @example
 * ```ts
 * const limits = await getUserLimits();
 * console.log(limits.generationsPerMonth); // 100, 350, etc.
 * ```
 */
export async function getUserLimits() {
  const plan = await getUserPlanFromClerk();

  const limitsMap = {
    FREE: {
      generationsPerMonth: 15,
      maxProjects: 1,
      models: ['haiku'] as const,
      sandboxTimeout: 10 * 60 * 1000, // 10 minutes
      supportLevel: 'community',
    },
    BUILDER: {
      generationsPerMonth: 100,
      maxProjects: 5,
      models: ['haiku', 'sonnet'] as const,
      sandboxTimeout: 30 * 60 * 1000, // 30 minutes
      supportLevel: 'email-48hr',
    },
    PRO: {
      generationsPerMonth: 350,
      maxProjects: 20,
      models: ['haiku', 'sonnet'] as const,
      sandboxTimeout: 120 * 60 * 1000, // 2 hours
      supportLevel: 'priority-chat',
    },
  };

  return limitsMap[plan];
}

/**
 * Check if user has an active paid subscription (any plan except FREE)
 *
 * @returns True if user has builder or pro plan
 *
 * @example
 * ```ts
 * if (await hasPaidSubscription()) {
 *   // Show premium features
 * }
 * ```
 */
export async function hasPaidSubscription(): Promise<boolean> {
  const plan = await getUserPlanFromClerk();
  return plan !== 'FREE';
}

/**
 * Check if the current user is an admin
 *
 * Admin user IDs are stored in the ADMIN_USER_IDS environment variable
 * as a comma-separated list of Clerk user IDs.
 *
 * @returns True if the current user is an admin
 *
 * @example
 * ```ts
 * if (await isAdmin()) {
 *   // Show admin features
 * }
 * ```
 */
export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();

  if (!userId) {
    return false;
  }

  const adminUserIds =
    process.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()) ?? [];
  return adminUserIds.includes(userId);
}
