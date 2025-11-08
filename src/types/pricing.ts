import type { LucideIcon } from 'lucide-react';

/**
 * Billing cycle options for subscriptions
 */
export type BillingCycle = 'monthly' | 'annual';

/**
 * Plan identifiers used throughout the app
 * These should match the plan IDs configured in Clerk Billing
 */
export type PlanId = 'starter' | 'builder' | 'pro';

/**
 * User plan type for subscription status
 * Single source of truth for plan types across the application
 */
export type UserPlan = 'FREE' | 'BUILDER' | 'PRO';

/**
 * Pricing tier configuration
 * Used for displaying pricing on landing page and checkout
 */
export interface PricingTier {
  /** Unique identifier for the plan */
  id: PlanId;
  /** Display name of the plan */
  name: string;
  /** Monthly price in USD */
  price: number;
  /** Billing period display text */
  period: string;
  /** Short description of the plan */
  description: string;
  /** List of features included in this plan */
  features: string[];
  /** Whether this plan should be highlighted */
  highlight?: boolean;
  /** Badge text to display (e.g., "Most Popular") */
  badge?: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** Call-to-action button text */
  cta: string;
}

/**
 * Plan details for checkout page
 * Simplified version used during checkout flow
 */
export interface CheckoutPlan {
  id: PlanId;
  name: string;
  icon: LucideIcon;
  /** Base monthly price */
  monthlyPrice: number;
  /** Annual price (typically discounted) */
  annualPrice: number;
  features: string[];
}

/**
 * Plan limits and features configuration
 * Defines resource limits for each subscription tier
 */
export interface PlanLimits {
  /** Monthly AI generation limit */
  generationsPerMonth: number;
  /** Maximum number of active projects */
  projectLimit: number;
  /** Maximum concurrent E2B sandboxes */
  e2bConcurrent: number;
  /** E2B sandbox timeout in seconds */
  e2bTimeoutSeconds: number;
  /** Available Claude models for this plan */
  models: ('haiku' | 'sonnet')[];
  /** Support level */
  supportLevel: 'community' | 'email' | 'priority' | 'priority_plus';
}

/**
 * Plan limits configuration for each tier
 * Used for enforcing usage limits throughout the application
 */
export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  FREE: {
    generationsPerMonth: 15,
    projectLimit: 1,
    e2bConcurrent: 1,
    e2bTimeoutSeconds: 600, // 10 minutes
    models: ['haiku'],
    supportLevel: 'community',
  },
  BUILDER: {
    generationsPerMonth: 100,
    projectLimit: 5,
    e2bConcurrent: 2,
    e2bTimeoutSeconds: 1800, // 30 minutes
    models: ['haiku', 'sonnet'],
    supportLevel: 'email',
  },
  PRO: {
    generationsPerMonth: 350,
    projectLimit: 20,
    e2bConcurrent: 5,
    e2bTimeoutSeconds: 7200, // 2 hours
    models: ['haiku', 'sonnet'],
    supportLevel: 'priority',
  },
} as const;

/**
 * Configuration for annual billing discount
 */
export const ANNUAL_DISCOUNT_PERCENTAGE = 20;

/**
 * Calculate annual price with discount
 */
export function calculateAnnualPrice(monthlyPrice: number): number {
  const annualWithoutDiscount = monthlyPrice * 12;
  return Math.floor(
    annualWithoutDiscount * (1 - ANNUAL_DISCOUNT_PERCENTAGE / 100)
  );
}

/**
 * Calculate savings from annual billing
 */
export function calculateAnnualSavings(monthlyPrice: number): number {
  const annualWithoutDiscount = monthlyPrice * 12;
  const annualWithDiscount = calculateAnnualPrice(monthlyPrice);
  return annualWithoutDiscount - annualWithDiscount;
}

/**
 * Get display price based on billing cycle
 */
export function getDisplayPrice(
  monthlyPrice: number,
  cycle: BillingCycle
): number {
  return cycle === 'annual' ? calculateAnnualPrice(monthlyPrice) : monthlyPrice;
}

/**
 * Map plan ID to user plan type
 */
export function planIdToUserPlan(planId: PlanId): UserPlan {
  if (planId === 'starter') return 'FREE';
  if (planId === 'builder') return 'BUILDER';
  return 'PRO';
}

/**
 * Map user plan to plan ID
 */
export function userPlanToPlanId(userPlan: UserPlan): PlanId {
  if (userPlan === 'FREE') return 'starter';
  if (userPlan === 'BUILDER') return 'builder';
  return 'pro';
}
