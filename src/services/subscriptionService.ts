/**
 * Enterprise-Grade Subscription Service
 * Handles subscription management, usage tracking, and limits enforcement
 * Integrates with intelligence system for personalized experiences
 */

import { supabase } from './supabaseClient';
import {
  Subscription,
  SubscriptionTier,
  // SubscriptionStatus - removed as unused
  UsageTracking,
  // SUBSCRIPTION_CONFIGS - removed as unused
} from '../interfaces/subscription';

export interface CanGenerateResult {
  allowed: boolean;
  remaining: number | 'Unlimited';
  limit: number | 'Unlimited';
  used: number;
  upgradeRequired: boolean;
  message?: string;
}

export interface SubscriptionLimits {
  playbooks: number; // -1 for unlimited
  devotionals: number; // -1 for unlimited
  exports: number;
  apiCalls: number;
  familyMembers: number;
  intelligenceEnabled: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

export class SubscriptionService {
  private supabase = supabase;

  /**
   * Get user's current subscription with automatic free trial creation
   */
  async getUserSubscription(userId: string): Promise<Subscription> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.log('[SubscriptionService] No subscription found, creating free trial');
        return await this.createFreeTrial(userId);
      }

      // Check if trial has expired
      if (data.status === 'trialing' && data.trial_end_date) {
        const trialEnd = new Date(data.trial_end_date);
        if (trialEnd < new Date()) {
          console.log('[SubscriptionService] Trial expired, updating status');
          await this.expireTrial(userId);
          data.status = 'expired';
        }
      }

