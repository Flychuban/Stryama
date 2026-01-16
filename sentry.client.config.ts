import * as Sentry from '@sentry/nextjs';
// import posthog from 'posthog-js';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_BROWSER = typeof window !== 'undefined';

if (SENTRY_DSN && IS_BROWSER) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Performance: 10% production, 100% dev
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'
    ),

    // Session replay: 5% normal, 100% errors (Conservative)
    replaysSessionSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? '0.05'
    ),
    replaysOnErrorSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? '1.0'
    ),

    integrations: [
      Sentry.browserTracingIntegration({
        enableInp: true,
        enableLongTask: true,
        traceFetch: true,
        traceXHR: true,
        shouldCreateSpanForRequest: (url) => {
          return (
            !url.includes('/ingest') &&
            !url.includes('sentry.io') &&
            !url.includes('posthog.com')
          );
        },
      }),

      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        beforeAddRecordingEvent: (event) => {
          if (IS_DEVELOPMENT) return null;
          return event;
        },
      }),
    ],

    // Filter sensitive data
    beforeSend(event) {
      if (IS_DEVELOPMENT) {
        console.log('[Sentry] Would send:', event);
        return null;
      }

      // Remove auth headers
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }

      return event;
    },

    // Ignore common non-issues
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'NetworkError',
      'Failed to fetch',
      'AbortError',
    ],

    // Reverse proxy tunnel (bypass ad blockers)
    tunnel: '/api/sentry',
  });
}
