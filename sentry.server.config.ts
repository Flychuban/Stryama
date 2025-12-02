import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.VERCEL_ENV ?? 'development';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // Lower server sample rate
    tracesSampleRate: IS_DEVELOPMENT ? 1.0 : 0.1,

    integrations: [
      Sentry.httpIntegration(),
      Sentry.nativeNodeFetchIntegration(),
      Sentry.prismaIntegration(),
      Sentry.nodeContextIntegration(),
    ],

    beforeSend(event) {
      if (IS_DEVELOPMENT) {
        console.log('[Sentry Server] Would send:', event);
        return null;
      }

      // Filter auth headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      return event;
    },

    // Filter expected business logic errors
    ignoreErrors: [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'P1001', // Prisma timeout
      'AbortError',
    ],
  });
}
