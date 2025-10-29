import { env } from '~/env';

export const E2B_CONFIG = {
  apiKey: env.E2B_API_KEY,
  defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes (E2B default)
  maxTimeoutMs: 30 * 60 * 1000, // 30 minutes
  retryAttempts: 3,
  retryDelayMs: 100, // Initial delay for exponential backoff
  maxConcurrentSandboxes: 5, // Maximum concurrent sandboxes per user
} as const;

export const SANDBOX_TIMEOUTS = {
  DEFAULT: 300_000, // 5 minutes
  EXTENDED: 600_000, // 10 minutes
  MAX: 1_800_000, // 30 minutes
} as const;

export const POOL_CONFIG = {
  minSize: 2, // Minimum number of paused sandboxes in pool
  maxSize: 3, // Maximum number of paused sandboxes in pool
  maxPoolAge: 60 * 60 * 1000, // 1 hour - remove from pool after this time
  refillThreshold: 1, // Refill pool when available count drops below this
} as const;

export const LIFECYCLE_CONFIG = {
  inactivityTimeout: 10 * 60 * 1000, // 10 minutes - pause after inactivity
  maxSandboxAge: 28 * 24 * 60 * 60 * 1000, // 28 days - cleanup before E2B 30-day limit
  cleanupInterval: 5 * 60 * 1000, // 5 minutes - run cleanup job frequency
} as const;

export const FEATURE_FLAGS = {
  usePersistence: true, // Use E2B pause/resume API
  useAutoPause: true, // Enable auto-pause on timeout
  enablePooling: true, // Enable sandbox pooling
} as const;
