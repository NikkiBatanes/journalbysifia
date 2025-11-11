/**
 * API Timeout Utility
 * Wraps API calls with configurable timeouts to prevent hanging requests
 * Enterprise-grade error handling without breaking existing functionality
 */

import { Logger } from './ProductionLogger';

export interface TimeoutConfig {
  timeoutMs: number;
  operationName: string;
  retryOnTimeout?: boolean;
  maxRetries?: number;
}

export class TimeoutError extends Error {
  constructor(message: string, public readonly operationName: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 * If the promise doesn't resolve within timeoutMs, it rejects with TimeoutError
 * The original promise continues running (can't be cancelled) but we stop waiting
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  config: TimeoutConfig
): Promise<T> {
  const { timeoutMs, operationName } = config;

  return new Promise<T>((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      const error = new TimeoutError(
        `Operation '${operationName}' timed out after ${timeoutMs}ms`,
        operationName
      );

      Logger.warn(`⏱️ Timeout: ${operationName}`, {
        component: 'apiTimeout',
        data: { timeoutMs, operationName },
      });

      reject(error);
    }, timeoutMs);

    // Wait for the promise
    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Wraps a promise with timeout and optional retry logic
 * Preserves existing behavior while adding safety net
 */
export async function withTimeoutAndRetry<T>(
  promiseFactory: () => Promise<T>,
  config: TimeoutConfig
): Promise<T> {
  const { retryOnTimeout = false, maxRetries = 0 } = config;

  let lastError: Error | null = null;
  const attempts = retryOnTimeout ? maxRetries + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const promise = promiseFactory();
      const result = await withTimeout(promise, config);
      return result;
    } catch (error) {
      lastError = error as Error;

      // If it's not a timeout error, don't retry
      if (!(error instanceof TimeoutError)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === attempts - 1) {
        throw error;
      }

      // Log retry attempt
      Logger.warn(`🔄 Retrying ${config.operationName} (attempt ${attempt + 2}/${attempts})`, {
        component: 'apiTimeout',
      });

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('Unexpected error in withTimeoutAndRetry');
}

/**
 * Predefined timeout configurations for different operation types
 * These are safe defaults that won't break existing functionality
 */
export const TIMEOUT_CONFIGS = {
  // AI generation can take time, so we're generous
  AI_GENERATION: {
    timeoutMs: 60000, // 60 seconds
    operationName: 'AI Generation',
    retryOnTimeout: false, // Don't retry AI generation on timeout
  },

  // Database operations should be fast
  DATABASE_READ: {
    timeoutMs: 10000, // 10 seconds
    operationName: 'Database Read',
    retryOnTimeout: true,
    maxRetries: 2,
  },

  DATABASE_WRITE: {
    timeoutMs: 15000, // 15 seconds
    operationName: 'Database Write',
    retryOnTimeout: true,
    maxRetries: 2,
  },

  // API calls to external services
  API_CALL: {
    timeoutMs: 30000, // 30 seconds
    operationName: 'API Call',
    retryOnTimeout: true,
    maxRetries: 1,
  },

  // Quick operations
  QUICK_OPERATION: {
    timeoutMs: 5000, // 5 seconds
    operationName: 'Quick Operation',
    retryOnTimeout: false,
  },
} as const;

/**
 * Helper to check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
