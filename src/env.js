import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Database
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (url) => url.startsWith('postgresql://'),
        'DATABASE_URL must be a valid PostgreSQL connection string'
      ),

    // Clerk Authentication (server-side)
    CLERK_SECRET_KEY: z
      .string()
      .min(1, 'CLERK_SECRET_KEY is required')
      .refine(
        (key) => key.startsWith('sk_test_') || key.startsWith('sk_live_'),
        'CLERK_SECRET_KEY must start with sk_test_ or sk_live_'
      ),

    // AI Services
    ANTHROPIC_API_KEY: z
      .string()
      .min(1, 'ANTHROPIC_API_KEY is required')
      .refine(
        (key) => key.startsWith('sk-ant-'),
        'ANTHROPIC_API_KEY must start with sk-ant-'
      ),

    // Sandbox
    E2B_API_KEY: z
      .string()
      .min(1, 'E2B_API_KEY is required')
      .refine(
        (key) => key.startsWith('e2b_'),
        'E2B_API_KEY must start with e2b_'
      ),

    // Node environment
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // Sentry Error Tracking (server-side)
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Clerk Authentication (client-side)
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required')
      .refine(
        (key) => key.startsWith('pk_test_') || key.startsWith('pk_live_'),
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_'
      ),

    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1).default('/sign-in'),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1).default('/sign-up'),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().min(1).default('/'),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().min(1).default('/'),

    // Application URL
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url('NEXT_PUBLIC_APP_URL must be a valid URL')
      .refine(
        (url) => url.startsWith('http://') || url.startsWith('https://'),
        'NEXT_PUBLIC_APP_URL must start with http:// or https://'
      ),

    // Sentry Error Tracking (client-side)
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
    NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.string().optional(),
    NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    E2B_API_KEY: process.env.E2B_API_KEY,
    NODE_ENV: process.env.NODE_ENV,

    // Client
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    // Sentry (client)
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,

    // Sentry (server)
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
