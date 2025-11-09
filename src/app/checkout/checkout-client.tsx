'use client';

import { PricingTable } from '@clerk/nextjs';
import { Loader2, ArrowRight } from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';
import { PlanHighlights } from '@/components/checkout/PlanHighlights';
import { FeatureComparisonTable } from '@/components/checkout/FeatureComparisonTable';
import { TrustSignals } from '@/components/checkout/TrustSignals';
import { CheckoutFAQ } from '@/components/checkout/CheckoutFAQ';

/**
 * Checkout Page Client Component
 *
 * Enhanced checkout experience with:
 * - Hero section with gradient text
 * - Plan highlights overview
 * - Clerk's PricingTable for subscription management
 * - Detailed feature comparison table
 * - Trust signals to build confidence
 * - FAQ section to address objections
 *
 * Uses Clerk's official PricingTable component for payment processing.
 * Configuration is done in the Clerk Dashboard:
 * https://dashboard.clerk.com -> Billing
 */
export function CheckoutPageClient() {
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

      <main className="px-6 pb-20 pt-24">
        <div className="mx-auto max-w-7xl space-y-16">
          {/* Hero Section */}
          <div className="animate-fade-in text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              Pricing Plans
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
              Choose Your{' '}
              <span className="animate-gradient-shift bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Perfect Plan
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
              Start free, upgrade as you grow. All plans include core features
              to help you build amazing applications with AI.
            </p>
          </div>

          {/* Plan Highlights - Quick Overview */}
          <section
            className="animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <PlanHighlights />
          </section>

          {/* Clerk's PricingTable Component */}
          <section
            className="animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-3xl font-bold">Select Your Plan</h2>
              <p className="text-muted-foreground">
                Choose monthly or annual billing. Switch plans anytime.
              </p>
            </div>

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
                  rootBox: 'mx-auto max-w-6xl',
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
          </section>

          {/* Feature Comparison Table */}
          <section
            className="animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <FeatureComparisonTable />
          </section>

          {/* Trust Signals */}
          <section
            className="animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            <TrustSignals />
          </section>

          {/* FAQ Section */}
          <section
            className="animate-fade-in"
            style={{ animationDelay: '0.5s' }}
          >
            <CheckoutFAQ />
          </section>

          {/* Final CTA */}
          <section
            className="animate-fade-in text-center"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="mx-auto max-w-3xl rounded-2xl border border-border/50 bg-gradient-to-br from-primary/5 via-accent/5 to-background p-8 shadow-lg backdrop-blur-sm md:p-12">
              <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Join thousands of developers building amazing applications with
                Stryama. Start free, no credit card required.
              </p>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                Choose Your Plan
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
