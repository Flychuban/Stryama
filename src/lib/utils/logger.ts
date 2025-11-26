/**
 * Production-Safe Logging Utility
 *
 * This logger automatically disables debug logs in production to:
 * - Prevent PII (Personally Identifiable Information) leakage
 * - Reduce log noise in production environments
 * - Improve performance by avoiding unnecessary console operations
 *
 * Usage:
 * - Use logger.debug() for development-only debugging information
 * - Use logger.info() for important production information
 * - Use logger.warn() for warnings (shown in all environments)
 * - Use logger.error() for errors (shown in all environments)
 *
 * Example:
 * ```typescript
 * import { logger } from '~/lib/utils/logger';
 *
 * logger.debug('User details:', user); // Only in development
 * logger.info('Server started'); // All environments
 * logger.error('Failed to process request:', error); // All environments
 * ```
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug logging - Only shown in development
   * Use for detailed debugging information that may contain sensitive data
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info logging - Shown in all environments
   * Use for important operational information
   */
  info: (...args: unknown[]) => {
    console.log(...args);
  },

  /**
   * Warning logging - Shown in all environments
   * Use for warning messages that don't prevent operation
   */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  /**
   * Error logging - Shown in all environments
   * Use for error messages and exceptions
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
