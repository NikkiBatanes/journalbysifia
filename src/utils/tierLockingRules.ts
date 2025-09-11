// Tier-based locking rules for devotional durations
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

// Lock visibility rules per tier
export const LOCK_VISIBILITY_RULES: Record<SubscriptionTier, number[]> = {
  seeker: [1, 3, 5, 7],        // All durations locked
  free_trial: [5, 7],          // 5-day and 7-day locked  
  spark: [5, 7],               // 5-day and 7-day locked
  growth: [7],                 // Only 7-day locked
  transformation: [],          // No locks
  family: []                   // No locks
};

// Usage counter messages per tier
export const USAGE_DISPLAY_RULES: Record<SubscriptionTier, string> = {
  seeker: "Unlock devotionals with Spark",
  free_trial: "2 devotionals remaining",
  spark: "8 devotionals remaining", 
  growth: "20 devotionals remaining",
  transformation: "Unlimited devotionals",
  family: "Unlimited devotionals"
};

// Dynamic upgrade messages by context
export const UPGRADE_MESSAGES = {
  onboarding: {
    seeker: "Start your spiritual journey with Spark",
    free_trial: "You've reached your trial limit",
    spark: "You've reached your Spark limit", 
    growth: "You've reached your Growth limit",
    transformation: "",
    family: ""
  },
  inApp: {
    seeker: "Unlock devotionals to deepen your faith",
    free_trial: "Upgrade to continue your journey",
    spark: "Upgrade to Growth for more devotionals",
    growth: "Upgrade to Transformation for unlimited access",
    transformation: "",
    family: ""
  }
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
  if (tier === 'transformation' || tier === 'family') {
    return USAGE_DISPLAY_RULES[tier];
  }
  
  if (typeof remaining === 'number') {
    if (tier === 'free_trial') {
      return `${remaining} devotionals remaining`;
    }
    if (tier === 'spark') {
      return `${remaining} devotionals remaining`;
    }
    if (tier === 'growth') {
      return `${remaining} devotionals remaining`;
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
  context: 'onboarding' | 'inApp' = 'inApp'
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
    upgradeMessage: getUpgradeMessage(tier, context)
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
    upgradeMessage: getUpgradeMessage(tier, 'inApp')
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
  const tiers: SubscriptionTier[] = ['seeker', 'free_trial', 'spark', 'growth', 'transformation', 'family'];
  
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
  return ['seeker', 'free_trial', 'spark', 'growth', 'transformation', 'family'];
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
