'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * GitHub OAuth Callback Page
 *
 * Handles the return from GitHub OAuth authorization.
 * Uses Clerk's AuthenticateWithRedirectCallback to process the OAuth response,
 * then triggers a mutation to save GitHub connection metadata to database.
 */
export default function GitHubCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnUrl = searchParams?.get('return_url') ?? '/dashboard';
  const [hasTriggeredMutation, setHasTriggeredMutation] = useState(false);

  const connectMutation = api.github.connectAfterOAuth.useMutation({
    onSuccess: () => {
      toast.success('GitHub connected successfully!');
      // Small delay to let toast show before redirect
      setTimeout(() => {
        router.push(returnUrl);
      }, 500);
    },
    onError: (error) => {
      console.error('[GitHub Callback] Connection error:', error);
      toast.error(`Failed to complete connection: ${error.message}`);
      // Redirect back even on error
      setTimeout(() => {
        router.push(returnUrl);
      }, 1000);
    },
  });

  // Trigger connection save after Clerk OAuth processing completes
  useEffect(() => {
    // Only trigger once per page load
    if (hasTriggeredMutation) return;

    // Small delay to ensure Clerk has processed the OAuth callback
    const timeoutId = setTimeout(() => {
      setHasTriggeredMutation(true);
      connectMutation.mutate();
    }, 1000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTriggeredMutation]);

  return (
    <>
      <AuthenticateWithRedirectCallback
        afterSignInUrl={returnUrl}
        afterSignUpUrl={returnUrl}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      />
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">
            Connecting to GitHub...
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please wait while we complete the connection
          </p>
        </div>
      </div>
    </>
  );
}
