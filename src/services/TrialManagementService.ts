// Enterprise-Grade Trial Management Service
// Handles trial lifecycle: creation, conversion, cancellation, grace periods
// Apple StoreKit 2 compliant with real-time webhook processing

import { Logger } from '../utils/ProductionLogger';
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';
import { SubscriptionTier } from '../types/subscription';
import { adminAnalyticsService } from './adminAnalyticsService';

export interface TrialCreationResult {
  success: boolean;
  tier: 'free_trial';
  chosenTier: SubscriptionTier;
  trialEndDate: string;
  error?: string;
}

export interface TrialConversionResult {
  success: boolean;
  fromTier: 'free_trial';
  toTier: SubscriptionTier;
  error?: string;
}

export interface TrialCancellationResult {
  success: boolean;
  revertedToSeeker: boolean;
  trialEligibilityRevoked: boolean;
  error?: string;
}

export class TrialManagementService {
  /**
   * PHASE 1A: Create a free trial subscription
   * Sets user to free_trial tier with tier-specific limits for 3 days
   * Spark: 5/5, Growth: 15/15, Transformation: 25/25
   */
  static async createTrial(
    userId: string,
    chosenTier: SubscriptionTier,
    platformSubscriptionId: string,
    transactionId: string,
    billingCycle?: 'monthly' | 'annual',
  ): Promise<TrialCreationResult> {
    try {
      Logger.info('[TrialManagement] Creating free trial', {
        userId,
        chosenTier,
        platformSubscriptionId,
        transactionId,
        billingCycle,
      });

      // Calculate trial end date (3 days from now)
      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 3);

      // Get tier-specific trial limits (Spark: 5/5, Growth: 15/15, Transformation: 25/25)
      const trialLimits = NewSubscriptionService.getTrialLimits(chosenTier);

      // Build display name with billing cycle
      const tierName = this.getTierName(chosenTier);
      const billingCycleName = billingCycle === 'annual' ? ' Annual' : '';
      const displayName = `siFia ${tierName}${billingCycleName} Trial`;

      // Capture device locale for location detection
      const { getDeviceLocale } = await import('../utils/localeHelper');
      const deviceLocale = getDeviceLocale();

      // Update subscription to free_trial tier
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'free_trial',
          subscription_display_name: displayName,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          trial_chosen_tier: chosenTier, // Store which tier they'll convert to
          billing_cycle: billingCycle || 'monthly', // Store billing cycle for conversion
          playbooks_limit: trialLimits.playbooks_limit,
          devotionals_limit: trialLimits.devotionals_limit,
          playbooks_used: 0, // Reset usage for trial
          devotionals_used: 0,
          smart_journaling_enabled: trialLimits.smart_journaling_enabled,
          platform_subscription_id: platformSubscriptionId,
          platform_transaction_id: transactionId,
          original_transaction_id: transactionId, // CRITICAL: Store for webhook lookups
          subscription_start_date: trialStartDate.toISOString(),
          locale: deviceLocale, // Capture device locale for market detection
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        Logger.error('[TrialManagement] Failed to create trial', error, { userId, chosenTier });
        return {
          success: false,
          tier: 'free_trial',
          chosenTier,
          trialEndDate: trialEndDate.toISOString(),
          error: error.message,
        };
      }

      // Track trial activation for analytics
      await adminAnalyticsService.trackTrialActivation(userId, chosenTier);

      Logger.info('[TrialManagement] ✅ Trial created successfully', {
        userId,
        tier: 'free_trial',
        chosenTier,
        trialEndDate: trialEndDate.toISOString(),
        limits: trialLimits,
      });

