// useDevotionalGating - Enterprise hook for devotional feature gating logic
// Provides comprehensive access control and usage tracking for devotionals

import { useMemo } from 'react';
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
  checkAccess: (duration: number, context?: 'onboarding' | 'inApp', isOnboarding?: boolean) => DevotionalAccessCheck;
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
    staleTime: 0, // Always consider stale to ensure immediate updates after payment
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount to get latest state
  });

  // IMPORTANT: For trials, use trial_chosen_tier for gating (not 'free_trial')
  // This ensures Growth Trial gets Growth tier's feature unlocks (5-day devotionals)
  // while still having trial limits (depends on trial_chosen_tier: Spark 5/5, Growth 15/15, Transformation 25/25)
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

    // PHASE 5: Grace period check - block token generation if billing issue
    const isInGracePeriod = (subscription as any).billing_issue === true;
    const gracePeriodEnd = (subscription as any).grace_period_end_date;
    const isGracePeriodActive = isInGracePeriod && gracePeriodEnd && new Date(gracePeriodEnd) > new Date();

    let remaining: number | 'Unlimited';
    if (limit === 'Unlimited') {
      remaining = isGracePeriodActive ? 0 : 'Unlimited'; // Block tokens during grace period
    } else {
      remaining = isGracePeriodActive ? 0 : Math.max(0, limit - used); // Block tokens during grace period
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
  const checkAccess = (duration: number, context: 'onboarding' | 'inApp' = 'inApp', isOnboarding: boolean = false): DevotionalAccessCheck => {
    return checkDevotionalAccess(tier, duration, context, isOnboarding);
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
