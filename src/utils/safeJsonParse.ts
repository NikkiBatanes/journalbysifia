/**
 * Safe JSON Parser Utility
 * Prevents crashes from malformed JSON data
 */

import { Logger } from './ProductionLogger';

export interface SafeJsonParseOptions<T> {
  fallback?: T | null | undefined;
  logError?: boolean;
  context?: string;
}

/**
 * Safely parse JSON with error handling and fallback
 * @param jsonString - The JSON string to parse
 * @param options - Configuration options
 * @returns Parsed object or fallback value
 */
export function safeJsonParse<T = any>(
  jsonString: string | null | undefined,
  options: SafeJsonParseOptions<T> = {}
): T | null {
  const { fallback = null, logError = true, context = 'JSON Parse' } = options;

  // Handle null/undefined input
  if (jsonString === null || jsonString === undefined || jsonString === '') {
    return fallback as T;
  }

  // Handle non-string input
  if (typeof jsonString !== 'string') {
    if (logError) {
      Logger.warn(`[${context}] Expected string but got ${typeof jsonString}`, {
        component: 'safeJsonParse',
      });
    }
    return fallback as T;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch (error) {
    if (logError) {
      Logger.error(
        `[${context}] Failed to parse JSON`,
        error as Error,
        {
          component: 'safeJsonParse',
          jsonPreview: jsonString.substring(0, 100),
        }
      );
    }
    return fallback as T;
  }
}

/**
 * Safely stringify JSON with error handling
 * @param value - The value to stringify
 * @param options - Configuration options
 * @returns JSON string or fallback
 */
export function safeJsonStringify<T = any>(
  value: T,
  options: { fallback?: string; logError?: boolean; context?: string } = {}
): string {
  const { fallback = '{}', logError = true, context = 'JSON Stringify' } = options;

  try {
    return JSON.stringify(value);
  } catch (error) {
    if (logError) {
      Logger.error(
        `[${context}] Failed to stringify JSON`,
        error as Error,
        {
          component: 'safeJsonStringify',
          valueType: typeof value,
        }
      );
    }
    return fallback;
  }
}

/**
 * Parse JSON from AsyncStorage with type safety
 * @param value - The stored value
 * @param fallback - Fallback value if parse fails
 * @returns Parsed value or fallback
 */
export function parseStorageValue<T>(
  value: string | null,
  fallback: T
): T {
  return safeJsonParse<T>(value, {
    fallback,
    logError: true,
    context: 'AsyncStorage',
  }) as T;
}

export default safeJsonParse;
