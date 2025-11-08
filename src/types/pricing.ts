import type { LucideIcon } from 'lucide-react';

/**
 * Billing cycle options for subscriptions
 */
export type BillingCycle = 'monthly' | 'annual';

/**
 * Plan identifiers used throughout the app
 * These should match the plan IDs configured in Clerk Billing
 */
export type PlanId = 'starter' | 'pro' | 'enterprise';

/**
 * User plan type for subscription status
 * Matches the rate limiter implementation
 */
export type UserPlan = 'free' | 'pro' | 'enterprise';

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
  if (planId === 'starter') return 'free';
  if (planId === 'pro') return 'pro';
  return 'enterprise';
}
