import Link from 'next/link';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppHeader } from '@/components/shared/AppHeader';

/**
 * Checkout Cancel Page
 *
 * Displayed when user cancels the checkout process or payment fails
 */
export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-20" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
        <Card className="max-w-2xl border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10">
              <XCircle className="h-12 w-12 text-orange-500" />
            </div>
            <CardTitle className="text-3xl">Checkout Canceled</CardTitle>
            <CardDescription className="text-base">
              Your payment was not processed
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Cancel Message */}
            <div className="space-y-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
              <p className="text-sm text-muted-foreground">
                You&apos;ve canceled the checkout process. No charges have been
                made to your account.
              </p>
              <p className="text-sm text-muted-foreground">
                If you experienced any issues or have questions about our
                pricing plans, we&apos;re here to help!
              </p>
            </div>

            {/* Help Section */}
            <div className="space-y-3">
              <h3 className="font-semibold">Common Questions</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong>Not sure which plan to choose?</strong> Compare our
                    plans to find the best fit for your needs.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong>Payment issues?</strong> Make sure your card details
                    are correct and has sufficient funds.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>
                    <strong>Want to try for free?</strong> Start with our free
                    plan and upgrade anytime.
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <Button asChild className="flex-1" size="lg">
                <Link href="/">View Pricing Plans</Link>
              </Button>
            </div>

            {/* Support Info */}
            <div className="border-t border-border/50 pt-4">
              <p className="text-center text-xs text-muted-foreground">
                Need help? Contact our support team or check out our{' '}
                <a href="#" className="underline hover:text-foreground">
                  FAQ
                </a>{' '}
                for more information about our plans and pricing.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
