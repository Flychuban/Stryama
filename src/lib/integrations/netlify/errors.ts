/**
 * Netlify Integration Custom Errors
 *
 * Specialized error classes for different failure scenarios in the Netlify integration
 */

/**
 * Base error class for Netlify integration
 */
export class NetlifyError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NetlifyError';
    Object.setPrototypeOf(this, NetlifyError.prototype);
  }
}

/**
 * Authentication/authorization errors
 */
export class NetlifyAuthError extends NetlifyError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'NetlifyAuthError';
    Object.setPrototypeOf(this, NetlifyAuthError.prototype);
  }
}

/**
 * Deployment-related errors
 */
export class NetlifyDeployError extends NetlifyError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'NetlifyDeployError';
    Object.setPrototypeOf(this, NetlifyDeployError.prototype);
  }
}

/**
 * Build process errors
 */
export class NetlifyBuildError extends NetlifyError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'NetlifyBuildError';
    Object.setPrototypeOf(this, NetlifyBuildError.prototype);
  }
}

/**
 * Build size limit exceeded
 */
export class NetlifyBuildTooLargeError extends NetlifyBuildError {
  constructor(
    public readonly actualSize: number,
    public readonly maxSize: number,
    context?: Record<string, unknown>
  ) {
    const sizeMB = (actualSize / 1024 / 1024).toFixed(2);
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
    super(
      `Build size (${sizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB). Please optimize your assets or reduce dependencies.`,
      { ...context, actualSize, maxSize }
    );
    this.name = 'NetlifyBuildTooLargeError';
    Object.setPrototypeOf(this, NetlifyBuildTooLargeError.prototype);
  }
}

/**
 * Rate limit exceeded
 */
export class NetlifyRateLimitError extends NetlifyError {
  constructor(
    public readonly retryAfter: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Netlify rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      { ...context, retryAfter }
    );
    this.name = 'NetlifyRateLimitError';
    Object.setPrototypeOf(this, NetlifyRateLimitError.prototype);
  }
}

/**
 * Deployment timeout error
 */
export class NetlifyDeployTimeoutError extends NetlifyDeployError {
  constructor(
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    const timeoutMin = (timeoutMs / 60000).toFixed(1);
    super(
      `Deployment timed out after ${timeoutMin} minutes. Check your Netlify dashboard for deployment status.`,
      { ...context, timeoutMs }
    );
    this.name = 'NetlifyDeployTimeoutError';
    Object.setPrototypeOf(this, NetlifyDeployTimeoutError.prototype);
  }
}

/**
 * Site not found error
 */
export class NetlifySiteNotFoundError extends NetlifyError {
  constructor(
    public readonly siteId: string,
    context?: Record<string, unknown>
  ) {
    super(`Site with ID "${siteId}" not found. It may have been deleted.`, {
      ...context,
      siteId,
    });
    this.name = 'NetlifySiteNotFoundError';
    Object.setPrototypeOf(this, NetlifySiteNotFoundError.prototype);
  }
}

/**
 * Invalid configuration error
 */
export class NetlifyConfigError extends NetlifyError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'NetlifyConfigError';
    Object.setPrototypeOf(this, NetlifyConfigError.prototype);
  }
}

/**
 * Site name conflict error (HTTP 422)
 * Thrown when a site name already exists globally
 */
export class NetlifySiteConflictError extends NetlifyError {
  constructor(
    public readonly attemptedName: string,
    public readonly suggestedName?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Site name "${attemptedName}" already exists. ${
        suggestedName
          ? `Try "${suggestedName}" instead.`
          : 'Please try a different name.'
      }`,
      { ...context, attemptedName, suggestedName }
    );
    this.name = 'NetlifySiteConflictError';
    Object.setPrototypeOf(this, NetlifySiteConflictError.prototype);
  }
}
