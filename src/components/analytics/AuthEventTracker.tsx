/**
 * AuthEventTracker Component
 *
 * Tracks authentication events (sign in, sign up, sign out) for analytics.
 * Works in conjunction with usePostHogIdentification for complete user tracking.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAnalytics } from '@/hooks/useAnalytics';

export function AuthEventTracker() {
  const { user, isLoaded } = useUser();
  const { trackUserSignedIn, trackUserSignedOut } = useAnalytics();
  const hasTrackedSignIn = useRef(false);
  const previousUserId = useRef<string | null>(null);
  const signInTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // User signed out (was signed in, now null)
    if (!user && previousUserId.current && signInTimestamp.current) {
      const sessionDurationMinutes = Math.floor(
        (Date.now() - signInTimestamp.current) / 60000
      );

      trackUserSignedOut({
        session_duration_minutes: sessionDurationMinutes,
        user_id: previousUserId.current,
      });

      // Reset tracking state
      hasTrackedSignIn.current = false;
      previousUserId.current = null;
      signInTimestamp.current = null;
      return;
    }

    // User signed in
    if (user) {
      // Track sign in event if this is a new session or different user
      if (!hasTrackedSignIn.current || previousUserId.current !== user.id) {
        trackUserSignedIn({
          login_method: 'email', // Clerk provides this but for now we default to email
          user_id: user.id,
        });

        hasTrackedSignIn.current = true;
        previousUserId.current = user.id;
        signInTimestamp.current = Date.now();
      }
    }
  }, [user, isLoaded, trackUserSignedIn, trackUserSignedOut]);

  return null;
}
