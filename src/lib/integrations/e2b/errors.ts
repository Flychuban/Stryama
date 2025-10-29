export enum E2BErrorType {
  CREATION_FAILED = 'CREATION_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SANDBOX_NOT_FOUND = 'SANDBOX_NOT_FOUND',
  OPERATION_FAILED = 'OPERATION_FAILED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
}

export class E2BSandboxError extends Error {
  constructor(
    message: string,
    public code: E2BErrorType,
    public details?: unknown
  ) {
    super(message);
    this.name = 'E2BSandboxError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SandboxCreationError extends E2BSandboxError {
  constructor(message: string, details?: unknown) {
    super(message, E2BErrorType.CREATION_FAILED, details);
    this.name = 'SandboxCreationError';
  }
}

export class SandboxTimeoutError extends E2BSandboxError {
  constructor(message: string, details?: unknown) {
    super(message, E2BErrorType.TIMEOUT_ERROR, details);
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxConnectionError extends E2BSandboxError {
  constructor(message: string, details?: unknown) {
    super(message, E2BErrorType.CONNECTION_FAILED, details);
    this.name = 'SandboxConnectionError';
  }
}
