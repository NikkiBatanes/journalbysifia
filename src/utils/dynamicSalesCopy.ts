/**
 * Dynamic Sales Copy Generator
 *
 * Generates contextual, tier-aware sales copy for feature gating
 * in playbooks and devotionals based on subscription status and usage.
 */

import { SubscriptionTier } from '../types/subscription';
import { Logger } from './ProductionLogger';

export interface SalesCopyParams {
  featureType: 'playbooks' | 'devotionals' | 'wisdom' | 'refinement';
  currentTier: SubscriptionTier;
  remaining: number;
  limit: number;
  isOnTrial?: boolean;
  trialChosenTier?: SubscriptionTier;
  trialEndDate?: string | null;
  subscriptionStartDate?: string | null;
  requestedDuration?: number; // For devotionals - which duration was requested
  hasEverStartedTrial?: boolean; // Whether user has ever started a 3-day trial
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
  isCurrentTier?: SubscriptionTier; // Show current tier label for paid users
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
function getTierLimits(tier: SubscriptionTier, featureType: 'playbooks' | 'devotionals' | 'wisdom' | 'refinement'): number {
  const limits = {
    'seeker': { playbooks: 2, devotionals: 1, wisdom: 2, refinement: 1 },
    'free_trial': { playbooks: 15, devotionals: 15, wisdom: 6, refinement: 4 }, // Default, actual limits depend on trial_chosen_tier
    'spark': { playbooks: 10, devotionals: 10, wisdom: 5, refinement: 3 },
    'spark_annual': { playbooks: 10, devotionals: 10, wisdom: 5, refinement: 3 },
    'growth': { playbooks: 25, devotionals: 25, wisdom: 12, refinement: 6 },
    'growth_annual': { playbooks: 25, devotionals: 25, wisdom: 12, refinement: 6 },
    'transformation': { playbooks: 60, devotionals: 60, wisdom: 25, refinement: 15 },
    'transformation_annual': { playbooks: 60, devotionals: 60, wisdom: 25, refinement: 15 },
    // POST-LAUNCH: 'family': { playbooks: -1, devotionals: -1, refinement: -1 },
  } as Record<SubscriptionTier, { playbooks: number; devotionals: number; wisdom: number; refinement: number }>;
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
    hasEverStartedTrial = false,
  } = params;

  const featureNamePlural = featureType === 'playbooks' ? 'Playbooks' : featureType === 'wisdom' ? 'Wisdom Requests' : featureType === 'refinement' ? 'Refinements' : 'Devotionals';
  const hasNoRemaining = remaining === 0;
  const effectiveTier = currentTier === 'free_trial' && trialChosenTier
    ? trialChosenTier
    : currentTier === 'transformation_annual'
      ? 'transformation'
      : currentTier === 'growth_annual'
        ? 'growth'
        : currentTier === 'spark_annual'
          ? 'spark'
      : currentTier;

  // CASE 1: Seeker tier - monthly free access used up (2 PB / 1 DEV per month)
  if (currentTier === 'seeker' && hasNoRemaining) {
    const title = hasEverStartedTrial ? 'Upgrade to Keep Going' : 'Start Your Free Trial';
    const message = featureType === 'playbooks'
      ? hasEverStartedTrial
        ? 'Your free playbooks for this month have been used. More will open again next month.\n\nUpgrade to Growth for more room to bring new moments before God, with up to 25 playbooks each month.'
        : 'Your free playbooks for this month have been used. More will open again next month.\n\nStart your 3-day free trial to keep bringing new moments before God with more room this month.'
      : featureType === 'wisdom'
        ? hasEverStartedTrial
          ? 'Your free wisdom requests for this month have been used. More will open again next month.\n\nUpgrade to Growth for more room to ask for guidance on your next faithful action, with up to 12 wisdom requests each month.'
          : 'Your free wisdom requests for this month have been used. More will open again next month.\n\nStart your 3-day free trial to keep asking for guidance on your next faithful action.'
        : featureType === 'refinement'
          ? hasEverStartedTrial
            ? 'Your free playbook refinement for this month has been used. More will open again next month.\n\nUpgrade to Growth for more room to refine your playbook, with up to 6 refinements each month.'
            : 'Your free playbook refinement for this month has been used. More will open again next month.\n\nStart your 3-day free trial to keep refining your playbook this month.'
          : hasEverStartedTrial
            ? 'Your free devotional for this month has been used. More will open again next month.\n\nUpgrade to Growth for more room to return to Scripture, reflection, and prayer, with up to 25 devotionals each month.'
            : 'Your free devotional for this month has been used. More will open again next month.\n\nStart your 3-day free trial to keep returning to Scripture, reflection, and prayer this month.';

    // Dynamic CTA based on trial usage
    const primaryCta = hasEverStartedTrial ? `Upgrade to ${getTierDisplayName('growth')}` : 'Start 3-Day Free Trial';

    return {
      title,
      message,
      primaryCta,
      recommendedTier: 'growth',
      showUpgradeOptions: true,
    };
  }

