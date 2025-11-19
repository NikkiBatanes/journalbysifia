// Guided Prompt Feature Gating System
// Tier-based access control for guided prompts with 2 random free prompts for seekers

import type { SubscriptionTier } from '../types/subscription';

export interface GuidedPromptAccessRules {
  allowedPrompts: number; // -1 for unlimited, 0 for none, positive number for limit
  isLocked: boolean;
  usageMessage: string;
  upgradeMessage: string;
}

export interface GuidedPromptAccessCheck {
  hasAccess: boolean;
  canUsePrompt: boolean;
  upgradeRequired: boolean;
  lockIconVisible: boolean;
  usageMessage: string;
  upgradeMessage: string;
  remainingPrompts?: number;
}

// Guided prompt access rules per tier
export const GUIDED_PROMPT_ACCESS_RULES: Record<SubscriptionTier, GuidedPromptAccessRules> = {
  seeker: {
    allowedPrompts: 2, // 2 random free prompts
    isLocked: true,
    usageMessage: '2 Free Guided Prompts',
    upgradeMessage: 'Unlock unlimited guided prompts with Spark',
  },
  free_trial: {
    allowedPrompts: -1, // Unlimited
    isLocked: false,
    usageMessage: 'Unlimited Guided Prompts',
    upgradeMessage: '',
  },
  spark: {
    allowedPrompts: -1, // Unlimited
    isLocked: false,
    usageMessage: 'Unlimited Guided Prompts',
    upgradeMessage: '',
  },
  growth: {
    allowedPrompts: -1, // Unlimited
    isLocked: false,
    usageMessage: 'Unlimited Guided Prompts',
    upgradeMessage: '',
  },
  transformation: {
    allowedPrompts: -1, // Unlimited
    isLocked: false,
    usageMessage: 'Unlimited Guided Prompts',
    upgradeMessage: '',
  },
  // POST-LAUNCH: family tier
} as Record<SubscriptionTier, GuidedPromptAccessRules>;

// Dynamic upgrade messages by context
export const GUIDED_PROMPT_UPGRADE_MESSAGES = {
  onboarding: {
    seeker: 'Start your spiritual journey with unlimited guided prompts',
    free_trial: '',
    spark: '',
    growth: '',
    transformation: '',
    // POST-LAUNCH: family: '',
  },
  inApp: {
    seeker: 'Unlock unlimited guided prompts to deepen your reflection practice',
    free_trial: '',
    spark: '',
    growth: '',
    transformation: '',
    // POST-LAUNCH: family: '',
  },
} as const;

/**
 * Check if guided prompts are locked for a given tier
 */
export function areGuidedPromptsLocked(tier: SubscriptionTier): boolean {
  const rules = GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;
  return rules.isLocked;
}

/**
 * Get allowed number of guided prompts for a tier
 */
export function getAllowedGuidedPrompts(tier: SubscriptionTier): number {
  const rules = GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;
  return rules.allowedPrompts;
}

/**
 * Get usage display message for guided prompts
 */
export function getGuidedPromptUsageMessage(tier: SubscriptionTier, remaining?: number): string {
  const rules = GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;

  if (tier === 'seeker' && typeof remaining === 'number') {
    return `${remaining} Free Guided Prompts Remaining`;
  }

  return rules.usageMessage;
}

/**
 * Get upgrade message based on context
 */
export function getGuidedPromptUpgradeMessage(
  tier: SubscriptionTier,
  context: 'onboarding' | 'inApp' = 'inApp'
): string {
  return GUIDED_PROMPT_UPGRADE_MESSAGES[context][tier] || '';
}

/**
 * Comprehensive access check for guided prompts
 */
export function checkGuidedPromptAccess(
  tier: SubscriptionTier,
  usedPrompts: number = 0,
  context: 'onboarding' | 'inApp' = 'inApp'
): GuidedPromptAccessCheck {
  const rules = GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;
  const allowedPrompts = rules.allowedPrompts;

  // Unlimited access (free_trial and above)
  if (allowedPrompts === -1) {
    return {
      hasAccess: true,
      canUsePrompt: true,
      upgradeRequired: false,
      lockIconVisible: false,
      usageMessage: rules.usageMessage,
      upgradeMessage: getGuidedPromptUpgradeMessage(tier, context),
    };
  }

  // Limited access (seeker tier)
  const remainingPrompts = Math.max(0, allowedPrompts - usedPrompts);
  const hasAccess = remainingPrompts > 0;

  return {
    hasAccess,
    canUsePrompt: hasAccess,
    upgradeRequired: !hasAccess,
    lockIconVisible: !hasAccess,
    usageMessage: getGuidedPromptUsageMessage(tier, remainingPrompts),
    upgradeMessage: getGuidedPromptUpgradeMessage(tier, context),
    remainingPrompts,
  };
}

/**
 * Get tier access rules summary for guided prompts
 */
export function getGuidedPromptAccessRules(tier: SubscriptionTier): GuidedPromptAccessRules {
  return GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;
}

/**
 * Check if tier has guided prompt restrictions
 */
export function tierHasGuidedPromptRestrictions(tier: SubscriptionTier): boolean {
  const rules = GUIDED_PROMPT_ACCESS_RULES[tier] || GUIDED_PROMPT_ACCESS_RULES.seeker;
  return rules.isLocked;
}

/**
 * Get next upgrade tier that unlocks unlimited guided prompts
 */
export function getGuidedPromptUnlockTier(): SubscriptionTier {
  return 'free_trial'; // First tier that unlocks unlimited guided prompts
}

/**
 * Deterministically select daily guided prompts using seeded randomization
 * Uses Mulberry32 PRNG with djb2-style hash for consistent daily selection
 */
/* eslint-disable no-bitwise */
export function generateDailyFreePrompts(
  allPrompts: string[],
  userId: string,
  count: number = 2
): string[] {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seedStr = `${userId}-${dateStr}-guided-prompts`;

  // Simple string hash -> number
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Mulberry32 PRNG for deterministic randomization
  const mulberry32 = (a: number) => () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rand = mulberry32(hash);

  // Copy and shuffle indices deterministically
  const indices = Array.from({ length: allPrompts.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Return the first 'count' prompts
  const selectedIndices = indices.slice(0, Math.min(count, indices.length));
  return selectedIndices.map(idx => allPrompts[idx]);
}
/* eslint-enable no-bitwise */
