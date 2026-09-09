// Tier-based locking rules for future planning
// Created for enterprise-grade feature gating system

import type { SubscriptionTier } from '../types/subscription';

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