  // CASE 2: Trial user - no remaining
  if (isOnTrial && hasNoRemaining) {
    const trialTier = trialChosenTier || 'spark';
    const tierName = getTierDisplayName(trialTier);
    const fullLimit = getTierLimits(trialTier, featureType);
    const fullLimitText = fullLimit === 1
      ? `1 ${featureNamePlural.slice(0, -1)}`
      : `${fullLimit} ${featureNamePlural.toLowerCase()}`;

    // Trial limits based on chosen tier
    const trialLimits = {
      'spark': 5,
      'growth': 15,
      'transformation': 25,
    };
    const trialWisdomLimits = {
      'spark': 2,
      'growth': 6,
      'transformation': 10,
    };
    const trialRefinementLimits = {
      'spark': 2,
      'growth': 6,
      'transformation': 10,
    };
    const trialLimit = featureType === 'wisdom'
      ? trialWisdomLimits[trialTier as keyof typeof trialWisdomLimits] || 6
      : featureType === 'refinement'
        ? trialRefinementLimits[trialTier as keyof typeof trialRefinementLimits] || 4
        : trialLimits[trialTier as keyof typeof trialLimits] || 5;
    const trialLimitText = featureType === 'wisdom'
      ? trialLimit === 1 ? '1 wisdom request' : `${trialLimit} wisdom requests`
      : featureType === 'refinement'
        ? trialLimit === 1 ? '1 refinement' : `${trialLimit} refinements`
        : trialLimit === 1 ? `1 ${featureType.slice(0, -1)}` : `${trialLimit} ${featureType}`;

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
      title: `No ${featureNamePlural}\nRemaining`,
      message: `You've used all ${trialLimitText} included in your free trial. Your ${tierName} plan starts in ${daysUntilSubscriptionStarts} ${dayText}, on ${subscriptionStartDateStr}, with ${fullLimitText} each month.`,
      primaryCta: 'Got it',
      secondaryCta: 'Close',
      recommendedTier: trialTier,
      showUpgradeOptions: false,
      closeOnPrimaryCta: true,
      isCurrentTrial: true,
    };
  }

  // CASE 3: Paid user - no remaining (Spark, Growth, or Transformation)
  if (hasNoRemaining && (
    currentTier === 'spark' ||
    currentTier === 'spark_annual' ||
    currentTier === 'growth' ||
    currentTier === 'growth_annual' ||
    currentTier === 'transformation' ||
    currentTier === 'transformation_annual'
  )) {
    const resetDate = getNextMonthlyResetDate(subscriptionStartDate);
    const daysUntilReset = getDaysUntilReset(resetDate);
    const dayText = daysUntilReset === 1 ? 'day' : 'days';
    const resetDateStr = resetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const limitText = featureType === 'wisdom'
      ? limit === 1 ? '1 wisdom request' : `${limit} wisdom requests`
      : featureType === 'refinement'
        ? limit === 1 ? '1 refinement' : `${limit} refinements`
        : limit === 1 ? `1 ${featureType.slice(0, -1)}` : `${limit} ${featureType}`;
    const refreshName = featureType === 'wisdom' ? 'wisdom requests' : featureType === 'refinement' ? 'refinements' : featureNamePlural.toLowerCase();

    if (currentTier === 'spark' || currentTier === 'spark_annual') {
      return {
        title: `No ${featureNamePlural}\nRemaining`,
        message: `You've used all your ${limitText} for this month.\n\nYour ${refreshName} will refresh in ${daysUntilReset} ${dayText}, on ${resetDateStr}. Want more? Upgrade to a different plan.`,
        primaryCta: `Upgrade to ${getTierDisplayName('growth')}`,
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'growth',
        showUpgradeOptions: true,
        isCurrentTier: 'spark',
      };
    } else if (currentTier === 'transformation' || currentTier === 'transformation_annual') {
      return {
        title: `No ${featureNamePlural}\nRemaining`,
        message: `You've used all your ${limitText} for this month.\n\nYour ${refreshName} will refresh in ${daysUntilReset} ${dayText}, on ${resetDateStr}.`,
        primaryCta: 'Got it',
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'transformation',
        showUpgradeOptions: false,
        closeOnPrimaryCta: true,
        isCurrentTier: 'transformation',
      };
    } else {
      return {
        title: `No ${featureNamePlural}\nRemaining`,
        message: `You've used all your ${limitText} for this month.\n\nYour ${refreshName} will refresh in ${daysUntilReset} ${dayText}, on ${resetDateStr}. Want more? Upgrade to a different plan.`,
        primaryCta: `Upgrade to ${getTierDisplayName('transformation')}`,
        secondaryCta: 'Wait for Refresh',
        recommendedTier: 'transformation',
        showUpgradeOptions: true,
        isCurrentTier: 'growth',
      };
    }
  }

  // CASE 4: Devotional duration locked (user has remaining, but wants locked duration)
  if (featureType === 'devotionals' && requestedDuration && !hasNoRemaining) {
    if (effectiveTier === 'seeker' && (requestedDuration === 5 || requestedDuration === 7)) {
      if (requestedDuration === 5) {
        return {
          title: 'Unlock 5-Day\nDevotionals',
          message: '5-day devotionals are available with Growth or Transformation. Upgrade to unlock 5-day devotionals, or choose another duration.',
          primaryCta: hasEverStartedTrial ? `Upgrade to ${getTierDisplayName('growth')}` : 'Start 3-Day Free Trial',
          secondaryCta: 'Choose Another Duration',
          recommendedTier: 'growth',
          showUpgradeOptions: true,
        };
      }

      return {
        title: 'Unlock 7-Day\nDevotionals',
        message: '7-day devotionals are available with Transformation. Upgrade to unlock 7-day devotionals, or choose another duration.',
        primaryCta: hasEverStartedTrial ? `Upgrade to ${getTierDisplayName('transformation')}` : 'Start 3-Day Free Trial',
        secondaryCta: 'Choose Another Duration',
        recommendedTier: 'transformation',
        showUpgradeOptions: true,
      };
    }

    if (effectiveTier === 'spark' && (requestedDuration === 5 || requestedDuration === 7)) {
      if (requestedDuration === 5) {
        return {
          title: 'Unlock 5-Day\nDevotionals',
          message: `5-day devotionals are available with Growth or Transformation. Spark includes up to 10 devotionals each month. You still have ${remaining} of ${limit} devotionals left this month. Upgrade to unlock 5-day devotionals, or choose another duration.`,
          primaryCta: `Upgrade to ${getTierDisplayName('growth')}`,
          secondaryCta: 'Choose Another Duration',
          recommendedTier: 'growth',
          showUpgradeOptions: true,
          isCurrentTier: isOnTrial ? undefined : 'spark',
        };
      } else {
        // 7-day
        return {
          title: 'Unlock 7-Day\nDevotionals',
          message: `7-day devotionals are available with Transformation. Spark includes up to 10 devotionals each month. You still have ${remaining} of ${limit} devotionals left this month. Upgrade to unlock 7-day devotionals, or choose another duration.`,
          primaryCta: `Upgrade to ${getTierDisplayName('transformation')}`,
          secondaryCta: 'Choose Another Duration',
          recommendedTier: 'transformation',
          showUpgradeOptions: true,
          isCurrentTier: isOnTrial ? undefined : 'spark',
        };
      }
    } else if (effectiveTier === 'growth' && requestedDuration === 7) {
      return {
        title: 'Unlock 7-Day\nDevotionals',
        message: `7-day devotionals are available with Transformation. Growth includes up to 25 devotionals each month. You still have ${remaining} of ${limit} devotionals left this month. Upgrade to unlock 7-day devotionals, or choose another duration.`,
        primaryCta: `Upgrade to ${getTierDisplayName('transformation')}`,
        secondaryCta: 'Choose Another Duration',
        recommendedTier: 'transformation',
        showUpgradeOptions: true,
        isCurrentTier: isOnTrial ? undefined : 'growth',
      };
    }
  }

  // CASE 5: Default fallback
  const recommendedTier = 'growth';
  return {
    title: 'Upgrade Your Plan',
    message: 'Get more room for playbooks and devotionals with a higher plan.',
    primaryCta: `Upgrade to ${getTierDisplayName(recommendedTier)}`,
    recommendedTier,
    showUpgradeOptions: true,
  };
}
