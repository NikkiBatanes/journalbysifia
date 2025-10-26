// Shim for legacy subscriptionService API, forwarding to NewSubscriptionService
// Created: 2025-08-20

import { supabase } from './supabaseClient';
import { NewSubscriptionService as NSS } from './NewSubscriptionService';
import type { Subscription, SubscriptionTier, SubscriptionLimits, SubscriptionCheck } from '../types/subscription';

// Augmented limits shape expected by legacy code
export interface LegacySubscriptionLimits extends SubscriptionLimits {
  // Additional legacy fields
  exports: number; // -1 unlimited, 0 none, N limited
  intelligenceEnabled: boolean;
}

// Result shape for legacy canGenerate checks
export interface LegacyCanGenerateResult {
  allowed: boolean;
  message?: string;
  upgradeRequired?: boolean;
  remaining: number | 'Unlimited';
  limit: number | 'Unlimited';
}

async function fetchUsageTracking(userId: string): Promise<{ export_count?: number } | null> {
  try {
    const query = supabase
      .from('subscription_usage_tracking')
      .select('export_count, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    const { data, error } = await query;
    if (error || !data || data.length === 0) { return null; }
    return data[0] as any;
  } catch {
    return null;
  }
}

function mapIntelligenceEnabled(tier: SubscriptionTier): boolean {
  // Enable intelligence for paid tiers
  switch (tier) {
    case 'spark':
    case 'growth':
    case 'transformation':
    case 'family':
      return true;
    default:
      return false; // seeker, free_trial
  }
}

function mapExportsLimit(tier: SubscriptionTier): number {
  // Conservative defaults: no exports for seeker, unlimited for paid and trial
  switch (tier) {
    case 'seeker':
      return 0;
    default:
      return -1; // unlimited
  }
}

export const subscriptionService = {
  // Expose supabase for callers that reach into the client
  supabase,

  // Forward: get user subscription
  async getUserSubscription(userId: string): Promise<Subscription> {
    return await NSS.getUserSubscription(userId);
  },

  // Legacy: return limits with extra fields expected by older services
  getSubscriptionLimits(tier: SubscriptionTier): LegacySubscriptionLimits {
    const base = NSS.getTierLimits(tier);
    return {
      ...base,
      exports: mapExportsLimit(tier),
      intelligenceEnabled: mapIntelligenceEnabled(tier),
    };
  },

  // Legacy: compute current usage summary used by older services
  async getCurrentUsage(userId: string): Promise<{
    playbooks_used: number;
    devotionals_used: number;
    exports_used: number;
    playbooks_generated: number;
    devotionals_generated: number;
    exports_generated: number;
  }> {
    const sub = await NSS.getUserSubscription(userId);
    const tracking = await fetchUsageTracking(userId);
    const playbooksUsed = (sub as any).playbooks_used || 0;
    const devotionalsUsed = (sub as any).devotionals_used || 0;
    const exportsUsed = (tracking?.export_count as number) || 0;

    return {
      // Legacy property names
      playbooks_used: playbooksUsed,
      devotionals_used: devotionalsUsed,
      exports_used: exportsUsed,
      // New property names for UI compatibility
      playbooks_generated: playbooksUsed,
      devotionals_generated: devotionalsUsed,
      exports_generated: exportsUsed,
    };
  },

  // Legacy: canGenerate wrapper for different content types
  async canGenerate(
    userId: string,
    type: 'playbook' | 'devotional' | 'smart_journal' | 'export',
    isOnboarding: boolean = false
  ): Promise<LegacyCanGenerateResult> {
    const sub = await NSS.getUserSubscription(userId);

    // Special-case onboarding for seekers on playbook generation
    if (type === 'playbook' && isOnboarding) {
      const onboardingLimit = NSS.getOnboardingPlaybookLimit(sub.tier);
      const used = (sub as any).playbooks_used || 0;
      const allowed = onboardingLimit === -1 || used < onboardingLimit;
      return {
        allowed,
        upgradeRequired: !allowed,
        remaining: onboardingLimit === -1 ? 'Unlimited' : Math.max(0, onboardingLimit - used),
        limit: onboardingLimit === -1 ? 'Unlimited' : onboardingLimit,
        message: allowed ? undefined : `You've used all ${onboardingLimit} onboarding playbooks. Upgrade for more!`,
      };
    }

    const check: SubscriptionCheck = await NSS.checkUsageLimit(userId, type);

    // Determine remaining/limit based on action type
    let remaining: number | 'Unlimited' = 0;
    let limit: number | 'Unlimited' = 0;

    if (type === 'playbook') {
      const limits = NSS.getTierLimits(sub.tier);
      const isUnlimited = limits.playbooks_limit === -1;
      const used = (sub as any).playbooks_used || 0;
      remaining = isUnlimited ? 'Unlimited' : Math.max(0, limits.playbooks_limit - used);
      limit = isUnlimited ? 'Unlimited' : limits.playbooks_limit;
      return {
        allowed: !!check.can_generate_playbook,
        upgradeRequired: !!check.show_upgrade_prompt,
        remaining,
        limit,
        message: check.upgrade_message,
      };
    }

    if (type === 'devotional') {
      const limits = NSS.getTierLimits(sub.tier);
      const isUnlimited = limits.devotionals_limit === -1;
      const used = (sub as any).devotionals_used || 0;
      remaining = isUnlimited ? 'Unlimited' : Math.max(0, limits.devotionals_limit - used);
      limit = isUnlimited ? 'Unlimited' : limits.devotionals_limit;
      return {
        allowed: !!check.can_generate_devotional,
        upgradeRequired: !!check.show_upgrade_prompt,
        remaining,
        limit,
        message: check.upgrade_message,
      };
    }

    if (type === 'export') {
      const limits = subscriptionService.getSubscriptionLimits(sub.tier);
      const usage = await subscriptionService.getCurrentUsage(userId);
      const isUnlimited = limits.exports === -1;
      const used = usage.exports_used || 0;
      remaining = isUnlimited ? 'Unlimited' : Math.max(0, limits.exports - used);
      limit = isUnlimited ? 'Unlimited' : limits.exports;
      return {
        allowed: true, // exports currently unrestricted in core service
        upgradeRequired: false,
        remaining,
        limit,
      };
    }

    // smart_journal
    const limits = NSS.getTierLimits(sub.tier);
    return {
      allowed: !!limits.smart_journaling_enabled,
      upgradeRequired: !limits.smart_journaling_enabled,
      remaining: -1 as any, // not used by callers
      limit: -1 as any,
      message: !limits.smart_journaling_enabled ? 'Smart journaling requires Spark plan or above.' : undefined,
    };
  },

  // Legacy: track usage (adapts extra params and forwards)
  async trackUsage(
    userId: string,
    action: 'playbook' | 'devotional' | 'smart_journal' | 'export',
    _tokensUsed?: number,
    isOnboarding?: boolean
  ): Promise<void> {
    await NSS.incrementUsage(userId, action, isOnboarding || false);
  },

  // Legacy: intelligence access flag
  async hasIntelligenceAccess(userId: string): Promise<boolean> {
    const sub = await NSS.getUserSubscription(userId);
    return mapIntelligenceEnabled(sub.tier);
  },

  // Legacy: queue priority mapping (lower number = higher priority)
  getQueuePriority(tier: SubscriptionTier): number {
    const map: Record<SubscriptionTier | string, number> = {
      seeker: 5,
      free_trial: 4,
      spark: 3,
      growth: 2,
      transformation: 1,
      family: 1,
      enterprise: 0,
    };
    return map[tier] ?? 5;
  },

  // Convenience analytics bundle for callers
  async getSubscriptionAnalytics(userId: string): Promise<{
    subscription: Subscription;
    usage: { playbooks_used: number; devotionals_used: number; exports_used: number };
    limits: LegacySubscriptionLimits;
    analytics: { intelligenceEnabled: boolean };
  }> {
    const subscription = await NSS.getUserSubscription(userId);
    const usage = await this.getCurrentUsage(userId);
    const limits = this.getSubscriptionLimits(subscription.tier);
    return {
      subscription,
      usage,
      limits,
      analytics: { intelligenceEnabled: limits.intelligenceEnabled },
    };
  },
};

export type { Subscription, SubscriptionTier };
