/**
 * Enterprise Response Caching
 * Caches AI responses to reduce costs and improve performance
 * Uses content-based hashing for cache keys
 */

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
  enabled: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

/**
 * Default cache configurations by content type
 */
export const CACHE_CONFIGS = {
  // Devotionals: Cache for 24 hours (content is relatively stable)
  devotional: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 100,
    enabled: true,
  },
  // Playbooks: Cache for 12 hours (more personalized)
  playbook: {
    ttl: 12 * 60 * 60 * 1000, // 12 hours
    maxSize: 100,
    enabled: true,
  },
  // Questions: Cache for 1 hour (very contextual)
  question: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 50,
    enabled: true,
  },
  // Coaching: Cache for 30 minutes (highly contextual)
  coaching: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 50,
    enabled: true,
  },
} as const;

/**
 * In-memory cache store
 * Maps cache keys to cached responses
 */
const cacheStore = new Map<string, CacheEntry<any>>();

/**
 * Simple hash function for generating cache keys
 * Uses content-based hashing for deterministic keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key from request parameters
 * Normalizes input to ensure consistent keys
 */
export function generateCacheKey(
  type: string,
  params: Record<string, any>
): string {
  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(params).sort();
  const normalized = sortedKeys
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  
  const hash = hashString(normalized);
  return `${type}:${hash}`;
}

/**
 * Response Cache Manager
 * Handles caching of AI responses with TTL and size limits
 */
export class ResponseCache {
  /**
   * Get cached response if available and not expired
   */
  static get<T>(
    cacheKey: string,
    config: CacheConfig
  ): T | null {
    if (!config.enabled) {
      return null;
    }

    const entry = cacheStore.get(cacheKey);
    
    if (!entry) {
      console.log(`[Cache] MISS - ${cacheKey}`);
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiresAt) {
      console.log(`[Cache] EXPIRED - ${cacheKey}`);
      cacheStore.delete(cacheKey);
      return null;
    }

    // Update hit count
    entry.hits++;
    console.log(`[Cache] HIT - ${cacheKey} (hits: ${entry.hits})`);
    
    return entry.data as T;
  }

  /**
   * Store response in cache
   */
  static set<T>(
    cacheKey: string,
    data: T,
    config: CacheConfig
  ): void {
    if (!config.enabled) {
      return;
    }

    const now = Date.now();
    
    // Check cache size limit
    if (cacheStore.size >= config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + config.ttl,
      hits: 0,
    };

    cacheStore.set(cacheKey, entry);
    console.log(`[Cache] SET - ${cacheKey} (TTL: ${config.ttl}ms)`);
  }

  /**
   * Evict oldest cache entry (LRU-like)
   */
  private static evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cacheStore.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cacheStore.delete(oldestKey);
      console.log(`[Cache] EVICTED - ${oldestKey}`);
    }
  }

  /**
   * Clear expired entries (garbage collection)
   */
  static cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of cacheStore.entries()) {
      if (now > entry.expiresAt) {
        cacheStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] CLEANUP - Removed ${cleaned} expired entries`);
    }
  }

  /**
   * Invalidate specific cache entry
   */
  static invalidate(cacheKey: string): void {
    const deleted = cacheStore.delete(cacheKey);
    if (deleted) {
      console.log(`[Cache] INVALIDATED - ${cacheKey}`);
    }
  }

  /**
   * Clear all cache entries
   */
  static clear(): void {
    const size = cacheStore.size;
    cacheStore.clear();
    console.log(`[Cache] CLEARED - Removed ${size} entries`);
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getStats(): {
    size: number;
    entries: Array<{
      key: string;
      age: number;
      hits: number;
      ttl: number;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(cacheStore.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      hits: entry.hits,
      ttl: entry.expiresAt - now,
    }));

    return {
      size: cacheStore.size,
      entries,
    };
  }

  /**
   * Execute function with caching
   * Checks cache first, executes function if miss, then caches result
   */
  static async withCache<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    config: CacheConfig
  ): Promise<{ data: T; cached: boolean }> {
    // Try to get from cache
    const cached = this.get<T>(cacheKey, config);
    if (cached !== null) {
      return { data: cached, cached: true };
    }

    // Execute function
    const data = await fn();

    // Store in cache
    this.set(cacheKey, data, config);

    return { data, cached: false };
  }
}

/**
 * Periodic cleanup task
 * Run every 5 minutes to remove expired entries
 */
let cleanupInterval: number | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval !== null) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    ResponseCache.cleanup();
  }, 5 * 60 * 1000) as unknown as number; // 5 minutes

  console.log('[Cache] Cleanup task started (every 5 minutes)');
}

export function stopCacheCleanup(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Cache] Cleanup task stopped');
  }
}

// Start cleanup on module load
startCacheCleanup();