      return data as Subscription;
    } catch (error) {
      console.error('[SubscriptionService] Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Get current month usage with automatic creation if needed
   */
  async getCurrentUsage(userId: string): Promise<UsageTracking> {
    try {
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM format

      const { data, error } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('period', period)
        .single();

      if (error || !data) {
        // Create usage record if doesn't exist
        const newUsage = {
          user_id: userId,
          period,
          playbooks_used: 0,
          devotionals_used: 0,
          ai_tokens_used: 0,
          ai_cost_cents: 0,
          exports_used: 0,
          api_calls_used: 0,
        };

        const { data: created, error: createError } = await this.supabase
          .from('usage_tracking')
          .insert(newUsage)
          .select()
          .single();

        if (createError) {
          console.error('[SubscriptionService] Error creating usage record:', createError);
          throw createError;
        }

        return created as UsageTracking;
      }

      return data as UsageTracking;
    } catch (error) {
      console.error('[SubscriptionService] Error getting usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform a generation (SIMPLE FOR USERS)
   */
  async canGenerate(userId: string, type: 'playbook' | 'devotional'): Promise<CanGenerateResult> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const usage = await this.getCurrentUsage(userId);
      const limits = await this.getSubscriptionLimits(subscription.tier);

      const limit = type === 'playbook' ? limits.playbooks : limits.devotionals;
      const used = type === 'playbook' ? usage.playbooks_used : usage.devotionals_used;

      // Handle unlimited subscriptions
      if (limit === -1) {
        return {
          allowed: true,
          remaining: 'Unlimited',
          limit: 'Unlimited',
          used,
          upgradeRequired: false,
        };
      }

      const remaining = Math.max(0, limit - used);
      const allowed = remaining > 0;

      let message = '';
      if (!allowed) {
        const contentType = type === 'playbook' ? 'playbooks' : 'devotionals';
        message = `You've used all ${limit} ${contentType} this month. Upgrade for more!`;
      }

      return {
        allowed,
        remaining,
        limit,
        used,
        upgradeRequired: !allowed,
        message,
      };
    } catch (error) {
      console.error('[SubscriptionService] Error checking generation limits:', error);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        used: 0,
        upgradeRequired: true,
        message: 'Error checking subscription limits',
      };
    }
  }

  /**
   * Track usage after successful generation
   */
  async trackUsage(
    userId: string,
    type: 'playbook' | 'devotional',
    tokensUsed: number = 0,
    costCents: number = 0
  ): Promise<void> {
    try {
      const period = new Date().toISOString().slice(0, 7);

      await this.supabase.rpc('increment_usage_counter', {
        p_user_id: userId,
        p_period: period,
        p_type: type,
        p_tokens_used: tokensUsed,
        p_cost_cents: costCents,
      });

      console.log(`[SubscriptionService] Tracked ${type} usage for user ${userId}`);
    } catch (error) {
      console.error('[SubscriptionService] Error tracking usage:', error);
      throw error;
    }
  }

  /**
   * Get subscription limits for a tier
   */
  getSubscriptionLimits(tier: string): SubscriptionLimits {
    const limitsMap: Record<string, SubscriptionLimits> = {
      free_trial: {
        playbooks: 2,
        devotionals: 2,
        exports: 0,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        intelligenceLevel: 'basic',
        smartJournalingEnabled: true,  // Full access during trial
        journalTemplatesAccess: 'all', // All templates during trial
        advancedAnalytics: false,
        prioritySupport: false,
      },
      starter: {
        playbooks: 4,
        devotionals: 4,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        intelligenceLevel: 'basic',
        smartJournalingEnabled: true,
        journalTemplatesAccess: 'all',
        advancedAnalytics: false,
        prioritySupport: false,
      },
      growth: {
        playbooks: 15,
        devotionals: 15,
        exports: 0,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        intelligenceLevel: 'enhanced',
        smartJournalingEnabled: true,
        journalTemplatesAccess: 'all',
        advancedAnalytics: true,
        prioritySupport: true,
      },
      transformation: {
        playbooks: -1,
        devotionals: -1,
        exports: 0,
        apiCalls: 1000,
        familyMembers: 0,
        intelligenceEnabled: true,
        intelligenceLevel: 'advanced',
        smartJournalingEnabled: true,
        journalTemplatesAccess: 'all',
        advancedAnalytics: true,
        prioritySupport: true,
      },
      family: {
        playbooks: -1,
        devotionals: -1,
        exports: 0,
        apiCalls: 2000,
        familyMembers: 5,
        intelligenceEnabled: true,
        intelligenceLevel: 'advanced',
        smartJournalingEnabled: true,
        journalTemplatesAccess: 'all',
        advancedAnalytics: true,
        prioritySupport: true,
      },
    };

    return limitsMap[tier];
  }

  /**
   * Check if user has access to intelligence features
   */
  async hasIntelligenceAccess(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const limits = await this.getSubscriptionLimits(subscription.tier);
      return limits.intelligenceEnabled;
    } catch (error) {
      console.error('[SubscriptionService] Error checking intelligence access:', error);
      return false;
    }
  }

  /**
   * Get queue priority based on subscription tier
   */
  getQueuePriority(tier: SubscriptionTier): number {
    const priorityMap: Record<SubscriptionTier, number> = {
      enterprise: 1,    // Highest priority
      family: 2,
      pro: 3,
      lite: 4,
      starter: 5,
      free_trial: 6,     // Lowest priority
    };

    return priorityMap[tier] || 6;
  }

  /**
   * Create free trial subscription
   */
  private async createFreeTrial(userId: string): Promise<Subscription> {
    try {
      const { error } = await this.supabase.rpc('create_free_trial_subscription', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[SubscriptionService] Error creating free trial:', error);
        throw error;
      }

      // Get the created subscription
      const subscription = await this.getUserSubscription(userId);
      console.log('[SubscriptionService] Created free trial for user:', userId);

      return subscription;
    } catch (error) {
      console.error('[SubscriptionService] Error in createFreeTrial:', error);
      throw error;
    }
  }

  /**
   * Expire trial subscription
   */
  private async expireTrial(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log('[SubscriptionService] Expired trial for user:', userId);
    } catch (error) {
      console.error('[SubscriptionService] Error expiring trial:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(
    userId: string,
    newTier: SubscriptionTier,
    stripeSubscriptionId?: string,
    priceId?: string
  ): Promise<void> {
    try {
      const limits = await this.getSubscriptionLimits(newTier);

      await this.supabase
        .from('user_subscriptions')
        .update({
          tier: newTier,
          status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          price_id: priceId,
          intelligence_enabled: limits.intelligenceEnabled,
          advanced_analytics: limits.advancedAnalytics,
          priority_support: limits.prioritySupport,
          export_features: limits.exports > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log(`[SubscriptionService] Upgraded user ${userId} to ${newTier}`);
    } catch (error) {
      console.error('[SubscriptionService] Error upgrading subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log('[SubscriptionService] Canceled subscription for user:', userId);
    } catch (error) {
      console.error('[SubscriptionService] Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics for user
   */
  async getSubscriptionAnalytics(userId: string) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const usage = await this.getCurrentUsage(userId);
      const limits = await this.getSubscriptionLimits(subscription.tier);

      // Calculate usage percentages
      const playbookUsagePercent = limits.playbooks === -1 ? 0 :
        Math.round((usage.playbooks_used / limits.playbooks) * 100);

      const devotionalUsagePercent = limits.devotionals === -1 ? 0 :
        Math.round((usage.devotionals_used / limits.devotionals) * 100);

      return {
        subscription,
        usage,
        limits,
        analytics: {
          playbookUsagePercent,
          devotionalUsagePercent,
          totalGenerations: usage.playbooks_used + usage.devotionals_used,
          costThisMonth: usage.ai_cost_cents / 100, // Convert to dollars
          tokensUsed: usage.ai_tokens_used,
          daysUntilReset: this.getDaysUntilReset(),
          intelligenceEnabled: limits.intelligenceEnabled,
        },
      };
    } catch (error) {
      console.error('[SubscriptionService] Error getting analytics:', error);
      throw error;
    }
  }

  /**
   * Get days until usage resets (next month)
   */
  private getDaysUntilReset(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffTime = nextMonth.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if user is in family plan and get family info
   */
  async getFamilyInfo(userId: string) {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (subscription.tier !== 'family') {
        return null;
      }

      return {
        isOwner: subscription.family_owner_id === userId,
        ownerId: subscription.family_owner_id,
        members: subscription.family_members || [],
        maxMembers: subscription.max_family_members || 5,
        availableSlots: (subscription.max_family_members || 5) - (subscription.family_members?.length || 0),
      };
    } catch (error) {
      console.error('[SubscriptionService] Error getting family info:', error);
      return null;
    }
  }

  /**
   * Add family member (family plan only)
   */
  async addFamilyMember(ownerId: string, memberUserId: string): Promise<boolean> {
    try {
      const ownerSubscription = await this.getUserSubscription(ownerId);

      if (ownerSubscription.tier !== 'family' || ownerSubscription.family_owner_id !== ownerId) {
        throw new Error('Only family plan owners can add members');
      }

      const currentMembers = ownerSubscription.family_members || [];
      if (currentMembers.length >= (ownerSubscription.max_family_members || 5)) {
        throw new Error('Family plan is full');
      }

      if (currentMembers.includes(memberUserId)) {
        throw new Error('User is already a family member');
      }

      // Add member to family
      const updatedMembers = [...currentMembers, memberUserId];

      await this.supabase
        .from('user_subscriptions')
        .update({
          family_members: updatedMembers,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', ownerId);

      // Create/update member's subscription to reference family
      await this.supabase
        .from('user_subscriptions')
        .upsert({
          user_id: memberUserId,
          tier: 'family',
          status: 'active',
          family_owner_id: ownerId,
          intelligence_enabled: true,
          advanced_analytics: true,
          priority_support: true,
          export_features: true,
        });

      console.log(`[SubscriptionService] Added family member ${memberUserId} to ${ownerId}`);
      return true;
    } catch (error) {
      console.error('[SubscriptionService] Error adding family member:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
