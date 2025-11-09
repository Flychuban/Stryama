'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppHeader } from '@/components/shared/AppHeader';
import { api } from '@/trpc/react';

/**
 * Checkout Success Page (Client Component)
 *
 * Displayed after successful subscription payment via Clerk/Stripe.
 * Automatically refreshes Clerk session and invalidates queries
 * so when user navigates to profile, they see updated plan immediately.
 */
export default function CheckoutSuccessPage() {
  const [isRefreshing, setIsRefreshing] = useState(true);
  const { getToken } = useAuth();
  const utils = api.useUtils();

  useEffect(() => {
    const refreshDataAfterPurchase = async () => {
      try {
        // Wait for Clerk to sync subscription (typically 1-2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Force Clerk session refresh to get updated plan entitlements
        await getToken({ skipCache: true });

        // Invalidate all queries to force fresh data fetch
        await utils.invalidate();
      } catch (error) {
        // Silent error - user can still navigate and data will refresh on page load
        console.error('Failed to refresh after purchase:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    void refreshDataAfterPurchase();
  }, [getToken, utils]);
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-20" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
        <Card className="max-w-2xl border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              {isRefreshing ? (
                <Loader2 className="h-12 w-12 animate-spin text-green-500" />
              ) : (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              )}
            </div>
            <CardTitle className="text-3xl">Payment Successful!</CardTitle>
            <CardDescription className="text-base">
              {isRefreshing
                ? 'Activating your subscription...'
                : 'Your subscription has been activated'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Success Message */}
            <div className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-sm text-muted-foreground">
                Thank you for subscribing to Stryama! Your payment has been
                processed successfully.
              </p>
              {isRefreshing ? (
                <p className="text-sm text-muted-foreground">
                  Please wait while we activate your subscription. This usually
                  takes a few seconds...
                </p>
              ) : (
                <p className="text-sm font-medium text-green-600">
                  ✓ Your subscription is now active. You can start using your
                  new plan features right away!
                </p>
              )}
            </div>

            {/* Next Steps */}
            <div className="space-y-3">
              <h3 className="font-semibold">What&apos;s Next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    Start creating projects with increased AI generation limits
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    Access advanced AI models (Sonnet) for complex tasks
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    Enjoy extended sandbox timeouts for longer sessions
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    View your usage stats and subscription details in your
                    profile
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button
                asChild
                className="flex-1"
                size="lg"
                disabled={isRefreshing}
              >
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isRefreshing}
              >
                <Link href="/profile">View Subscription</Link>
              </Button>
            </div>

            {/* Receipt Info */}
            <div className="border-t border-border/50 pt-4">
              <p className="text-center text-xs text-muted-foreground">
                A receipt has been sent to your email address. You can also view
                your billing history in your{' '}
                <Link
                  href="/profile"
                  className="underline hover:text-foreground"
                >
                  profile settings
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
