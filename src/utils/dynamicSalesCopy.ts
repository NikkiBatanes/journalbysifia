/**
 * Dynamic Sales Copy Generator
 *
 * Generates contextual, tier-aware sales copy for feature gating
 * in playbooks and devotionals based on subscription status and usage.
 */

import { SubscriptionTier } from '../types/subscription';

export interface SalesCopyParams {
  featureType: 'playbooks' | 'devotionals';
  currentTier: SubscriptionTier;
  remaining: number;
  limit: number;
  isOnTrial?: boolean;
  trialChosenTier?: SubscriptionTier;
  trialEndDate?: string | null;
  subscriptionStartDate?: string | null;
  requestedDuration?: number; // For devotionals - which duration was requested
}

export interface SalesCopyResult {
  title: string;
  message: string;
  primaryCta: string;
  secondaryCta?: string;
  recommendedTier: SubscriptionTier;
  showUpgradeOptions: boolean; // Show multiple tier options vs single upgrade
}

/**
 * Get tier display name
 */
function getTierDisplayName(tier: SubscriptionTier): string {
  const tierNames: Record<SubscriptionTier, string> = {
    'seeker': 'Seeker',
    'free_trial': 'Trial',
    'spark': 'Spark',
    'growth': 'Growth',
    'transformation': 'Transformation',
    'family': 'Family',
  };
  return tierNames[tier] || tier;
}

/**
 * Get tier limits
 */
function getTierLimits(tier: SubscriptionTier, featureType: 'playbooks' | 'devotionals'): number {
  const limits: Record<SubscriptionTier, { playbooks: number; devotionals: number }> = {
    'seeker': { playbooks: 0, devotionals: 0 },
    'free_trial': { playbooks: 2, devotionals: 2 },
    'spark': { playbooks: 8, devotionals: 8 },
    'growth': { playbooks: 20, devotionals: 20 },
    'transformation': { playbooks: -1, devotionals: -1 }, // unlimited
    'family': { playbooks: -1, devotionals: -1 }, // unlimited
  };
  return limits[tier][featureType];
}

/**
 * Calculate days until reset
 */
