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
  const { has } = await auth();

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
