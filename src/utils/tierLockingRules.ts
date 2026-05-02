// Tier-based locking rules for devotional durations and future planning
// Created for enterprise-grade feature gating system

import type { SubscriptionTier } from '../types/subscription';

export interface DevotionalAccessRules {
  lockedDurations: number[];
  allowedDurations: number[];
  usageMessage: string;
  upgradeMessage: string;
}

export interface DevotionalAccessCheck {
  isLocked: boolean;
  canGenerate: boolean;
  upgradeRequired: boolean;
  lockIconVisible: boolean;
  usageMessage: string;
  upgradeMessage: string;
}

export interface PlanningAccessRules {
  futurePlanningLocked: boolean;
  allowedFeatures: string[];
  usageMessage: string;
  upgradeMessage: string;
}

export interface PlanningAccessCheck {
  isLocked: boolean;
  canAccess: boolean;
  upgradeRequired: boolean;
  lockIconVisible: boolean;
  usageMessage: string;
  upgradeMessage: string;
}

// Lock visibility rules per tier
export const LOCK_VISIBILITY_RULES = {
  seeker: [5, 7],              // Up to 3-day (1-day and 3-day allowed)
  free_trial: [5, 7],          // Follows chosen tier; Spark/Growth trials cap at 3/5-day
  spark: [5, 7],               // Up to 3-day
  spark_annual: [5, 7],
  growth: [7],                 // Up to 5-day
  growth_annual: [7],
  transformation: [],          // Up to 7-day (all durations)
  transformation_annual: [],
} as Record<SubscriptionTier, number[]>;

// Usage counter messages per tier
export const USAGE_DISPLAY_RULES = {
  seeker: '1 Devotional per month',
  free_trial: 'Devotionals Remaining', // Limits depend on trial_chosen_tier
  spark: '10 Devotionals Remaining',
  spark_annual: '10 Devotionals Remaining',
  growth: '25 Devotionals Remaining',
  growth_annual: '25 Devotionals Remaining',
  transformation: '60 Devotionals Remaining',
  transformation_annual: '60 Devotionals Remaining',
} as Record<SubscriptionTier, string>;

// Dynamic upgrade messages by context
export const UPGRADE_MESSAGES = {
  onboarding: {
    seeker: 'Start your spiritual journey with Spark',
    free_trial: "You've reached your trial limit",
    spark: "You've reached your Spark limit",
    spark_annual: "You've reached your Spark limit",
    growth: "You've reached your Growth limit",
    growth_annual: "You've reached your Growth limit",
    transformation: '',
    transformation_annual: '',
  },
  inApp: {
    seeker: 'Unlock devotionals to deepen your faith',
    free_trial: 'Upgrade to continue your journey',
    spark: 'Upgrade to Growth for more devotionals',
    spark_annual: 'Upgrade to Growth for more devotionals',
    growth: 'Upgrade to Transformation for 60 devotionals',
    growth_annual: 'Upgrade to Transformation for 60 devotionals',
    transformation: '',
    transformation_annual: '',
  },
} as const;

/**
 * Check if a devotional duration is locked for a given tier
 */
export function isDevotionalDurationLocked(tier: SubscriptionTier, duration: number): boolean {
  const lockedDurations = LOCK_VISIBILITY_RULES[tier] || [];
  return lockedDurations.includes(duration);
}

/**
 * Get all locked durations for a tier
 */
export function getLockedDurations(tier: SubscriptionTier): number[] {
  return LOCK_VISIBILITY_RULES[tier] || [];
}

/**
 * Get all allowed durations for a tier
 */
export function getAllowedDurations(tier: SubscriptionTier): number[] {
  const allDurations = [1, 3, 5, 7];
  const lockedDurations = LOCK_VISIBILITY_RULES[tier] || [];
  return allDurations.filter(duration => !lockedDurations.includes(duration));
}

/**
 * Get usage display message for a tier
 */
export function getUsageDisplayMessage(tier: SubscriptionTier, remaining?: number): string {
  if (typeof remaining === 'number') {
    if (remaining === 0) {
      return 'No Devotionals Remaining';
    }
    const devotionalText = remaining === 1 ? 'Devotional' : 'Devotionals';
    if (['free_trial', 'spark', 'spark_annual', 'growth', 'growth_annual', 'transformation', 'transformation_annual'].includes(tier)) {
      return `${remaining} ${devotionalText} Remaining`;
    }
  }
  return USAGE_DISPLAY_RULES[tier];
}

