/**
 * Subscription Flow Service
 * 
 * Handles the logic for determining initial subscription tiers for new users
 * and managing the subscription flow based on different user sources and conditions.
 */

import { SubscriptionTier } from '../interfaces/subscription';
import { supabase } from '../lib/supabase';

export interface UserSignupSource {
  source?: 'organic' | 'campaign' | 'referral' | 'promotion' | 'social' | 'search';
  campaign?: string;
  referralCode?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface OnboardingPlaybook {
  id: string;
  title: string;
  content: string;
  category: string;
}

export class SubscriptionFlowService {
  /**
   * Determine the initial subscription tier for a new user
   * Based on signup source, campaigns, referrals, etc.
   */
  static determineInitialTier(
    userId: string, 
    signupSource?: UserSignupSource
  ): SubscriptionTier {
    // Option 1: Free trial for specific campaigns or promotions
    if (signupSource?.source === 'campaign' || 
        signupSource?.source === 'promotion' ||
        signupSource?.utm_campaign?.includes('trial')) {
      console.log(`[SubscriptionFlow] User ${userId} gets free_trial from campaign/promotion`);
      return 'free_trial';
    }

    // Option 2: Free trial for referrals (optional)
    if (signupSource?.source === 'referral' && signupSource?.referralCode) {
      console.log(`[SubscriptionFlow] User ${userId} gets free_trial from referral: ${signupSource.referralCode}`);
      return 'free_trial';
    }

    // Option 3: Free trial for paid advertising sources
    if (signupSource?.utm_source === 'google-ads' || 
        signupSource?.utm_source === 'facebook-ads' ||
        signupSource?.utm_medium === 'cpc') {
      console.log(`[SubscriptionFlow] User ${userId} gets free_trial from paid advertising`);
      return 'free_trial';
    }

    // Default: Basic (freemium) for organic users
    console.log(`[SubscriptionFlow] User ${userId} gets basic (freemium) tier`);
    return 'basic';
  }

