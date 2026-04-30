/**
 * Dynamic Sales Copy Generator
 *
 * Generates contextual, tier-aware sales copy for feature gating
 * in playbooks and devotionals based on subscription status and usage.
 */

import { SubscriptionTier } from '../types/subscription';
import { Logger } from './ProductionLogger';

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
  closeOnPrimaryCta?: boolean; // Close modal when primary CTA is tapped (for "Got it" scenarios)
  isCurrentTrial?: boolean; // Show "Current Trial" label instead of "Recommended"
}

/**
 * Get tier display name
 */
function getTierDisplayName(tier: SubscriptionTier): string {
  const tierNames = {
    'seeker': 'Seeker',
    'free_trial': 'Trial',
    'spark': 'Spark',
    'growth': 'Growth',
    'transformation': 'Transformation',
    // POST-LAUNCH: 'family': 'Family',
  } as Record<SubscriptionTier, string>;
  return tierNames[tier] || tier;
}

/**
 * Get tier limits
 */
function getTierLimits(tier: SubscriptionTier, featureType: 'playbooks' | 'devotionals'): number {
  const limits = {
    'seeker': { playbooks: 2, devotionals: 1 },
    'free_trial': { playbooks: 15, devotionals: 15 }, // Default, actual limits depend on trial_chosen_tier
    'spark': { playbooks: 10, devotionals: 10 },
    'growth': { playbooks: 25, devotionals: 25 },
    'transformation': { playbooks: 60, devotionals: 60 },
    // POST-LAUNCH: 'family': { playbooks: -1, devotionals: -1 },
  } as Record<SubscriptionTier, { playbooks: number; devotionals: number }>;
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
 * IMPORTANT: Always returns NEXT billing cycle date, never today
 */
function getNextMonthlyResetDate(subscriptionStartISO?: string | null): Date {
  const now = new Date();
  // Set to start of today for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  Logger.info('Reset Calculation: subscriptionStartISO', { subscriptionStartISO });
  Logger.info('Reset Calculation: Today', { today: today.toISOString() });

  if (!subscriptionStartISO) {
    // Fallback: first day of next month
    Logger.warn('Reset Calculation: No subscription start date, using fallback');
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const start = new Date(subscriptionStartISO);
  const targetDay = start.getDate();
  Logger.info('Reset Calculation: Subscription start date', { start: start.toISOString() });
  Logger.info('Reset Calculation: Target billing day', { targetDay });

  // Calculate the reset date for this month (at midnight)
  const lastDayOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const resetDayThisMonth = Math.min(targetDay, lastDayOfThisMonth);
  const resetDateThisMonth = new Date(now.getFullYear(), now.getMonth(), resetDayThisMonth);
  Logger.info('Reset Calculation: This month reset would be', { resetDate: resetDateThisMonth.toISOString() });

  // If the reset date for this month is in the FUTURE (not today), use it
  // Changed from >= to > so today's date triggers next month calculation
  if (resetDateThisMonth > today) {
    Logger.info('Reset Calculation: Using this month\'s reset date', { resetDate: resetDateThisMonth.toISOString() });
    return resetDateThisMonth;
  }

  // Calculate next month's reset date (either because today is past this month's date, or today IS the reset date)
  const nextMonth = now.getMonth() + 1;
  const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
  const normalizedMonth = (nextMonth + 12) % 12;
  const lastDayOfNextMonth = new Date(nextYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(targetDay, lastDayOfNextMonth);
  const nextResetDate = new Date(nextYear, normalizedMonth, day);
  Logger.info('Reset Calculation: Using next month\'s reset date', { resetDate: nextResetDate.toISOString() });

  return nextResetDate;
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

  // CASE 1: Seeker tier - monthly free access used up (2 PB / 1 DEV per month)
  if (currentTier === 'seeker' && hasNoRemaining) {
    const title = featureType === 'playbooks' ? 'Upgrade to Keep Going' : 'Upgrade to Keep Going';
    const message = featureType === 'playbooks'
      ? 'Your free playbooks for this month have been used. More will open again next month.\n\nUpgrade to Growth for more room to bring new moments before God, with up to 25 playbooks each month.'
      : 'Your free devotional for this month has been used. More will open again next month.\n\nUpgrade to Growth for more room to return to Scripture, reflection, and prayer, with up to 25 devotionals each month.';

    return {
      title,
      message,
      primaryCta: 'View Plans',
      recommendedTier: 'spark',
      showUpgradeOptions: true,
    };
  }

  // CASE 2: Trial user - no remaining
  if (isOnTrial && hasNoRemaining) {
    const effectiveTier = trialChosenTier || 'spark';
    const tierName = getTierDisplayName(effectiveTier);
    const fullLimit = getTierLimits(effectiveTier, featureType);
    const fullLimitText = fullLimit === 1
      ? `1 ${featureType.slice(0, -1)}`
      : `${fullLimit} ${featureType}`;

    // Trial limits based on chosen tier
    const trialLimits = {
      'spark': 5,
      'growth': 10,
      'transformation': 25,
    };
    const trialLimit = trialLimits[effectiveTier as keyof typeof trialLimits] || 5;
    const trialLimitText = trialLimit === 1 ? `1 ${featureType.slice(0, -1)}` : `${trialLimit} ${featureType}`;

    // Calculate when subscription starts
    const trialEnd = trialEndDate ? new Date(trialEndDate) : new Date();
    const daysUntilSubscriptionStarts = getDaysUntilReset(trialEnd);
    const dayText = daysUntilSubscriptionStarts === 1 ? 'day' : 'days';
    const subscriptionStartDateStr = trialEnd.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      title: `No ${featureNamePlural} Remaining`,
      message: `You've used all ${trialLimitText} included in your free trial. Your ${tierName} plan starts in ${daysUntilSubscriptionStarts} ${dayText}, on ${subscriptionStartDateStr}, with ${fullLimitText} each month.`,
      primaryCta: 'Got it',
      recommendedTier: effectiveTier,
      showUpgradeOptions: false,
      closeOnPrimaryCta: true,
      isCurrentTrial: true,
    };
  }

  // CASE 3: Paid user - no remaining (Spark, Growth, or Transformation)
  if (hasNoRemaining && (currentTier === 'spark' || currentTier === 'growth' || currentTier === 'transformation' || currentTier === 'transformation_annual')) {
    const resetDate = getNextMonthlyResetDate(subscriptionStartDate);
    const daysUntilReset = getDaysUntilReset(resetDate);
    const dayText = daysUntilReset === 1 ? 'day' : 'days';
    const resetDateStr = resetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const limitText = limit === 1 ? `1 ${featureType.slice(0, -1)}` : `${limit} ${featureType}`;

    if (currentTier === 'spark') {
      return {
        title: `No ${featureNamePlural} Remaining`,
        message: `You have used all ${limitText} for this month.\n\nYour ${featureNamePlural.toLowerCase()} will refresh in ${daysUntilReset} ${dayText} on ${resetDateStr}.\n\nWant more? Upgrade to a different plan.`,
        primaryCta: 'View Upgrade Options',
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'growth',
        showUpgradeOptions: true,
      };
    } else if (currentTier === 'transformation' || currentTier === 'transformation_annual') {
      return {
        title: `No ${featureNamePlural} Remaining`,
        message: `You have used all ${limitText} for this month.\n\nYour ${featureNamePlural.toLowerCase()} will refresh in ${daysUntilReset} ${dayText} on ${resetDateStr}.`,
        primaryCta: 'Got it',
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'transformation',
        showUpgradeOptions: false,
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
