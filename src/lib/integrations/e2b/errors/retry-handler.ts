import { E2B_CONFIG } from '../config';
import { classifyE2BError } from './error-classifier';

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < E2B_CONFIG.retryAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classification = classifyE2BError(error);

      // Don't retry if error is not retryable
      if (!classification.isRetryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === E2B_CONFIG.retryAttempts - 1) {
        break;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, 800ms...
      const delayMs = E2B_CONFIG.retryDelayMs * Math.pow(2, attempt);
      console.log(
        `[E2B Retry] ${context} failed (attempt ${attempt + 1}/${E2B_CONFIG.retryAttempts}), retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
