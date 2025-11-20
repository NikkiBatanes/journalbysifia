// useDevotionalGating - Enterprise hook for devotional feature gating logic
// Provides comprehensive access control and usage tracking for devotionals

import { useMemo, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { useAuth } from '../context/IndustryStandardAuthContext';
import subscriptionService from '../services/NewSubscriptionService';
import {
  checkDevotionalAccess,
  getUsageDisplayMessage,
  getUpgradeMessage,
  type DevotionalAccessCheck,
} from '../utils/tierLockingRules';
import { useQuery } from '@tanstack/react-query';
import type { Subscription, SubscriptionTier } from '../types/subscription';

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

  // Use React Query to watch subscription changes - this makes the hook reactive
  const { data: subscription, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', user?.id || ''],
    queryFn: () => subscriptionService.getUserSubscription(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - shorter for faster updates
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // IMPORTANT: For trials, use trial_chosen_tier for gating (not 'free_trial')
  // This ensures Growth Trial gets Growth tier's feature unlocks (5-day devotionals)
  // while still having trial limits (2/2)
  const tier = useMemo(() => {
    if (!subscription) {return 'seeker';}

    const effectiveTier = subscription.tier === 'free_trial' && (subscription as any).trial_chosen_tier
      ? (subscription as any).trial_chosen_tier
      : subscription.tier;

    return effectiveTier;
  }, [subscription]);

  // Calculate usage information
  const usageInfo = useMemo((): DevotionalUsageInfo => {
    if (!subscription) {
      return {
        used: 0,
        limit: 0,
        remaining: 0,
        displayMessage: getUsageDisplayMessage('seeker'),
      };
    }

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
  }, [subscription]);

  // Access checking function
  const checkAccess = (duration: number, context: 'onboarding' | 'inApp' = 'inApp'): DevotionalAccessCheck => {
    return checkDevotionalAccess(tier, duration, context);
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
    return getUsageDisplayMessage(tier, remaining);
  };

  const getUpgradeMessageForContext = (context: 'onboarding' | 'inApp' = 'inApp'): string => {
    return getUpgradeMessage(tier, context);
  };

  // Refresh function
  const refreshSubscription = async (): Promise<void> => {
    await refetch();
  };

  return {
    // State
    subscription: subscription || null,
    tier,
    loading: isLoading,
    error: error ? (error as Error).message : null,

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
