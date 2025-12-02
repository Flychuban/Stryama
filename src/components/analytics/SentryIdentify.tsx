'use client';

import { useSentryUser } from '@/hooks/useSentryUser';

/**
 * Auto-identify users in Sentry when they sign in
 * Mirrors the PostHogIdentify component pattern
 */
export function SentryIdentify() {
  useSentryUser();
  return null;
}
