/**
 * Request Deduplication Utility
 * Prevents duplicate API requests from the same user
 * Enterprise-grade protection against button mashing and concurrent requests
 */

import { Logger } from './ProductionLogger';

interface CachedRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  key: string;
}

/**
 * Request cache to store in-flight requests
 * Key format: "userId-operationType-contentHash"
 */
class RequestCache {
  private cache = new Map<string, CachedRequest<any>>();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get or create a request
   * If request is in flight, return existing promise
   * Otherwise, execute the request factory and cache it
   */
  async getOrCreate<T>(
    key: string,
    requestFactory: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Check if request is already in flight
    const cached = this.cache.get(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;

      if (age < this.CACHE_TTL) {
        Logger.info(`🔄 Deduplicating ${operationName} request`, {
          component: 'requestDeduplication',
          data: { key, age },
        });
        return cached.promise;
      } else {
        // Expired, remove it
        this.cache.delete(key);
      }
    }

    // Create new request
    Logger.info(`🆕 Creating new ${operationName} request`, {
      component: 'requestDeduplication',
      data: { key },
    });

    const promise = requestFactory();

    // Cache the promise
    this.cache.set(key, {
      promise,
      timestamp: Date.now(),
      key,
    });

    // Clean up after completion (success or failure)
    promise
      .then(() => {
        // Keep in cache for a bit to prevent immediate duplicates
        setTimeout(() => {
          this.cache.delete(key);
        }, 5000); // 5 seconds
      })
      .catch(() => {
        // Remove immediately on error so user can retry
        this.cache.delete(key);
      });

    return promise;
  }

  /**
   * Check if a request is currently in flight
   */
  isInFlight(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) {return false;}

    const age = Date.now() - cached.timestamp;
    return age < this.CACHE_TTL;
  }

  /**
   * Clear a specific request from cache
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached requests
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Start periodic cleanup of expired requests
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {return;}

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.cache.forEach((cached, key) => {
        const age = now - cached.timestamp;
        if (age > this.CACHE_TTL) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.cache.delete(key));

      if (keysToDelete.length > 0) {
        Logger.info(`🧹 Cleaned up ${keysToDelete.length} expired requests`, {
          component: 'requestDeduplication',
        });
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Stop cleanup interval (for testing or cleanup)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
const requestCache = new RequestCache();

/**
 * Generate a cache key for a request
 * Uses MD5-like hash for content to detect duplicates
 */
export function generateRequestKey(
  userId: string,
  operationType: string,
  content: string
): string {
  // Simple hash function (not cryptographic, just for deduplication)
  const hash = simpleHash(content);
  return `${userId}-${operationType}-${hash}`;
}

/**
 * Simple hash function for content deduplication
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash) + char;
    // eslint-disable-next-line no-bitwise
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Deduplicate a playbook generation request
 */
export async function deduplicatePlaybookGeneration<T>(
  userId: string,
  userInput: string,
  requestFactory: () => Promise<T>
): Promise<T> {
  const key = generateRequestKey(userId, 'playbook', userInput);
  return requestCache.getOrCreate(key, requestFactory, 'Playbook Generation');
}

/**
 * Check if a playbook generation is in flight
 */
export function isPlaybookGenerationInFlight(
  userId: string,
  userInput: string
): boolean {
  const key = generateRequestKey(userId, 'playbook', userInput);
  return requestCache.isInFlight(key);
}

/**
 * Clear all cached requests (useful for logout or testing)
 */
export function clearAllRequestCache(): void {
  requestCache.clearAll();
}

/**
 * Get cache statistics (for debugging)
 */
export function getRequestCacheStats(): { size: number; keys: string[] } {
  return requestCache.getStats();
}

// Export for testing
export { requestCache };
