/**
 * Rate Limiting Utility
 * Client-side rate limiting for all subscription tiers
 * Prevents abuse while maintaining excellent UX for normal users
 */

import { Logger } from './ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { monitoring } from './monitoring';

export type SubscriptionTier = 'seeker' | 'spark' | 'growth' | 'transformation' | 'family';

export interface RateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
  perMonth: number;
  cooldownSeconds: number; // Minimum seconds between requests
}

/**
 * Rate limits per subscription tier
 * PHILOSOPHY: Only prevent abuse, not restrict normal usage
 * Paying users should NEVER hit these limits in normal use
 */
export const TIER_RATE_LIMITS: Record<SubscriptionTier, RateLimitConfig> = {
  // Free tier - Prevent abuse (they already have subscription limits)
  seeker: {
    perMinute: 1,
    perHour: 3,
    perDay: 10,
    perMonth: 999999, // No monthly limit - subscription service handles this
    cooldownSeconds: 30, // Prevent button mashing
  },

  // Spark tier - 10 playbooks/month (subscription handles limit)
  // Rate limits ONLY prevent rapid abuse, not normal usage
  spark: {
    perMinute: 3,     // Can generate 3 quickly if needed
    perHour: 10,      // Generous - normal users won't hit this
    perDay: 999999,   // No daily limit - subscription handles monthly
    perMonth: 999999, // No monthly limit - subscription handles this
    cooldownSeconds: 5, // Just prevent accidental double-clicks
  },

  // Growth tier - 25 playbooks/month (subscription handles limit)
  // Rate limits ONLY prevent rapid abuse
  growth: {
    perMinute: 5,     // Very generous
    perHour: 20,      // More than they can use
    perDay: 999999,   // No daily limit - subscription handles monthly
    perMonth: 999999, // No monthly limit - subscription handles this
    cooldownSeconds: 5, // Just prevent accidental double-clicks
  },

  // Transformation tier - Unlimited (but prevent abuse)
  transformation: {
    perMinute: 10,    // Very generous
    perHour: 50,      // More than anyone needs
    perDay: 200,      // Abuse protection only
    perMonth: 1000,   // Extreme abuse protection ($10 cost cap)
    cooldownSeconds: 3, // Minimal - just prevent accidents
  },

  // Family tier - Unlimited for 5 users (but prevent abuse)
  family: {
    perMinute: 20,    // 5 users × 4 = very generous
    perHour: 100,     // 5 users × 20 = more than needed
    perDay: 500,      // Abuse protection only
    perMonth: 2000,   // Extreme abuse protection ($20 cost cap)
    cooldownSeconds: 3, // Minimal - just prevent accidents
  },
};

interface RateLimitEntry {
  timestamp: number;
  count: number;
}

interface RateLimitState {
  lastRequestTime: number;
  minuteRequests: RateLimitEntry[];
  hourRequests: RateLimitEntry[];
  dayRequests: RateLimitEntry[];
  monthRequests: RateLimitEntry[];
}

class RateLimiter {
  private storageKey = '@siFia:rateLimits';
  private cache = new Map<string, RateLimitState>();
  private saveLocks = new Map<string, Promise<void>>(); // Prevent concurrent saves

