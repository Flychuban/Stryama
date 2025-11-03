import { env } from '~/env';

export const E2B_CONFIG = {
  apiKey: env.E2B_API_KEY,
  defaultTimeoutMs: 30 * 60 * 1000, // 30 minutes - enough for AI generation + preview
  maxTimeoutMs: 60 * 60 * 1000, // 60 minutes
  retryAttempts: 3,
  retryDelayMs: 100, // Initial delay for exponential backoff
  maxConcurrentSandboxes: 5, // Maximum concurrent sandboxes per user
} as const;

export const SANDBOX_TIMEOUTS = {
  DEFAULT: 300_000, // 5 minutes
  EXTENDED: 600_000, // 10 minutes
  MAX: 1_800_000, // 30 minutes
} as const;

export const FEATURE_FLAGS = {
  usePersistence: true, // Use E2B pause/resume API for reconnecting to existing sandboxes
} as const;
