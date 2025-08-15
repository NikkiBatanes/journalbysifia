/**
 * Tier Restriction Service
 *
 * Handles feature access checking and restriction enforcement
 * across the application based on subscription tiers.
 */

import { SubscriptionTier, SubscriptionLimits } from '../interfaces/subscription';
import { subscriptionService } from './subscriptionService';
import { retentionService } from './retentionService';

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
  usageType?: 'playbooks' | 'devotionals' | 'exports' | 'apiCalls' | 'familyMembers';
  featureFlag?: keyof SubscriptionLimits;
}

class TierRestrictionService {
  private restrictions: TierRestriction[] = [
    // Export features
    {
      feature: 'export_pdf',
      requiredTier: 'spark',
      usageType: 'exports',
      featureFlag: 'intelligenceEnabled',
    },
    {
      feature: 'export_docx',
      requiredTier: 'spark',
      usageType: 'exports',
      featureFlag: 'intelligenceEnabled',
    },

    // Expounding content
    {
      feature: 'expounding_content',
      requiredTier: 'transformation',
      featureFlag: 'expoundingEnabled',
    },

    // Smart journaling
    {
      feature: 'smart_journaling',
      requiredTier: 'free_trial',
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

    // Family features
    {
      feature: 'family_sharing',
      requiredTier: 'family',
      usageType: 'familyMembers',
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
      const limits = subscriptionService.getSubscriptionLimits(subscription?.tier || 'seeker');

      // Find restriction for this feature
      const restriction = this.restrictions.find(r => r.feature === feature);
      if (!restriction) {
        // No restriction defined, allow access
        return { hasAccess: true };
      }

      // Check tier requirement
      if (!this.hasTierAccess(subscription?.tier || 'seeker', restriction.requiredTier)) {
        return {
          hasAccess: false,
          reason: 'tier_restriction',
          requiredTier: restriction.requiredTier,
          upgradePrompt: this.generateUpgradePrompt(feature, restriction.requiredTier),
        };
      }

      // Check feature flag if specified
      if (restriction.featureFlag && !limits[restriction.featureFlag]) {
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
        const limit = this.getLimitForType(limits, restriction.usageType);

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
      console.error('[TierRestrictionService] Error checking feature access:', error);
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
  async triggerRestrictionRetention(
    userId: string,
    feature: string,
    currentTier: SubscriptionTier
  ): Promise<void> {
    try {
      await retentionService.logRetentionEvent(userId, 'feature_restriction', {
        feature,
        currentTier,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[TierRestrictionService] Error triggering retention:', error);
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
      'family': 5,
      'family_annual': 5,
    };

    return (tierHierarchy[currentTier] || 0) >= (tierHierarchy[requiredTier] || 0);
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
        return limits.playbooks;
      case 'devotionals':
        return limits.devotionals;
      case 'exports':
        return limits.exports;
      case 'apiCalls':
        return limits.apiCalls;
      case 'familyMembers':
        return limits.familyMembers;
      default:
        return 0;
    }
  }

  /**
   * Get the next tier that provides unlimited access for a usage type
   */
  private getNextTierWithUnlimitedAccess(usageType: string): SubscriptionTier {
    // Define which tiers provide unlimited access for each usage type
    const unlimitedTiers: Record<string, SubscriptionTier> = {
      'playbooks': 'growth',
      'devotionals': 'growth',
      'exports': 'transformation',
      'apiCalls': 'transformation',
      'familyMembers': 'family',
    };

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
      'export_pdf': 'PDF Export',
      'export_docx': 'Word Export',
      'expounding_content': 'Deeper Insights',
      'smart_journaling': 'Smart Journaling',
      'calendar_sync': 'Calendar Sync',
      'advanced_analytics': 'Advanced Analytics',
      'priority_support': 'Priority Support',
      'family_sharing': 'Family Sharing',
      'unlimited_playbooks': 'Unlimited Playbooks',
      'unlimited_devotionals': 'Unlimited Devotionals',
      'copy_incomplete_todos': 'Copy Incomplete Todos',
      'answered_prayer_tracking': 'Prayer Tracking',
    };

    const tierNames: Record<SubscriptionTier, string> = {
      'seeker': 'siFia SEEKER',
      'free_trial': 'Free Trial',
      'spark': 'siFia SPARK',
      'spark_annual': 'siFia SPARK Annual',
      'growth': 'siFia GROWTH',
      'growth_annual': 'siFia GROWTH Annual',
      'transformation': 'siFia TRANSFORMATION',
      'transformation_annual': 'siFia TRANSFORMATION Annual',
      'family': 'siFia FAMILY',
      'family_annual': 'siFia FAMILY Annual',
    };

    const featureName = featureNames[feature] || feature;
    const tierName = tierNames[requiredTier] || requiredTier;

    return {
      title: `Unlock ${featureName}`,
      message: `${featureName} is available with ${tierName} and higher plans. Upgrade to continue your spiritual growth journey.`,
      cta: `Upgrade to ${tierName}`,
      recommendedTier: requiredTier,
    };
  }
}

// Export singleton instance
export const tierRestrictionService = new TierRestrictionService();
