// New Subscription Service - Core Foundation
// Created: 2025-08-20
// Handles all subscription logic for the new tier system

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import {
  Subscription,
  SubscriptionTier,
  SubscriptionLimits,
  SubscriptionCheck,
  DiscountCode,
  SubscriptionUpgradeOptions,
  TrialStartOptions,
  SubscriptionError,
  UsageLimitError,
  TrialExpiredError,
} from '../types/subscription';

export class NewSubscriptionService {

  // ===== TIER CONFIGURATION =====
  /**
   * Get limits and features for a subscription tier
   */
  static getTierLimits(tier: SubscriptionTier): {
    playbooks_limit: number;
    devotionals_limit: number;
    smart_journaling_enabled: boolean;
    show_dashboard_counts: boolean;
  } {
    // Map annual variants to base tiers for limits
    const baseTier = tier.replace('_annual', '') as SubscriptionTier;

    switch (baseTier) {
      case 'seeker':
        return {
          playbooks_limit: 0,
          devotionals_limit: 0,
          smart_journaling_enabled: false,
          show_dashboard_counts: true,
        };
      case 'free_trial':
        // Free trial: Limited to 2 playbooks and 2 devotionals for 3 days
        return {
          playbooks_limit: 2,
          devotionals_limit: 2,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'spark':
        return {
          playbooks_limit: 8,
          devotionals_limit: 8,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'growth':
        return {
          playbooks_limit: 20,
          devotionals_limit: 20,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'transformation':
        return {
          playbooks_limit: 999999, // Effectively unlimited, but database-compatible
          devotionals_limit: 999999, // Effectively unlimited, but database-compatible
          smart_journaling_enabled: true,
          show_dashboard_counts: false, // Hide counts for unlimited
        };
      // POST-LAUNCH: Family tier
      // case 'family':
      //   return {
      //     playbooks_limit: 999999, // Effectively unlimited, but database-compatible
      //     devotionals_limit: 999999, // Effectively unlimited, but database-compatible
      //     smart_journaling_enabled: true,
      //     show_dashboard_counts: false, // Hide counts for unlimited
      //   };
      default:
        // Fallback to seeker limits for unknown tiers
        return {
          playbooks_limit: 0,
          devotionals_limit: 0,
          smart_journaling_enabled: false,
          show_dashboard_counts: true,
        };
    }
  }

  /**
   * Get onboarding playbook limit (special case for seeker during onboarding)
   */
  static getOnboardingPlaybookLimit(tier: SubscriptionTier): number {
    return tier === 'seeker' ? 1 : this.getTierLimits(tier).playbooks_limit;
  }

  // ===== USER SUBSCRIPTION MANAGEMENT =====

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<Subscription> {
    const { data, error } = await supabase
      .from('user_subscriptions_new')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - create default seeker
        return await this.createDefaultSeekerSubscription(userId);
      }
      throw new SubscriptionError(`Failed to get subscription: ${error.message}`, 'DATABASE_ERROR', error);
    }

    return this.enrichSubscriptionData(data);
  }

  /**
   * Check and perform monthly usage reset for annual subscriptions
   * MONTHLY: Reset handled by DID_RENEW webhook (Apple charges every 30 days)
   * ANNUAL: Reset handled here (Apple charges yearly, but usage resets monthly)
   */
  static async checkAndResetMonthlyUsage(userId: string): Promise<boolean> {
    try {
      const { data: subscription, error } = await supabase
        .from('user_subscriptions_new')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !subscription) {
        return false;
      }

      // Only reset for active paid subscriptions
      // Skip if: Seeker tier, free_trial, or monthly (monthly handled by webhook)
      if (subscription.tier === 'seeker' || subscription.tier === 'free_trial') {
        return false; // No resets for seeker or trial
      }
      
      const isAnnual = subscription.billing_cycle === 'annual' || 
                       subscription.tier?.includes('_annual');
      
      if (!isAnnual) {
        return false; // Monthly subs reset via DID_RENEW webhook only
        // CANCELLATION BEHAVIOR FOR MONTHLY:
        // - User cancels → No more DID_RENEW webhooks fire
        // - Therefore NO resets after cancellation
        // - On expiration: EXPIRED webhook downgrades to Seeker
      }

      // CANCELLATION BEHAVIOR FOR ANNUAL:
      // - User cancels → auto_renew_enabled: false, but tier stays annual
      // - Monthly resets CONTINUE (user paid for full year)
      // - Keeps annual badge/tier until expiration
      // - On Day 365: EXPIRED webhook downgrades to Seeker

      // For annual: Calculate from billing anchor (subscription_start_date)
      const billingAnchor = new Date(subscription.subscription_start_date || subscription.created_at);
      const now = new Date();
      const daysSinceAnchor = (now.getTime() - billingAnchor.getTime()) / (1000 * 60 * 60 * 24);
      
      // Calculate which 30-day period we're in (0-based)
      const currentPeriod = Math.floor(daysSinceAnchor / 30);
      
      // Calculate when the current period started
      const currentPeriodStart = new Date(billingAnchor.getTime() + (currentPeriod * 30 * 24 * 60 * 60 * 1000));
      
      // Check if we already reset for this period
      const lastReset = subscription.last_usage_reset ? new Date(subscription.last_usage_reset) : new Date(0);
      
      if (lastReset < currentPeriodStart) {
        // Need to reset - we're in a new 30-day period
        const { error: resetError } = await supabase
          .from('user_subscriptions_new')
          .update({
            playbooks_used: 0,
            devotionals_used: 0,
            last_usage_reset: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);

        if (resetError) {
          Logger.error('[NewSubscriptionService] Failed to reset monthly usage', resetError as Error, {
            component: 'NewSubscriptionService',
            userId,
          });
          return false;
        }

        Logger.info('[NewSubscriptionService] Annual subscription monthly reset', {
          component: 'NewSubscriptionService',
          userId,
          tier: subscription.tier,
          period: currentPeriod + 1,
          daysSinceAnchor: Math.floor(daysSinceAnchor),
        });

        return true;
      }

      return false;
    } catch (error) {
      Logger.error('[NewSubscriptionService] Error checking monthly reset', error as Error, {
        component: 'NewSubscriptionService',
        userId,
      });
      return false;
    }
  }

  /**
   * Create default seeker subscription for new users
   */
  static async createDefaultSeekerSubscription(userId: string): Promise<Subscription> {
    const { error } = await supabase.rpc('create_default_seeker_subscription', {
      target_user_id: userId,
    });

    if (error) {
      throw new SubscriptionError(`Failed to create seeker subscription: ${error.message}`, 'CREATION_ERROR', error);
    }

    // Fetch the created subscription
    const subscription = await this.getUserSubscription(userId);

    // CRITICAL FAILSAFE: Verify tier is seeker, fix if not
    if (subscription.tier !== 'seeker') {
      Logger.error('[NewSubscriptionService] Database RPC created wrong tier - forcing to seeker', new Error('Wrong tier created'), {
        component: 'NewSubscriptionService',
        userId,
        wrongTier: subscription.tier,
      });

      // Force correct the tier to seeker
      const { error: updateError } = await supabase
        .from('user_subscriptions_new')
        .update({ tier: 'seeker' })
        .eq('user_id', userId);

      if (updateError) {
        Logger.error('[NewSubscriptionService] Failed to correct tier to seeker', updateError as Error, {
          component: 'NewSubscriptionService',
          userId,
        });
      }

      // Refetch to get corrected subscription
      return await this.getUserSubscription(userId);
    }

    return subscription;
  }

  /**
   * Start free trial for user (during onboarding)
   */
  static async startFreeTrial(options: TrialStartOptions): Promise<Subscription> {
    const { user_id, duration_days = 3, trial_chosen_tier } = options;

    try {
      // Since the start_free_trial RPC function doesn't exist, implement manually
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + duration_days);

      // Create or update subscription record with trial dates for proper expiry management
      const chosenTier = (trial_chosen_tier as SubscriptionTier) || 'spark';

      // IMPORTANT: All trials get 2/2 limits regardless of chosen tier
      // The chosen tier only applies AFTER they convert to paid
      const trialLimits = this.getTierLimits('free_trial'); // Always 2/2 for trials

      // Generate display name for trial: "siFia Spark Trial", "siFia Growth Trial", etc.
      const tierDisplayName = this.getTierDisplayName(chosenTier);
      const displayName = `${tierDisplayName} Trial`;

      const subscriptionData = {
        user_id: user_id,
        status: 'active', // Trial users have 'active' status, distinguished by trial_start_date
        tier: 'free_trial', // Set tier to 'free_trial' during trial period
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        trial_chosen_tier: chosenTier, // Remember which tier they want after trial
        subscription_display_name: displayName, // e.g., "siFia Spark Trial"
        playbooks_limit: trialLimits.playbooks_limit, // Always 2 for trials
        devotionals_limit: trialLimits.devotionals_limit, // Always 2 for trials
        smart_journaling_enabled: trialLimits.smart_journaling_enabled,
        playbooks_used: 0,
        devotionals_used: 0,
        updated_at: new Date().toISOString(),
      };

      // CRITICAL FIX: Use a transaction-like approach with retry logic
      // This ensures the tier is set to 'free_trial' even if there are race conditions
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: any = null;

      while (retryCount < maxRetries) {
        try {
          // Upsert with onConflict to handle existing subscription
          const { error, data } = await supabase
            .from('user_subscriptions_new')
            .upsert(subscriptionData, {
              onConflict: 'user_id', // Update existing record if user_id already exists
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          // CRITICAL: Verify the tier was actually set to 'free_trial'
          if (data && data.tier !== 'free_trial') {
            Logger.warn('[NewSubscriptionService] Trial tier mismatch after upsert, retrying...', {
              component: 'NewSubscriptionService',
              userId: user_id,
              expectedTier: 'free_trial',
              actualTier: data.tier,
              retryCount,
            });
            throw new Error('Tier mismatch after upsert');
          }

          // Success - break out of retry loop
          break;
        } catch (retryError) {
          lastError = retryError;
          retryCount++;

          if (retryCount < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
            Logger.info('[NewSubscriptionService] Retrying trial setup', {
              component: 'NewSubscriptionService',
              userId: user_id,
              retryCount,
              errorMessage: retryError instanceof Error ? retryError.message : 'Unknown',
            });
          }
        }
      }

      if (retryCount >= maxRetries && lastError) {
        throw new SubscriptionError(`Failed to start trial after ${maxRetries} attempts: ${lastError.message}`, 'TRIAL_START_ERROR', lastError);
      }

      // CRITICAL: Force a fresh fetch to ensure we get the correct tier
      const finalSubscription = await this.getUserSubscription(user_id);

      // Final verification
      if (finalSubscription.tier !== 'free_trial') {
        Logger.error('[NewSubscriptionService] CRITICAL: Trial tier still incorrect after all retries', new Error('Trial tier verification failed'), {
          component: 'NewSubscriptionService',
          userId: user_id,
          expectedTier: 'free_trial',
          actualTier: finalSubscription.tier,
        });

        // Force correct the tier one last time
        await supabase
          .from('user_subscriptions_new')
          .update({ tier: 'free_trial' })
          .eq('user_id', user_id);

        return await this.getUserSubscription(user_id);
      }

      return finalSubscription;
    } catch (error) {
      throw new SubscriptionError(`Failed to start trial: ${error instanceof Error ? error.message : 'Unknown error'}`, 'TRIAL_START_ERROR', error);
    }
  }

  /**
   * Convert trial to paid subscription after successful payment
   * This upgrades the user from free_trial tier to their chosen tier
   */
  static async convertTrialToPaid(userId: string): Promise<Subscription> {
    try {
      const subscription = await this.getUserSubscription(userId);

      // Verify user is on trial
      if (subscription.tier !== 'free_trial') {
        return subscription;
      }

      // Get the tier they chose during trial signup
      const chosenTier = (subscription as any).trial_chosen_tier || 'spark';
      const limits = this.getTierLimits(chosenTier);
      const displayName = this.getTierDisplayName(chosenTier); // Remove "Trial" suffix

      // Upgrade to paid tier with full limits and updated display name
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: chosenTier,
          subscription_display_name: displayName, // e.g., "siFia Spark" (no "Trial")
          playbooks_limit: limits.playbooks_limit,
          devotionals_limit: limits.devotionals_limit,
          smart_journaling_enabled: limits.smart_journaling_enabled,
          playbooks_used: 0, // Reset usage when converting from trial to paid
          devotionals_used: 0,
          subscription_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new SubscriptionError(`Failed to convert trial: ${error.message}`, 'TRIAL_CONVERSION_ERROR', error);
      }

      return await this.getUserSubscription(userId);
    } catch (error) {
      throw new SubscriptionError(`Failed to convert trial: ${error instanceof Error ? error.message : 'Unknown error'}`, 'TRIAL_CONVERSION_ERROR', error);
    }
  }

  /**
   * Upgrade subscription to paid tier
   */
  static async upgradeSubscription(userId: string, options: SubscriptionUpgradeOptions): Promise<Subscription> {
    const { target_tier, discount_code } = options;
    // POST-LAUNCH: is_family_upgrade

    if (!target_tier) {
      throw new SubscriptionError('Target tier is required for upgrade', 'MISSING_TARGET_TIER');
    }

    // Get current subscription to validate upgrade path
    const currentSubscription = await this.getUserSubscription(userId);
    const from_tier = currentSubscription.tier;
    const to_tier = target_tier;

    // Validate upgrade path (allow same-tier if converting from trial to paid)
    const isTrialConversion = from_tier === 'free_trial';
    const isSameTierUpgrade = from_tier === to_tier;

    // Allow same-tier "upgrade" if converting from trial, otherwise require actual upgrade
    if (!isTrialConversion && isSameTierUpgrade) {
      return currentSubscription; // Return existing subscription, no upgrade needed
    }

    // Special case: If updating to same tier but it's a trial tier, we need to update trial fields
    if (isSameTierUpgrade && to_tier === 'free_trial') {
      // Update trial-specific fields even if tier is the same
      const limits = this.getTierLimits(to_tier);
      const displayName = this.getTierDisplayName(to_tier);

      const updateData: any = {
        subscription_display_name: displayName,
        playbooks_limit: limits.playbooks_limit,
        devotionals_limit: limits.devotionals_limit,
        smart_journaling_enabled: limits.smart_journaling_enabled,
        playbooks_used: 0, // ALWAYS reset usage for trial - should be 0/2
        devotionals_used: 0, // ALWAYS reset usage for trial - should be 0/2
        updated_at: new Date().toISOString(),
      };

      // Add platform info if provided
      if (options.platform_subscription_id) {
        updateData.platform_subscription_id = options.platform_subscription_id;
      }
      if (options.platform_transaction_id) {
        updateData.platform_transaction_id = options.platform_transaction_id;
      }

      const { data, error } = await supabase
        .from('user_subscriptions_new')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new SubscriptionError(`Failed to update trial subscription: ${error.message}`, 'TRIAL_UPDATE_ERROR', error);
      }

      return this.enrichSubscriptionData(data);
    }

    if (!isTrialConversion && !this.isValidUpgrade(from_tier, to_tier)) {
      throw new SubscriptionError(`Invalid upgrade from ${from_tier} to ${to_tier}`, 'INVALID_UPGRADE');
    }

    const limits = this.getTierLimits(to_tier);
    const displayName = this.getTierDisplayName(to_tier);

    const updateData: any = {
      tier: to_tier,
      status: 'active',
      subscription_start_date: new Date().toISOString(),
      subscription_display_name: displayName, // e.g., "siFia Spark", "siFia Growth"
      playbooks_limit: limits.playbooks_limit,
      devotionals_limit: limits.devotionals_limit,
      smart_journaling_enabled: limits.smart_journaling_enabled,
      updated_at: new Date().toISOString(),
    };

    // Add platform info if provided
    if (options.platform) {
      updateData.platform = options.platform;
    }
    if (options.platform_subscription_id) {
      updateData.platform_subscription_id = options.platform_subscription_id;
    }
    if (options.platform_transaction_id) {
      updateData.platform_transaction_id = options.platform_transaction_id;
    }

    // ALWAYS reset usage counters when upgrading to a new tier
    // Users should start fresh with their new tier's limits
    // This applies to: seeker→paid, trial→paid, spark→growth, growth→transformation, etc.
    updateData.playbooks_used = 0;
    updateData.devotionals_used = 0;
    updateData.last_usage_reset = new Date().toISOString(); // Track when usage was reset
    updateData.subscription_start_date = new Date().toISOString(); // Set billing anchor for monthly resets
    updateData.billing_cycle = to_tier.includes('_annual') ? 'annual' : 'monthly'; // Track billing frequency

    // POST-LAUNCH: Handle family upgrade
    /* if (is_family_upgrade && to_tier === 'family') {
      // Family upgrade logic will be implemented in Phase 4
      // Note: family_role column doesn't exist yet, skip for now
      // updateData.family_role = 'admin';
    } */

    // Apply discount code if provided
    if (discount_code) {
      const discount = await this.validateAndApplyDiscount(discount_code, to_tier);
      updateData.discount_code = discount_code;
      updateData.discount_applied_amount = discount.discount_amount;
      updateData.discount_percentage = discount.discount_percentage;
    }

    Logger.info('🔄 Attempting subscription upgrade', {
      userId,
      target_tier: to_tier,
      platform: options.platform,
      platform_subscription_id: options.platform_subscription_id,
      updateData_keys: Object.keys(updateData),
      component: 'NewSubscriptionService',
    });

    const { data, error } = await supabase
      .from('user_subscriptions_new')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      Logger.error('❌ Subscription upgrade database error', {
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        error_code: error.code,
        updateData_keys: Object.keys(updateData),
        userId,
      }, { component: 'NewSubscriptionService' });

      // Handle specific schema cache errors
      if (error.message?.includes('Could not find') && error.message?.includes('platform')) {
        Logger.error('❌ Database schema issue: platform column not found. Please apply the subscription schema.', undefined, { component: 'NewSubscriptionService' });
        throw new SubscriptionError(
          'Database schema not up to date. Please contact support.',
          'SCHEMA_ERROR',
          error
        );
      }
      throw new SubscriptionError(`Failed to upgrade subscription: ${error.message}`, 'UPGRADE_ERROR', error);
    }

