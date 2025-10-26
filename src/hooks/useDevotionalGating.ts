// useDevotionalGating - Enterprise hook for devotional feature gating logic
// Provides comprehensive access control and usage tracking for devotionals

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { subscriptionService } from '../services/subscriptionService';
import type { SubscriptionTier, Subscription } from '../types/subscription';
import {
  checkDevotionalAccess,
  getUsageDisplayMessage,
  getUpgradeMessage,
  type DevotionalAccessCheck,
} from '../utils/tierLockingRules';

interface DevotionalGatingState {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  loading: boolean;
  error: string | null;
}

interface DevotionalUsageInfo {
  used: number;
  limit: number | 'Unlimited';
  remaining: number | 'Unlimited';
  displayMessage: string;
}

interface DevotionalGatingResult {
  // Subscription state
  subscription: Subscription | null;
  tier: SubscriptionTier;
  loading: boolean;
  error: string | null;

  // Access checking
  checkAccess: (duration: number, context?: 'onboarding' | 'inApp') => DevotionalAccessCheck;
  canGenerate: (duration: number) => boolean;
  isLocked: (duration: number) => boolean;

  // Usage information
  usageInfo: DevotionalUsageInfo;

  // Messaging
  getUsageMessage: (remaining?: number) => string;
  getUpgradeMessage: (context?: 'onboarding' | 'inApp') => string;

  // Actions
  refreshSubscription: () => Promise<void>;
}

export const useDevotionalGating = (): DevotionalGatingResult => {
  const { user } = useAuth();
  const [state, setState] = useState<DevotionalGatingState>({
    subscription: null,
    tier: 'seeker',
    loading: true,
    error: null,
  });

  // Load subscription data
  const loadSubscription = useCallback(async () => {
    if (!user?.id) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'No user found',
        tier: 'seeker',
        subscription: null,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const subscription = await subscriptionService.getUserSubscription(user.id);

      // IMPORTANT: For trials, use trial_chosen_tier for gating (not 'free_trial')
      // This ensures Growth Trial gets Growth tier's feature unlocks (5-day devotionals)
      // while still having trial limits (2/2)
      const effectiveTier = subscription.tier === 'free_trial' && (subscription as any).trial_chosen_tier
        ? (subscription as any).trial_chosen_tier
        : subscription.tier;

      setState({
        subscription,
        tier: effectiveTier, // Use chosen tier for gating
        loading: false,
        error: null,
      });

      console.log(`[useDevotionalGating] Loaded subscription for user ${user.id}:`, {
        tier: subscription.tier,
        effectiveTier: effectiveTier,
        trial_chosen_tier: (subscription as any).trial_chosen_tier,
        devotionals_used: subscription.devotionals_used,
        devotionals_limit: subscription.devotionals_limit,
      });

    } catch (error) {
      console.error('[useDevotionalGating] Failed to load subscription:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: (error as Error).message || 'Failed to load subscription',
        tier: 'seeker',
        subscription: null,
      }));
    }
  }, [user?.id]);

  // Load subscription on mount and user change
  useEffect(() => {
    loadSubscription();
  }, [user?.id, loadSubscription]);

  // Calculate usage information
  const usageInfo = useMemo((): DevotionalUsageInfo => {
    if (!state.subscription) {
      return {
        used: 0,
        limit: 0,
        remaining: 0,
        displayMessage: getUsageDisplayMessage('seeker'),
      };
    }

    const { subscription } = state;
    const used = subscription.devotionals_used || 0;
    const limit = subscription.devotionals_limit === -1 ? 'Unlimited' : subscription.devotionals_limit;

    let remaining: number | 'Unlimited';
    if (limit === 'Unlimited') {
      remaining = 'Unlimited';
    } else {
      remaining = Math.max(0, limit - used);
    }

    const displayMessage = getUsageDisplayMessage(subscription.tier,
      remaining === 'Unlimited' ? undefined : remaining);

    return {
      used,
      limit,
      remaining,
      displayMessage,
    };
  }, [state]);

  // Access checking function
  const checkAccess = (duration: number, context: 'onboarding' | 'inApp' = 'inApp'): DevotionalAccessCheck => {
    return checkDevotionalAccess(state.tier, duration, context);
  };

  // Simple access checks
  const canGenerate = (duration: number): boolean => {
    const access = checkAccess(duration);
    return access.canGenerate;
  };

  const isLocked = (duration: number): boolean => {
    const access = checkAccess(duration);
    return access.isLocked;
  };

  // Messaging functions
  const getUsageMessage = (remaining?: number): string => {
    return getUsageDisplayMessage(state.tier, remaining);
  };

  const getUpgradeMessageForContext = (context: 'onboarding' | 'inApp' = 'inApp'): string => {
    return getUpgradeMessage(state.tier, context);
  };

  // Refresh function
  const refreshSubscription = async (): Promise<void> => {
    await loadSubscription();
  };

  return {
    // State
    subscription: state.subscription,
    tier: state.tier,
    loading: state.loading,
    error: state.error,

    // Access checking
    checkAccess,
    canGenerate,
    isLocked,

    // Usage information
    usageInfo,

    // Messaging
    getUsageMessage,
    getUpgradeMessage: getUpgradeMessageForContext,

    // Actions
    refreshSubscription,
  };
};

export default useDevotionalGating;
