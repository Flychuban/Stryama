/**
 * usePostHogIdentification Hook
 *
 * Automatically identifies users with PostHog when they authenticate via Clerk.
 * Handles user identification, property updates, and reset on logout.
 */

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAnalytics } from './useAnalytics';
import type { UserProperties } from '@/lib/analytics/events';

export function usePostHogIdentification() {
  const { user, isLoaded } = useUser();
  const { identifyUser, resetUser, setUserProperties } = useAnalytics();
  const hasIdentified = useRef(false);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    // Wait for Clerk to finish loading
    if (!isLoaded) {
      return;
    }

    // If user is signed out, reset PostHog
    if (!user) {
      if (previousUserId.current) {
        console.log('[PostHog] User signed out, resetting identification');
        resetUser();
        hasIdentified.current = false;
        previousUserId.current = null;
      }
      return;
    }

    // If this is a different user or we haven't identified yet, identify them
    if (!hasIdentified.current || previousUserId.current !== user.id) {
      const userProperties: UserProperties = {
        email: user.primaryEmailAddress?.emailAddress,
        created_at: user.createdAt?.toISOString(),
        // Plan type will be fetched from Clerk metadata if available
        plan_type:
          (user.publicMetadata?.plan as 'FREE' | 'BUILDER' | 'PRO') ?? 'FREE',
        is_beta_tester: Boolean(user.publicMetadata?.isBetaTester),
      };

      console.log('[PostHog] Identifying user:', user.id);
      identifyUser(user.id, userProperties);

      hasIdentified.current = true;
      previousUserId.current = user.id;
    }
  }, [user, isLoaded, identifyUser, resetUser, setUserProperties]);

  // Update user properties when they change
  useEffect(() => {
    if (!user || !hasIdentified.current) {
      return;
    }

    // Listen for changes in user metadata and update properties
    const userProperties: UserProperties = {
      email: user.primaryEmailAddress?.emailAddress,
      plan_type:
        (user.publicMetadata?.plan as 'FREE' | 'BUILDER' | 'PRO') ?? 'FREE',
      is_beta_tester: Boolean(user.publicMetadata?.isBetaTester),
    };

    // Only update if we're already identified
    setUserProperties(userProperties);
  }, [
    user?.primaryEmailAddress?.emailAddress,
    user?.publicMetadata,
    setUserProperties,
    user,
  ]);

  return {
    isIdentified: hasIdentified.current,
    userId: user?.id ?? null,
  };
}
