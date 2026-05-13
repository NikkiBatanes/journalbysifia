/**
 * Enterprise Key Pool Manager for 2000+ Users
 * Handles multiple OpenAI API keys with intelligent routing
 */

export interface APIKey {
  id: string;
  key: string;
  tier: 'onboarding' | 'seeker' | 'spark' | 'growth' | 'transformation' | 'free_trial';
  rateLimit: number;
  currentUsage: number;
  lastUsed: number;
  isHealthy: boolean;
  costPerToken: number;
}

export interface UserTier {
  name: string;
  priority: number;
  keyPool: 'onboarding' | 'seeker' | 'spark' | 'growth' | 'transformation' | 'free_trial';
  maxRequestsPerHour: number;
}

class KeyPoolManager {
  private keyPools: Map<string, APIKey[]> = new Map();
  private userTiers: Map<string, UserTier> = new Map();
  private usageTracking: Map<string, number> = new Map();

  constructor() {
    this.initializeKeyPools();
    this.initializeUserTiers();
  }

  private initializeKeyPools() {
    // Onboarding pool - Key 1 dedicated for first impressions
    this.keyPools.set('onboarding', [
      {
        id: 'onboarding_1',
        key: Deno.env.get('OPENAI_API_KEY_1') || '',
        tier: 'onboarding',
        rateLimit: 500, // Tier 1: 500 RPM per key
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.00040 // gpt-4.1-mini input cost ($0.40 per 1M tokens)
      }
    ]);

    // Spark pool - Key 2 for Spark tier (trial + paid)
    this.keyPools.set('spark', [
      {
        id: 'spark_1',
        key: Deno.env.get('OPENAI_API_KEY_2') || '',
        tier: 'spark',
        rateLimit: 500,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
    ]);

    // Growth pool - Key 3 for Growth tier (trial + paid)
    this.keyPools.set('growth', [
      {
        id: 'growth_1',
        key: Deno.env.get('OPENAI_API_KEY_3') || '',
        tier: 'growth',
        rateLimit: 500,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
    ]);

    // Transformation pool - Key 4 for Transformation tier (trial + paid)
    this.keyPools.set('transformation', [
      {
        id: 'transformation_1',
        key: Deno.env.get('OPENAI_API_KEY_4') || '',
        tier: 'transformation',
        rateLimit: 500,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
    ]);

    // Free Trial pool - reuses Spark key (Key 2) for free trial users
    this.keyPools.set('free_trial', [
      {
        id: 'free_trial_1',
        key: Deno.env.get('OPENAI_API_KEY_2') || '', // Share with Spark
        tier: 'free_trial',
        rateLimit: 500,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
    ]);

    // Seeker pool - reuses Spark key (Key 2) for free tier
    this.keyPools.set('seeker', [
      {
        id: 'seeker_1',
        key: Deno.env.get('OPENAI_API_KEY_2') || '', // Share with Spark
        tier: 'seeker',
        rateLimit: 500,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
    ]);
  }

  private initializeUserTiers() {
    this.userTiers.set('onboarding', {
      name: 'Onboarding',
      priority: 0, // Highest priority - first impressions matter
      keyPool: 'onboarding',
      maxRequestsPerHour: 100
    });

    this.userTiers.set('seeker', {
      name: 'Seeker (Free)',
      priority: 5, // Lowest priority
      keyPool: 'seeker',
      maxRequestsPerHour: 5
    });

    this.userTiers.set('spark', {
      name: 'Spark',
      priority: 3,
      keyPool: 'spark',
      maxRequestsPerHour: 50
    });

    // Annual plan aliases reuse the same key pools and limits as their base tiers
    this.userTiers.set('spark_annual', {
      name: 'Spark Annual',
      priority: 3,
      keyPool: 'spark',
      maxRequestsPerHour: 50
    });

    this.userTiers.set('growth', {
      name: 'Growth',
      priority: 2,
      keyPool: 'growth',
      maxRequestsPerHour: 100
    });

    this.userTiers.set('growth_annual', {
      name: 'Growth Annual',
      priority: 2,
      keyPool: 'growth',
      maxRequestsPerHour: 100
    });

    this.userTiers.set('transformation', {
      name: 'Transformation',
      priority: 1, // Second highest priority
      keyPool: 'transformation',
      maxRequestsPerHour: 200
    });

    this.userTiers.set('transformation_annual', {
      name: 'Transformation Annual',
      priority: 1,
      keyPool: 'transformation',
      maxRequestsPerHour: 200
    });

    this.userTiers.set('free_trial', {
      name: 'Free Trial',
      priority: 4, // Higher priority than seekers, lower than paid tiers
      keyPool: 'free_trial',
      maxRequestsPerHour: 25 // More generous than seekers (5), less than Spark (50)
    });
  }

  /**
   * Get the best available API key for a user
   */
  getBestKey(userId: string, userSubscriptionTier: string): APIKey | null {
    console.log(`[KeyPoolManager] getBestKey called with userId: ${userId}, tier: ${userSubscriptionTier}`);
    console.log(`[KeyPoolManager] Available tiers:`, Array.from(this.userTiers.keys()));
    
    const userTier = this.userTiers.get(userSubscriptionTier);
    if (!userTier) {
      console.error(`[KeyPoolManager] Unknown user tier: ${userSubscriptionTier}`);
      console.error(`[KeyPoolManager] Available tiers are:`, Array.from(this.userTiers.keys()));
      return null;
    }
    
    console.log(`[KeyPoolManager] Matched tier: ${userTier.name}, keyPool: ${userTier.keyPool}`);

    // Check user's hourly rate limit
    const userUsage = this.usageTracking.get(userId) || 0;
    if (userUsage >= userTier.maxRequestsPerHour) {
      console.warn(`User ${userId} exceeded hourly limit: ${userUsage}/${userTier.maxRequestsPerHour}`);
      return null;
    }

    // Get available keys from the appropriate pool
    const pool = this.keyPools.get(userTier.keyPool);
    if (!pool || pool.length === 0) {
      console.error(`No keys available for pool: ${userTier.keyPool}`);
      return null;
    }

    // Find the best key based on usage and health
    let bestKey: APIKey | null = null;
    let lowestUsage = Infinity;

    for (const key of pool) {
      if (!key.isHealthy || !key.key) continue;
      
      // Check if key is under rate limit
      const now = Date.now();
      const minutesSinceLastUse = (now - key.lastUsed) / 60000;
      const currentRate = Math.max(0, key.currentUsage - minutesSinceLastUse);
      
      if (currentRate < key.rateLimit && currentRate < lowestUsage) {
        bestKey = key;
        lowestUsage = currentRate;
      }
    }

    if (bestKey) {
      // Update usage tracking
      bestKey.currentUsage++;
      bestKey.lastUsed = Date.now();
      this.usageTracking.set(userId, userUsage + 1);
      
      console.log(`Assigned key ${bestKey.id} to user ${userId} (${userTier.name})`);
    }

    return bestKey;
  }

  /**
   * Mark a key as healthy/unhealthy
   */
  setKeyHealth(keyId: string, isHealthy: boolean) {
    for (const pool of this.keyPools.values()) {
      const key = pool.find(k => k.id === keyId);
      if (key) {
        key.isHealthy = isHealthy;
        if (!isHealthy) {
          console.warn(`Key ${keyId} marked as unhealthy`);
        }
        break;
      }
    }
  }

  /**
   * Mark a key as healthy (convenience method)
   */
  markHealthy(keyId: string) {
    this.setKeyHealth(keyId, true);
  }

  /**
   * Mark a key as unhealthy (convenience method)
   */
  markUnhealthy(keyId: string) {
    this.setKeyHealth(keyId, false);
  }

  /**
   * Get usage statistics for monitoring
   */
  getUsageStats() {
    const stats = {
      totalKeys: 0,
      healthyKeys: 0,
      totalUsage: 0,
      poolStats: {} as Record<string, { keys: number; healthy: number; usage: number }>
    };

    for (const [poolName, keys] of this.keyPools.entries()) {
      const healthyKeys = keys.filter(k => k.isHealthy).length;
      const totalUsage = keys.reduce((sum, k) => sum + k.currentUsage, 0);
      
      stats.totalKeys += keys.length;
      stats.healthyKeys += healthyKeys;
      stats.totalUsage += totalUsage;
      
      stats.poolStats[poolName] = {
        keys: keys.length,
        healthy: healthyKeys,
        usage: totalUsage
      };
    }

    return stats;
  }

  /**
   * Reset usage tracking (call every hour)
   */
  resetHourlyUsage() {
    this.usageTracking.clear();
    
    // Decay key usage (helps with rate limit recovery)
    for (const pool of this.keyPools.values()) {
      for (const key of pool) {
        key.currentUsage = Math.max(0, key.currentUsage - 30); // Decay by 30 requests
      }
    }
    
    console.log('Hourly usage reset completed');
  }
}

// Singleton instance
export const keyPoolManager = new KeyPoolManager();

// Auto-reset usage every hour
setInterval(() => {
  keyPoolManager.resetHourlyUsage();
}, 60 * 60 * 1000); // 1 hour
