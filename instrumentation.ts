import * as Sentry from '@sentry/nextjs';

/**
 * Next.js Instrumentation Hook
 * Enables onRequestError for comprehensive error tracking
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js 15+ hook for capturing request errors
export const onRequestError = Sentry.captureRequestError;
