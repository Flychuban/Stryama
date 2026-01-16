import type { PreviewProcessInfo } from './types';
import { logger } from '~/lib/utils/logger';

export const HEALTH_CHECK_CONFIG = {
  INTERVAL_MS: 1500,
  MAX_TIMEOUT_MS: 12000,
  MAX_ATTEMPTS: 8,
  HTTP_TIMEOUT_MS: 5000,
} as const;

/**
 * Maximum number of log lines to store per process (prevent memory bloat)
 */
export const MAX_LOG_LINES = 200;

/**
 * Time-to-live for process tracking entries (30 minutes)
 * After this time of inactivity, entries are removed to prevent memory leaks
 */
export const PROCESS_TTL_MS = 30 * 60 * 1000;

/**
 * Interval for running cleanup of stale process entries (5 minutes)
 */
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Map to store running preview processes by sandbox ID
 * This allows us to track and kill preview servers when needed
 * Also stores stdout/stderr logs for debugging
 */
export const previewProcesses = new Map<string, PreviewProcessInfo>();

/**
 * Clean up stale process entries from the previewProcesses Map
 * Removes entries that haven't been active for longer than PROCESS_TTL_MS
 */
export function cleanupStaleProcesses(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sandboxId, info] of previewProcesses.entries()) {
    if (now - info.lastActivity > PROCESS_TTL_MS) {
      previewProcesses.delete(sandboxId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug(
      `[Preview] Cleaned up ${cleanedCount} stale process tracking entries`
    );
  }
}

// Set up periodic cleanup to prevent memory leaks
// Only run in server environment (not during build or in browser)
if (typeof setInterval !== 'undefined' && typeof process !== 'undefined') {
  const cleanupTimer = setInterval(cleanupStaleProcesses, CLEANUP_INTERVAL_MS);

  // Prevent the timer from keeping the process alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}
