/**
 * Tier Restriction Service
 *
 * Handles feature access checking and restriction enforcement
 * across the application based on subscription tiers.
 */

import { SubscriptionTier, SubscriptionLimits } from '../interfaces/subscription';
import { Logger } from '../utils/ProductionLogger';
import { subscriptionService } from './subscriptionService';

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: 'tier_restriction' | 'usage_limit' | 'feature_disabled';
  currentUsage?: number;
  limit?: number;
  requiredTier?: SubscriptionTier;
  upgradePrompt?: {
    title: string;
    message: string;
    cta: string;
    recommendedTier: SubscriptionTier;
  };
}

export interface TierRestriction {
  feature: string;
  requiredTier: SubscriptionTier;
  usageType?: 'playbooks' | 'devotionals' | 'exports' | 'apiCalls' | 'familyMembers' | 'guidedPrompts';
  featureFlag?: keyof SubscriptionLimits;
}

class TierRestrictionService {
  private restrictions: TierRestriction[] = [
    // Export features - Growth tier and above only
    {
      feature: 'export_pdf',
      requiredTier: 'growth',
      usageType: 'exports',
      featureFlag: 'intelligenceEnabled',
    },
    {
      feature: 'export_docx',
      requiredTier: 'growth',
      usageType: 'exports',
      featureFlag: 'intelligenceEnabled',
    },

    // Smart journaling - Spark tier and above only (restrict Seeker and Free Trial)
    {
      feature: 'smart_journaling',
      requiredTier: 'spark',
      featureFlag: 'smartJournalingEnabled',
    },

    // Calendar sync
    {
      feature: 'calendar_sync',
      requiredTier: 'growth',
      featureFlag: 'calendarSyncEnabled',
    },

    // Advanced analytics
    {
      feature: 'advanced_analytics',
      requiredTier: 'growth',
      featureFlag: 'advancedAnalytics',
    },

    // Priority support
    {
      feature: 'priority_support',
      requiredTier: 'transformation',
      featureFlag: 'prioritySupport',
    },

    // POST-LAUNCH: Family features
    // {
    //   feature: 'family_sharing',
    //   requiredTier: 'family',
    //   usageType: 'familyMembers',
    // },

    // Basic content generation
    {
      feature: 'playbook_generation',
      requiredTier: 'free_trial',
      usageType: 'playbooks',
    },
    {
      feature: 'devotional_generation',
      requiredTier: 'free_trial',
      usageType: 'devotionals',
    },

    // Content creation limits
    {
      feature: 'unlimited_playbooks',
      requiredTier: 'growth',
      usageType: 'playbooks',
    },
    {
      feature: 'unlimited_devotionals',
      requiredTier: 'spark',
      usageType: 'devotionals',
    },

    // Copy incomplete todos
    {
      feature: 'copy_incomplete_todos',
      requiredTier: 'free_trial',
      featureFlag: 'copyIncompleteTodosEnabled',
    },

    // Answered prayer tracking
    {
      feature: 'answered_prayer_tracking',
      requiredTier: 'free_trial',
      featureFlag: 'answeredPrayerTrackingEnabled',
    },

    // Guided prompts
    {
      feature: 'guided_prompts',
      requiredTier: 'free_trial',
      usageType: 'guidedPrompts',
    },
    {
      feature: 'unlimited_guided_prompts',
      requiredTier: 'free_trial',
      usageType: 'guidedPrompts',
    },
  ];

