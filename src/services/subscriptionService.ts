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
      // First, try to get existing subscription with maybeSingle to avoid errors
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[SubscriptionService] Error fetching subscription:', error);
        // If there's an error fetching, return in-memory subscription
        return this.createInMemorySubscription(userId);
      }

      if (data) {
        // Subscription exists, check if trial has expired
        if (data.status === 'trialing' && data.trial_end_date) {
          const trialEnd = new Date(data.trial_end_date);
          if (trialEnd < new Date()) {
            console.log('[SubscriptionService] Trial expired, updating status');
            await this.expireTrial(userId);
            data.status = 'expired';
          }
        }
        // Add limits to subscription data
        const limits = this.getSubscriptionLimits(data.tier);
        return {
          ...data,
          limits
        } as Subscription;
      }

      // No subscription found, try to create one
      console.log('[SubscriptionService] No subscription found, creating free trial');
      return await this.createFreeTrial(userId);
    } catch (error) {
      console.error('[SubscriptionService] Error getting subscription:', error);
      // Handle different error types gracefully
      const errorCode = (error as any)?.code;
      
      if (errorCode === 'PGRST204') {
        console.log('[SubscriptionService] Database schema mismatch, creating in-memory subscription');
        return this.createInMemorySubscription(userId);
      }
      
      if (errorCode === '23505') {
        // Duplicate key error - subscription already exists, try to fetch it
        console.log('[SubscriptionService] Subscription exists, attempting to fetch');
        try {
          const { data: existing } = await this.supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (existing) {
            return existing as Subscription;
          }
        } catch (fetchError) {
          console.log('[SubscriptionService] Failed to fetch existing subscription, using in-memory');
        }
        
        return this.createInMemorySubscription(userId);
      }
      
      // For other errors, return in-memory subscription instead of throwing
      console.log('[SubscriptionService] Unexpected error, using in-memory subscription');
      return this.createInMemorySubscription(userId);
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
        .single();

      if (error || !data) {
        // Create usage record if doesn't exist - match actual database schema
        const basicUsage = {
          user_id: userId,
          playbooks_generated: 0,
          devotionals_generated: 0,
          created_at: new Date().toISOString(),
        };

        // Try full schema first, fallback to basic
        const newUsage = {
          ...basicUsage,
          journal_entries: 0,
          smart_journal_entries: 0,
          openai_tokens_used: 0,
          api_calls_made: 0,
          intelligence_queries: 0,
          template_uses: {},
          export_count: 0,
          last_reset_date: new Date().toISOString().split('T')[0],
          reset_period: 'monthly',
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: createError } = await this.supabase
          .from('usage_tracking')
          .insert(newUsage)
          .select()
          .single();

        if (createError) {
          console.error('[SubscriptionService] Error creating usage record:', createError);
          // If schema mismatch, try with basic fields only
          if (createError.code === 'PGRST204') {
            console.log('[SubscriptionService] Schema mismatch, trying basic usage fields');
            const { data: basicCreated, error: basicCreateError } = await this.supabase
              .from('usage_tracking')
              .insert(basicUsage)
              .select()
              .single();

            if (basicCreateError) {
              console.error('[SubscriptionService] Basic usage insert also failed:', basicCreateError);
              // Return default usage to prevent crashes
              return {
                userId: userId,
                period: period,
                playbooks_used: 0,
                devotionals_used: 0,
                ai_tokens_used: 0,
                ai_cost_cents: 0,
                api_calls_made: 0,
                lastUpdated: new Date().toISOString(),
              };
            }

            // Convert basic usage to full usage tracking format
            return {
              userId: basicCreated.user_id,
              period: basicCreated.period,
              playbooks_used: basicCreated.playbooks_used || 0,
              devotionals_used: basicCreated.devotionals_used || 0,
              ai_tokens_used: 0,
              ai_cost_cents: 0,
              api_calls_made: 0,
              lastUpdated: basicCreated.created_at || new Date().toISOString(),
            };
          }
          throw createError;
        }

        return created as UsageTracking;
      }

      return data as UsageTracking;
    } catch (error) {
      console.error('[SubscriptionService] Error getting usage:', error);
      // If database schema issues, return default usage
      if ((error as any)?.code === 'PGRST204') {
        console.log('[SubscriptionService] Database schema mismatch, returning default usage');
        return {
          userId: userId,
          period: new Date().toISOString().slice(0, 7),
          playbooks_used: 0,
          devotionals_used: 0,
          ai_tokens_used: 0,
          ai_cost_cents: 0,
          api_calls_made: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  /**
   * Check if user can perform a generation (SIMPLE FOR USERS)
   */
  async canGenerate(userId: string, type: 'playbook' | 'devotional', isOnboarding: boolean = false): Promise<CanGenerateResult> {
    try {
      // Development flag - set to false to test actual limits
      const DEV_UNLIMITED = __DEV__ && false; // Change to true for unlimited dev mode

      if (DEV_UNLIMITED) {
        console.log(`[SubscriptionService] Development mode: allowing ${type} generation for user ${userId}`);
        return {
          allowed: true,
          remaining: 'Unlimited',
          limit: 'Unlimited',
          used: 0,
          upgradeRequired: false,
          message: 'Development mode - unlimited generation',
        };
      }

      // Allow onboarding playbooks for free (don't count against limits)
      if (isOnboarding && type === 'playbook') {
        console.log(`[SubscriptionService] Allowing onboarding playbook for user ${userId}`);
        return {
          allowed: true,
          remaining: 'Unlimited',
          limit: 'Unlimited',
          used: 0,
          upgradeRequired: false,
          message: 'Free onboarding playbook',
        };
      }

      const subscription = await this.getUserSubscription(userId);
      const usage = await this.getCurrentUsage(userId);
      const limits = this.getSubscriptionLimits(subscription.tier);

      const limit = type === 'playbook' ? limits.playbooks : limits.devotionals;
      const used = type === 'playbook' ? (usage.playbooks_generated || 0) : (usage.devotionals_generated || 0);

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
      // If database schema issues, allow limited usage for trial users
      if ((error as any)?.code === 'PGRST204') {
        console.log('[SubscriptionService] Database schema mismatch, allowing trial usage');
        return {
          allowed: true,
          remaining: 5, // Allow 5 generations during schema issues
          limit: 10,
          used: 0,
          upgradeRequired: false,
          message: 'Trial usage available',
        };
      }
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
      // Get or create usage record
      let { data: usage, error } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !usage) {
        // Create usage record if doesn't exist
        const { data: newUsage, error: createError } = await this.supabase
          .from('usage_tracking')
          .insert({
            user_id: userId,
            playbooks_generated: type === 'playbook' ? 1 : 0,
            devotionals_generated: type === 'devotional' ? 1 : 0,
            journal_entries: 0,
            smart_journal_entries: 0,
            openai_tokens_used: tokensUsed,
            api_calls_made: 0,
            intelligence_queries: 0,
            template_uses: {},
            export_count: 0,
            last_reset_date: new Date().toISOString().split('T')[0],
            reset_period: 'monthly',
          })
          .select()
          .single();

        if (createError) {
          console.error('[SubscriptionService] Error creating usage record:', createError);
          return; // Don't throw, just log
        }
        usage = newUsage;
      } else {
        // Update existing usage record
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (type === 'playbook') {
          updateData.playbooks_generated = (usage.playbooks_generated || 0) + 1;
        } else if (type === 'devotional') {
          updateData.devotionals_generated = (usage.devotionals_generated || 0) + 1;
        }

        if (tokensUsed > 0) {
          updateData.openai_tokens_used = (usage.openai_tokens_used || 0) + tokensUsed;
        }

        const { error: updateError } = await this.supabase
          .from('usage_tracking')
          .update(updateData)
          .eq('user_id', userId);

        if (updateError) {
          console.error('[SubscriptionService] Error updating usage:', updateError);
          return; // Don't throw, just log
        }
      }

      console.log(`[SubscriptionService] Tracked ${type} usage for user ${userId}`);
    } catch (error) {
      console.error('[SubscriptionService] Error tracking usage:', error);
      // Don't throw error to avoid breaking the main flow
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
        smartJournalingEnabled: true,  // Full access during trial
        calendarSyncEnabled: false,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 1,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      basic: {
        playbooks: 1,
        devotionals: 0,
        exports: 0,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: false,
        smartJournalingEnabled: false,  // Restricted for basic
        calendarSyncEnabled: false,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: false,
        answeredPrayerTrackingEnabled: false,
        maxLevel: 1,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      starter: {
        playbooks: 8,
        devotionals: 8,
        exports: 10,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 2,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      growth: {
        playbooks: 20,
        devotionals: 20,
        exports: 50,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 4,
        advancedAnalytics: true,
        prioritySupport: true,
      },
      transformation: {
        playbooks: -1,
        devotionals: -1,
        exports: -1,
        apiCalls: 1000,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: true,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 9,
        advancedAnalytics: true,
        prioritySupport: true,
      },
      family: {
        playbooks: -1,
        devotionals: -1,
        exports: -1,
        apiCalls: 2000,
        familyMembers: 5,
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
      // Annual plans have same limits as monthly
      starter_annual: {
        playbooks: 8,
        devotionals: 8,
        exports: 10,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 2,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      growth_annual: {
        playbooks: 20,
        devotionals: 20,
        exports: 50,
        apiCalls: 0,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: false,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 4,
        advancedAnalytics: true,
        prioritySupport: true,
      },
      transformation_annual: {
        playbooks: -1,
        devotionals: -1,
        exports: -1,
        apiCalls: 1000,
        familyMembers: 0,
        intelligenceEnabled: true,
        smartJournalingEnabled: true,
        calendarSyncEnabled: true,
        expoundingEnabled: true,
        copyIncompleteTodosEnabled: true,
        answeredPrayerTrackingEnabled: true,
        maxLevel: 9,
        advancedAnalytics: true,
        prioritySupport: true,
      },
      family_annual: {
        playbooks: -1,
        devotionals: -1,
        exports: -1,
        apiCalls: 2000,
        familyMembers: 5,
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

    return limitsMap[tier] || limitsMap['basic'];
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
      // FIRST: Check if subscription already exists to prevent duplicate key errors
      console.log('[SubscriptionService] Checking if subscription already exists for user:', userId);
      const { data: existingSubscription, error: checkError } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('[SubscriptionService] Error checking existing subscription:', checkError);
        return this.createInMemorySubscription(userId);
      }

      if (existingSubscription) {
        console.log('[SubscriptionService] Subscription already exists, returning existing one');
        return existingSubscription as Subscription;
      }

      // Only try to create if subscription doesn't exist
      console.log('[SubscriptionService] No existing subscription found, creating new one');
      const { error } = await this.supabase.rpc('create_free_trial_subscription', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[SubscriptionService] Error creating free trial:', error);
        
        // If function doesn't exist, create subscription manually
        if (error.code === 'PGRST202') {
          console.log('[SubscriptionService] Database function not found, creating trial manually');
          return await this.createFreeTrialManually(userId);
        }
        
        // Handle duplicate key error from RPC function
        if (error.code === '23505') {
          console.log('[SubscriptionService] Trial already exists from RPC, fetching existing subscription');
          try {
            const { data: existing } = await this.supabase
              .from('user_subscriptions')
              .select('*')
              .eq('user_id', userId)
              .single();
            
            if (existing) {
              return existing as Subscription;
            }
          } catch (fetchError) {
            console.log('[SubscriptionService] Failed to fetch existing trial from RPC, using in-memory');
          }
          
          return this.createInMemorySubscription(userId);
        }
        
        // For other errors, return in-memory subscription instead of throwing
        console.log('[SubscriptionService] Unexpected RPC error, using in-memory subscription');
        return this.createInMemorySubscription(userId);
      }

      // Get the created subscription
      const subscription = await this.getUserSubscription(userId);
      console.log('[SubscriptionService] Created free trial for user:', userId);

      return subscription;
    } catch (error) {
      console.error('[SubscriptionService] Error in createFreeTrial:', error);
      const errorCode = (error as any)?.code;
      
      // Handle different error types gracefully
      if (errorCode === 'PGRST202') {
        // Database function doesn't exist, use manual creation
        return await this.createFreeTrialManually(userId);
      }
      
      if (errorCode === '23505') {
        // Duplicate key error - subscription already exists, fetch it
        console.log('[SubscriptionService] Trial already exists, fetching existing subscription');
        try {
          const { data: existing } = await this.supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (existing) {
            return existing as Subscription;
          }
        } catch (fetchError) {
          console.log('[SubscriptionService] Failed to fetch existing trial, using in-memory');
        }
        
        return this.createInMemorySubscription(userId);
      }
      
      // For other errors, return in-memory subscription instead of throwing
      console.log('[SubscriptionService] Unexpected error in createFreeTrial, using in-memory subscription');
      return this.createInMemorySubscription(userId);
    }
  }

  /**
   * Manually create free trial subscription when database function is not available
   */
  private async createFreeTrialManually(userId: string): Promise<Subscription> {
    try {
      // FIRST: Double-check if subscription already exists to prevent duplicate key errors
      console.log('[SubscriptionService] Double-checking if subscription exists before manual creation');
      const { data: existingSubscription, error: checkError } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('[SubscriptionService] Error checking existing subscription in manual creation:', checkError);
        return this.createInMemorySubscription(userId);
      }

      if (existingSubscription) {
        console.log('[SubscriptionService] Subscription already exists during manual creation, returning existing one');
        return existingSubscription as Subscription;
      }

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial

      // Try to insert basic subscription data that matches actual database schema
      const basicSubscriptionData = {
        user_id: userId,
        status: 'trialing',
        tier: 'free_trial',
        trial_end_date: trialEndDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .insert(basicSubscriptionData)
        .select()
        .single();

      if (error) {
        // If subscription already exists, fetch it instead of creating a new one
        if (error.code === '23505') { // Unique constraint violation
          console.log('[SubscriptionService] Subscription already exists, fetching existing one');
          const { data: existing, error: fetchError } = await this.supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (existing && !fetchError) {
            return this.convertToFullSubscription(existing, userId);
          }
        }
        
        console.log('[SubscriptionService] Database insert failed, using in-memory subscription:', error.message);
        return this.createInMemorySubscription(userId);
      }

      console.log('[SubscriptionService] Created basic subscription for user:', userId);
      // Convert database result to full subscription object
      return this.convertToFullSubscription(data, userId);
    } catch (error) {
      console.log('[SubscriptionService] Database operation failed, using in-memory subscription');
      return this.createInMemorySubscription(userId);
    }
  }

  /**
   * Create an in-memory subscription object when database operations fail
   */
  private createInMemorySubscription(userId: string): Subscription {
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      id: 'temp-' + userId,
      userId: userId,
      status: 'trialing' as const,
      tier: 'free_trial' as const,
      priceId: 'free-trial',
      startDate: new Date().toISOString(),
      endDate: trialEndDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      limits: this.getSubscriptionLimits('free_trial'),
      currentUsage: {
        id: 'temp-usage-' + userId,
        user_id: userId,
        subscription_id: 'temp-' + userId,
        playbooks_generated: 0,
        devotionals_generated: 0,
        journal_entries: 0,
        smart_journal_entries: 0,
        openai_tokens_used: 0,
        api_calls_made: 0,
        intelligence_queries: 0,
        template_uses: {},
        export_count: 0,
        last_reset_date: new Date().toISOString(),
        reset_period: 'monthly',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Subscription;
  }

  /**
   * Convert basic database subscription to full subscription object
   */
  private convertToFullSubscription(dbData: any, userId: string): Subscription {
    const trialEndDate = new Date(dbData.trial_end_date || Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      id: dbData.id,
      userId: userId,
      status: dbData.status || 'trialing',
      tier: dbData.tier || 'free_trial',
      priceId: 'free-trial',
      startDate: dbData.created_at || new Date().toISOString(),
      endDate: trialEndDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      limits: {
        playbooks: 10,
        devotionals: 10,
        exports: 5,
        apiCalls: 100,
        familyMembers: 1,
        intelligenceEnabled: false,
        advancedAnalytics: false,
        prioritySupport: false,
      },
      currentUsage: {
        userId: userId,
        period: new Date().toISOString().substring(0, 7),
        playbooks_used: 0,
        devotionals_used: 0,
        ai_tokens_used: 0,
        ai_cost_cents: 0,
        api_calls_made: 0,
        lastUpdated: new Date().toISOString(),
      },
      createdAt: dbData.created_at || new Date().toISOString(),
      updatedAt: dbData.updated_at || new Date().toISOString(),
    } as Subscription;
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
      // When users cancel or opt out, they become basic (freemium) users
      await this.supabase
        .from('user_subscriptions')
        .update({
          tier: 'basic',  // Move to freemium tier
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log('[SubscriptionService] Canceled subscription for user:', userId, '- moved to basic (freemium) tier');
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
