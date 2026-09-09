// New Subscription Service - Core Foundation
// Created: 2025-08-20
// Handles all subscription logic for the new tier system

import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { metaAppEventsService } from './metaAppEventsService';
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
  private static readonly PAID_EXPIRATION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

  private static getPaidExpirationGraceEnd(subscriptionEndDate?: string | null): Date | null {
    if (!subscriptionEndDate) {
      return null;
    }

    const endDate = new Date(subscriptionEndDate);
    if (Number.isNaN(endDate.getTime())) {
      return null;
    }

    return new Date(endDate.getTime() + this.PAID_EXPIRATION_GRACE_MS);
  }

  // ===== TIER CONFIGURATION =====
  /**
   * Get trial limits based on chosen tier
   * @param trialChosenTier - The tier the user chose for trial
   * @returns Tier limits for the trial period
   */
  static getTrialLimits(trialChosenTier?: SubscriptionTier): {
    playbooks_limit: number;
    wisdom_limit: number;
    refinement_limit: number;
    smart_journaling_enabled: boolean;
    show_dashboard_counts: boolean;
  } {
    const tier = ((trialChosenTier || 'growth') as string).replace('_annual', '') as SubscriptionTier;
    switch (tier) {
      case 'spark':
        return {
          playbooks_limit: 5,
          wisdom_limit: 2,
          refinement_limit: 2,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'growth':
        return {
          playbooks_limit: 15,
          wisdom_limit: 6,
          refinement_limit: 4,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'transformation':
        return {
          playbooks_limit: 25,
          wisdom_limit: 10,
          refinement_limit: 6,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      default:
        return {
          playbooks_limit: 15,
          wisdom_limit: 6,
          refinement_limit: 4,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
    }
  }

  /**
   * Get tier limits and features for a subscription tier
   * @param tier - The subscription tier
   * @param subscription - Optional full subscription object for trial_chosen_tier lookup
   */
  static getTierLimits(tier: SubscriptionTier, subscription?: Subscription | null): {
    playbooks_limit: number;
    wisdom_limit: number;
    refinement_limit: number;
    smart_journaling_enabled: boolean;
    show_dashboard_counts: boolean;
  } {
    // Map annual variants to base tiers for limits
    const baseTier = tier.replace('_annual', '') as SubscriptionTier;

    switch (baseTier) {
      case 'seeker':
        return {
          playbooks_limit: 2,
          wisdom_limit: 2,
          refinement_limit: 1,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'free_trial':
        // Free trial: Limits depend on trial_chosen_tier
        // Spark: 5/5, Growth: 15/15, Transformation: 25/25
        // Use stored trial_chosen_tier if available, otherwise default to Growth
        const trialChosenTier = (subscription as any)?.trial_chosen_tier || 'growth';
        return this.getTrialLimits(trialChosenTier);
      case 'spark':
        return {
          playbooks_limit: 10,
          wisdom_limit: 5,
          refinement_limit: 3,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'growth':
        return {
          playbooks_limit: 25,
          wisdom_limit: 12,
          refinement_limit: 6,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      case 'transformation':
        return {
          playbooks_limit: 60,
          wisdom_limit: 25,
          refinement_limit: 15,
          smart_journaling_enabled: true,
          show_dashboard_counts: true,
        };
      // POST-LAUNCH: Family tier
      // case 'family':
      //   return {
      //     playbooks_limit: -1,
      //     wisdom_limit: -1,
      //     refinement_limit: -1,
      //     smart_journaling_enabled: true,
      //     show_dashboard_counts: false, // Hide counts for unlimited
      //   };
      default:
        // Fallback to seeker limits for unknown tiers
        return {
          playbooks_limit: 2,
          wisdom_limit: 2,
          refinement_limit: 1,
          smart_journaling_enabled: false,
          show_dashboard_counts: true,
        };
    }
  }

  /**
   * Get onboarding playbook limit.
   * Seeker onboarding playbook is free and does not increment playbooks_used.
   */
  static getOnboardingPlaybookLimit(tier: SubscriptionTier, subscription?: Subscription | null): number {
    return this.getTierLimits(tier, subscription).playbooks_limit;
  }

  // ===== USER SUBSCRIPTION MANAGEMENT =====

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string, bustCache = false): Promise<Subscription> {
    // Journal by siFia is a paid app — grant full access without subscription checks
    return {
      id: 'local-journal-full',
      user_id: userId,
      tier: 'transformation',
      status: 'active',
      subscription_display_name: 'Journal Full Access',
      platform: 'local_test',
      playbooks_limit: -1,
      wisdom_limit: -1,
      refinement_limit: -1,
      playbooks_used: 0,
      wisdom_count: 0,
      refinement_count: 0,
      smart_journaling_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Subscription;

    // Original siFia subscription lookup (disabled for this paid app build)
    // let query = supabase
    //   .from('user_subscriptions_new')
    //   .select('*')
    //   .eq('user_id', userId);
    // if (bustCache) { query = query.gte('created_at', '1970-01-01T00:00:00.000Z'); }
    // const { data, error } = await query.single();

  }

  /**
   * Reset all usage counters for a newly activated entitlement period.
   */
  static async resetUsageCounters(userId: string): Promise<Subscription> {
    const resetAt = new Date().toISOString();
    const { error } = await supabase
      .from('user_subscriptions_new')
      .update({
        playbooks_used: 0,
        wisdom_count: 0,
        refinement_count: 0,
        last_usage_reset: resetAt,
        updated_at: resetAt,
      })
      .eq('user_id', userId);

    if (error) {
      throw new SubscriptionError(`Failed to reset usage counters: ${error.message}`, 'USAGE_RESET_ERROR', error);
    }

    return await this.getUserSubscription(userId, true);
  }

  /**
   * Replenish onboarding-only assist allowances without touching generated content counters.
   */
  static async resetOnboardingAssistCounters(userId: string): Promise<Subscription> {
    const resetAt = new Date().toISOString();
    const { error } = await supabase
      .from('user_subscriptions_new')
      .update({
        wisdom_count: 0,
        refinement_count: 0,
        updated_at: resetAt,
      })
      .eq('user_id', userId);

    if (error) {
      throw new SubscriptionError(`Failed to reset onboarding assist counters: ${error.message}`, 'ONBOARDING_ASSIST_RESET_ERROR', error);
    }

    return await this.getUserSubscription(userId, true);
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

      // Skip free_trial — no resets during trial period
      if (subscription.tier === 'free_trial') {
        return false;
      }

      // Seeker: reset 30 days after last_usage_reset.
      // For fresh seekers: last_usage_reset = account creation date.
      // For post-trial seekers: last_usage_reset = trial_end_date (cooldown clock).
      // Both cases: usage resets exactly 30 days after last_usage_reset, no rollover.
      if (subscription.tier === 'seeker') {
        const now = new Date();
        const lastReset = subscription.last_usage_reset
          ? new Date(subscription.last_usage_reset)
          : new Date(subscription.created_at);
        const nextReset = new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (now >= nextReset) {
          const { error: resetError } = await supabase
            .from('user_subscriptions_new')
            .update({
              playbooks_used: 0,
              wisdom_count: 0,
              refinement_count: 0,
              last_usage_reset: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          if (resetError) {
            Logger.error('[NewSubscriptionService] Failed to reset seeker monthly usage', resetError as Error, {
              component: 'NewSubscriptionService',
              userId,
            });
            return false;
          }

          Logger.info('[NewSubscriptionService] Seeker monthly usage reset', {
            component: 'NewSubscriptionService',
            userId,
            daysAfterLastReset: Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)),
          });
          return true;
        }
        return false;
      }

      const isAnnual = subscription.billing_cycle === 'annual' ||
                       subscription.tier?.includes('_annual');

      // Monthly paid subs: webhook is primary reset mechanism, but perform a
      // client-side calendar check as a fallback so the profile never shows stale counts.
      if (!isAnnual) {
        const anchor = new Date(subscription.subscription_start_date || subscription.created_at);
        const billingDay = anchor.getDate(); // e.g. 15th of every month
        const now = new Date();

        // Find the start of the current billing period (same calendar day, this or last month)
        // Clamp billing day to last day of current/prior month to prevent overflow (e.g., Feb 31 → Mar 3)
        const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const clampedDay = Math.min(billingDay, lastDayOfCurrentMonth);
        let periodStart: Date;
        if (now.getDate() >= clampedDay) {  // compare against clamped day so short months (Feb) are detected
          periodStart = new Date(now.getFullYear(), now.getMonth(), clampedDay);
        } else {
          const lastDayOfPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
          const clampedPriorDay = Math.min(billingDay, lastDayOfPriorMonth);
          periodStart = new Date(now.getFullYear(), now.getMonth() - 1, clampedPriorDay);
        }

        const lastReset = subscription.last_usage_reset ? new Date(subscription.last_usage_reset) : new Date(0);

        if (lastReset < periodStart) {
          const { error: resetError } = await supabase
            .from('user_subscriptions_new')
            .update({
              playbooks_used: 0,
              wisdom_count: 0,
              refinement_count: 0,
              last_usage_reset: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          if (resetError) {
            Logger.error('[NewSubscriptionService] Failed to reset monthly paid usage', resetError as Error, {
              component: 'NewSubscriptionService',
              userId,
            });
            return false;
          }

          Logger.info('[NewSubscriptionService] Monthly paid subscription client-side reset', {
            component: 'NewSubscriptionService',
            userId,
            tier: subscription.tier,
            billingDay,
            periodStart: periodStart.toISOString(),
          });
          return true;
        }
        return false;
      }

      // CANCELLATION BEHAVIOR FOR ANNUAL:
      // - User cancels → auto_renew_enabled: false, but tier stays annual
      // - Monthly resets CONTINUE (user paid for full year)
      // - Keeps annual badge/tier until expiration
      // - On Day 365: EXPIRED webhook downgrades to Seeker

      // Issue 8 fix: Use calendar-month arithmetic instead of 30-day rolling periods
      // to avoid drift (e.g., buy on Jan 15 → reset on Feb 15, Mar 15, not Feb 14, Mar 16)
      const billingAnchor = new Date(subscription.subscription_start_date || subscription.created_at);
      const now = new Date();
      const anchorDay = billingAnchor.getDate();

      // Clamp anchor day to last day of current/prior month to prevent overflow (e.g., Feb 31 → Mar 3)
      const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const clampedDay = Math.min(anchorDay, lastDayOfCurrentMonth);
      let currentPeriodStart: Date;
      if (now.getDate() >= clampedDay) {  // compare against clamped day so short months (Feb) are detected
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), clampedDay);
      } else {
        const lastDayOfPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        const clampedPriorDay = Math.min(anchorDay, lastDayOfPriorMonth);
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, clampedPriorDay);
      }

      // Check if we already reset for this period
      const lastReset = subscription.last_usage_reset ? new Date(subscription.last_usage_reset) : new Date(0);

      if (lastReset < currentPeriodStart) {
        // Need to reset - we're in a new 30-day period
        const { error: resetError } = await supabase
          .from('user_subscriptions_new')
          .update({
            playbooks_used: 0,
            wisdom_count: 0,
            refinement_count: 0,
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
          periodStart: currentPeriodStart.toISOString(),
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

      const seekerLimits = this.getTierLimits('seeker');

      // Force correct the tier and limits to seeker
      const { error: updateError } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          subscription_display_name: 'siFia Seeker',
          playbooks_limit: seekerLimits.playbooks_limit,
          wisdom_limit: seekerLimits.wisdom_limit,
          refinement_limit: seekerLimits.refinement_limit,
          smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
          show_dashboard_counts: seekerLimits.show_dashboard_counts,
          playbooks_used: 0,
          wisdom_count: 0,
          refinement_count: 0,
          last_usage_reset: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
    const {
      user_id,
      duration_days = 3,
      trial_chosen_tier,
      billing_cycle,
      platform_transaction_id,
      original_transaction_id,
      platform_subscription_id,
    } = options;

    try {
      // Since the start_free_trial RPC function doesn't exist, implement manually
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + duration_days);

      // Create or update subscription record with trial dates for proper expiry management
      const chosenTier = (trial_chosen_tier as SubscriptionTier) || 'spark';

      // IMPORTANT: Trial limits depend on chosen tier
      // Spark: 5/5, Growth: 15/15, Transformation: 25/25
      const trialLimits = this.getTrialLimits(chosenTier);

      // Generate display name for trial: "siFia Spark Trial", "siFia Growth Trial", etc.
      const tierDisplayName = this.getTierDisplayName(chosenTier);
      const displayName = `${tierDisplayName} Trial`;

      const trialNow = new Date().toISOString();
      const subscriptionData = {
        user_id: user_id,
        status: 'active', // Trial users have 'active' status, distinguished by trial_start_date
        tier: 'free_trial', // Set tier to 'free_trial' during trial period
        trial_start_date: trialNow,
        trial_end_date: trialEndDate.toISOString(),
        trial_chosen_tier: chosenTier, // Remember which tier they want after trial
        billing_cycle: billing_cycle || 'monthly', // Store billing cycle for conversion
        subscription_display_name: displayName, // e.g., "siFia Spark Trial"
        playbooks_limit: trialLimits.playbooks_limit,
        wisdom_limit: trialLimits.wisdom_limit,
        refinement_limit: trialLimits.refinement_limit,
        smart_journaling_enabled: trialLimits.smart_journaling_enabled,
        playbooks_used: 0,
        wisdom_count: 0,
        refinement_count: 0,
        last_usage_reset: trialNow, // Issue 7: initialize so first foreground check has a valid anchor
        updated_at: trialNow,
        // CRITICAL: Store transaction IDs for webhook lookup
        platform_transaction_id: platform_transaction_id,
        original_transaction_id: original_transaction_id,
        platform_subscription_id: platform_subscription_id,
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
      const trackTrialStarted = () => {
        metaAppEventsService.trackTrialStarted({
          tier: chosenTier,
          billingCycle: billing_cycle || 'monthly',
          transactionId: platform_transaction_id || original_transaction_id,
          productId: platform_subscription_id,
        });
      };

      // Final verification
      if (finalSubscription.tier !== 'free_trial') {
        Logger.error('[NewSubscriptionService] CRITICAL: Trial tier still incorrect after all retries', new Error('Trial tier verification failed'), {
          component: 'NewSubscriptionService',
          userId: user_id,
          expectedTier: 'free_trial',
          actualTier: finalSubscription.tier,
        });

        // Force correct the full trial state one last time
        await supabase
          .from('user_subscriptions_new')
          .update({
            tier: 'free_trial',
            status: 'active',
            trial_start_date: trialNow,
            trial_end_date: trialEndDate.toISOString(),
            trial_chosen_tier: chosenTier,
            billing_cycle: billing_cycle || 'monthly',
            subscription_display_name: displayName,
            playbooks_limit: trialLimits.playbooks_limit,
            wisdom_limit: trialLimits.wisdom_limit,
            refinement_limit: trialLimits.refinement_limit,
            smart_journaling_enabled: trialLimits.smart_journaling_enabled,
            playbooks_used: 0,
            wisdom_count: 0,
            refinement_count: 0,
            last_usage_reset: trialNow,
            platform_transaction_id,
            original_transaction_id,
            platform_subscription_id,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user_id);

        const correctedSubscription = await this.getUserSubscription(user_id);
        trackTrialStarted();
        return correctedSubscription;
      }

      trackTrialStarted();
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
          wisdom_limit: limits.wisdom_limit,
          refinement_limit: limits.refinement_limit,
          smart_journaling_enabled: limits.smart_journaling_enabled,
          playbooks_used: 0, // Reset usage when converting from trial to paid
          wisdom_count: 0,
          refinement_count: 0,
          subscription_start_date: new Date().toISOString(),
          last_usage_reset: new Date().toISOString(), // Initialize reset anchor for paid billing cycle
          trial_converted_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new SubscriptionError(`Failed to convert trial: ${error.message}`, 'TRIAL_CONVERSION_ERROR', error);
      }

      const convertedSubscription = await this.getUserSubscription(userId);
      metaAppEventsService.trackSubscriptionConverted({
        tier: chosenTier,
        billingCycle: (subscription as any).billing_cycle || 'monthly',
      });

      return convertedSubscription;
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
      // Use tier-specific trial limits based on trial_chosen_tier
      const subscription = await this.getUserSubscription(userId);
      const trialChosenTier = subscription?.trial_chosen_tier || 'growth';
      const limits = this.getTrialLimits(trialChosenTier);
      const displayName = this.getTierDisplayName(to_tier, trialChosenTier);

      const updateData: any = {
        subscription_display_name: displayName,
        playbooks_limit: limits.playbooks_limit,
        wisdom_limit: limits.wisdom_limit,
        refinement_limit: limits.refinement_limit,
        smart_journaling_enabled: limits.smart_journaling_enabled,
        playbooks_used: 0, // ALWAYS reset usage for trial
        wisdom_count: 0, // ALWAYS reset wisdom usage for trial
        refinement_count: 0,
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
      wisdom_limit: limits.wisdom_limit,
      refinement_limit: limits.refinement_limit,
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
    updateData.wisdom_count = 0;
    updateData.refinement_count = 0;
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
        // DO NOT change: tier, playbooks_limit, playbooks_used
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
  static async checkUsageLimit(userId: string, action: 'playbook' | 'smart_journal' | 'export' | 'wisdom' | 'refinement', isOnboarding: boolean = false): Promise<SubscriptionCheck> {
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

    // CRITICAL: Check if paid subscription is past the backend grace window.
    // Webhook/Apple sync should handle expiration first; this is only a late failsafe.
    if (subscription.tier !== 'seeker' && subscription.tier !== 'free_trial' && subscription.subscription_end_date) {
      const graceEnd = this.getPaidExpirationGraceEnd(subscription.subscription_end_date);
      if (graceEnd && graceEnd < new Date()) {
        // Subscription is past the grace window and webhook did not downgrade it.
        Logger.warn('[NewSubscriptionService] Subscription past grace (webhook failsafe triggered)', {
          component: 'NewSubscriptionService',
          userId,
          tier: subscription.tier,
          expiration: subscription.subscription_end_date,
          expirationGraceEnd: graceEnd.toISOString(),
        });

        await this.handleExpiredSubscription(userId);
        throw new SubscriptionError('Subscription has expired', 'SUBSCRIPTION_EXPIRED');
      }
    }

    const limits = this.getTierLimits(subscription.tier, subscription);

    switch (action) {
      case 'playbook':
        return this.checkPlaybookLimit(subscription, limits, isOnboarding);
      case 'smart_journal':
        return this.checkSmartJournalingLimit(subscription, limits);
      case 'export':
        return this.checkExportLimit(subscription, limits);
      case 'wisdom':
        return this.checkWisdomLimit(subscription, limits, isOnboarding);
      case 'refinement':
        return this.checkRefinementLimit(subscription, limits, isOnboarding);
      default:
        throw new SubscriptionError(`Unknown action: ${action}`, 'INVALID_ACTION');
    }
  }

  /**
   * Increment usage counter
   */
  static async incrementUsage(userId: string, action: 'playbook' | 'smart_journal' | 'export' | 'wisdom' | 'refinement', isOnboarding: boolean = false): Promise<void> {
    // First check if action is allowed
    const check = await this.checkUsageLimit(userId, action, isOnboarding);
    const subscription = await this.getUserSubscription(userId);
    if (!check.can_generate_playbook && action === 'playbook') {
      throw new UsageLimitError(subscription.tier, 'playbook', subscription.playbooks_limit, subscription.playbooks_used);
    }
    if (check.show_upgrade_prompt && action === 'refinement') {
      throw new UsageLimitError(subscription.tier, 'refinement', subscription.refinement_limit, subscription.refinement_count);
    }

    // Increment the appropriate counter
    const updateField = action === 'playbook' ? 'playbooks_used' :
                       action === 'wisdom' ? 'wisdom_count' :
                       action === 'refinement' ? 'refinement_count' : null;

    if (updateField) {
      // Optimistic-lock increment with a fresh limit check on every retry.
      // This prevents concurrent requests from pushing usage beyond the monthly quota.
      const doAtomicIncrement = async (): Promise<void> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const currentSubscription = await this.getUserSubscription(userId, true);
          const currentValue = (currentSubscription as any)?.[updateField] || 0;
          const limits = this.getTierLimits(currentSubscription.tier, currentSubscription);
          const limit = action === 'playbook'
            ? (currentSubscription.tier === 'seeker' && isOnboarding ? this.getOnboardingPlaybookLimit(currentSubscription.tier, currentSubscription) : limits.playbooks_limit)
            : action === 'wisdom'
                ? (isOnboarding ? 1 : limits.wisdom_limit)
                : action === 'refinement'
                  ? (isOnboarding ? 1 : limits.refinement_limit)
                  : -1;

          if (limit !== -1 && currentValue >= limit) {
            throw new UsageLimitError(currentSubscription.tier, action, limit, currentValue);
          }

          const { data: updated, error } = await supabase
            .from('user_subscriptions_new')
            .update({
              [updateField]: currentValue + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq(updateField, currentValue)
            .select(updateField)
            .maybeSingle();

          if (error) {
            throw new SubscriptionError(`Failed to increment usage: ${error.message}`, 'USAGE_UPDATE_ERROR', error);
          }

          if (updated) {
            return;
          }
        }

        throw new SubscriptionError('Failed to increment usage after concurrent updates', 'USAGE_UPDATE_CONFLICT');
      };

      // Only skip counting playbook usage for seeker users during onboarding —
      // their first generated content is free and should not consume their quota.
      // free_trial usage MUST be counted so the profile shows accurate progress
      // (e.g. 3/15) and so the trial limit is actually enforced.
      const skipCount = isOnboarding
        && subscription.tier === 'seeker'
        && action === 'playbook';
      if (!skipCount) {
        await doAtomicIncrement();
      }
    }

    // Also update the legacy usage tracking table where enabled.
    // free_trial is no longer excluded — counts must be recorded there too.
    const isOnboardingSeeker = isOnboarding
      && subscription.tier === 'seeker'
      && action === 'playbook';
    if (!isOnboardingSeeker) {
      await this.updateUsageTracking(userId, action);
    }
  }

  // ===== TRIAL MANAGEMENT =====

  /**
   * Handle expired trial (auto-downgrade to seeker)
   */
  static async handleExpiredTrial(userId: string): Promise<Subscription> {
    const seekerLimits = this.getTierLimits('seeker');

    const { error } = await supabase
      .from('user_subscriptions_new')
      .update({
        tier: 'seeker',
        subscription_display_name: 'siFia Seeker',
        playbooks_limit: seekerLimits.playbooks_limit,
        wisdom_limit: seekerLimits.wisdom_limit,
        refinement_limit: seekerLimits.refinement_limit,
        playbooks_used: 0,
        wisdom_count: 0,
        refinement_count: 0,
        smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
        billing_cycle: null,
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('tier', 'free_trial'); // safety: only downgrade if actually on trial

    if (error) {
      throw new SubscriptionError(
        `Failed to handle expired trial: ${error.message}`,
        'TRIAL_EXPIRY_ERROR',
        error
      );
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
        wisdom_limit: seekerLimits.wisdom_limit,
        refinement_limit: seekerLimits.refinement_limit,
        playbooks_used: 0,
        wisdom_count: 0,
        refinement_count: 0,
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
    const seekerLimits = this.getTierLimits('seeker');

    const { data, error } = await supabase
      .from('user_subscriptions_new')
      .update({
        tier: 'seeker',
        subscription_display_name: 'siFia Seeker',
        playbooks_limit: seekerLimits.playbooks_limit,
        wisdom_limit: seekerLimits.wisdom_limit,
        refinement_limit: seekerLimits.refinement_limit,
        playbooks_used: 0,
        wisdom_count: 0,
        refinement_count: 0,
        smart_journaling_enabled: seekerLimits.smart_journaling_enabled,
        billing_cycle: null,
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('tier', 'free_trial')
      .lt('trial_end_date', new Date().toISOString()) // only expired trials
      .select();

    if (error) {
      throw new SubscriptionError(
        `Failed to process expired trials: ${error.message}`,
        'BATCH_EXPIRY_ERROR',
        error
      );
    }

    return data?.length || 0;
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
        const chosenTierRaw = (trialChosenTier || 'spark') as string;
        const chosenTier = chosenTierRaw.replace('_annual', '');
        const trialBilling = chosenTierRaw.includes('_annual') ? ' Annual' : '';
        return `siFia ${chosenTier.charAt(0).toUpperCase() + chosenTier.slice(1)}${trialBilling} Trial`;
      default:
        return `siFia ${String(baseTier).replace('_', ' ')}`;
    }
  }

  /**
   * Enrich subscription data with computed properties
   */
  private static enrichSubscriptionData(data: any): Subscription {
    const tierLimits = this.getTierLimits(data.tier, data);
    const displayName = this.getTierDisplayName(data.tier, data.trial_chosen_tier);

    // Always use calculated limits as the source of truth. Server/webhook rows may
    // contain stale historical limits (for example old trial or Transformation values).
    const useCalculatedLimits = true;

    // Create UI-friendly data structure
    const subscription: Subscription = {
      ...data,
      // Use calculated limits so stale stored rows cannot bypass or hide quotas.
      playbooks_limit: useCalculatedLimits ? tierLimits.playbooks_limit : (data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit),
      wisdom_limit: useCalculatedLimits ? tierLimits.wisdom_limit : (data.wisdom_limit != null ? data.wisdom_limit : tierLimits.wisdom_limit),
      refinement_limit: useCalculatedLimits ? tierLimits.refinement_limit : (data.refinement_limit != null ? data.refinement_limit : tierLimits.refinement_limit),
      refinement_count: data.refinement_count || 0,
      smart_journaling_enabled: useCalculatedLimits ? tierLimits.smart_journaling_enabled : (data.smart_journaling_enabled != null ? data.smart_journaling_enabled : tierLimits.smart_journaling_enabled),
      // Only override display name if it's missing or doesn't match tier
      subscription_display_name: data.subscription_display_name && data.subscription_display_name.includes(displayName) ? data.subscription_display_name : displayName,
      // Add limits property for dashboard compatibility
      limits: {
        playbooks_limit: useCalculatedLimits ? tierLimits.playbooks_limit : (data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit),
        wisdom_limit: useCalculatedLimits ? tierLimits.wisdom_limit : (data.wisdom_limit != null ? data.wisdom_limit : tierLimits.wisdom_limit),
        refinement_limit: useCalculatedLimits ? tierLimits.refinement_limit : (data.refinement_limit != null ? data.refinement_limit : tierLimits.refinement_limit),
        smart_journaling_enabled: useCalculatedLimits ? tierLimits.smart_journaling_enabled : (data.smart_journaling_enabled != null ? data.smart_journaling_enabled : tierLimits.smart_journaling_enabled),
        // Add backward compatibility aliases
        playbooks: useCalculatedLimits ? tierLimits.playbooks_limit : (data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit),
        wisdom: useCalculatedLimits ? tierLimits.wisdom_limit : (data.wisdom_limit != null ? data.wisdom_limit : tierLimits.wisdom_limit),
        refinements: useCalculatedLimits ? tierLimits.refinement_limit : (data.refinement_limit != null ? data.refinement_limit : tierLimits.refinement_limit),
      },
      // UI fields - use actual limits (not stored values that might be outdated)
      playbooks_ui: useCalculatedLimits ? tierLimits.playbooks_limit : (data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit),
      playbooks: useCalculatedLimits ? tierLimits.playbooks_limit : (data.playbooks_limit != null ? data.playbooks_limit : tierLimits.playbooks_limit),
    };

    // Add trial expiration tracking for free_trial tier
    if (data.tier === 'free_trial' && data.trial_end_date) {
      const trialEnd = new Date(data.trial_end_date);
      const now = new Date();
      subscription.is_expired = trialEnd < now;
      subscription.days_remaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Add cooldown state detection for users who ended trial without upgrading
    // Cooldown state: tier === 'seeker' AND trial_start_date IS NOT NULL AND playbooks_used >= playbooks_limit
    if (data.tier === 'seeker' && data.trial_start_date && data.playbooks_used >= data.playbooks_limit) {
      subscription.is_in_cooldown = true;
      // Calculate replenish date = last_usage_reset + 30 days
      if (data.last_usage_reset) {
        const lastReset = new Date(data.last_usage_reset);
        const replenishDate = new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000);
        subscription.replenish_date = replenishDate.toISOString();
      }
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

    // Onboarding usage counts against the same monthly quota as regular usage.
    const effectiveLimit = (subscription.tier === 'seeker' && isOnboarding)
      ? this.getOnboardingPlaybookLimit(subscription.tier, subscription)
      : limits.playbooks_limit;

    const isUnlimited = effectiveLimit === -1;
    const canGenerate = isGracePeriodActive ? false : (isUnlimited || subscription.playbooks_used < effectiveLimit);
    const remaining = isGracePeriodActive ? 0 : (isUnlimited ? -1 : Math.max(0, effectiveLimit - subscription.playbooks_used));

    return {
      can_generate_playbook: canGenerate,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true, // Will be checked separately
      playbooks_remaining: remaining,
      show_upgrade_prompt: !canGenerate && subscription.tier !== 'transformation', // POST-LAUNCH: && subscription.tier !== 'family'
      upgrade_message: !canGenerate
        ? this.getPlaybookLimitMessage(subscription, limits)
        : undefined,
    };
  }

  /**
   * Check wisdom usage limit
   */
  private static checkWisdomLimit(subscription: Subscription, limits: SubscriptionLimits, isOnboarding: boolean = false): SubscriptionCheck {
    const wisdomUsed = (subscription as any).wisdom_count || 0;
    const wisdomLimit = isOnboarding ? 1 : limits.wisdom_limit || 0;
    const isUnlimited = wisdomLimit === -1;
    const canUse = isUnlimited || wisdomUsed < wisdomLimit;
    const normalizedTier = subscription.tier.replace('_annual', '');

    return {
      can_generate_playbook: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
      show_upgrade_prompt: !canUse,
      upgrade_message: !canUse
        ? isOnboarding
          ? 'You have used your onboarding How To request. You will get your normal How To requests after onboarding.'
          : normalizedTier === 'transformation'
          ? `You've used all ${wisdomLimit} wisdom requests this month. Your wisdom requests will refresh next month.`
          : `You've used all ${wisdomLimit} wisdom requests this month. Upgrade for more!`
        : undefined,
    };
  }

  private static checkRefinementLimit(subscription: Subscription, limits: SubscriptionLimits, isOnboarding: boolean = false): SubscriptionCheck {
    const refinementUsed = (subscription as any).refinement_count || 0;
    const refinementLimit = isOnboarding ? 1 : limits.refinement_limit || 0;
    const isUnlimited = refinementLimit === -1;
    const canUse = isUnlimited || refinementUsed < refinementLimit;
    const normalizedTier = subscription.tier.replace('_annual', '');

    return {
      can_generate_playbook: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
      show_upgrade_prompt: !canUse,
      upgrade_message: !canUse
        ? isOnboarding
          ? 'You have used your onboarding playbook refinement. You will get your normal refinements after onboarding.'
          : normalizedTier === 'transformation'
          ? `You've used all ${refinementLimit} playbook refinements this month. Your refinements will refresh next month.`
          : `You've used all ${refinementLimit} playbook refinements this month. Upgrade for more!`
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

  private static checkSmartJournalingLimit(subscription: Subscription, limits: SubscriptionLimits): SubscriptionCheck {
    return {
      can_generate_playbook: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
      show_upgrade_prompt: !limits.smart_journaling_enabled,
      upgrade_message: !limits.smart_journaling_enabled ? 'Smart journaling is available with Spark plan and above!' : undefined,
    };
  }

  private static checkExportLimit(subscription: Subscription, limits: SubscriptionLimits): SubscriptionCheck {
    return {
      can_generate_playbook: true,
      can_use_smart_journaling: limits.smart_journaling_enabled,
      can_export: true,
      playbooks_remaining: -1,
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
