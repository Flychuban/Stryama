/**
 * PostHogIdentify Component
 *
 * Client component that handles automatic user identification with PostHog.
 * Must be rendered within both ClerkProvider and PostHogProvider.
 */

'use client';

import { usePostHogIdentification } from '@/hooks/usePostHogIdentification';

export function PostHogIdentify() {
  // This hook automatically handles user identification
  usePostHogIdentification();

  // This component doesn't render anything
  return null;
}
