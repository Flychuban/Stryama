/**
 * PostHog Analytics Integration
 *
 * This file provides a placeholder for PostHog analytics integration.
 * To activate PostHog tracking:
 *
 * 1. Install PostHog:
 *    pnpm add posthog-js
 *
 * 2. Add environment variable to .env.local:
 *    NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
 *    NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com (or your self-hosted instance)
 *
 * 3. Uncomment the implementation code below
 *
 * 4. Import and use in your app:
 *    import { analytics } from '@/lib/analytics/posthog';
 *    analytics.track('event_name', { property: 'value' });
 */

// Placeholder analytics object (no-op until PostHog is configured)
export const analytics = {
  /**
   * Track a custom event
   * @param eventName - Name of the event to track
   * @param properties - Optional properties to attach to the event
   */
  track: (eventName: string, properties?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Track event:', eventName, properties);
    }
    // TODO: Implement PostHog tracking after installation
    // posthog.capture(eventName, properties);
  },

  /**
   * Identify a user
   * @param userId - Unique user identifier
   * @param traits - Optional user traits/properties
   */
  identify: (userId: string, traits?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Identify user:', userId, traits);
    }
    // TODO: Implement PostHog identify after installation
    // posthog.identify(userId, traits);
  },

  /**
   * Track page views
   * @param pageName - Optional page name
   */
  page: (pageName?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[Analytics] Page view:',
        pageName ?? window.location.pathname
      );
    }
    // TODO: Implement PostHog page tracking after installation
    // posthog.capture('$pageview', { page: pageName });
  },

  /**
   * Reset user identification (on logout)
   */
  reset: () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Reset user');
    }
    // TODO: Implement PostHog reset after installation
    // posthog.reset();
  },
};

/**
 * Example implementation (uncomment after installing PostHog):
 *
 * import posthog from 'posthog-js';
 *
 * // Initialize PostHog
 * if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
 *   posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
 *     api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
 *     loaded: (posthog) => {
 *       if (process.env.NODE_ENV === 'development') posthog.debug();
 *     },
 *   });
 * }
 *
 * export const analytics = {
 *   track: (eventName: string, properties?: Record<string, unknown>) => {
 *     posthog.capture(eventName, properties);
 *   },
 *   identify: (userId: string, traits?: Record<string, unknown>) => {
 *     posthog.identify(userId, traits);
 *   },
 *   page: (pageName?: string) => {
 *     posthog.capture('$pageview', { page: pageName });
 *   },
 *   reset: () => {
 *     posthog.reset();
 *   },
 * };
 */

/**
 * Common events to track:
 *
 * User Actions:
 * - analytics.track('user_signed_up', { method: 'email' });
 * - analytics.track('user_signed_in', { method: 'google' });
 * - analytics.track('user_upgraded', { plan: 'pro' });
 *
 * App Creation:
 * - analytics.track('app_created', { prompt_length: 50 });
 * - analytics.track('app_generated', { generation_time: 1.2, success: true });
 * - analytics.track('app_downloaded', { file_count: 15 });
 *
 * Feature Usage:
 * - analytics.track('preview_opened');
 * - analytics.track('code_exported');
 * - analytics.track('prompt_submitted', { suggestion_used: true });
 *
 * Conversion Events:
 * - analytics.track('checkout_started', { plan: 'builder' });
 * - analytics.track('subscription_created', { plan: 'pro', interval: 'monthly' });
 * - analytics.track('trial_started');
 */
