/**
 * Netlify Integration Configuration
 *
 * Centralized configuration for Netlify API integration, rate limits, and deployment settings
 */

export const NETLIFY_CONFIG = {
  /**
   * Netlify API base URL
   */
  apiUrl: 'https://api.netlify.com/api/v1',

  /**
   * User agent for API requests
   */
  userAgent: 'Stryama-App/1.0',

  /**
   * Rate limits enforced by Netlify
   * @see https://docs.netlify.com/api/get-started/#rate-limiting
   */
  rateLimits: {
    deploymentsPerMinute: 3,
    deploymentsPerDay: 100,
  },

  /**
   * Deployment configuration
   */
  deployment: {
    /**
     * Default timeout for deployment operations (10 minutes)
     */
    defaultTimeout: 600000,

    /**
     * Maximum build size in bytes (50MB)
     * Netlify has a 50MB limit for direct uploads
     */
    maxBuildSize: 52428800,

    /**
     * Maximum individual file size in bytes (10MB)
     */
    maxFileSize: 10485760,

    /**
     * Polling interval for checking deployment status (3 seconds)
     */
    pollInterval: 3000,
  },

  /**
   * Build configuration
   */
  build: {
    /**
     * Working directory in E2B sandbox
     * CRITICAL: Must match E2B file sync directory
     */
    workDir: '/project',

    /**
     * Build command timeout (5 minutes)
     */
    timeoutMs: 300000,
  },
} as const;
