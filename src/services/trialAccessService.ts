import { supabase } from './supabaseClient';
import { subscriptionService } from './subscriptionService';

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  expiresAt: Date;
  hasExpired: boolean;
  fullAccessEnabled: boolean;
}

export interface FeatureAccess {
  smartJournalingEnabled: boolean;
  journalTemplatesAccess: 'basic' | 'all';
  playbooksRemaining: number;
  devotionalsRemaining: number;
  intelligenceEnabled: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

class TrialAccessService {
  private readonly TRIAL_DURATION_DAYS = 3;

  /**
   * Get current trial status for user
   */
  async getTrialStatus(userId: string): Promise<TrialStatus> {
    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, created_at, trial_ends_at')
        .eq('user_id', userId)
        .single();

      if (!subscription) {
        // No subscription = no trial started
        return {
          isActive: false,
          daysRemaining: 0,
          expiresAt: new Date(),
          hasExpired: true,
          fullAccessEnabled: false,
        };
      }

      const now = new Date();
      const trialEndsAt = subscription.trial_ends_at
        ? new Date(subscription.trial_ends_at)
        : new Date(subscription.created_at);

      // Add trial duration if not explicitly set
      if (!subscription.trial_ends_at) {
        trialEndsAt.setDate(trialEndsAt.getDate() + this.TRIAL_DURATION_DAYS);
      }

      const hasExpired = now > trialEndsAt;
      const isActive = subscription.tier === 'free_trial' && !hasExpired;
      const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        isActive,
        daysRemaining,
        expiresAt: trialEndsAt,
        hasExpired,
        fullAccessEnabled: isActive, // Full access only during active trial
      };
    } catch (error) {
      console.error('Error getting trial status:', error);
      return {
        isActive: false,
        daysRemaining: 0,
        expiresAt: new Date(),
        hasExpired: true,
        fullAccessEnabled: false,
      };
    }
  }

  /**
   * Get feature access based on trial status and subscription tier
   */
  async getFeatureAccess(userId: string): Promise<FeatureAccess> {
    try {
      const trialStatus = await this.getTrialStatus(userId);
      const subscription = await subscriptionService.getUserSubscription(userId);

      if (!subscription) {
        return this.getDefaultFeatureAccess();
      }

      // During active trial: FULL ACCESS to everything
      if (trialStatus.fullAccessEnabled) {
        return {
          smartJournalingEnabled: true,
          journalTemplatesAccess: 'all',
          playbooksRemaining: 999, // Unlimited during trial
          devotionalsRemaining: 999, // Unlimited during trial
          intelligenceEnabled: true,
          advancedAnalytics: true,
          prioritySupport: true,
        };
      }

      // After trial expires: Apply tier-based limits
      const limits = subscriptionService.getSubscriptionLimits(subscription.tier);
      const usage = await subscriptionService.getCurrentUsage(userId);

      return {
        smartJournalingEnabled: limits.smartJournalingEnabled || false,
        journalTemplatesAccess: limits.journalTemplatesAccess || 'basic',
        playbooksRemaining: Math.max(0, limits.playbooks - usage.playbooks),
        devotionalsRemaining: Math.max(0, limits.devotionals - usage.devotionals),
        intelligenceEnabled: limits.intelligenceEnabled || false,
        advancedAnalytics: limits.advancedAnalytics || false,
        prioritySupport: limits.prioritySupport || false,
      };
    } catch (error) {
      console.error('Error getting feature access:', error);
      return this.getDefaultFeatureAccess();
    }
  }

  /**
   * Check if user can access a specific feature
   */
  async canAccessFeature(userId: string, feature: keyof FeatureAccess): Promise<boolean> {
    const access = await this.getFeatureAccess(userId);
    return !!access[feature];
  }

  /**
   * Check if user can generate content (playbook/devotional)
   */
  async canGenerateContent(userId: string, contentType: 'playbook' | 'devotional'): Promise<{
    canGenerate: boolean;
    reason?: string;
    remainingCount?: number;
  }> {
    const access = await this.getFeatureAccess(userId);
    const remaining = contentType === 'playbook'
      ? access.playbooksRemaining
      : access.devotionalsRemaining;

    if (remaining > 0) {
      return {
        canGenerate: true,
        remainingCount: remaining,
      };
    }

    const trialStatus = await this.getTrialStatus(userId);

    if (trialStatus.hasExpired && !trialStatus.isActive) {
      return {
        canGenerate: false,
        reason: 'trial_expired',
        remainingCount: 0,
      };
    }

    return {
      canGenerate: false,
      reason: 'limit_reached',
      remainingCount: 0,
    };
  }

  /**
   * Start trial for new user
   */
  async startTrial(userId: string): Promise<void> {
    try {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + this.TRIAL_DURATION_DAYS);

      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          tier: 'free_trial',
          status: 'active',
          trial_ends_at: trialEndsAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      console.log(`Trial started for user ${userId}, expires at ${trialEndsAt}`);
    } catch (error) {
      console.error('Error starting trial:', error);
      throw error;
    }
  }

  /**
   * Handle trial expiration - convert to free tier with locked features
   */
  async handleTrialExpiration(userId: string): Promise<void> {
    try {
      const trialStatus = await this.getTrialStatus(userId);

      if (trialStatus.hasExpired && trialStatus.isActive) {
        // Update subscription to expired trial state
        await supabase
          .from('subscriptions')
          .update({
            tier: 'free_trial', // Keep as trial but expired
            status: 'trial_expired',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        // Log trial expiration for analytics
        await this.logTrialEvent(userId, 'trial_expired');

        console.log(`Trial expired for user ${userId}`);
      }
    } catch (error) {
      console.error('Error handling trial expiration:', error);
    }
  }

  /**
   * Get upgrade prompts based on blocked feature
   */
  getUpgradePrompt(blockedFeature: string): {
    title: string;
    message: string;
    recommendedTier: string;
  } {
    const prompts = {
      smartJournaling: {
        title: 'Unlock Smart Journaling',
        message: 'Get AI-powered insights and personalized prompts to deepen your spiritual journey.',
        recommendedTier: 'starter',
      },
      journalTemplates: {
        title: 'Access All Journal Templates',
        message: 'Explore 20+ guided templates for prayer, gratitude, Bible study, and spiritual growth.',
        recommendedTier: 'starter',
      },
      playbooks: {
        title: 'Generate More Playbooks',
        message: 'Create unlimited personalized spiritual growth plans tailored to your journey.',
        recommendedTier: 'growth',
      },
      devotionals: {
        title: 'Unlimited Devotionals',
        message: 'Access daily AI-generated devotionals personalized to your spiritual needs.',
        recommendedTier: 'growth',
      },
      intelligence: {
        title: 'Advanced AI Guidance',
        message: 'Unlock enhanced personalization and deeper spiritual insights.',
        recommendedTier: 'transformation',
      },
    };

    return prompts[blockedFeature] || {
      title: 'Upgrade Your Plan',
      message: 'Unlock premium features to enhance your spiritual growth journey.',
      recommendedTier: 'starter',
    };
  }

  /**
   * Log trial events for analytics
   */
  private async logTrialEvent(userId: string, event: string): Promise<void> {
    try {
      await supabase
        .from('user_events')
        .insert({
          user_id: userId,
          event_type: 'trial',
          event_name: event,
          metadata: { timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error logging trial event:', error);
    }
  }

  /**
   * Default feature access for users without subscription
   */
  private getDefaultFeatureAccess(): FeatureAccess {
    return {
      smartJournalingEnabled: false,
      journalTemplatesAccess: 'basic',
      playbooksRemaining: 0,
      devotionalsRemaining: 0,
      intelligenceEnabled: false,
      advancedAnalytics: false,
      prioritySupport: false,
    };
  }
}

export const trialAccessService = new TrialAccessService();
