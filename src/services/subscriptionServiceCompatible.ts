/**
 * Subscription Service - Compatible with Existing siFia Schema
 * 
 * Handles subscription management, usage tracking, and tier limits
 * using the existing database structure.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'your-anon-key'
);

export type SubscriptionTier = 'free_trial' | 'starter' | 'growth' | 'transformation' | 'family';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: 'active' | 'trial_expired' | 'cancelled' | 'past_due' | 'paused';
  created_at: string;
  updated_at: string;
  trial_ends_at?: string;
  amount?: number;
  currency?: string;
}

export interface SubscriptionLimits {
  playbooks: number;
  devotionals: number;
  exports: number;
  apiCalls: number;
  familyMembers: number;
  intelligenceEnabled: boolean;
  smartJournalingEnabled: boolean;
  calendarSyncEnabled: boolean;
  expoundingEnabled: boolean;
  copyIncompleteTodosEnabled: boolean;
  answeredPrayerTrackingEnabled: boolean;
  maxLevel: number;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  subscription_id?: string;
  playbooks_generated: number;
  devotionals_generated: number;
  journal_entries: number;
  smart_journal_entries: number;
  openai_tokens_used: number;
  api_calls_made: number;
  intelligence_queries: number;
  export_count: number;
  last_reset_date: string;
  reset_period: 'monthly' | 'yearly';
  created_at: string;
  updated_at: string;
}

class SubscriptionServiceCompatible {
  // Get user's current subscription
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to get user subscription:', error);
      return null;
    }
  }

  // Get subscription limits for a tier
  getSubscriptionLimits(tier: SubscriptionTier): SubscriptionLimits {
    const limitsMap: Record<SubscriptionTier, SubscriptionLimits> = {
      free_trial: {
        playbooks: 2,
        devotionals: 2,
        exports: 0,
        apiCalls: 10,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: false,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 1,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      starter: {
        playbooks: 5,
        devotionals: 5,
        exports: 2,
        apiCalls: 50,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 3,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      growth: {
        playbooks: 15,
        devotionals: 15,
        exports: 5,
        apiCalls: 200,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: true,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 5,
        advancedAnalytics: true,
        prioritySupport: false,
      },
      transformation: {
        playbooks: 50,
        devotionals: 50,
        exports: 25,
        apiCalls: 1000,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: true,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 10,
        advancedAnalytics: true,
        prioritySupport: true,
      },
      family: {
        playbooks: 100,
        devotionals: 100,
        exports: 50,
        apiCalls: 2000,
        familyMembers: 6,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: true,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 10,
        advancedAnalytics: true,
        prioritySupport: true,
      },
    };

    return limitsMap[tier] || limitsMap.free_trial;
  }

  // Get user's current usage
  async getUserUsage(userId: string): Promise<UsageTracking | null> {
    try {
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No usage record found, create one
          return await this.createUsageRecord(userId);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to get user usage:', error);
      return null;
    }
  }

  // Create initial usage record
  private async createUsageRecord(userId: string): Promise<UsageTracking | null> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      const { data, error } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          subscription_id: subscription?.id,
          playbooks_generated: 0,
          devotionals_generated: 0,
          journal_entries: 0,
          smart_journal_entries: 0,
          openai_tokens_used: 0,
          api_calls_made: 0,
          intelligence_queries: 0,
          export_count: 0,
          last_reset_date: new Date().toISOString().split('T')[0],
          reset_period: 'monthly'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create usage record:', error);
      return null;
    }
  }

  // Track usage for a specific feature
  async trackUsage(userId: string, feature: keyof UsageTracking, amount: number = 1): Promise<boolean> {
    try {
      const usage = await this.getUserUsage(userId);
      if (!usage) return false;

      const updates: Partial<UsageTracking> = {
        updated_at: new Date().toISOString()
      };

      // Map feature to the correct field
      switch (feature) {
        case 'playbooks_generated':
          updates.playbooks_generated = usage.playbooks_generated + amount;
          break;
        case 'devotionals_generated':
          updates.devotionals_generated = usage.devotionals_generated + amount;
          break;
        case 'export_count':
          updates.export_count = usage.export_count + amount;
          break;
        case 'api_calls_made':
          updates.api_calls_made = usage.api_calls_made + amount;
          break;
        case 'intelligence_queries':
          updates.intelligence_queries = usage.intelligence_queries + amount;
          break;
        default:
          console.warn(`Unknown feature for tracking: ${feature}`);
          return false;
      }

      const { error } = await supabase
        .from('usage_tracking')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to track usage:', error);
      return false;
    }
  }

  // Check if user can use a feature
  async canUseFeature(userId: string, feature: string): Promise<{
    canUse: boolean;
    reason?: string;
    currentUsage?: number;
    limit?: number;
    tier?: SubscriptionTier;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const usage = await this.getUserUsage(userId);

      if (!subscription) {
        return {
          canUse: false,
          reason: 'no_subscription',
          tier: 'free_trial'
        };
      }

      if (!usage) {
        return {
          canUse: false,
          reason: 'no_usage_data',
          tier: subscription.tier
        };
      }

      const limits = this.getSubscriptionLimits(subscription.tier);

      // Check feature-specific limits
      switch (feature) {
        case 'playbook_generation':
          return {
            canUse: usage.playbooks_generated < limits.playbooks,
            currentUsage: usage.playbooks_generated,
            limit: limits.playbooks,
            tier: subscription.tier,
            reason: usage.playbooks_generated >= limits.playbooks ? 'limit_exceeded' : undefined
          };

        case 'devotional_generation':
          return {
            canUse: usage.devotionals_generated < limits.devotionals,
            currentUsage: usage.devotionals_generated,
            limit: limits.devotionals,
            tier: subscription.tier,
            reason: usage.devotionals_generated >= limits.devotionals ? 'limit_exceeded' : undefined
          };

        case 'export_pdf':
        case 'export_docx':
          return {
            canUse: usage.export_count < limits.exports,
            currentUsage: usage.export_count,
            limit: limits.exports,
            tier: subscription.tier,
            reason: usage.export_count >= limits.exports ? 'limit_exceeded' : undefined
          };

        case 'expounding_content':
          return {
            canUse: limits.expoundingEnabled,
            tier: subscription.tier,
            reason: !limits.expoundingEnabled ? 'feature_not_available' : undefined
          };

        case 'advanced_analytics':
          return {
            canUse: limits.advancedAnalytics,
            tier: subscription.tier,
            reason: !limits.advancedAnalytics ? 'feature_not_available' : undefined
          };

        default:
          return {
            canUse: true,
            tier: subscription.tier
          };
      }
    } catch (error) {
      console.error('Failed to check feature access:', error);
      return {
        canUse: false,
        reason: 'error',
        tier: 'free_trial'
      };
    }
  }

  // Reset monthly usage (typically called by a cron job)
  async resetMonthlyUsage(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('usage_tracking')
        .update({
          playbooks_generated: 0,
          devotionals_generated: 0,
          journal_entries: 0,
          smart_journal_entries: 0,
          openai_tokens_used: 0,
          api_calls_made: 0,
          intelligence_queries: 0,
          export_count: 0,
          last_reset_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to reset monthly usage:', error);
      return false;
    }
  }

  // Get subscription tier hierarchy for upgrades
  getTierHierarchy(): SubscriptionTier[] {
    return ['free_trial', 'starter', 'growth', 'transformation', 'family'];
  }

  // Get next tier for upgrade suggestions
  getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
    const hierarchy = this.getTierHierarchy();
    const currentIndex = hierarchy.indexOf(currentTier);
    
    if (currentIndex === -1 || currentIndex === hierarchy.length - 1) {
      return null;
    }
    
    return hierarchy[currentIndex + 1];
  }

  // Get tier pricing (in cents)
  getTierPricing(tier: SubscriptionTier, market: 'US' | 'PH' = 'US'): {
    monthly: number;
    yearly: number;
    currency: string;
  } {
    const usPricing = {
      free_trial: { monthly: 0, yearly: 0, currency: 'USD' },
      starter: { monthly: 999, yearly: 9999, currency: 'USD' }, // $9.99/month
      growth: { monthly: 1999, yearly: 19999, currency: 'USD' }, // $19.99/month
      transformation: { monthly: 3999, yearly: 39999, currency: 'USD' }, // $39.99/month
      family: { monthly: 5999, yearly: 59999, currency: 'USD' }, // $59.99/month
    };

    const phPricing = {
      free_trial: { monthly: 0, yearly: 0, currency: 'PHP' },
      starter: { monthly: 49900, yearly: 499900, currency: 'PHP' }, // ₱499/month
      growth: { monthly: 99900, yearly: 999900, currency: 'PHP' }, // ₱999/month
      transformation: { monthly: 199900, yearly: 1999900, currency: 'PHP' }, // ₱1999/month
      family: { monthly: 299900, yearly: 2999900, currency: 'PHP' }, // ₱2999/month
    };

    return market === 'PH' ? phPricing[tier] : usPricing[tier];
  }

  // Cancel subscription and move user to basic (freemium) tier
  async cancelSubscription(userId: string): Promise<void> {
    try {
      // When users cancel or opt out, they become basic (freemium) users
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'basic',  // Move to freemium tier
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('[SubscriptionServiceCompatible] Cancelled subscription for user:', userId, '- moved to basic (freemium) tier');
    } catch (error) {
      console.error('[SubscriptionServiceCompatible] Error cancelling subscription:', error);
      throw error;
    }
  }

  // Handle trial expiration - move to basic (freemium)
  async handleTrialExpiration(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'basic',  // Move to freemium tier
          status: 'trial_expired',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('tier', 'free_trial');

      if (error) {
        throw error;
      }

      console.log('[SubscriptionServiceCompatible] Trial expired for user:', userId, '- moved to basic (freemium) tier');
    } catch (error) {
      console.error('[SubscriptionServiceCompatible] Error handling trial expiration:', error);
      throw error;
    }
  }
}

export const subscriptionServiceCompatible = new SubscriptionServiceCompatible();
