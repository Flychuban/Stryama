/**
 * GitHub Integration Error Classes
 */

export enum GitHubErrorType {
  AUTH_ERROR = 'AUTH_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  EXPORT_ERROR = 'EXPORT_ERROR',
  REPOSITORY_NOT_FOUND = 'REPOSITORY_NOT_FOUND',
  REPOSITORY_EXISTS = 'REPOSITORY_EXISTS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Base GitHub error class
 */
export class GitHubError extends Error {
  constructor(
    message: string,
    public code: GitHubErrorType,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/**
 * GitHub authentication error
 */
export class GitHubAuthError extends GitHubError {
  constructor(message: string, details?: unknown) {
    super(message, GitHubErrorType.AUTH_ERROR, details);
    this.name = 'GitHubAuthError';
  }
}

/**
 * GitHub connection error
 */
export class GitHubConnectionError extends GitHubError {
  constructor(message: string, details?: unknown) {
    super(message, GitHubErrorType.CONNECTION_ERROR, details);
    this.name = 'GitHubConnectionError';
  }
}

/**
 * GitHub export error
 */
export class GitHubExportError extends GitHubError {
  constructor(message: string, details?: unknown) {
    super(message, GitHubErrorType.EXPORT_ERROR, details);
    this.name = 'GitHubExportError';
  }
}

/**
 * GitHub repository not found error
 */
export class GitHubRepositoryNotFoundError extends GitHubError {
  constructor(repository: string, details?: unknown) {
    super(
      `Repository "${repository}" not found`,
      GitHubErrorType.REPOSITORY_NOT_FOUND,
      details
    );
    this.name = 'GitHubRepositoryNotFoundError';
  }
}

/**
 * GitHub repository already exists error
 */
export class GitHubRepositoryExistsError extends GitHubError {
  constructor(repository: string, details?: unknown) {
    super(
      `Repository "${repository}" already exists. Choose a different name or push to existing repository.`,
      GitHubErrorType.REPOSITORY_EXISTS,
      details
    );
    this.name = 'GitHubRepositoryExistsError';
  }
}

/**
 * GitHub rate limit exceeded error
 */
export class GitHubRateLimitError extends GitHubError {
  constructor(
    message: string,
    public resetAt: Date,
    details?: unknown
  ) {
    super(message, GitHubErrorType.RATE_LIMIT_EXCEEDED, details);
    this.name = 'GitHubRateLimitError';
  }
}

/**
 * GitHub invalid token error
 */
export class GitHubInvalidTokenError extends GitHubError {
  constructor(message = 'Invalid GitHub token', details?: unknown) {
    super(message, GitHubErrorType.INVALID_TOKEN, details);
    this.name = 'GitHubInvalidTokenError';
  }
}

/**
 * GitHub permission denied error
 */
export class GitHubPermissionDeniedError extends GitHubError {
  constructor(message = 'Permission denied', details?: unknown) {
    super(message, GitHubErrorType.PERMISSION_DENIED, details);
    this.name = 'GitHubPermissionDeniedError';
  }
}
