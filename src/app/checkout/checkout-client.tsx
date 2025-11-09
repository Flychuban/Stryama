'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/shared/AppHeader';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentForm } from '@/components/checkout/PaymentForm';
import { type BillingCycle, type CheckoutPlan } from '@/types';

/**
 * Plan configurations for checkout
 * These should match the plans configured in Clerk Billing Dashboard
 */
const CHECKOUT_PLANS: Record<'builder' | 'pro', CheckoutPlan> = {
  builder: {
    id: 'builder',
    name: 'Builder',
    icon: Zap,
    monthlyPrice: 19,
    annualPrice: 182, // 20% discount
    features: [
      '100 AI generations per month',
      '5 active projects',
      'Smart AI (Haiku + Sonnet)',
      'E2B sandbox (30min timeout)',
      'Email support (48hr)',
      'Private projects',
      'GitHub export',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 470, // 20% discount
    features: [
      '350 AI generations per month',
      '20 active projects',
      'Smart AI with priority routing',
      'E2B sandbox (2hr timeout)',
      'Priority support + chat',
      'Custom domains (coming soon)',
      'API access (coming soon)',
    ],
  },
};

interface CheckoutPageClientProps {
  initialPlan: 'builder' | 'pro';
  initialBilling: BillingCycle;
}

export function CheckoutPageClient({
  initialPlan,
  initialBilling,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(initialBilling);

  const plan = CHECKOUT_PLANS[initialPlan];

  const handleBillingCycleChange = (cycle: BillingCycle) => {
    setBillingCycle(cycle);
    // Update URL to reflect billing cycle change
    router.replace(`/checkout?plan=${initialPlan}&billing=${cycle}`, {
      scroll: false,
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-20" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[100px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <main className="px-6 pb-16 pt-24">
        <div className="mx-auto max-w-6xl">
          {/* Back Button */}
          <Button variant="ghost" className="mb-8" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Two Column Layout */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column - Order Summary */}
            <OrderSummary
              plan={plan}
              billingCycle={billingCycle}
              onBillingCycleChange={handleBillingCycleChange}
            />

            {/* Right Column - Payment Form */}
            <PaymentForm
              monthlyPrice={plan.monthlyPrice}
              billingCycle={billingCycle}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
