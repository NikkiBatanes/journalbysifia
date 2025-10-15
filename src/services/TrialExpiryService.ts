// Trial Expiry Service
// Handles automatic trial expiry and downgrade to Seeker tier
// Created: 2025-08-20

import { supabase } from './supabaseClient';
import { NewSubscriptionService } from './NewSubscriptionService';

export class TrialExpiryService {
  private static instance: TrialExpiryService;
  private subscriptionService: NewSubscriptionService;

  private constructor() {
    this.subscriptionService = new NewSubscriptionService();
  }

  static getInstance(): TrialExpiryService {
    if (!TrialExpiryService.instance) {
      TrialExpiryService.instance = new TrialExpiryService();
    }
    return TrialExpiryService.instance;
  }

  /**
   * Check and handle expired trials
   * This should be called periodically (e.g., on app startup, user login)
   */
  async checkAndHandleExpiredTrials(): Promise<number> {
    try {
      console.log('🔍 Checking for expired trials...');

      const { data: expiredCount, error } = await supabase
        .rpc('check_and_handle_expired_trials');

      if (error) {
        console.error('❌ Error checking expired trials:', error);
        return 0;
      }

      if (expiredCount > 0) {
        console.log(`✅ Processed ${expiredCount} expired trials`);
      } else {
        console.log('✅ No expired trials found');
      }

      return expiredCount || 0;
    } catch (error) {
      console.error('💥 Failed to check expired trials:', error);
      return 0;
    }
  }

  /**
   * Check if a specific user's trial has expired
   */
  async checkUserTrialExpiry(userId: string): Promise<boolean> {
    try {
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (subscription.tier !== 'free_trial') {
        return false; // Not on trial
      }

      if (!subscription.trial_end_date) {
        console.warn('⚠️ Trial subscription missing end date');
        return false;
      }

      const now = new Date();
      const trialEnd = new Date(subscription.trial_end_date);

      const isExpired = now > trialEnd;

      if (isExpired) {
        console.log(`⏰ Trial expired for user ${userId}`);
        await this.downgradeTrial(userId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('💥 Error checking user trial expiry:', error);
      return false;
    }
  }

  /**
   * Manually downgrade a trial to Seeker tier
   */
  async downgradeTrial(userId: string): Promise<void> {
    try {
      console.log(`⬇️ Downgrading trial to Seeker for user ${userId}`);

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'seeker',
          status: 'active',
          playbooks_limit: 0,
          devotionals_limit: 0,
          playbooks_used: 0,
          devotionals_used: 0,
          smart_journaling_enabled: false,
          trial_start_date: null,
          trial_end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('tier', 'free_trial');

      if (error) {
        throw new Error(`Failed to downgrade trial: ${error.message}`);
      }

      console.log(`✅ Successfully downgraded trial to Seeker for user ${userId}`);
    } catch (error) {
      console.error('💥 Error downgrading trial:', error);
      throw error;
    }
  }

  /**
   * Get trial time remaining for a user
   */
  async getTrialTimeRemaining(userId: string): Promise<{
    isOnTrial: boolean;
    hoursRemaining: number;
    daysRemaining: number;
    isExpired: boolean;
  }> {
    try {
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (subscription.tier !== 'free_trial' || !subscription.trial_end_date) {
        return {
          isOnTrial: false,
          hoursRemaining: 0,
          daysRemaining: 0,
          isExpired: false,
        };
      }

      const now = new Date();
      const trialEnd = new Date(subscription.trial_end_date);
      const timeDiff = trialEnd.getTime() - now.getTime();

      if (timeDiff <= 0) {
        return {
          isOnTrial: true,
          hoursRemaining: 0,
          daysRemaining: 0,
          isExpired: true,
        };
      }

      const hoursRemaining = Math.floor(timeDiff / (1000 * 60 * 60));
      const daysRemaining = Math.floor(hoursRemaining / 24);

      return {
        isOnTrial: true,
        hoursRemaining,
        daysRemaining,
        isExpired: false,
      };
    } catch (error) {
      console.error('💥 Error getting trial time remaining:', error);
      return {
        isOnTrial: false,
        hoursRemaining: 0,
        daysRemaining: 0,
        isExpired: false,
      };
    }
  }

  /**
   * Schedule trial expiry check (for background tasks)
   */
  scheduleTrialExpiryCheck(): void {
    // Check every hour
    setInterval(async () => {
      await this.checkAndHandleExpiredTrials();
    }, 60 * 60 * 1000);

    console.log('⏰ Trial expiry checker scheduled (every hour)');
  }

  /**
   * Send trial expiry notifications
   * This would integrate with your notification system
   */
  async sendTrialExpiryNotifications(): Promise<void> {
    try {
      console.log('📱 Checking for trial expiry notifications...');

      // Get users whose trials expire in 24 hours
      const { data: expiringTrials, error } = await supabase
        .from('user_subscriptions_new')
        .select(`
          user_id,
          trial_end_date,
          user_profiles!inner(email, first_name)
        `)
        .eq('tier', 'free_trial')
        .eq('status', 'active')
        .gte('trial_end_date', new Date().toISOString())
        .lte('trial_end_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('❌ Error fetching expiring trials:', error);
        return;
      }

      if (!expiringTrials || expiringTrials.length === 0) {
        console.log('✅ No trials expiring in next 24 hours');
        return;
      }

      console.log(`📧 Found ${expiringTrials.length} trials expiring soon`);

      // Here you would integrate with your notification service
      // For now, we'll just log the notifications
      for (const trial of expiringTrials) {
        const profile = Array.isArray(trial.user_profiles) ? trial.user_profiles[0] : trial.user_profiles;
        console.log(`📧 Would send expiry notification to ${profile?.email}`);
      }
    } catch (error) {
      console.error('💥 Error sending trial expiry notifications:', error);
    }
  }
}

export const trialExpiryService = TrialExpiryService.getInstance();