  /**
   * Create initial subscription record for new user
   */
  static async createInitialSubscription(
    userId: string,
    signupSource?: UserSignupSource
  ): Promise<{ tier: SubscriptionTier; success: boolean; error?: string }> {
    try {
      const initialTier = this.determineInitialTier(userId, signupSource);
      
      // Calculate trial end date if applicable
      const trialEndsAt = initialTier === 'free_trial' 
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        : null;

      // Create subscription record
      const { error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          tier: initialTier,
          status: 'active',
          trial_ends_at: trialEndsAt?.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[SubscriptionFlow] Error creating subscription:', error);
        return { tier: initialTier, success: false, error: error.message };
      }

      // Log the signup source for analytics
      if (signupSource) {
        await this.logSignupSource(userId, signupSource, initialTier);
      }

      console.log(`[SubscriptionFlow] Created ${initialTier} subscription for user ${userId}`);
      return { tier: initialTier, success: true };

    } catch (error) {
      console.error('[SubscriptionFlow] Error in createInitialSubscription:', error);
      return { 
        tier: 'basic', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create onboarding playbook for new user
   */
  static async createOnboardingPlaybook(userId: string): Promise<OnboardingPlaybook | null> {
    try {
      const onboardingPlaybook = {
        title: "Welcome to siFia - Your Spiritual Journey Begins",
        content: JSON.stringify({
          introduction: "Welcome to siFia! This playbook will guide you through your first steps in spiritual growth and reflection.",
          sections: [
            {
              title: "Getting Started",
              steps: [
                "Set up your daily reflection time",
                "Choose your preferred prayer style",
                "Explore the journal features",
                "Set your spiritual goals"
              ]
            },
            {
              title: "Daily Practices",
              steps: [
                "Morning gratitude reflection",
                "Midday prayer check-in",
                "Evening review and planning",
                "Weekly spiritual assessment"
              ]
            }
          ],
          tips: [
            "Start small - even 5 minutes daily makes a difference",
            "Be consistent rather than perfect",
            "Use the app's reminders to build habits",
            "Connect with the community for support"
          ]
        }),
        category: "onboarding",
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert the playbook
      const { data, error } = await supabase
        .from('playbooks')
        .insert(onboardingPlaybook)
        .select()
        .single();

      if (error) {
        console.error('[SubscriptionFlow] Error creating onboarding playbook:', error);
        return null;
      }

      console.log(`[SubscriptionFlow] Created onboarding playbook for user ${userId}`);
      return {
        id: data.id,
        title: data.title,
        content: data.content,
        category: data.category,
      };

    } catch (error) {
      console.error('[SubscriptionFlow] Error in createOnboardingPlaybook:', error);
      return null;
    }
  }

  /**
   * Complete onboarding flow - create subscription and playbook
   */
  static async completeOnboarding(
    userId: string,
    signupSource?: UserSignupSource
  ): Promise<{
    subscription: { tier: SubscriptionTier; success: boolean; error?: string };
    playbook: OnboardingPlaybook | null;
  }> {
    console.log(`[SubscriptionFlow] Starting onboarding for user ${userId}`);

    // Create subscription
    const subscription = await this.createInitialSubscription(userId, signupSource);

    // Create onboarding playbook
    const playbook = await this.createOnboardingPlaybook(userId);

    console.log(`[SubscriptionFlow] Onboarding completed for user ${userId}:`, {
      tier: subscription.tier,
      hasPlaybook: !!playbook,
    });

    return { subscription, playbook };
  }

  /**
   * Log signup source for analytics
   */
  private static async logSignupSource(
    userId: string,
    signupSource: UserSignupSource,
    assignedTier: SubscriptionTier
  ): Promise<void> {
    try {
      await supabase
        .from('user_behavior_events')
        .insert({
          user_id: userId,
          event_type: 'signup',
          event_category: 'onboarding',
          event_data: {
            source: signupSource.source,
            campaign: signupSource.campaign,
            referral_code: signupSource.referralCode,
            utm_source: signupSource.utm_source,
            utm_medium: signupSource.utm_medium,
            utm_campaign: signupSource.utm_campaign,
            assigned_tier: assignedTier,
          },
          engagement_score: 0.5, // Initial engagement score
          created_at: new Date().toISOString(),
        });

      console.log(`[SubscriptionFlow] Logged signup source for user ${userId}`);
    } catch (error) {
      console.error('[SubscriptionFlow] Error logging signup source:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get tier assignment statistics for analytics
   */
  static async getTierAssignmentStats(): Promise<{
    total: number;
    byTier: Record<SubscriptionTier, number>;
    bySource: Record<string, { count: number; tier_distribution: Record<SubscriptionTier, number> }>;
  }> {
    try {
      // Get total subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select('tier, created_at');

      if (subError) throw subError;

      // Get signup sources
      const { data: signupEvents, error: eventError } = await supabase
        .from('user_behavior_events')
        .select('event_data, created_at')
        .eq('event_type', 'signup');

      if (eventError) throw eventError;

      // Calculate statistics
      const total = subscriptions?.length || 0;
      const byTier = subscriptions?.reduce((acc, sub) => {
        acc[sub.tier as SubscriptionTier] = (acc[sub.tier as SubscriptionTier] || 0) + 1;
        return acc;
      }, {} as Record<SubscriptionTier, number>) || {};

      const bySource = signupEvents?.reduce((acc, event) => {
        const source = event.event_data?.source || 'unknown';
        const assignedTier = event.event_data?.assigned_tier;
        
        if (!acc[source]) {
          acc[source] = { count: 0, tier_distribution: {} };
        }
        
        acc[source].count++;
        if (assignedTier) {
          acc[source].tier_distribution[assignedTier] = 
            (acc[source].tier_distribution[assignedTier] || 0) + 1;
        }
        
        return acc;
      }, {} as Record<string, { count: number; tier_distribution: Record<SubscriptionTier, number> }>) || {};

      return { total, byTier, bySource };

    } catch (error) {
      console.error('[SubscriptionFlow] Error getting tier assignment stats:', error);
      return { total: 0, byTier: {} as Record<SubscriptionTier, number>, bySource: {} };
    }
  }
}

export default SubscriptionFlowService;
