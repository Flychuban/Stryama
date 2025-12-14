'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * Netlify OAuth Callback Page
 *
 * Handles the return from Netlify OAuth authorization.
 * The connection is already saved by the server-side /api/netlify/callback route.
 * This page just triggers connection verification and redirects to the original page.
 */
export default function NetlifyCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnUrl = searchParams?.get('return_url') ?? '/editor';
  const netlifyConnected = searchParams?.get('netlify_connected') === 'true';
  const switched = searchParams?.get('switched') === 'true';
  const fromAccount = searchParams?.get('from');
  const toAccount = searchParams?.get('to');
  const [hasTriggeredConnection, setHasTriggeredConnection] = useState(false);

  const connectMutation = api.netlify.connectAfterOAuth.useMutation({
    onSuccess: () => {
      console.log('[Netlify Callback] Connection verified successfully');

      // Show different message if account was switched
      if (switched && fromAccount && toAccount) {
        toast.info('Account Switched', {
          description: `Changed from ${fromAccount} to ${toAccount}`,
        });
      } else {
        toast.success('Netlify connected successfully!');
      }

      // Redirect to the original page with success parameter
      router.push(returnUrl);
    },
    onError: (error) => {
      console.error('[Netlify Callback] Connection verification error:', error);

      // Still redirect even if verification fails - connection is already saved
      if (switched && fromAccount && toAccount) {
        toast.info('Account Switched', {
          description: `Changed from ${fromAccount} to ${toAccount}`,
        });
      } else {
        toast.success('Netlify connected successfully!');
      }

      router.push(returnUrl);
    },
  });

  // Verify connection and redirect
  useEffect(() => {
    // Only trigger once per page load
    if (hasTriggeredConnection) return;

    if (netlifyConnected) {
      setHasTriggeredConnection(true);
      // Trigger connection verification mutation (non-blocking)
      connectMutation.mutate();
    } else {
      // No netlify_connected param, just redirect
      router.push(returnUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTriggeredConnection, netlifyConnected]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground">
          Connecting to Netlify...
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Redirecting you back...
        </p>
      </div>
    </div>
  );
}
