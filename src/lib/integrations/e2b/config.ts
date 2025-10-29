import { env } from '~/env';

export const E2B_CONFIG = {
  apiKey: env.E2B_API_KEY,
  defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes (E2B default)
  maxTimeoutMs: 30 * 60 * 1000, // 30 minutes
  retryAttempts: 3,
  retryDelayMs: 100, // Initial delay for exponential backoff
} as const;

export const SANDBOX_TIMEOUTS = {
  DEFAULT: 300_000, // 5 minutes
  EXTENDED: 600_000, // 10 minutes
  MAX: 1_800_000, // 30 minutes
} as const;
