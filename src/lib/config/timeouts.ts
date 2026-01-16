/**
 * Centralized timeout and limit constants
 */

export const TIMEOUTS = {
  /** npm install timeout (10 minutes) */
  NPM_INSTALL_MS: 600_000,
  /** Vite server startup wait (45 seconds) */
  VITE_WAIT_MS: 45_000,
  /** Fallback polling delay (3 seconds) */
  FALLBACK_POLL_MS: 3_000,
  /** Preview polling interval (2 seconds) */
  PREVIEW_POLL_MS: 2_000,
  /** Stream buffer delay (500ms) */
  STREAM_BUFFER_MS: 500,
} as const;

export const FILE_LIMITS = {
  /** Maximum files to include in context */
  MAX_CONTEXT_FILES: 5,
  /** Maximum file size for context (3000 chars) */
  MAX_FILE_SIZE_CHARS: 3_000,
} as const;