      return {
        success: true,
        tier: 'free_trial',
        chosenTier,
        trialEndDate: trialEndDate.toISOString(),
      };
    } catch (error) {
      Logger.error('[TrialManagement] Exception creating trial', error as Error, { userId, chosenTier });
      return {
        success: false,
        tier: 'free_trial',
        chosenTier,
        trialEndDate: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE 1B: Convert trial to paid subscription
   * Called when Apple charges after 3-day trial (via webhook)
   */
  static async convertTrialToPaid(
    userId: string,
    transactionId: string,
  ): Promise<TrialConversionResult> {
    try {
      Logger.info('[TrialManagement] Converting trial to paid', { userId, transactionId });

      // Get current subscription
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      // Verify user is on trial
      if (subscription.tier !== 'free_trial') {
        Logger.warn('[TrialManagement] User not on trial, skipping conversion', {
          userId,
          currentTier: subscription.tier,
        });
        return {
          success: false,
          fromTier: 'free_trial',
          toTier: subscription.tier,
          error: 'User not on trial',
        };
      }

      // Get the tier they chose during trial
      const chosenTier = (subscription as any).trial_chosen_tier || 'spark';
      const paidLimits = NewSubscriptionService.getTierLimits(chosenTier);

      const conversionNow = new Date().toISOString();
      // Issue 13 fix: billing_cycle must match the tier suffix to keep reset logic consistent
      const billingCycle = chosenTier.includes('_annual') ? 'annual' : 'monthly';

      // Convert to paid tier with full limits
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: chosenTier,
          billing_cycle: billingCycle,
          subscription_display_name: `siFia ${this.getTierName(chosenTier)}`,
          playbooks_limit: paidLimits.playbooks_limit,
          devotionals_limit: paidLimits.devotionals_limit,
          playbooks_used: 0, // Reset usage on conversion
          devotionals_used: 0,
          last_usage_reset: conversionNow, // Initialize reset anchor for first billing cycle
          smart_journaling_enabled: paidLimits.smart_journaling_enabled,
          platform_transaction_id: transactionId,
          subscription_start_date: conversionNow, // New start date for paid
          trial_converted_date: conversionNow,
          updated_at: conversionNow,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        Logger.error('[TrialManagement] Failed to convert trial', error, { userId, chosenTier });
        return {
          success: false,
          fromTier: 'free_trial',
          toTier: chosenTier,
          error: error.message,
        };
      }

      // Track subscription conversion for analytics
      await adminAnalyticsService.trackSubscriptionConversion(
        userId,
        'free_trial',
        chosenTier,
        billingCycle
      );

      Logger.info('[TrialManagement] ✅ Trial converted to paid successfully', {
        userId,
        fromTier: 'free_trial',
        toTier: chosenTier,
        limits: paidLimits,
      });

      return {
        success: true,
        fromTier: 'free_trial',
        toTier: chosenTier,
      };
    } catch (error) {
      Logger.error('[TrialManagement] Exception converting trial', error as Error, { userId });
      return {
        success: false,
        fromTier: 'free_trial',
        toTier: 'spark',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE 1C: Handle trial cancellation
   * Marks trial as cancelled but lets user finish remaining usage until trial_end_date
   */
  static async cancelTrial(userId: string): Promise<TrialCancellationResult> {
    try {
      Logger.info('[TrialManagement] Cancelling trial', { userId });

      // IMPORTANT: Do NOT immediately downgrade to seeker
      // Keep trial tier and usage until trial_end_date
      // User can finish their remaining trial usage (e.g., 1/2 used, can still use 1 more)
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          // Keep trial_start_date to prevent re-eligibility
          trial_cancelled_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // DO NOT change: tier, playbooks_limit, devotionals_limit, playbooks_used, devotionals_used
          // User keeps trial access until trial_end_date
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        Logger.error('[TrialManagement] Failed to cancel trial', error, { userId });
        return {
          success: false,
          revertedToSeeker: false,
          trialEligibilityRevoked: false,
          error: error.message,
        };
      }

      Logger.info('[TrialManagement] ✅ Trial cancelled - user keeps access until trial_end_date', {
        userId,
        trial_cancelled_date: new Date().toISOString(),
        trialEligibilityRevoked: true,
      });

      return {
        success: true,
        revertedToSeeker: false, // Not immediately reverted - happens at trial_end_date
        trialEligibilityRevoked: true,
      };
    } catch (error) {
      Logger.error('[TrialManagement] Exception cancelling trial', error as Error, { userId });
      return {
        success: false,
        revertedToSeeker: false,
        trialEligibilityRevoked: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PHASE 1D: Handle payment failure with grace period
   * User keeps access but no token generation (playbooks/devotionals)
   */
  static async handlePaymentFailure(
    userId: string,
    gracePeriodDays: number = 3, // Custom grace period
  ): Promise<{ success: boolean; gracePeriodEnd: string; error?: string }> {
    try {
      Logger.info('[TrialManagement] Handling payment failure with grace period', {
        userId,
        gracePeriodDays,
      });

      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

      // Mark subscription as in grace period
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          billing_issue: true,
          grace_period_end_date: gracePeriodEnd.toISOString(),
          // Keep current tier and limits, but block token generation
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        Logger.error('[TrialManagement] Failed to set grace period', error, { userId });
        return {
          success: false,
          gracePeriodEnd: gracePeriodEnd.toISOString(),
          error: error.message,
        };
      }

      Logger.info('[TrialManagement] ✅ Grace period set', {
        userId,
        gracePeriodEnd: gracePeriodEnd.toISOString(),
      });

      return {
        success: true,
        gracePeriodEnd: gracePeriodEnd.toISOString(),
      };
    } catch (error) {
      Logger.error('[TrialManagement] Exception setting grace period', error as Error, { userId });
      return {
        success: false,
        gracePeriodEnd: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper: Get tier display name
   */
  private static getTierName(tier: SubscriptionTier): string {
    const names: Record<SubscriptionTier, string> = {
      seeker: 'Seeker',
      free_trial: 'Trial',
      spark: 'Spark',
      spark_annual: 'Spark Annual',
      growth: 'Growth',
      growth_annual: 'Growth Annual',
      transformation: 'Transformation',
      transformation_annual: 'Transformation Annual',
    };
    return names[tier] || tier;
  }
}
