/**
 * GitHub Integration Configuration
 */

export const GITHUB_CONFIG = {
  /**
   * GitHub API base URL
   */
  apiUrl: 'https://api.github.com',

  /**
   * User agent for GitHub API requests
   */
  userAgent: 'Stryama v1.0.0',

  /**
   * Default branch name for new repositories
   */
  defaultBranch: 'main',

  /**
   * Maximum files per export batch
   * GitHub Tree API can handle 100,000 files, but we limit for performance
   */
  maxFilesPerBatch: 1000,

  /**
   * Retry configuration for API calls
   */
  retry: {
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
  },
} as const;
