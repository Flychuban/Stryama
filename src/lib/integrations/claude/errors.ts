import { ClaudeErrorType } from './types';

export class ClaudeGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: ClaudeErrorType,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ClaudeGenerationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClaudeGenerationError);
    }
  }
}

export function classifyError(error: unknown): ClaudeErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit')) {
      return ClaudeErrorType.RATE_LIMIT;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ClaudeErrorType.TIMEOUT;
    }
    if (message.includes('quota') || message.includes('exceeded')) {
      return ClaudeErrorType.QUOTA_EXCEEDED;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ClaudeErrorType.NETWORK_ERROR;
    }
    if (message.includes('invalid') || message.includes('malformed')) {
      return ClaudeErrorType.INVALID_RESPONSE;
    }
  }

  return ClaudeErrorType.API_ERROR;
}

export function getUserFriendlyErrorMessage(
  errorType: ClaudeErrorType
): string {
  const messages: Record<ClaudeErrorType, string> = {
    [ClaudeErrorType.RATE_LIMIT]:
      'You are making requests too quickly. Please wait a moment and try again.',
    [ClaudeErrorType.TIMEOUT]:
      'The request took too long to complete. Please try with a simpler prompt.',
    [ClaudeErrorType.INVALID_RESPONSE]:
      'The AI response was incomplete. Please try again.',
    [ClaudeErrorType.API_ERROR]:
      'An unexpected error occurred. Please try again later.',
    [ClaudeErrorType.QUOTA_EXCEEDED]:
      'You have reached your generation limit. Please upgrade your plan.',
    [ClaudeErrorType.NETWORK_ERROR]:
      'Network connection issue. Please check your internet and try again.',
  };

  return messages[errorType];
}