/**
 * Get upgrade message based on context
 */
export function getUpgradeMessage(
  tier: SubscriptionTier,
  context: 'onboarding' | 'inApp' = 'inApp'
): string {
  return UPGRADE_MESSAGES[context][tier] || '';
}

/**
 * Comprehensive access check for devotional duration
 */
export function checkDevotionalAccess(
  tier: SubscriptionTier,
  duration: number,
  context: 'onboarding' | 'inApp' = 'inApp',
  _isOnboarding = false
): DevotionalAccessCheck {
  const isLocked = isDevotionalDurationLocked(tier, duration);
  const canGenerate = !isLocked;
  const upgradeRequired = isLocked;
  const lockIconVisible = isLocked;

  return {
    isLocked,
    canGenerate,
    upgradeRequired,
    lockIconVisible,
    usageMessage: getUsageDisplayMessage(tier),
    upgradeMessage: getUpgradeMessage(tier, context),
  };
}

/**
 * Get tier access rules summary
 */
export function getTierAccessRules(tier: SubscriptionTier): DevotionalAccessRules {
  const lockedDurations = getLockedDurations(tier);
  const allowedDurations = getAllowedDurations(tier);

  return {
    lockedDurations,
    allowedDurations,
    usageMessage: getUsageDisplayMessage(tier),
    upgradeMessage: getUpgradeMessage(tier, 'inApp'),
  };
}

/**
 * Check if tier has any locked durations
 */
export function tierHasLocks(tier: SubscriptionTier): boolean {
  return getLockedDurations(tier).length > 0;
}

/**
 * Get next upgrade tier that unlocks a duration
 */
export function getUnlockTier(duration: number): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['seeker', 'free_trial', 'spark', 'growth', 'transformation'];

  for (const tier of tiers) {
    if (!isDevotionalDurationLocked(tier, duration)) {
      return tier;
    }
  }

  return null;
}

/**
 * Get tier hierarchy for upgrade suggestions
 */
export function getTierHierarchy(): SubscriptionTier[] {
  return ['seeker', 'free_trial', 'spark', 'growth', 'transformation'];
}

/**
 * Get next tier in hierarchy
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const hierarchy = getTierHierarchy();
  const currentIndex = hierarchy.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex === hierarchy.length - 1) {
    return null;
  }

  return hierarchy[currentIndex + 1];
}

// ==========================================
// FUTURE PLANNING FEATURE GATING SYSTEM
// ==========================================

// Planning lock rules per tier
export const PLANNING_LOCK_RULES = {
  seeker: true,           // Future planning locked
  free_trial: false,      // Future planning allowed
  spark: false,           // Future planning allowed
  spark_annual: false,    // Future planning allowed
  growth: false,          // Future planning allowed
  growth_annual: false,   // Future planning allowed
  transformation: false,  // Future planning allowed
  transformation_annual: false, // Future planning allowed
} as Record<SubscriptionTier, boolean>;

// Planning usage messages per tier
export const PLANNING_USAGE_MESSAGES = {
  seeker: 'Future Planning Locked',
  free_trial: 'Future Planning Available',
  spark: 'Future Planning Available',
  spark_annual: 'Future Planning Available',
  growth: 'Future Planning Available',
  growth_annual: 'Future Planning Available',
  transformation: 'Future Planning Available',
  transformation_annual: 'Future Planning Available',
} as Record<SubscriptionTier, string>;

// Planning upgrade messages by context
export const PLANNING_UPGRADE_MESSAGES = {
  onboarding: {
    seeker: 'Start planning ahead with Spark',
    free_trial: '',
    spark: '',
    spark_annual: '',
    growth: '',
    growth_annual: '',
    transformation: '',
    transformation_annual: '',
    family: '',
  },
  inApp: {
    seeker: 'Unlock future planning to organize your spiritual journey',
    free_trial: '',
    spark: '',
    spark_annual: '',
    growth: '',
    growth_annual: '',
    transformation: '',
    transformation_annual: '',
    family: '',
  },
} as Record<'onboarding' | 'inApp', Record<SubscriptionTier, string>>;

const SUBSCRIPTION_TIER_ALIASES: Record<string, SubscriptionTier> = {
  seeker: 'seeker',
  free: 'seeker',
  basic: 'seeker',
  free_trial: 'free_trial',
  trial: 'free_trial',
  spark: 'spark',
  spark_annual: 'spark_annual',
  growth: 'growth',
  growth_annual: 'growth_annual',
  transformation: 'transformation',
  transformation_annual: 'transformation_annual',
  premium: 'transformation',
  premium_annual: 'transformation_annual',
};

function normalizePlanningTierInput(tier: unknown): SubscriptionTier | null {
  if (typeof tier !== 'string' || !tier.trim()) {
    return null;
  }

  const normalized = tier
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_month(ly)?$/, '');

  return SUBSCRIPTION_TIER_ALIASES[normalized] || null;
}

/**
 * Resolve the tier used for planning gates. Trial users inherit their chosen
 * plan's unlocks; if the chosen plan is missing, the trial itself is unlocked.
 */
