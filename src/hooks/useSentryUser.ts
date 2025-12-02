'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';

/**
 * Hook to automatically identify users in Sentry based on Clerk authentication
 * Mirrors the PostHog user identification pattern
 */
export function useSentryUser() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      // Set user context in Sentry
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });

      // Add user plan as a tag for filtering
      const plan = user.publicMetadata?.plan as string | undefined;
      Sentry.setTag('user_plan', plan ?? 'free');
    } else {
      // Clear user context when signed out
      Sentry.setUser(null);
    }
  }, [user, isLoaded]);
}
