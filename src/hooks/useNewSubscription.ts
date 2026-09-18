// New Subscription Hook for React Components
// Created: 2025-08-20

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NewSubscriptionService from '../services/NewSubscriptionService';
import { billingNotificationService } from '../services/billingNotificationService';
import {
  Subscription,
  SubscriptionUpgradeOptions,
  TrialStartOptions,
  SubscriptionError,
} from '../types/subscription';

interface UseSubscriptionResult {
  // Data
  subscription: Subscription | null;
  isLoading: boolean;
  error: Error | null;

  // Computed properties
  isSeeker: boolean;
  isTrial: boolean;
  isPaid: boolean;
  daysRemaining: number;

  // Actions
  startTrial: (options?: Partial<TrialStartOptions>) => Promise<void>;
  upgradeSubscription: (options: SubscriptionUpgradeOptions) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export function useNewSubscription(userId: string): UseSubscriptionResult {
  const queryClient = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Query for subscription data
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => NewSubscriptionService.getUserSubscription(userId, true), // Force fresh data from database
    enabled: !!userId,
    staleTime: 0, // Always consider stale to ensure immediate updates after payment
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: 'always', // Always refetch on mount to get latest state
  });

  // Computed properties
  const isSeeker = subscription?.tier === 'seeker';
  const isTrial = subscription?.tier === 'free_trial';
  const isPaid = subscription && !isSeeker && !isTrial;
  const daysRemaining = subscription?.days_remaining ?? 0;

  // Start trial mutation
  const startTrialMutation = useMutation({
    mutationFn: (options: TrialStartOptions) => NewSubscriptionService.startFreeTrial(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
    },
  });

  // Upgrade subscription mutation
  const upgradeSubscriptionMutation = useMutation({
    mutationFn: (options: SubscriptionUpgradeOptions) => NewSubscriptionService.upgradeSubscription(userId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => NewSubscriptionService.cancelSubscription(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
    },
  });


  // Issue 3 fix: trigger reset check when app comes to foreground
  useEffect(() => {
    if (!userId) {return;}
    const appStateSub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        const didReset = await NewSubscriptionService.checkAndResetMonthlyUsage(userId);
        if (didReset) {
          queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
        }
        // Issue 10 fix: check for billing_issue on foreground and notify user
        const sub = await NewSubscriptionService.getUserSubscription(userId, true);
        if ((sub as any).billing_issue) {
          billingNotificationService.handlePaymentFailure(userId).catch(() => {});
        }
      }
    });
    return () => appStateSub.remove();
  }, [userId, queryClient]);

  // Action functions
  const startTrial = useCallback(async (options: Partial<TrialStartOptions> = {}) => {
    const trialOptions: TrialStartOptions = {
      user_id: userId,
      duration_days: 3,
      ...options,
    };

    try {
      await startTrialMutation.mutateAsync(trialOptions);
    } catch (catchError) {
      throw new SubscriptionError(
        `Failed to start trial: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`,
        'TRIAL_START_FAILED',
        catchError
      );
    }
  }, [userId, startTrialMutation]);

  const upgradeSubscription = useCallback(async (options: SubscriptionUpgradeOptions) => {
    try {
      await upgradeSubscriptionMutation.mutateAsync(options);
    } catch (catchError) {
      throw new SubscriptionError(
        `Failed to upgrade subscription: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`,
        'UPGRADE_FAILED',
        catchError
      );
    }
  }, [upgradeSubscriptionMutation]);

  const cancelSubscription = useCallback(async () => {
    try {
      await cancelSubscriptionMutation.mutateAsync();
    } catch (catchError) {
      throw new SubscriptionError(
        `Failed to cancel subscription: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`,
        'CANCELLATION_FAILED',
        catchError
      );
    }
  }, [cancelSubscriptionMutation]);

  const refreshSubscription = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    // Data
    subscription: subscription || null,
    isLoading: isLoading || startTrialMutation.isPending || upgradeSubscriptionMutation.isPending ||
               cancelSubscriptionMutation.isPending,
    error: error || startTrialMutation.error || upgradeSubscriptionMutation.error ||
           cancelSubscriptionMutation.error,

    // Computed properties
    isSeeker,
    isTrial,
    isPaid: !!isPaid,
    daysRemaining,

    // Actions
    startTrial,
    upgradeSubscription,
    cancelSubscription,
    refreshSubscription,
  };
}

export default useNewSubscription;
