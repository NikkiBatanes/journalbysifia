/**
 * Enterprise Key Pool Manager for 2000+ Users
 * Handles multiple OpenAI API keys with intelligent routing
 */

export interface APIKey {
  id: string;
  key: string;
  tier: 'basic' | 'premium' | 'enterprise';
  rateLimit: number;
  currentUsage: number;
  lastUsed: number;
  isHealthy: boolean;
  costPerToken: number;
}

export interface UserTier {
  name: string;
  priority: number;
  keyPool: 'basic' | 'premium' | 'enterprise';
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
    // Basic pool - for free tier users
    this.keyPools.set('basic', [
      {
        id: 'basic_1',
        key: Deno.env.get('OPENAI_BASIC_1') || '',
        tier: 'basic',
        rateLimit: 60, // requests per minute
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      },
      {
        id: 'basic_2', 
        key: Deno.env.get('OPENAI_BASIC_2') || '',
        tier: 'basic',
        rateLimit: 60,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000015
      }
      // Add more basic keys as needed
    ]);

    // Premium pool - for $14.99 tier users
    this.keyPools.set('premium', [
      {
        id: 'premium_1',
        key: Deno.env.get('OPENAI_PREMIUM_1') || '',
        tier: 'premium',
        rateLimit: 150, // higher rate limit
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000012 // better pricing
      },
      {
        id: 'premium_2',
        key: Deno.env.get('OPENAI_PREMIUM_2') || '',
        tier: 'premium', 
        rateLimit: 150,
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000012
      }
      // Add more premium keys as needed
    ]);

    // Enterprise pool - for future growth
    this.keyPools.set('enterprise', [
      {
        id: 'enterprise_1',
        key: Deno.env.get('OPENAI_ENTERPRISE_1') || '',
        tier: 'enterprise',
        rateLimit: 300, // highest rate limit
        currentUsage: 0,
        lastUsed: 0,
        isHealthy: true,
        costPerToken: 0.000010 // best pricing
      }
    ]);
  }

  private initializeUserTiers() {
    this.userTiers.set('free', {
      name: 'Free',
      priority: 1,
      keyPool: 'basic',
      maxRequestsPerHour: 5
    });

    this.userTiers.set('premium', {
      name: 'Premium ($14.99)',
      priority: 2,
      keyPool: 'premium', 
      maxRequestsPerHour: 50
    });

    this.userTiers.set('enterprise', {
      name: 'Enterprise',
      priority: 3,
      keyPool: 'enterprise',
      maxRequestsPerHour: 200
    });
  }

  /**
   * Get the best available API key for a user
   */
  async getBestKey(userId: string, userSubscriptionTier: string): Promise<APIKey | null> {
    const userTier = this.userTiers.get(userSubscriptionTier);
    if (!userTier) {
      console.error(`Unknown user tier: ${userSubscriptionTier}`);
      return null;
    }

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
      
      if (currentRate < key.rateLimit && currentUsage < lowestUsage) {
        bestKey = key;
        lowestUsage = currentUsage;
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