    Logger.info('✅ Subscription upgrade successful', {
      subscription_id: data.id,
      new_tier: data.tier,
      platform: data.platform,
      platform_subscription_id: data.platform_subscription_id,
      component: 'NewSubscriptionService',
    });

    return this.enrichSubscriptionData(data);
  }

  /**
   * Cancel subscription (mark as cancelled but keep access until period ends)
   * User keeps current tier and remaining usage until subscription_end_date
   * POST-LAUNCH: Handles family cancellation if user is family admin
   */
  static async cancelSubscription(userId: string): Promise<Subscription> {
    // POST-LAUNCH: Check if user is family admin before cancelling
    /* const currentSubscription = await this.getUserSubscription(userId);
    const isFamilyAdmin = currentSubscription.tier === 'family' &&
                          currentSubscription.family_role === 'admin' &&
                          currentSubscription.family_group_id;

    // If family admin, trigger family cancellation flow
    if (isFamilyAdmin && currentSubscription.family_group_id) {
      try {
        const { FamilyPaymentService } = await import('./FamilyPaymentService');
        await FamilyPaymentService.handleFamilyCancellation(
          currentSubscription.family_group_id,
          userId,
          'admin_downgraded'
        );
      } catch (familyError) {
        Logger.error('Failed to handle family cancellation during downgrade', familyError as Error, {
          component: 'NewSubscriptionService',
          userId,
        });
        // Continue with individual cancellation even if family cleanup fails
      }
    } */

    // IMPORTANT: Do NOT immediately downgrade to seeker
    // Keep current tier and usage until subscription_end_date
    // Mark cancellation_date so we know it's cancelled
    const { data, error } = await supabase
      .from('user_subscriptions_new')
      .update({
        cancellation_date: new Date().toISOString(), // Mark as cancelled
        auto_renew_enabled: false, // Disable auto-renewal
        updated_at: new Date().toISOString(),
        // DO NOT change: tier, playbooks_limit, devotionals_limit, playbooks_used, devotionals_used
        // User keeps access until subscription_end_date
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new SubscriptionError(`Failed to cancel subscription: ${error.message}`, 'CANCELLATION_ERROR', error);
    }

    Logger.info('[NewSubscriptionService] ✅ Subscription cancelled - user keeps access until period ends', {
      component: 'NewSubscriptionService',
      userId,
      tier: data.tier,
      cancellation_date: data.cancellation_date,
      subscription_end_date: data.subscription_end_date,
    });

    await this.generateDynamicDiscount(userId, 'cancellation');

    return this.enrichSubscriptionData(data);
  }

  // ===== USAGE TRACKING =====

  /**
   * Check if user can perform an action
   */
  static async checkUsageLimit(userId: string, action: 'playbook' | 'devotional' | 'smart_journal' | 'export', isOnboarding: boolean = false): Promise<SubscriptionCheck> {
    // Check and perform monthly usage reset before checking limits
    await this.checkAndResetMonthlyUsage(userId);
    
    const subscription = await this.getUserSubscription(userId);

    // Check if trial has expired
    if (subscription.tier === 'free_trial' && subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      if (trialEnd < new Date()) {
        await this.handleExpiredTrial(userId);
        throw new TrialExpiredError(subscription.trial_end_date);
      }
    }

    // CRITICAL: Check if paid subscription has expired (webhook failsafe)
    // Webhook should handle this via EXPIRED, but check as failsafe
    if (subscription.tier !== 'seeker' && subscription.tier !== 'free_trial' && subscription.subscription_end_date) {
      const subEnd = new Date(subscription.subscription_end_date);
      if (subEnd < new Date()) {
        // Subscription expired but webhook didn't arrive - downgrade now
        Logger.warn('[NewSubscriptionService] Subscription expired (webhook failsafe triggered)', {
          component: 'NewSubscriptionService',
          userId,
          tier: subscription.tier,
          expiration: subscription.subscription_end_date,
        });
        
        await this.handleExpiredSubscription(userId);
        throw new SubscriptionError('Subscription has expired', 'SUBSCRIPTION_EXPIRED');
      }
    }

    const limits = this.getTierLimits(subscription.tier);

    switch (action) {
      case 'playbook':
        return this.checkPlaybookLimit(subscription, limits, isOnboarding);
      case 'devotional':
        return this.checkDevotionalLimit(subscription, limits);
      case 'smart_journal':
        return this.checkSmartJournalingLimit(subscription, limits);
      case 'export':
        return this.checkExportLimit(subscription, limits);
      default:
        throw new SubscriptionError(`Unknown action: ${action}`, 'INVALID_ACTION');
    }
  }

  /**
   * Increment usage counter
   */
  static async incrementUsage(userId: string, action: 'playbook' | 'devotional' | 'smart_journal' | 'export', isOnboarding: boolean = false): Promise<void> {
    // First check if action is allowed
    const check = await this.checkUsageLimit(userId, action, isOnboarding);
    const subscription = await this.getUserSubscription(userId);
    if (!check.can_generate_playbook && action === 'playbook') {
      throw new UsageLimitError(subscription.tier, 'playbook', subscription.playbooks_limit, subscription.playbooks_used);
    }
    if (!check.can_generate_devotional && action === 'devotional') {
      throw new UsageLimitError(subscription.tier, 'devotional', subscription.devotionals_limit, subscription.devotionals_used);
    }

    // Skip incrementing usage for onboarding playbooks - they're free for all tiers
    if (isOnboarding && action === 'playbook') {
      return;
    }

    // Increment the appropriate counter
    const updateField = action === 'playbook' ? 'playbooks_used' :
                       action === 'devotional' ? 'devotionals_used' : null;

    if (updateField) {
      // Get current value and increment manually to avoid RPC issues
      const { data: currentSub } = await supabase
        .from('user_subscriptions_new')
        .select(`${updateField}`)
        .eq('user_id', userId)
        .single();

      const currentValue = (currentSub as any)?.[updateField] || 0;

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          [updateField]: currentValue + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw new SubscriptionError(`Failed to increment usage: ${error.message}`, 'USAGE_UPDATE_ERROR', error);
      }
    }

    // Also update usage tracking table (but skip for onboarding)
    if (!isOnboarding || action !== 'playbook' || subscription.tier !== 'seeker') {
      await this.updateUsageTracking(userId, action);
    }
  }

  // ===== TRIAL MANAGEMENT =====

  /**
   * Handle expired trial (auto-downgrade to seeker)
   */
  static async handleExpiredTrial(userId: string): Promise<Subscription> {
    const { error } = await supabase.rpc('check_and_handle_expired_trials');

    if (error) {
      throw new SubscriptionError(`Failed to handle expired trial: ${error.message}`, 'TRIAL_EXPIRY_ERROR', error);
    }

    return await this.getUserSubscription(userId);
  }

  /**
   * Handle expired paid subscription (failsafe downgrade to seeker)
   * Webhook should handle this, but this is failsafe if webhook fails
   */
  static async handleExpiredSubscription(userId: string): Promise<Subscription> {
    const seekerLimits = this.getTierLimits('seeker');
    
    const { error } = await supabase
      .from('user_subscriptions_new')
      .update({
        tier: 'seeker',
        subscription_display_name: 'siFia Seeker',
        playbooks_limit: seekerLimits.playbooks_limit,
        devotionals_limit: seekerLimits.devotionals_limit,
        playbooks_used: 0,
        devotionals_used: 0,
        smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      throw new SubscriptionError(`Failed to handle expired subscription: ${error.message}`, 'SUBSCRIPTION_EXPIRY_ERROR', error);
    }

    return await this.getUserSubscription(userId);
  }

  /**
   * Check and process all expired trials (background job)
   */
  static async processExpiredTrials(): Promise<number> {
    const { data, error } = await supabase.rpc('check_and_handle_expired_trials');

    if (error) {
      throw new SubscriptionError(`Failed to process expired trials: ${error.message}`, 'BATCH_EXPIRY_ERROR', error);
    }

    return data || 0;
  }

  // ===== DISCOUNT CODES =====

  /**
   * Generate dynamic discount code
   */
  static async generateDynamicDiscount(userId: string, triggerEvent: string): Promise<DiscountCode | null> {
    // Dynamic discount logic - simplified for Phase 1
    const discountPercentage = triggerEvent === 'cancellation' ? 25 : 15;
    const code = `DYNAMIC_${userId.slice(-8).toUpperCase()}_${Date.now()}`;

    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        code,
        discount_percentage: discountPercentage,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        max_uses: 1,
        applicable_tiers: ['spark', 'growth', 'transformation'], // POST-LAUNCH: add 'family'
        is_dynamic: true,
        generated_for_user_id: userId,
        trigger_event: triggerEvent,
      })
      .select()
      .single();

    if (error) {
      return null; // Silently fail - discount generation is not critical
    }

    return data;
  }

  /**
   * Validate and apply discount code
   */
  static async validateAndApplyDiscount(code: string, tier: SubscriptionTier): Promise<DiscountCode> {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      throw new SubscriptionError('Invalid discount code', 'INVALID_DISCOUNT_CODE');
    }

    const discount = data as DiscountCode;

    // Validate discount
    if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
      throw new SubscriptionError('Discount code has expired', 'DISCOUNT_EXPIRED');
    }

    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      throw new SubscriptionError('Discount code usage limit reached', 'DISCOUNT_LIMIT_REACHED');
    }

    if (!discount.applicable_tiers.includes(tier)) {
      throw new SubscriptionError('Discount code not applicable to this tier', 'DISCOUNT_NOT_APPLICABLE');
    }

    // Increment usage
    await supabase
      .from('discount_codes')
      .update({ current_uses: discount.current_uses + 1 })
      .eq('id', discount.id);

    return discount;
  }

  // ===== HELPER METHODS =====

  /**
   * Get user-friendly display name for a tier
   */
  private static getTierDisplayName(tier: SubscriptionTier, trialChosenTier?: SubscriptionTier): string {
    // Handle annual variants
    const baseTier = tier.replace('_annual', '') as SubscriptionTier;
    const isAnnual = tier.includes('_annual');

    switch (baseTier) {
      case 'seeker':
        return 'siFia Seeker';
      case 'spark':
        return isAnnual ? 'siFia Spark Annual' : 'siFia Spark';
      case 'growth':
        return isAnnual ? 'siFia Growth Annual' : 'siFia Growth';
      case 'transformation':
        return isAnnual ? 'siFia Transformation Annual' : 'siFia Transformation';
      // POST-LAUNCH: case 'family':
      //   return isAnnual ? 'siFia Family Annual' : 'siFia Family';
      case 'free_trial':
        // Show which tier the trial is for (e.g., siFia Spark Trial)
        const chosenTier = trialChosenTier || 'spark';
        return `siFia ${chosenTier.charAt(0).toUpperCase() + chosenTier.slice(1)} Trial`;
      default:
        return `siFia ${String(baseTier).replace('_', ' ')}`;
    }
  }

  /**
   * Enrich subscription data with computed properties
   */
  private static enrichSubscriptionData(data: any): Subscription {
    const tierLimits = this.getTierLimits(data.tier);
    const displayName = this.getTierDisplayName(data.tier, data.trial_chosen_tier);

    // Create UI-friendly data structure
    const subscription: Subscription = {
      ...data,
      // Only override if stored values are missing/invalid (null/undefined), NOT if they're valid from upgrades
      playbooks_limit: data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit,
      devotionals_limit: data.devotionals_limit != null ? data.devotionals_limit : tierLimits.devotionals_limit,
      smart_journaling_enabled: data.smart_journaling_enabled != null ? data.smart_journaling_enabled : tierLimits.smart_journaling_enabled,
      show_dashboard_counts: data.show_dashboard_counts != null ? data.show_dashboard_counts : tierLimits.show_dashboard_counts,
      // Only override display name if it's missing or doesn't match tier
      subscription_display_name: data.subscription_display_name && data.subscription_display_name.includes(displayName) ? data.subscription_display_name : displayName,
      // Add limits property for dashboard compatibility
      limits: {
        playbooks_limit: data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit,
        devotionals_limit: data.devotionals_limit != null ? data.devotionals_limit : tierLimits.devotionals_limit,
        smart_journaling_enabled: data.smart_journaling_enabled != null ? data.smart_journaling_enabled : tierLimits.smart_journaling_enabled,
        show_dashboard_counts: data.show_dashboard_counts != null ? data.show_dashboard_counts : tierLimits.show_dashboard_counts,
        // Add backward compatibility aliases
        playbooks: data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit,
        devotionals: data.devotionals_limit != null ? data.devotionals_limit : tierLimits.devotionals_limit,
      },
      // UI fields - use actual limits (not stored values that might be outdated)
      playbooks_ui: data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit,
      devotionals_ui: data.devotionals_limit != null ? data.devotionals_limit : tierLimits.devotionals_limit,
      playbooks: data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit,
      devotionals: data.devotionals_limit != null ? data.devotionals_limit : tierLimits.devotionals_limit,
    };

    // Calculate trial expiry
    if (subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      const now = new Date();
      subscription.is_expired = trialEnd < now;
      subscription.days_remaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return subscription;
  }

  /**
   * Check if upgrade path is valid
   */
  private static isValidUpgrade(from: SubscriptionTier, to: SubscriptionTier): boolean {
    const tierHierarchy = ['seeker', 'free_trial', 'spark', 'growth', 'transformation']; // POST-LAUNCH: add 'family'

    // Strip _annual suffix for comparison
    const fromBase = from.replace(/_annual$/, '');
    const toBase = to.replace(/_annual$/, '');

    const fromIndex = tierHierarchy.indexOf(fromBase);
    const toIndex = tierHierarchy.indexOf(toBase);

    // POST-LAUNCH: Can upgrade from any tier to family
    // if (toBase === 'family') {return true;}

    // Can upgrade to higher tiers or same tier with different billing cycle
    return toIndex >= fromIndex;
  }

  /**
   * Check playbook generation limit
   */
  private static checkPlaybookLimit(subscription: Subscription, limits: SubscriptionLimits, isOnboarding: boolean = false): SubscriptionCheck {
    // PHASE 5: Grace period check - block generation if billing issue
    const isInGracePeriod = (subscription as any).billing_issue === true;
    const gracePeriodEnd = (subscription as any).grace_period_end_date;
    const isGracePeriodActive = isInGracePeriod && gracePeriodEnd && new Date(gracePeriodEnd) > new Date();

    // Use onboarding limit for seeker tier during onboarding
    const effectiveLimit = (subscription.tier === 'seeker' && isOnboarding)
      ? this.getOnboardingPlaybookLimit(subscription.tier)
      : limits.playbooks_limit;

    const isUnlimited = effectiveLimit === -1;
    const canGenerate = isGracePeriodActive ? false : (isUnlimited || subscription.playbooks_used < effectiveLimit);
    const remaining = isGracePeriodActive ? 0 : (isUnlimited ? -1 : Math.max(0, effectiveLimit - subscription.playbooks_used));

    return {
      can_generate_playbook: canGenerate,
      can_generate_devotional: true, // Will be checked separately
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true, // Will be checked separately
      playbooks_remaining: remaining,
      devotionals_remaining: -1, // Will be calculated separately
      show_upgrade_prompt: !canGenerate && subscription.tier !== 'transformation', // POST-LAUNCH: && subscription.tier !== 'family'
      upgrade_message: !canGenerate
        ? this.getPlaybookLimitMessage(subscription, limits)
        : undefined,
    };
  }

  /**
   * Check devotional generation limit
   */
  private static checkDevotionalLimit(subscription: Subscription, limits: SubscriptionLimits): SubscriptionCheck {
    // PHASE 5: Grace period check - block generation if billing issue
    const isInGracePeriod = (subscription as any).billing_issue === true;
    const gracePeriodEnd = (subscription as any).grace_period_end_date;
    const isGracePeriodActive = isInGracePeriod && gracePeriodEnd && new Date(gracePeriodEnd) > new Date();

    const isUnlimited = limits.devotionals_limit === -1;
    const canGenerate = isGracePeriodActive ? false : (isUnlimited || subscription.devotionals_used < limits.devotionals_limit);
    const remaining = isUnlimited ? -1 : Math.max(0, limits.devotionals_limit - subscription.devotionals_used);

    return {
      can_generate_playbook: true, // Will be checked separately
      can_generate_devotional: canGenerate,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true, // Will be checked separately
      playbooks_remaining: -1, // Will be calculated separately
      devotionals_remaining: remaining,
      show_upgrade_prompt: !canGenerate && subscription.tier !== 'transformation', // POST-LAUNCH: && subscription.tier !== 'family'
      upgrade_message: !canGenerate
        ? this.getDevotionalLimitMessage(subscription, limits)
        : undefined,
    };
  }

  /**
   * Get tier-specific playbook limit message
   */
  private static getPlaybookLimitMessage(subscription: Subscription, _limits: SubscriptionLimits): string {
    switch (subscription.tier) {
      case 'free_trial':
        return 'You\'ve reached your trial limit.';
      case 'spark':
        return 'You\'ve reached your Spark plan limit.';
      case 'growth':
        return 'You\'ve reached your Growth plan limit.';
      case 'seeker':
        return 'Ready to begin your journey?';
      default:
        return `You've reached your ${subscription.tier} plan limit.`;
    }
  }

  /**
   * Get tier-specific devotional limit message
   */
  private static getDevotionalLimitMessage(subscription: Subscription, _limits: SubscriptionLimits): string {
    switch (subscription.tier) {
      case 'free_trial':
        return 'You\'ve reached your trial limit.';
      case 'spark':
        return 'You\'ve reached your Spark plan limit.';
      case 'growth':
        return 'You\'ve reached your Growth plan limit.';
      case 'seeker':
        return 'Ready to begin your journey?';
      default:
        return `You've reached your ${subscription.tier} plan limit.`;
    }
  }

  /**
   * Check smart journaling access
   */
  private static checkSmartJournalingLimit(subscription: Subscription, limits: SubscriptionLimits): SubscriptionCheck {
    return {
      can_generate_playbook: true,
      can_generate_devotional: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
      devotionals_remaining: -1,
      show_upgrade_prompt: !limits.smart_journaling_enabled,
      upgrade_message: !limits.smart_journaling_enabled ? 'Smart journaling is available with Spark plan and above!' : undefined,
    };
  }

  /**
   * Check export limit (no limits for now)
   */
  private static checkExportLimit(subscription: Subscription, limits: SubscriptionLimits): SubscriptionCheck {
    return {
      can_generate_playbook: true,
      can_generate_devotional: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
      devotionals_remaining: -1,
      show_upgrade_prompt: false,
    };
  }

  /**
   * Update usage tracking table
   */
  private static async updateUsageTracking(_userId: string, _action: string): Promise<void> {
    // Skip usage tracking for now to avoid RPC function issues
    // This can be re-enabled once database functions are properly deployed
    return;
  }
}

export default NewSubscriptionService;
