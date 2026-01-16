import type { LucideIcon } from 'lucide-react';

export type BillingCycle = 'monthly' | 'annual';
export type PlanId = 'starter' | 'builder' | 'pro';
export type UserPlan = 'FREE' | 'BUILDER' | 'PRO';

export interface PricingTier {
  id: PlanId;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  icon: LucideIcon;
  cta: string;
}

export interface CheckoutPlan {
  id: PlanId;
  name: string;
  icon: LucideIcon;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
}

export interface PlanLimits {
  generationsPerMonth: number;
  projectLimit: number;
  e2bConcurrent: number;
  e2bTimeoutSeconds: number;
  models: ('haiku' | 'sonnet')[];
  supportLevel: 'community' | 'email' | 'priority' | 'priority_plus';
}

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

export const ANNUAL_DISCOUNT_PERCENTAGE = 20;

export function calculateAnnualPrice(monthlyPrice: number): number {
  const annualWithoutDiscount = monthlyPrice * 12;
  return Math.floor(
    annualWithoutDiscount * (1 - ANNUAL_DISCOUNT_PERCENTAGE / 100)
  );
}

export function calculateAnnualSavings(monthlyPrice: number): number {
  const annualWithoutDiscount = monthlyPrice * 12;
  const annualWithDiscount = calculateAnnualPrice(monthlyPrice);
  return annualWithoutDiscount - annualWithDiscount;
}

export function getDisplayPrice(
  monthlyPrice: number,
  cycle: BillingCycle
): number {
  return cycle === 'annual' ? calculateAnnualPrice(monthlyPrice) : monthlyPrice;
}

export function planIdToUserPlan(planId: PlanId): UserPlan {
  if (planId === 'starter') return 'FREE';
  if (planId === 'builder') return 'BUILDER';
  return 'PRO';
}

export function userPlanToPlanId(userPlan: UserPlan): PlanId {
  if (userPlan === 'FREE') return 'starter';
  if (userPlan === 'BUILDER') return 'builder';
  return 'pro';
}
