'use client';

import { Check, Shield, Lock, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { type BillingCycle, type CheckoutPlan } from '@/types';
import { BillingCycleSelector } from './BillingCycleSelector';
import { calculateAnnualSavings, getDisplayPrice } from '@/types/pricing';

interface OrderSummaryProps {
  plan: CheckoutPlan;
  billingCycle: BillingCycle;
  onBillingCycleChange: (cycle: BillingCycle) => void;
}

export function OrderSummary({
  plan,
  billingCycle,
  onBillingCycleChange,
}: OrderSummaryProps) {
  const Icon = plan.icon;
  const finalPrice = getDisplayPrice(plan.monthlyPrice, billingCycle);
  const savings =
    billingCycle === 'annual' ? calculateAnnualSavings(plan.monthlyPrice) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-2 text-4xl font-bold">Complete Your Order</h1>
        <p className="text-muted-foreground">
          Join thousands of creators building with Stryama
        </p>
      </div>

      {/* Order Summary Card */}
      <Card className="overflow-hidden border-border/50 shadow-lg">
        {/* Plan Header with Gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-3">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-2xl font-bold">{plan.name} Plan</h3>
              <p className="text-muted-foreground">
                Everything you need to build amazing apps
              </p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 p-6">
          {/* Billing Cycle Selection */}
          <BillingCycleSelector
            selectedCycle={billingCycle}
            onCycleChange={onBillingCycleChange}
            monthlyPrice={plan.monthlyPrice}
          />

          <Separator />

          {/* Features List */}
          <div>
            <h4 className="mb-4 font-semibold">What&apos;s included:</h4>
            <div className="space-y-3">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Price Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${finalPrice}</span>
            </div>
            {billingCycle === 'annual' && (
              <div className="flex justify-between text-sm">
                <span className="text-accent">Annual discount (20%)</span>
                <span className="font-medium text-accent">-${savings}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-lg font-semibold">Total due today</span>
              <span className="text-2xl font-bold">${finalPrice}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust Signals */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <span>Secure Payment</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-accent" />
          <span>256-bit SSL</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span>Instant Access</span>
        </div>
      </div>
    </div>
  );
}
