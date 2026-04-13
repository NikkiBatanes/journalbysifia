// New Subscription Hook for React Components
// Created: 2025-08-20

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NewSubscriptionService from '../services/NewSubscriptionService';
import { supabase } from '../services/supabaseClient';
import {
  Subscription,
  SubscriptionCheck,
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
  isUnlimited: boolean;
  showDashboardCounts: boolean;
  daysRemaining: number;

  // Usage checks
  canGeneratePlaybook: boolean;
  canGenerateDevotional: boolean;
  canUseSmartJournaling: boolean;
  playbooksRemaining: number;
  devotionalsRemaining: number;

  // Actions
  startTrial: (options?: Partial<TrialStartOptions>) => Promise<void>;
  upgradeSubscription: (options: SubscriptionUpgradeOptions) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  incrementUsage: (action: 'playbook' | 'devotional' | 'smart_journal' | 'export') => Promise<void>;
  checkUsage: (action: 'playbook' | 'devotional' | 'smart_journal' | 'export') => Promise<SubscriptionCheck>;
  refreshSubscription: () => Promise<void>;
}

export function useNewSubscription(userId: string): UseSubscriptionResult {
  const queryClient = useQueryClient();
  const [usageCheck, setUsageCheck] = useState<SubscriptionCheck | null>(null);

  // Query for subscription data
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => NewSubscriptionService.getUserSubscription(userId),
    enabled: !!userId,
    staleTime: 0, // Always consider stale to ensure immediate updates after payment
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: 'always', // Always refetch on mount to get latest state
  });

  // Listen for real-time changes to the subscription row
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`subscription-realtime:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions_new',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Invalidate the query so it refetches with fresh data
          queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Computed properties
  const isSeeker = subscription?.tier === 'seeker';
  const isTrial = subscription?.tier === 'free_trial';
  const isPaid = subscription && !isSeeker && !isTrial;
  const isUnlimited = subscription?.tier === 'transformation'; // POST-LAUNCH: || subscription?.tier === 'family'
  const showDashboardCounts = subscription?.limits?.show_dashboard_counts ?? false;
  const daysRemaining = subscription?.days_remaining ?? 0;

  // Usage properties with better defaults
  const canGeneratePlaybook = usageCheck?.can_generate_playbook ?? true;
  const canGenerateDevotional = usageCheck?.can_generate_devotional ?? true;
  const canUseSmartJournaling = subscription?.limits?.smart_journaling_enabled ?? false;

  // Calculate remaining based on subscription data if usageCheck isn't ready
  const playbooksRemaining = usageCheck?.playbooks_remaining ??
    (subscription ? Math.max(0, subscription.playbooks_limit - subscription.playbooks_used) : 0);
  const devotionalsRemaining = usageCheck?.devotionals_remaining ??
    (subscription ? Math.max(0, subscription.devotionals_limit - subscription.devotionals_used) : 0);

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

  // Increment usage mutation
  const incrementUsageMutation = useMutation({
    mutationFn: (action: 'playbook' | 'devotional' | 'smart_journal' | 'export') =>
      NewSubscriptionService.incrementUsage(userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      // Refresh usage check
      if (subscription) {
        updateUsageCheck();
      }
    },
  });

  // Update usage check when subscription changes
  const updateUsageCheck = useCallback(async () => {
    if (!subscription) {return;}

    try {
      // Check both playbook and devotional limits
      const playbookCheck = await NewSubscriptionService.checkUsageLimit(userId, 'playbook');
      const devotionalCheck = await NewSubscriptionService.checkUsageLimit(userId, 'devotional');

      // Combine the checks
      setUsageCheck({
        can_generate_playbook: playbookCheck.can_generate_playbook,
        can_generate_devotional: devotionalCheck.can_generate_devotional,
        can_use_smart_journaling: playbookCheck.can_use_smart_journaling,
        can_export: playbookCheck.can_export,
        playbooks_remaining: playbookCheck.playbooks_remaining,
        devotionals_remaining: devotionalCheck.devotionals_remaining,
        show_upgrade_prompt: playbookCheck.show_upgrade_prompt || devotionalCheck.show_upgrade_prompt,
        upgrade_message: playbookCheck.upgrade_message || devotionalCheck.upgrade_message,
      });
    } catch (catchError) {
      // Usage check failed - set default restrictive values
      setUsageCheck({
        can_generate_playbook: false,
        can_generate_devotional: false,
        can_use_smart_journaling: false,
        can_export: false,
        playbooks_remaining: 0,
        devotionals_remaining: 0,
        show_upgrade_prompt: false,
        upgrade_message: '',
      });
    }
  }, [userId, subscription]);

  // Update usage check when subscription changes
  useEffect(() => {
    updateUsageCheck();
  }, [updateUsageCheck]);

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

  const incrementUsage = useCallback(async (action: 'playbook' | 'devotional' | 'smart_journal' | 'export') => {
    try {
      await incrementUsageMutation.mutateAsync(action);
    } catch (catchError) {
      throw new SubscriptionError(
        `Failed to increment usage: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`,
        'USAGE_INCREMENT_FAILED',
        catchError
      );
    }
  }, [incrementUsageMutation]);

  const checkUsage = useCallback(async (action: 'playbook' | 'devotional' | 'smart_journal' | 'export') => {
    try {
      return await NewSubscriptionService.checkUsageLimit(userId, action);
    } catch (catchError) {
      throw new SubscriptionError(
        `Failed to check usage: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`,
        'USAGE_CHECK_FAILED',
        catchError
      );
    }
  }, [userId]);

  const refreshSubscription = useCallback(async () => {
    await refetch();
    await updateUsageCheck();
  }, [refetch, updateUsageCheck]);

  return {
    // Data
    subscription: subscription || null,
    isLoading: isLoading || startTrialMutation.isPending || upgradeSubscriptionMutation.isPending ||
               cancelSubscriptionMutation.isPending || incrementUsageMutation.isPending,
    error: error || startTrialMutation.error || upgradeSubscriptionMutation.error ||
           cancelSubscriptionMutation.error || incrementUsageMutation.error,

    // Computed properties
    isSeeker,
    isTrial,
    isPaid: !!isPaid,
    isUnlimited,
    showDashboardCounts,
    daysRemaining,

    // Usage checks
    canGeneratePlaybook,
    canGenerateDevotional,
    canUseSmartJournaling,
    playbooksRemaining,
    devotionalsRemaining,

    // Actions
    startTrial,
    upgradeSubscription,
    cancelSubscription,
    incrementUsage,
    checkUsage,
    refreshSubscription,
  };
}

// Utility hook for checking specific feature access
export function useFeatureAccess(userId: string, feature: 'playbook' | 'devotional' | 'smart_journal' | 'export') {
  const { subscription, checkUsage } = useNewSubscription(userId);

  const { data: featureCheck, isLoading, error } = useQuery({
    queryKey: ['feature-access', userId, feature],
    queryFn: () => checkUsage(feature),
    enabled: !!userId && !!subscription,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return {
    canAccess: featureCheck?.can_generate_playbook || featureCheck?.can_generate_devotional ||
               featureCheck?.can_use_smart_journaling || featureCheck?.can_export || false,
    remaining: feature === 'playbook' ? featureCheck?.playbooks_remaining :
               feature === 'devotional' ? featureCheck?.devotionals_remaining : -1,
    showUpgradePrompt: featureCheck?.show_upgrade_prompt || false,
    upgradeMessage: featureCheck?.upgrade_message,
    isLoading,
    error,
  };
}

export default useNewSubscription;
