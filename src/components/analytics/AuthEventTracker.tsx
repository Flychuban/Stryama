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
  const { trackUserSignedIn, trackUserSignedOut, trackUserSignedUp } =
    useAnalytics();
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
      });

      // Reset tracking state
      hasTrackedSignIn.current = false;
      previousUserId.current = null;
      signInTimestamp.current = null;
      return;
    }

    // User signed in or signed up
    if (user) {
      // Track sign in/up event if this is a new session or different user
      if (!hasTrackedSignIn.current || previousUserId.current !== user.id) {
        // Check if this is a new user (created within last 10 seconds)
        const isNewUser =
          user.createdAt &&
          Date.now() - new Date(user.createdAt).getTime() < 10000;

        if (isNewUser) {
          // This is a sign-up (user just created)
          trackUserSignedUp({
            signup_method: 'email', // Clerk provides this but for now we default to email
            user_id: user.id,
          });
        } else {
          // This is a sign-in (existing user)
          trackUserSignedIn({
            login_method: 'email',
            user_id: user.id,
          });
        }

        hasTrackedSignIn.current = true;
        previousUserId.current = user.id;
        signInTimestamp.current = Date.now();
      }
    }
  }, [
    user,
    isLoaded,
    trackUserSignedIn,
    trackUserSignedOut,
    trackUserSignedUp,
  ]);

  return null;
}
