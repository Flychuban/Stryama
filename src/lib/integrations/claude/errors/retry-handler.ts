import { ClaudeErrorType } from '../types';
import { ClaudeGenerationError } from '../errors';
import type { ServiceResult } from '../types';
import { logger } from '~/lib/utils/logger';

type RetryConfig = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: readonly ClaudeErrorType[];
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 16000, // 16 seconds
  retryableErrors: [
    ClaudeErrorType.RATE_LIMIT,
    ClaudeErrorType.TIMEOUT,
    ClaudeErrorType.NETWORK_ERROR,
  ],
};

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async executeWithRetry<T>(
    operation: () => Promise<ServiceResult<T>>,
    operationName: string
  ): Promise<ServiceResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        logger.debug(
          `[Retry] ${operationName} - Attempt ${attempt + 1}/${this.config.maxAttempts}`
        );

        const result = await operation();

        if (result.success) {
          if (attempt > 0) {
            logger.debug(
              `[Retry] ${operationName} succeeded on attempt ${attempt + 1}`
            );
          }
          return result;
        }

        if (!result.error) {
          return result; // No error message, return as-is
        }

        const errorType = this.classifyErrorFromMessage(result.error);
        if (!this.isRetryable(errorType)) {
          logger.debug(
            `[Retry] ${operationName} - Non-retryable error: ${errorType}`
          );
          return result;
        }

        if (attempt === this.config.maxAttempts - 1) {
          logger.error(`[Retry] ${operationName} - Max attempts reached`);
          return result;
        }

        const delay = this.calculateDelay(attempt);
        logger.debug(
          `[Retry] ${operationName} - Waiting ${delay}ms before retry`
        );
        await this.sleep(delay);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof ClaudeGenerationError) {
          if (!this.isRetryable(error.code)) {
            throw error; // Non-retryable, throw immediately
          }
        }

        if (attempt === this.config.maxAttempts - 1) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        logger.debug(
          `[Retry] ${operationName} - Error: ${lastError.message}. Retrying in ${delay}ms`
        );
        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError ?? new Error('Max retries exceeded');
  }

  private calculateDelay(attemptNumber: number): number {
    const exponentialDelay =
      this.config.baseDelayMs * Math.pow(2, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter (0-1000ms) to prevent thundering herd
    const jitter = Math.random() * 1000;

    return Math.floor(cappedDelay + jitter);
  }

  private isRetryable(errorType: ClaudeErrorType): boolean {
    return this.config.retryableErrors.includes(errorType);
  }

  private classifyErrorFromMessage(errorMessage: string): ClaudeErrorType {
    const lower = errorMessage.toLowerCase();

    if (lower.includes('rate limit')) return ClaudeErrorType.RATE_LIMIT;
    if (lower.includes('timeout')) return ClaudeErrorType.TIMEOUT;
    if (lower.includes('network') || lower.includes('connection')) {
      return ClaudeErrorType.NETWORK_ERROR;
    }
    if (lower.includes('quota')) return ClaudeErrorType.QUOTA_EXCEEDED;
    if (lower.includes('invalid')) return ClaudeErrorType.INVALID_RESPONSE;

    return ClaudeErrorType.API_ERROR;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const retryHandler = new RetryHandler();

export async function withRetry<T>(
  operation: () => Promise<ServiceResult<T>>,
  operationName: string,
  config?: Partial<RetryConfig>
): Promise<ServiceResult<T>> {
  const handler = new RetryHandler(config);
  return handler.executeWithRetry(operation, operationName);
}