  /**
   * Check if a request is allowed for the given user and tier
   * Returns { allowed: boolean, reason?: string, waitSeconds?: number }
   */
  async canMakeRequest(
    userId: string,
    tier: SubscriptionTier,
    operationType: 'playbook' | 'devotional' = 'playbook'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    waitSeconds?: number;
    remaining?: {
      minute: number;
      hour: number;
      day: number;
      month: number;
    };
  }> {
    const limits = TIER_RATE_LIMITS[tier];
    const state = await this.getState(userId, operationType);
    const now = Date.now();

    // 1. Check cooldown (minimum time between requests)
    const timeSinceLastRequest = (now - state.lastRequestTime) / 1000;
    if (timeSinceLastRequest < limits.cooldownSeconds) {
      const waitSeconds = Math.ceil(limits.cooldownSeconds - timeSinceLastRequest);

      // Track rate limit hit (no UI impact)
      monitoring.trackMetric('rate_limit_hit', 1, {
        tier,
        limitType: 'cooldown',
        waitSeconds,
      });

      return {
        allowed: false,
        reason: `Unusual activity detected. Please wait ${waitSeconds} seconds to ensure quality.`,
        waitSeconds,
      };
    }

    // Clean up old entries
    this.cleanupOldEntries(state, now);

    // 2. Check per-minute limit
    if (state.minuteRequests.length >= limits.perMinute) {
      const oldestRequest = state.minuteRequests[0];
      const waitMs = 60000 - (now - oldestRequest.timestamp);
      const waitSeconds = Math.ceil(waitMs / 1000);
      return {
        allowed: false,
        reason: `Unusual activity detected. Please wait ${waitSeconds} seconds while we ensure quality.`,
        waitSeconds,
      };
    }

    // 3. Check per-hour limit
    if (state.hourRequests.length >= limits.perHour) {
      const oldestRequest = state.hourRequests[0];
      const waitMs = 3600000 - (now - oldestRequest.timestamp);
      const waitMinutes = Math.ceil(waitMs / 60000);
      return {
        allowed: false,
        reason: `Unusual activity detected. Please wait ${waitMinutes} minutes while we ensure quality for everyone.`,
        waitSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // 4. Check per-day limit
    if (state.dayRequests.length >= limits.perDay) {
      const oldestRequest = state.dayRequests[0];
      const waitMs = 86400000 - (now - oldestRequest.timestamp);
      const waitHours = Math.ceil(waitMs / 3600000);
      return {
        allowed: false,
        reason: `Unusual activity detected today. This helps us maintain quality for everyone. Please try again in ${waitHours} hours.`,
        waitSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // 5. Check per-month limit
    if (state.monthRequests.length >= limits.perMonth) {
      const oldestRequest = state.monthRequests[0];
      const waitMs = 2592000000 - (now - oldestRequest.timestamp); // 30 days
      // const waitDays = Math.ceil(waitMs / 86400000); // Unused but kept for reference
      return {
        allowed: false,
        reason: 'Unusual activity detected this month. This helps us maintain service quality. Please contact support if you need assistance.',
        waitSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // All checks passed - request is allowed
    return {
      allowed: true,
      remaining: {
        minute: limits.perMinute - state.minuteRequests.length,
        hour: limits.perHour - state.hourRequests.length,
        day: limits.perDay - state.dayRequests.length,
        month: limits.perMonth - state.monthRequests.length,
      },
    };
  }

  /**
   * Record a successful request
   */
  async recordRequest(
    userId: string,
    operationType: 'playbook' | 'devotional' = 'playbook'
  ): Promise<void> {
    try {
      const state = await this.getState(userId, operationType);
      const now = Date.now();

      // Update last request time
      state.lastRequestTime = now;

      // Add to all time windows
      const entry: RateLimitEntry = { timestamp: now, count: 1 };
      state.minuteRequests.push(entry);
      state.hourRequests.push(entry);
      state.dayRequests.push(entry);
      state.monthRequests.push(entry);

      // Clean up old entries
      this.cleanupOldEntries(state, now);

      // Save state (non-blocking)
      await this.saveState(userId, operationType, state);

      Logger.info(`📊 Rate limit recorded for ${userId}`, {
        component: 'rateLimiting',
        data: {
          operationType,
          remaining: {
            minute: state.minuteRequests.length,
            hour: state.hourRequests.length,
            day: state.dayRequests.length,
            month: state.monthRequests.length,
          },
        },
      });
    } catch (error) {
      // Log error but don't throw - rate limiting is not critical enough to block user
      Logger.error('Failed to record rate limit', error as Error, {
        component: 'rateLimiting',
      });
    }
  }

  /**
   * Get current rate limit state for a user
   */
  private async getState(
    userId: string,
    operationType: string
  ): Promise<RateLimitState> {
    const cacheKey = `${userId}-${operationType}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Load from storage
    try {
      const stored = await AsyncStorage.getItem(`${this.storageKey}:${cacheKey}`);
      if (stored) {
        const state = JSON.parse(stored) as RateLimitState;
        this.cache.set(cacheKey, state);
        return state;
      }
    } catch (error) {
      Logger.error('Failed to load rate limit state', error as Error, {
        component: 'rateLimiting',
      });
    }

    // Return fresh state
    const freshState: RateLimitState = {
      lastRequestTime: 0,
      minuteRequests: [],
      hourRequests: [],
      dayRequests: [],
      monthRequests: [],
    };
    this.cache.set(cacheKey, freshState);
    return freshState;
  }

  /**
   * Save rate limit state with lock to prevent race conditions
   */
  private async saveState(
    userId: string,
    operationType: string,
    state: RateLimitState
  ): Promise<void> {
    const cacheKey = `${userId}-${operationType}`;

    // Update cache immediately (synchronous)
    this.cache.set(cacheKey, state);

    // Wait for any existing save to complete
    const existingLock = this.saveLocks.get(cacheKey);
    if (existingLock) {
      try {
        await existingLock;
      } catch {
        // Ignore errors from previous save
      }
    }

    // Create new save promise
    const savePromise = (async () => {
      try {
        await AsyncStorage.setItem(
          `${this.storageKey}:${cacheKey}`,
          JSON.stringify(state)
        );
      } catch (error) {
        Logger.error('Failed to save rate limit state', error as Error, {
          component: 'rateLimiting',
        });
        // Don't throw - we have the cache
      } finally {
        // Clean up lock
        this.saveLocks.delete(cacheKey);
      }
    })();

    // Store the promise
    this.saveLocks.set(cacheKey, savePromise);

    // Don't await - let it save in background
    // This prevents blocking the UI
  }

  /**
   * Clean up old entries from rate limit state
   */
  private cleanupOldEntries(state: RateLimitState, now: number): void {
    // Remove entries older than 1 minute
    state.minuteRequests = state.minuteRequests.filter(
      (entry) => now - entry.timestamp < 60000
    );

    // Remove entries older than 1 hour
    state.hourRequests = state.hourRequests.filter(
      (entry) => now - entry.timestamp < 3600000
    );

    // Remove entries older than 1 day
    state.dayRequests = state.dayRequests.filter(
      (entry) => now - entry.timestamp < 86400000
    );

    // Remove entries older than 30 days
    state.monthRequests = state.monthRequests.filter(
      (entry) => now - entry.timestamp < 2592000000
    );
  }

  /**
   * Get user-friendly message for rate limit
   */
  getUserFriendlyMessage(
    tier: SubscriptionTier,
    reason: string,
    _waitSeconds?: number // Prefixed with _ to indicate intentionally unused
  ): string {
    // All messages now use "unusual activity" language
    // Just return the reason as-is since it's already user-friendly
    return reason;
  }

  /**
   * Clear rate limits for a user (useful for testing or admin actions)
   */
  async clearUserLimits(userId: string): Promise<void> {
    const keys = [`${userId}-playbook`, `${userId}-devotional`];

    for (const key of keys) {
      this.cache.delete(key);
      try {
        await AsyncStorage.removeItem(`${this.storageKey}:${key}`);
      } catch (error) {
        Logger.error('Failed to clear rate limits', error as Error, {
          component: 'rateLimiting',
        });
      }
    }

    Logger.info(`🧹 Cleared rate limits for user ${userId}`, {
      component: 'rateLimiting',
    });
  }

  /**
   * Get statistics for a user (for debugging/admin)
   */
  async getUserStats(
    userId: string,
    operationType: 'playbook' | 'devotional' = 'playbook'
  ): Promise<{
    lastRequest: Date | null;
    requestsInLastMinute: number;
    requestsInLastHour: number;
    requestsInLastDay: number;
    requestsInLastMonth: number;
  }> {
    const state = await this.getState(userId, operationType);
    const now = Date.now();
    this.cleanupOldEntries(state, now);

    return {
      lastRequest: state.lastRequestTime > 0 ? new Date(state.lastRequestTime) : null,
      requestsInLastMinute: state.minuteRequests.length,
      requestsInLastHour: state.hourRequests.length,
      requestsInLastDay: state.dayRequests.length,
      requestsInLastMonth: state.monthRequests.length,
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Helper function to check and record a request in one call
 */
export async function checkAndRecordRequest(
  userId: string,
  tier: SubscriptionTier,
  operationType: 'playbook' | 'devotional' = 'playbook'
): Promise<{
  allowed: boolean;
  message?: string;
  waitSeconds?: number;
}> {
  const check = await rateLimiter.canMakeRequest(userId, tier, operationType);

  if (!check.allowed) {
    const friendlyMessage = rateLimiter.getUserFriendlyMessage(
      tier,
      check.reason || 'Rate limit exceeded',
      check.waitSeconds
    );

    Logger.warn(`🚫 Rate limit hit for ${userId}`, {
      component: 'rateLimiting',
      data: {
        tier,
        operationType,
        reason: check.reason,
        waitSeconds: check.waitSeconds,
      },
    });

    return {
      allowed: false,
      message: friendlyMessage,
      waitSeconds: check.waitSeconds,
    };
  }

  // Record the request
  await rateLimiter.recordRequest(userId, operationType);

  return {
    allowed: true,
  };
}