function getDaysUntilReset(resetDate: Date): number {
  const now = new Date();
  return Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Get next monthly reset date (Apple-style: same calendar day each month)
 */
function getNextMonthlyResetDate(subscriptionStartISO?: string | null): Date {
  const now = new Date();
  if (!subscriptionStartISO) {
    // Fallback: first day of next month
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const start = new Date(subscriptionStartISO);
  const targetDay = start.getDate();

  // If today's date is before the billing day, next reset is this month
  // Otherwise, it's next month
  const candidateMonth = now.getDate() < targetDay ? now.getMonth() : now.getMonth() + 1;
  const candidateYear = candidateMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
  const normalizedMonth = (candidateMonth + 12) % 12;

  // Find last day of candidate month
  const lastDayOfMonth = new Date(candidateYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(targetDay, lastDayOfMonth);

  return new Date(candidateYear, normalizedMonth, day);
}

/**
 * Generate dynamic sales copy for feature gating
 */
export function generateSalesCopy(params: SalesCopyParams): SalesCopyResult {
  const {
    featureType,
    currentTier,
    remaining,
    limit,
    isOnTrial = false,
    trialChosenTier,
    trialEndDate,
    subscriptionStartDate,
    requestedDuration,
  } = params;

  const featureNamePlural = featureType === 'playbooks' ? 'Playbooks' : 'Devotionals';
  const hasNoRemaining = remaining === 0;

  // CASE 1: Seeker tier (no access at all)
  if (currentTier === 'seeker') {
    return {
      title: `Unlock ${featureNamePlural}`,
      message: `${featureNamePlural} are available with a siFia subscription.\n\nChoose the plan that fits your spiritual journey:`,
      primaryCta: 'View Plans',
      recommendedTier: 'growth',
      showUpgradeOptions: true,
    };
  }

  // CASE 2: Trial user - no remaining
  if (isOnTrial && hasNoRemaining) {
    const effectiveTier = trialChosenTier || 'spark';
    const tierName = getTierDisplayName(effectiveTier);
    const fullLimit = getTierLimits(effectiveTier, featureType);
    const fullLimitText = fullLimit === -1
      ? `unlimited ${featureType}`
      : fullLimit === 1
        ? `1 ${featureType.slice(0, -1)}`
        : `${fullLimit} ${featureType}`;

    // Calculate when subscription starts
    const trialEnd = trialEndDate ? new Date(trialEndDate) : new Date();
    const daysUntilSubscriptionStarts = getDaysUntilReset(trialEnd);
    const dayText = daysUntilSubscriptionStarts === 1 ? 'day' : 'days';
    const subscriptionStartDateStr = trialEnd.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const limitText = limit === 1 ? `1 ${featureType.slice(0, -1)}` : `${limit} ${featureType}`;

    // Check if unlimited trial
    const isUnlimitedTrial = effectiveTier === 'transformation' || effectiveTier === 'family';

    if (isUnlimitedTrial) {
      return {
        title: `No ${featureNamePlural} Remaining`,
        message: `You have used all ${limitText} available during your free trial.\n\nYour siFia ${tierName} Plan subscription will start in ${daysUntilSubscriptionStarts} ${dayText} on ${subscriptionStartDateStr}, and you'll be able to generate ${fullLimitText}.`,
        primaryCta: 'Got it',
        recommendedTier: effectiveTier,
        showUpgradeOptions: false,
      };
    }

    return {
      title: `No ${featureNamePlural} Remaining`,
      message: `You have used all ${limitText} available during your free trial.\n\nYour siFia ${tierName} Plan subscription will start in ${daysUntilSubscriptionStarts} ${dayText} on ${subscriptionStartDateStr}, and you'll be able to generate ${fullLimitText}.\n\nWant more now? Upgrade to a different plan.`,
      primaryCta: 'View Upgrade Options',
      secondaryCta: 'Wait for Subscription',
      recommendedTier: 'transformation',
      showUpgradeOptions: true,
    };
  }

  // CASE 3: Paid user - no remaining (Spark or Growth)
  if (hasNoRemaining && (currentTier === 'spark' || currentTier === 'growth')) {
    const resetDate = getNextMonthlyResetDate(subscriptionStartDate);
    const daysUntilReset = getDaysUntilReset(resetDate);
    const dayText = daysUntilReset === 1 ? 'day' : 'days';
    const resetDateStr = resetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const limitText = limit === 1 ? `1 ${featureType.slice(0, -1)}` : `${limit} ${featureType}`;

    // Different messaging based on current tier
    if (currentTier === 'spark') {
      return {
        title: `No ${featureNamePlural} Remaining`,
        message: `You have used all ${limitText} for this month.\n\nYour ${featureNamePlural.toLowerCase()} will refresh in ${daysUntilReset} ${dayText} on ${resetDateStr}.\n\nWant more? Upgrade to a different plan.`,
        primaryCta: 'View Upgrade Options',
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'growth',
        showUpgradeOptions: true,
      };
    } else {
      // Growth tier
      return {
        title: `No ${featureNamePlural} Remaining`,
        message: `You have used all ${limitText} for this month.\n\nYour ${featureNamePlural.toLowerCase()} will refresh in ${daysUntilReset} ${dayText} on ${resetDateStr}.\n\nWant more? Upgrade to a different plan.`,
        primaryCta: 'View Upgrade Options',
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'transformation',
        showUpgradeOptions: true,
      };
    }
  }

  // CASE 4: Devotional duration locked (user has remaining, but wants locked duration)
  if (featureType === 'devotionals' && requestedDuration && !hasNoRemaining) {
    if (currentTier === 'spark' && (requestedDuration === 5 || requestedDuration === 7)) {
      if (requestedDuration === 5) {
        return {
          title: 'Unlock 5-Day Devotionals',
          message: `5-day devotionals are available with Growth Plan or higher.\n\nYou currently have ${remaining} of ${limit} devotionals remaining this month.\n\nWant to unlock 5-day devotionals? Upgrade to a different plan.`,
          primaryCta: 'View Upgrade Options',
          secondaryCta: 'Choose Another Duration',
          recommendedTier: 'growth',
          showUpgradeOptions: true,
        };
      } else {
        // 7-day
        return {
          title: 'Unlock 7-Day Devotionals',
          message: `7-day devotionals are available with Transformation Plan.\n\nYou currently have ${remaining} of ${limit} devotionals remaining this month.\n\nWant to unlock 7-day devotionals? Upgrade to a different plan.`,
          primaryCta: 'View Upgrade Options',
          secondaryCta: 'Choose Another Duration',
          recommendedTier: 'transformation',
          showUpgradeOptions: true,
        };
      }
    } else if (currentTier === 'growth' && requestedDuration === 7) {
      return {
        title: 'Unlock 7-Day Devotionals',
        message: `7-day devotionals are available with Transformation Plan.\n\nYou currently have ${remaining} of ${limit} devotionals remaining this month.\n\nWant to unlock 7-day devotionals? Upgrade to a different plan.`,
        primaryCta: 'View Upgrade Options',
        secondaryCta: 'Choose Another Duration',
        recommendedTier: 'transformation',
        showUpgradeOptions: true,
      };
    }
  }

  // CASE 5: Default fallback
  return {
    title: 'Upgrade Your Plan',
    message: `Unlock more ${featureType} with a higher tier plan.`,
    primaryCta: 'View Plans',
    recommendedTier: 'growth',
    showUpgradeOptions: true,
  };
}
