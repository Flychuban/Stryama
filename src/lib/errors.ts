// Custom error types for different domains

export class AIGenerationError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'AIGenerationError';
    this.code = code;
    this.details = details;
  }
}

export class ProjectError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
    this.details = details;
  }
}

export class SandboxError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'SandboxError';
    this.code = code;
    this.details = details;
  }
}

// Error classification helper
export function classifyError(error: Error): string {
  if (error.message.includes('rate limit')) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  if (error.message.includes('token limit')) {
    return 'TOKEN_LIMIT_EXCEEDED';
  }
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (error instanceof AIGenerationError) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}
