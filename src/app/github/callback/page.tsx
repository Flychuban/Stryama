'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * GitHub OAuth Callback Page
 *
 * Handles the return from GitHub OAuth authorization.
 * The connection is already saved by the server-side /api/github/callback route.
 * This page just triggers analytics tracking and redirects to the original page.
 */
export default function GitHubCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnUrl = searchParams?.get('return_url') ?? '/editor';
  const githubConnected = searchParams?.get('github_connected') === 'true';
  const switched = searchParams?.get('switched') === 'true';
  const fromAccount = searchParams?.get('from');
  const toAccount = searchParams?.get('to');
  const [hasTriggeredAnalytics, setHasTriggeredAnalytics] = useState(false);

  const connectMutation = api.github.connectAfterOAuth.useMutation({
    onSuccess: () => {
      console.log('[GitHub Callback] Analytics tracked successfully');

      // Show different message if account was switched
      if (switched && fromAccount && toAccount) {
        toast.info('Account Switched', {
          description: `Changed from @${fromAccount} to @${toAccount}`,
        });
      } else {
        toast.success('GitHub connected successfully!');
      }

      // Redirect to the original page with success parameter
      router.push(returnUrl);
    },
    onError: (error) => {
      console.error('[GitHub Callback] Analytics error:', error);

      // Still redirect even if analytics fails - connection is already saved
      if (switched && fromAccount && toAccount) {
        toast.info('Account Switched', {
          description: `Changed from @${fromAccount} to @${toAccount}`,
        });
      } else {
        toast.success('GitHub connected successfully!');
      }

      router.push(returnUrl);
    },
  });

  // Track analytics and redirect
  useEffect(() => {
    // Only trigger once per page load
    if (hasTriggeredAnalytics) return;

    if (githubConnected) {
      setHasTriggeredAnalytics(true);
      // Trigger analytics mutation (non-blocking)
      connectMutation.mutate();
    } else {
      // No github_connected param, just redirect
      router.push(returnUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTriggeredAnalytics, githubConnected]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground">
          Connecting to GitHub...
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Redirecting you back...
        </p>
      </div>
    </div>
  );
}