  /**
   * Check if user has access to a specific feature
   */
  async checkFeatureAccess(
    userId: string,
    feature: string,
    options: { skipUsageCheck?: boolean } = {}
  ): Promise<FeatureAccessResult> {
    try {
      // Get user subscription and limits
      const subscription = await subscriptionService.getUserSubscription(userId);
      const currentTier = subscription?.tier || 'seeker';
      
      // For free_trial users, use their trial_chosen_tier for feature access checks
      const effectiveTier = currentTier === 'free_trial' && subscription?.trial_chosen_tier
        ? subscription.trial_chosen_tier
        : currentTier;
      
      // Debug logging for trial users
      if (currentTier === 'free_trial') {
        console.log('[TierRestriction] Trial User Debug:', {
          feature,
          currentTier,
          trial_chosen_tier: subscription?.trial_chosen_tier,
          effectiveTier,
          userId: userId.substring(0, 8) + '...',
        });
      }
      
      // CRITICAL FIX: Use effectiveTier for limits to get correct feature flags for trial users
      const limits = subscriptionService.getSubscriptionLimits(effectiveTier);

      // Find restriction for this feature
      const restriction = this.restrictions.find(r => r.feature === feature);
      if (!restriction) {
        // No restriction defined, allow access
        return { hasAccess: true };
      }

      // Check tier requirement using effective tier (trial_chosen_tier for trials)
      if (!this.hasTierAccess(effectiveTier, restriction.requiredTier)) {
        return {
          hasAccess: false,
          reason: 'tier_restriction',
          requiredTier: restriction.requiredTier,
          upgradePrompt: this.generateUpgradePrompt(feature, restriction.requiredTier),
        };
      }

      // Check feature flag if specified
      if (restriction.featureFlag && !(limits as any)[restriction.featureFlag]) {
        return {
          hasAccess: false,
          reason: 'feature_disabled',
          requiredTier: restriction.requiredTier,
          upgradePrompt: this.generateUpgradePrompt(feature, restriction.requiredTier),
        };
      }

      // Check usage limits if specified and not skipped
      if (restriction.usageType && !options.skipUsageCheck) {
        const usage = await subscriptionService.getCurrentUsage(userId);
        const currentUsage = this.getCurrentUsageForType(usage, restriction.usageType);
        const limit = this.getLimitForType(limits as any, restriction.usageType);

        if (limit > 0 && currentUsage >= limit) {
          return {
            hasAccess: false,
            reason: 'usage_limit',
            currentUsage,
            limit,
            requiredTier: this.getNextTierWithUnlimitedAccess(restriction.usageType),
            upgradePrompt: this.generateUpgradePrompt(feature, restriction.requiredTier),
          };
        }
      }

      return { hasAccess: true };
    } catch (error) {
      Logger.error('[TierRestrictionService] Error checking feature access', error as Error, { component: 'tierRestrictionService' });
      // Default to allowing access on error to avoid blocking users
      return { hasAccess: true };
    }
  }

  /**
   * Check multiple features at once
   */
  async checkMultipleFeatures(
    userId: string,
    features: string[]
  ): Promise<Record<string, FeatureAccessResult>> {
    const results: Record<string, FeatureAccessResult> = {};

    await Promise.all(
      features.map(async (feature) => {
        results[feature] = await this.checkFeatureAccess(userId, feature);
      })
    );

    return results;
  }

  /**
   * Get feature restrictions for a specific tier
   */
  getRestrictionsForTier(tier: SubscriptionTier): string[] {
    return this.restrictions
      .filter(restriction => !this.hasTierAccess(tier, restriction.requiredTier))
      .map(restriction => restriction.feature);
  }

  /**
   * Get all available features for a tier
   */
  getAvailableFeaturesForTier(tier: SubscriptionTier): string[] {
    return this.restrictions
      .filter(restriction => this.hasTierAccess(tier, restriction.requiredTier))
      .map(restriction => restriction.feature);
  }