export function getEffectivePlanningTier(
  subscription?: {
    tier?: unknown;
    subscription_tier?: unknown;
    trial_chosen_tier?: unknown;
  } | null
): SubscriptionTier {
  const tier = normalizePlanningTierInput(subscription?.tier ?? subscription?.subscription_tier) || 'seeker';

  if (tier !== 'free_trial') {
    return tier;
  }

  return normalizePlanningTierInput(subscription?.trial_chosen_tier) || 'free_trial';
}

function toLocalDateKey(date: Date | string): string | null {
  if (typeof date === 'string') {
    const dateKey = date.includes('T') ? date.split('T')[0] : date;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compares only local calendar days, so a future evening UTC offset cannot
 * accidentally gate today's local journal entry.
 */
export function isFuturePlanningDate(date: Date | string): boolean {
  const targetDate = toLocalDateKey(date);
  const today = toLocalDateKey(new Date());

  if (!targetDate || !today) {
    return false;
  }

  return targetDate > today;
}

export function isRecurringPlanningFrequency(frequency?: unknown): boolean {
  if (typeof frequency !== 'string') {
    return false;
  }

  const normalized = frequency.toLowerCase().trim().replace(/-/g, '');
  return normalized !== '' && normalized !== 'never' && normalized !== 'none';
}

/**
 * Check if future planning is locked for a tier
 */
export function isFuturePlanningLocked(tier: SubscriptionTier): boolean {
  return PLANNING_LOCK_RULES[tier] || false;
}

/**
 * Get planning usage display message
 */
export function getPlanningUsageMessage(tier: SubscriptionTier): string {
  return PLANNING_USAGE_MESSAGES[tier] || 'Future Planning Available';
}

/**
 * Get planning upgrade message by context
 */
export function getPlanningUpgradeMessage(
  tier: SubscriptionTier,
  context: 'onboarding' | 'inApp' = 'inApp'
): string {
  return PLANNING_UPGRADE_MESSAGES[context][tier] || '';
}

/**
 * Check planning access for a tier with comprehensive details
 */
export function checkPlanningAccess(
  tier: SubscriptionTier,
  context: 'onboarding' | 'inApp' = 'inApp'
): PlanningAccessCheck {
  const isLocked = isFuturePlanningLocked(tier);
  const canAccess = !isLocked;
  const upgradeRequired = isLocked;
  const lockIconVisible = isLocked;

  return {
    isLocked,
    canAccess,
    upgradeRequired,
    lockIconVisible,
    usageMessage: getPlanningUsageMessage(tier),
    upgradeMessage: getPlanningUpgradeMessage(tier, context),
  };
}

/**
 * Get planning access rules summary
 */
export function getPlanningAccessRules(tier: SubscriptionTier): PlanningAccessRules {
  const isLocked = isFuturePlanningLocked(tier);

  return {
    futurePlanningLocked: isLocked,
    allowedFeatures: isLocked ? [] : ['focus', 'todos', 'timeblocks'],
    usageMessage: getPlanningUsageMessage(tier),
    upgradeMessage: getPlanningUpgradeMessage(tier, 'inApp'),
  };
}
