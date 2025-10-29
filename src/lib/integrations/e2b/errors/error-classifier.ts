import { E2BErrorType } from '../errors';

export type ErrorClassification = {
  type: E2BErrorType;
  isRetryable: boolean;
  shouldReportToUser: boolean;
};

export function classifyE2BError(error: unknown): ErrorClassification {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Network/connection errors - retryable
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound')
  ) {
    return {
      type: E2BErrorType.CONNECTION_FAILED,
      isRetryable: true,
      shouldReportToUser: false,
    };
  }

  // Authentication errors - not retryable
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('api key')
  ) {
    return {
      type: E2BErrorType.AUTHENTICATION_ERROR,
      isRetryable: false,
      shouldReportToUser: true,
    };
  }

  // Sandbox not found - not retryable
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return {
      type: E2BErrorType.SANDBOX_NOT_FOUND,
      isRetryable: false,
      shouldReportToUser: true,
    };
  }

  // Default: operation failed, retryable
  return {
    type: E2BErrorType.OPERATION_FAILED,
    isRetryable: true,
    shouldReportToUser: true,
  };
}