  /**
   * Trigger retention flow when user hits restriction
   */
  async triggerRestrictionRetention(): Promise<void> {
    try {
      // Log feature restriction event for analytics

      // Note: retentionService.logRetentionEvent expects specific event types
      // We'll implement this when retention service is ready

    } catch (error) {
      Logger.error('[TierRestriction] Error triggering retention', error as Error, { component: 'tierRestrictionService' });
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Check if a tier has access to a required tier
   */
  private hasTierAccess(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
    const tierHierarchy: Record<SubscriptionTier, number> = {
      'seeker': 0,
      'free_trial': 1,
      'spark': 2,
      'spark_annual': 2,
      'growth': 3,
      'growth_annual': 3,
      'transformation': 4,
      'transformation_annual': 4,
      // POST-LAUNCH: 'family': 5,
      // POST-LAUNCH: 'family_annual': 5,
    } as Record<SubscriptionTier, number>;

    const currentLevel = tierHierarchy[currentTier] || 0;
    const requiredLevel = tierHierarchy[requiredTier] || 0;
    const hasAccess = currentLevel >= requiredLevel;
    
    console.log('[TierRestriction] hasTierAccess check:', {
      currentTier,
      requiredTier,
      currentLevel,
      requiredLevel,
      hasAccess,
    });

    return hasAccess;
  }

  /**
   * Get current usage for a specific type
   */
  private getCurrentUsageForType(usage: any, type: string): number {
    switch (type) {
      case 'playbooks':
        return usage?.playbooks_used || usage?.playbooks_generated || 0;
      case 'devotionals':
        return usage?.devotionals_used || usage?.devotionals_generated || 0;
      case 'exports':
        return usage?.export_count || 0;
      case 'apiCalls':
        return usage?.api_calls || 0;
      case 'familyMembers':
        return usage?.family_members || 0;
      case 'guidedPrompts':
        return usage?.guided_prompts_used || 0;
      default:
        return 0;
    }
  }

  /**
   * Get limit for a specific type
   */
  private getLimitForType(limits: SubscriptionLimits, type: string): number {
    switch (type) {
      case 'playbooks':
        return (limits as any).playbooks || 0;
      case 'devotionals':
        return (limits as any).devotionals || 0;
      case 'exports':
        return (limits as any).exports || 0;
      case 'apiCalls':
        return (limits as any).apiCalls || 0;
      case 'familyMembers':
        return (limits as any).familyMembers || 0;
      case 'guidedPrompts':
        return (limits as any).guidedPrompts || 2; // Default for seeker tier
      default:
        return 0;
    }
  }

  /**
   * Get the next tier that provides unlimited access for a usage type
   */
  private getNextTierWithUnlimitedAccess(usageType: string): SubscriptionTier {
    // Define which tiers provide unlimited access for each usage type
    const unlimitedTiers = {
      'playbooks': 'growth',
      'devotionals': 'growth',
      'exports': 'transformation',
      'apiCalls': 'transformation',
      // POST-LAUNCH: 'familyMembers': 'family',
      'guidedPrompts': 'free_trial', // Unlimited guided prompts start at free trial
    } as Record<string, SubscriptionTier>;

    return unlimitedTiers[usageType] || 'transformation';
  }

  /**
   * Generate upgrade prompt for a feature
   */
  private generateUpgradePrompt(feature: string, requiredTier: SubscriptionTier): {
    title: string;
    message: string;
    cta: string;
    recommendedTier: SubscriptionTier;
  } {
    const featureNames: Record<string, string> = {
      'playbook_generation': 'Playbook Generation',
      'devotional_generation': 'Devotional Generation',
      'export_pdf': 'PDF Export',
      'export_docx': 'Word Export',
      'smart_journaling': 'Smart Journaling',
      'calendar_sync': 'Calendar Sync',
      'advanced_analytics': 'Advanced Analytics',
      'priority_support': 'Priority Support',
      'family_sharing': 'Family Sharing',
      'unlimited_playbooks': 'Unlimited Playbooks',
      'unlimited_devotionals': 'Unlimited Devotionals',
      'copy_incomplete_todos': 'Copy Incomplete Todos',
      'answered_prayer_tracking': 'Prayer Tracking',
      'guided_prompts': 'Guided Prompts',
      'unlimited_guided_prompts': 'Unlimited Guided Prompts',
    };

    const tierNames = {
      'seeker': 'siFia Seeker',
      'free_trial': 'Free Trial',
      'spark': 'siFia Spark',
      'spark_annual': 'siFia Spark Annual',
      'growth': 'siFia Growth',
      'growth_annual': 'siFia Growth Annual',
      'transformation': 'siFia Transformation',
      'transformation_annual': 'siFia Transformation Annual',
      // POST-LAUNCH: 'family': 'siFia Family',
      // POST-LAUNCH: 'family_annual': 'siFia Family Annual',
    } as Record<SubscriptionTier, string>;

    const featureName = featureNames[feature] || feature;
    const tierName = tierNames[requiredTier] || requiredTier;

    // Special handling for export features - emphasize Growth/Transformation only
    const isExportFeature = feature === 'export_pdf' || feature === 'export_docx';
    
    if (isExportFeature) {
      return {
        title: `Unlock ${featureName}`,
        message: `Export your playbooks and devotionals as ${feature === 'export_pdf' ? 'PDF' : 'Word'} documents. Available exclusively with Growth or Transformation plans.`,
        cta: 'Upgrade to Growth',
        recommendedTier: requiredTier,
      };
    }

    // For Growth tier features, mention both Growth and Transformation since both have access
    const isGrowthTierFeature = requiredTier === 'growth' || requiredTier === 'growth_annual';
    const tierMessage = isGrowthTierFeature 
      ? 'Growth or Transformation plans'
      : `${tierName} and higher plans`;

    const ctaText = isGrowthTierFeature
      ? 'Upgrade to Growth'
      : `Upgrade to ${tierName}`;

    return {
      title: `Unlock ${featureName}`,
      message: `${featureName} is available with ${tierMessage}. Upgrade to continue your spiritual growth journey.`,
      cta: ctaText,
      recommendedTier: requiredTier,
    };
  }
}

// Export singleton instance
export const tierRestrictionService = new TierRestrictionService();
