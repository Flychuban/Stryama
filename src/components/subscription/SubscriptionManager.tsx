'use client';

import Link from 'next/link';
import { Crown, CreditCard, Calendar, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';

/**
 * SubscriptionManager Component (Clerk Billing)
 *
 * Simplified subscription management using Clerk's official billing:
 * - Displays current plan from Clerk session
 * - Links to /checkout for plan changes (handled by Clerk's PricingTable)
 * - Clerk automatically handles subscription management via their portal
 *
 * Key simplifications from webhook-based approach:
 * - No custom cancel/reactivate mutations (Clerk handles via portal)
 * - No custom portal URL fetching (Clerk provides built-in access)
 * - Plan comes from Clerk session, not database
 */
export function SubscriptionManager() {
  // Fetch subscription details (plan from Clerk, periods from database)
  const { data: subscription, isLoading } =
    api.subscription.getDetails.useQuery();

  if (isLoading || !subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading subscription details...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPaidPlan = subscription.plan !== 'FREE';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Subscription</span>
          {isPaidPlan && (
            <Badge className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Premium
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Manage your subscription and billing settings
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Plan Section */}
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Current Plan</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{subscription.plan}</span>
              {!isPaidPlan && (
                <span className="text-sm text-muted-foreground">
                  No payment required
                </span>
              )}
            </div>
          </div>

          {/* Billing Period */}
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Billing Period</span>
            </div>
            <p className="text-sm">
              {subscription.currentPeriodStart.toLocaleDateString()} -{' '}
              {subscription.currentPeriodEnd.toLocaleDateString()}
            </p>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isPaidPlan ? (
            <>
              <Button asChild className="w-full" size="lg">
                <Link href="/checkout">
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Unlock advanced AI models and increase your generation limits
              </p>
            </>
          ) : (
            <>
              <Button asChild className="w-full" variant="outline">
                <Link href="/checkout">Change Plan</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Manage your subscription, payment method, and billing info
                through Clerk&apos;s secure portal
              </p>
            </>
          )}
        </div>

        {/* Help Text */}
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a
              href="mailto:support@stryama.com"
              className="font-medium text-primary hover:underline"
            >
              support@stryama.com
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
