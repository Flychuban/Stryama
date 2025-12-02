'use client';

/**
 * SentryInit Component
 *
 * Explicitly imports Sentry client config to ensure it loads in Turbopack mode.
 * This is a workaround for Turbopack not processing the Sentry webpack plugin.
 *
 * Must be imported in root layout to initialize Sentry on app load.
 */

// Import the client config to trigger Sentry initialization
import '../../../sentry.client.config';

export function SentryInit() {
  // This component doesn't render anything, it just ensures the config is loaded
  return null;
}
