'use client';

import { PricingTable } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';

/**
 * Checkout Page Client Component
 *
 * Uses Clerk's official PricingTable component for subscription management.
 * The PricingTable handles:
 * - Plan selection and pricing display
 * - Checkout flow with Stripe
 * - Payment processing
 * - Subscription creation and management
 *
 * Configuration is done in the Clerk Dashboard:
 * https://dashboard.clerk.com -> Billing
 */
export function CheckoutPageClient() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Background Effects - Preserved from original design */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-20" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[100px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <main className="px-6 pb-16 pt-24">
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight">
              Choose Your Plan
            </h1>
            <p className="text-lg text-muted-foreground">
              Unlock powerful AI features and take your projects to the next
              level
            </p>
          </div>

          {/* Clerk's PricingTable Component */}
          <PricingTable
            newSubscriptionRedirectUrl="/checkout/success"
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">
                  Loading plans...
                </span>
              </div>
            }
            appearance={{
              variables: {
                colorPrimary: 'hsl(var(--primary))',
                colorBackground: 'hsl(var(--background))',
                colorText: 'hsl(var(--foreground))',
                colorTextSecondary: 'hsl(var(--muted-foreground))',
                colorDanger: 'hsl(var(--destructive))',
                colorSuccess: 'hsl(var(--primary))',
                fontFamily: 'var(--font-sans)',
                borderRadius: '0.5rem',
              },
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-lg border-border/50 hover:shadow-xl transition-all duration-300',
                cardHeader: 'bg-gradient-to-br from-primary/5 to-accent/5',
                cardBody: 'p-6',
                button:
                  'bg-gradient-to-r from-primary to-accent text-white font-semibold ' +
                  'hover:from-primary/90 hover:to-accent/90 transition-all duration-200',
                badge: 'bg-primary/20 text-primary font-semibold',
                planName: 'text-2xl font-bold',
                planPrice: 'text-4xl font-bold',
                planDescription: 'text-muted-foreground',
                featureList: 'space-y-3',
                featureListItem: 'flex items-center gap-2',
              },
            }}
          />
        </div>
      </main>
    </div>
  );
}
