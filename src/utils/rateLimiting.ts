/**
 * Rate Limiting Utility
 * Client-side rate limiting for all subscription tiers
 * Prevents abuse while maintaining excellent UX for normal users
 */

import { Logger } from './ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
 * Based on your pricing tiers and expected usage patterns
 */
export const TIER_RATE_LIMITS: Record<SubscriptionTier, RateLimitConfig> = {
  // Free tier - Very conservative to prevent abuse
  seeker: {
    perMinute: 1,
    perHour: 3,
    perDay: 5,
    perMonth: 10,
    cooldownSeconds: 30, // 30 seconds between requests
  },
  
  // Spark tier - 8 playbooks/month included
  // Allow some flexibility but prevent abuse
  spark: {
    perMinute: 2,
    perHour: 5,
    perDay: 10,
    perMonth: 20, // 2.5x monthly limit for flexibility
    cooldownSeconds: 15, // 15 seconds between requests
  },
  
  // Growth tier - 20 playbooks/month included
  // More generous limits for engaged users
  growth: {
    perMinute: 3,
    perHour: 10,
    perDay: 25,
    perMonth: 50, // 2.5x monthly limit
    cooldownSeconds: 10, // 10 seconds between requests
  },
  
  // Transformation tier - Unlimited playbooks
  // High limits but still prevent abuse
  transformation: {
    perMinute: 5,
    perHour: 30,
    perDay: 100,
    perMonth: 500, // Reasonable "unlimited" with abuse protection
    cooldownSeconds: 5, // 5 seconds between requests
  },
  
  // Family tier - Unlimited for 5 users
  // Same as transformation but tracked per family
  family: {
    perMinute: 10, // 5 users × 2 requests/min
    perHour: 60,   // 5 users × 12 requests/hour
    perDay: 200,   // 5 users × 40 requests/day
    perMonth: 1000, // 5 users × 200 requests/month
    cooldownSeconds: 5, // 5 seconds between requests per user
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
      return {
        allowed: false,
        reason: `Please wait ${waitSeconds} seconds before generating another ${operationType}`,
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
        reason: `You've reached your limit of ${limits.perMinute} ${operationType}s per minute. Please wait ${waitSeconds} seconds.`,
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
        reason: `You've reached your limit of ${limits.perHour} ${operationType}s per hour. Please wait ${waitMinutes} minutes.`,
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
        reason: `You've reached your daily limit of ${limits.perDay} ${operationType}s. Please try again in ${waitHours} hours.`,
        waitSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // 5. Check per-month limit
    if (state.monthRequests.length >= limits.perMonth) {
      const oldestRequest = state.monthRequests[0];
      const waitMs = 2592000000 - (now - oldestRequest.timestamp); // 30 days
      const waitDays = Math.ceil(waitMs / 86400000);
      return {
        allowed: false,
        reason: `You've reached your monthly limit of ${limits.perMonth} ${operationType}s. Please upgrade your plan or wait ${waitDays} days.`,
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

    // Save state
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
   * Save rate limit state
   */
  private async saveState(
    userId: string,
    operationType: string,
    state: RateLimitState
  ): Promise<void> {
    const cacheKey = `${userId}-${operationType}`;
    this.cache.set(cacheKey, state);

    try {
      await AsyncStorage.setItem(
        `${this.storageKey}:${cacheKey}`,
        JSON.stringify(state)
      );
    } catch (error) {
      Logger.error('Failed to save rate limit state', error as Error, {
        component: 'rateLimiting',
      });
    }
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
    waitSeconds?: number
  ): string {
    const limits = TIER_RATE_LIMITS[tier];

    // For transformation and family tiers, emphasize quality over quantity
    if (tier === 'transformation' || tier === 'family') {
      if (waitSeconds && waitSeconds < 60) {
        return `Taking a moment to ensure quality... Please wait ${waitSeconds} seconds.`;
      }
      return reason;
    }

    // For paid tiers, be encouraging
    if (tier === 'spark' || tier === 'growth') {
      if (reason.includes('monthly limit')) {
        return `You've used your monthly playbooks! Upgrade to Transformation for unlimited access, or wait for your limit to reset.`;
      }
      if (waitSeconds && waitSeconds < 60) {
        return `Almost ready! Please wait ${waitSeconds} seconds before creating another playbook.`;
      }
      return reason;
    }

    // For free tier, encourage upgrade
    if (reason.includes('monthly limit') || reason.includes('daily limit')) {
      return `You've reached your free limit. Upgrade to Spark for 8 playbooks per month, or Growth for 20!`;
    }

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
