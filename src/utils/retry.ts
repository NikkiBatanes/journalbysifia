// src/utils/retry.ts
// Retry utility for handling failed API requests

import { RetryConfig } from '../types/api';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attempts: 3,
  delay: 1000,
  backoff: 'exponential',
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (!error.response) {return true;} // Network error
    if (error.response?.status >= 500) {return true;} // Server error
    if (error.response?.status === 408) {return true;} // Request timeout
    if (error.response?.status === 429) {return true;} // Rate limit
    return false;
  },
};

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay based on backoff strategy
 */
const calculateDelay = (
  attempt: number,
  baseDelay: number,
  backoff: 'linear' | 'exponential'
): number => {
  switch (backoff) {
    case 'linear':
      return baseDelay * attempt;
    case 'exponential':
      return baseDelay * Math.pow(2, attempt - 1);
    default:
      return baseDelay;
  }
};

/**
 * Retry wrapper for async functions
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= finalConfig.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!finalConfig.retryCondition?.(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === finalConfig.attempts) {
        break;
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt, finalConfig.delay, finalConfig.backoff);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Request failed (attempt ${attempt}/${finalConfig.attempts}), retrying in ${delay}ms:`, errorMessage);

      await sleep(delay);
    }
  }

  // If we get here, all attempts failed
  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
  throw new Error(`Request failed after ${finalConfig.attempts} attempts. Last error: ${errorMessage}`);
}

/**
 * Retry configuration for different types of operations
 */
export const RETRY_CONFIGS = {
  // For critical operations like saving user data
  CRITICAL: {
    attempts: 5,
    delay: 1000,
    backoff: 'exponential' as const,
  },

  // For standard API calls
  STANDARD: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential' as const,
  },

  // For non-critical operations like analytics
  LIGHT: {
    attempts: 2,
    delay: 500,
    backoff: 'linear' as const,
  },

  // For real-time operations that should fail fast
  FAST_FAIL: {
    attempts: 1,
    delay: 0,
    backoff: 'linear' as const,
  },
} as const;

/**
 * React Query retry function
 */
export const createRetryFunction = (config: Partial<RetryConfig> = {}) => {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return (failureCount: number, error: any): boolean => {
    // Don't retry if we've exceeded max attempts
    if (failureCount >= finalConfig.attempts) {
      return false;
    }

    // Use the retry condition to determine if we should retry
    return finalConfig.retryCondition?.(error) ?? false;
  };
};

/**
 * React Query retry delay function
 */
export const createRetryDelayFunction = (config: Partial<RetryConfig> = {}) => {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return (retryAttempt: number, _error: any): number => {
    return calculateDelay(retryAttempt, finalConfig.delay, finalConfig.backoff);
  };
};
