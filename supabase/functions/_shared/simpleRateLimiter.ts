/**
 * Simple in-memory rate limiter using sliding window algorithm
 * Lightweight solution that doesn't require database tables
 * Perfect for Edge Functions with short-lived instances
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Prefix for identification
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Rate limit configurations by endpoint type
 */
export const RATE_LIMIT_CONFIGS = {
  devotional: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 devotionals per hour per user
    keyPrefix: 'devotional',
  },
  playbook: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 15, // 15 playbooks per hour per user
    keyPrefix: 'playbook',
  },
  question: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 questions per minute per user
    keyPrefix: 'question',
  },
  coaching: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 coaching messages per minute per user
    keyPrefix: 'coaching',
  },
} as const;

// In-memory store for rate limit data
// Note: This resets when Edge Function instance restarts (typically every few minutes)
// For production, consider using Supabase database or Redis
const rateLimitStore = new Map<string, number[]>();

/**
 * Simple sliding window rate limiter
 * Tracks timestamps of requests within the time window
 */
export class SimpleRateLimiter {
  /**
   * Check if request is allowed under rate limit
   */
  static checkLimit(
    userId: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = `${config.keyPrefix}:${userId}`;

    // Get existing timestamps for this key
    const timestamps = rateLimitStore.get(key) || [];
    
    // Filter to only timestamps within the current window
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    // Check if limit exceeded
    if (validTimestamps.length >= config.maxRequests) {
      // Calculate when oldest request will expire
      const oldestTimestamp = Math.min(...validTimestamps);
      const resetAt = new Date(oldestTimestamp + config.windowMs);
      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Allow request and record timestamp
    const newTimestamps = [...validTimestamps, now];
    rateLimitStore.set(key, newTimestamps);

    // Clean up old entries periodically (every 100 requests)
    if (rateLimitStore.size > 1000) {
      this.cleanup();
    }

    const remaining = config.maxRequests - newTimestamps.length;
    const resetAt = new Date(now + config.windowMs);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Get current rate limit status without consuming a request
   */
  static getStatus(
    userId: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = `${config.keyPrefix}:${userId}`;

    const timestamps = rateLimitStore.get(key) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    const remaining = Math.max(0, config.maxRequests - validTimestamps.length);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: new Date(now + config.windowMs),
    };
  }

  /**
   * Clean up expired entries from store
   */
  private static cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour max

    for (const [key, timestamps] of rateLimitStore.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > now - maxAge);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, validTimestamps);
      }
    }
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  static resetLimit(userId: string, keyPrefix: string): void {
    const key = `${keyPrefix}:${userId}`;
    rateLimitStore.delete(key);
  }
}

/**
 * Helper function to create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
  };
}

/**
 * Helper function to create rate limit error response
 */
export function createRateLimitError(result: RateLimitResult, message?: string): Response {
  const defaultMessage = result.retryAfter
    ? `You're doing that too often. Please wait ${result.retryAfter} seconds before trying again.`
    : 'You\'ve reached your request limit. Please try again later.';

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: message || defaultMessage,
      retryAfter: result.retryAfter,
      resetAt: result.resetAt.toISOString(),
      retryable: true,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
      },
    }
  );
}
