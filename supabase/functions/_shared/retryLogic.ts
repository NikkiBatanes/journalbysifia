/**
 * Enterprise-grade retry logic with exponential backoff
 * Handles transient failures gracefully without overwhelming the API
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry configuration for AI API calls
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // Start with 1 second
  maxDelayMs: 10000, // Cap at 10 seconds
  backoffMultiplier: 2, // Double the delay each time
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'NetworkError',
    'FetchError',
  ],
};

/**
 * Determines if an error is retryable based on status code or error type
 */
export function isRetryableError(
  error: unknown,
  statusCode?: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // Check status code
  if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Check error type
  if (error instanceof Error) {
    const errorMessage = error.message;
    return config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }

  return false;
}

/**
 * Calculates delay with exponential backoff and jitter
 * Jitter prevents thundering herd problem
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter (±25% randomness)
  const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
  const finalDelay = Math.max(0, cappedDelay + jitter);
  
  return Math.floor(finalDelay);
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns RetryResult with success status and data or error
 * 
 * @example
 * const result = await withRetry(async () => {
 *   const response = await fetch('https://api.openai.com/...');
 *   if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *   return await response.json();
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    attempts = attempt;

    try {
      console.log(`[Retry] Attempt ${attempt}/${config.maxRetries + 1}`);
      const data = await fn();
      
      const totalDuration = Date.now() - startTime;
      console.log(`[Retry] Success on attempt ${attempt} (${totalDuration}ms)`);
      
      return {
        success: true,
        data,
        attempts,
        totalDuration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.error(`[Retry] Attempt ${attempt} failed:`, lastError.message);

      // Check if we should retry
      const shouldRetry = attempt <= config.maxRetries && isRetryableError(lastError);
      
      if (!shouldRetry) {
        console.log(`[Retry] Not retrying. Retryable: ${isRetryableError(lastError)}, Attempts left: ${config.maxRetries - attempt + 1}`);
        break;
      }

      // Calculate and wait for backoff delay
      const delay = calculateBackoffDelay(attempt, config);
      console.log(`[Retry] Waiting ${delay}ms before retry ${attempt + 1}...`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  const totalDuration = Date.now() - startTime;
  console.error(`[Retry] All ${attempts} attempts failed (${totalDuration}ms)`);
  
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts,
    totalDuration,
  };
}

/**
 * Wrapper for fetch with retry logic
 * Automatically handles HTTP errors and retries
 * 
 * @example
 * const response = await fetchWithRetry('https://api.openai.com/...', {
 *   method: 'POST',
 *   headers: { 'Authorization': 'Bearer ...' },
 *   body: JSON.stringify({ ... })
 * });
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  const result = await withRetry(async () => {
    const response = await fetch(url, options);
    
    // Check if status code is retryable
    if (!response.ok && isRetryableError(null, response.status, config)) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // For non-retryable errors, throw immediately
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response;
  }, config);

  if (!result.success) {
    throw result.error || new Error('Fetch failed after retries');
  }

  return result.data!;
}

/**
 * Custom retry config for OpenAI API
 * More aggressive retries for rate limits
 */
export const OPENAI_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: 4, // More retries for OpenAI
  initialDelayMs: 2000, // Start with 2 seconds
  maxDelayMs: 30000, // Cap at 30 seconds for rate limits
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Include 429 for rate limits
};
