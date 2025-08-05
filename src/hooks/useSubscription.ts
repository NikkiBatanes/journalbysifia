/**
 * Subscription Hook
 * Provides simple interface for subscription management and usage tracking
 * Integrates with intelligence system for premium features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionService, CanGenerateResult } from '../services/subscriptionService';
import { intelligenceService } from '../services/intelligenceService';
import { useAuth } from '../context/IndustryStandardAuthContext';

export interface UseSubscriptionResult {
  // Subscription data
  subscription: any;
  usage: any;
  analytics: any;

  // Loading states
  loading: boolean;
  error: Error | null;

  // Generation checks (SIMPLE FOR USERS)
  canGenerate: (type: 'playbook' | 'devotional') => CanGenerateResult;

  // Intelligence features
  hasIntelligence: boolean;
  recommendations: any;

  // Actions
  upgradeSubscription: (tier: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;

  // Family features
  familyInfo: any;
  addFamilyMember: (email: string) => Promise<boolean>;
}

export const useSubscription = (): UseSubscriptionResult => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Get subscription data
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => subscriptionService.getUserSubscription(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Get usage data
  const {
    data: usage,
    isLoading: usageLoading,
  } = useQuery({
    queryKey: ['usage', userId],
    queryFn: () => subscriptionService.getCurrentUsage(userId!),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute (more frequent for usage)
    refetchOnWindowFocus: true,
  });

  // Get analytics
  const {
    data: analytics,
    isLoading: analyticsLoading,
  } = useQuery({
    queryKey: ['subscription-analytics', userId],
    queryFn: () => subscriptionService.getSubscriptionAnalytics(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Get intelligence recommendations (only for premium users)
  const { data: recommendations } = useQuery({
    queryKey: ['intelligence-recommendations', userId],
    queryFn: () => intelligenceService.getContentRecommendations(userId!),
    enabled: !!userId && subscription?.intelligence_enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Get family info (only for family plans)
  const { data: familyInfo } = useQuery({
    queryKey: ['family-info', userId],
    queryFn: () => subscriptionService.getFamilyInfo(userId!),
    enabled: !!userId && subscription?.tier === 'family',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Upgrade subscription mutation
  const upgradeMutation = useMutation({
    mutationFn: async (tier: string) => {
      if (!userId) {throw new Error('User not authenticated');}
      await subscriptionService.upgradeSubscription(userId, tier as any);
    },
    onSuccess: () => {
      // Invalidate all subscription-related queries
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {throw new Error('User not authenticated');}
      await subscriptionService.cancelSubscription(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  // Add family member mutation
  const addFamilyMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!userId) {throw new Error('User not authenticated');}
      // This would typically involve sending an invitation
      // For now, we'll assume the member user ID is provided
      return await subscriptionService.addFamilyMember(userId, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-info'] });
    },
  });

  // Simple generation check function (WHAT USERS SEE)
  const canGenerate = (type: 'playbook' | 'devotional'): CanGenerateResult => {
    if (!subscription || !usage) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        used: 0,
        upgradeRequired: true,
        message: 'Loading subscription data...',
      };
    }

    // Get limits for current tier
    const limits = getSubscriptionLimits(subscription.tier);
    const limit = type === 'playbook' ? limits.playbooks : limits.devotionals;
    const used = type === 'playbook' ? usage.playbooks_used : usage.devotionals_used;

    // Handle unlimited subscriptions
    if (limit === -1) {
      return {
        allowed: true,
        remaining: 'Unlimited',
        limit: 'Unlimited',
        used,
        upgradeRequired: false,
      };
    }

    const remaining = Math.max(0, limit - used);
    const allowed = remaining > 0;

    let message = '';
    if (!allowed) {
      const contentType = type === 'playbook' ? 'playbooks' : 'devotionals';
      message = `You've used all ${limit} ${contentType} this month. Upgrade for more!`;
    }

    return {
      allowed,
      remaining,
      limit,
      used,
      upgradeRequired: !allowed,
      message,
    };
  };

  // Helper function to get subscription limits
  const getSubscriptionLimits = (tier: string) => {
    const limitsMap: Record<string, any> = {
      free_trial: { playbooks: 2, devotionals: 2, intelligenceEnabled: false },
      starter: { playbooks: 8, devotionals: 8, intelligenceEnabled: false },
      lite: { playbooks: 20, devotionals: 20, intelligenceEnabled: true },
      pro: { playbooks: -1, devotionals: -1, intelligenceEnabled: true },
      family: { playbooks: -1, devotionals: -1, intelligenceEnabled: true },
      enterprise: { playbooks: -1, devotionals: -1, intelligenceEnabled: true },
    };
    return limitsMap[tier] || limitsMap.free_trial;
  };

  const loading = subscriptionLoading || usageLoading || analyticsLoading;
  const error = subscriptionError as Error | null;
  const hasIntelligence = subscription?.intelligence_enabled || false;

  return {
    // Data
    subscription,
    usage,
    analytics,

    // States
    loading,
    error,

    // Functions
    canGenerate,

    // Intelligence
    hasIntelligence,
    recommendations,

    // Actions
    upgradeSubscription: upgradeMutation.mutateAsync,
    cancelSubscription: cancelMutation.mutateAsync,

    // Family
    familyInfo,
    addFamilyMember: addFamilyMemberMutation.mutateAsync,
  };
};

// Additional hook for generation-specific functionality
export const useGeneration = () => {
  const { user } = useAuth();
  const { canGenerate, hasIntelligence } = useSubscription();
  const userId = user?.id;

  // Get queue status
  const { data: queueStatus } = useQuery({
    queryKey: ['queue-status', userId],
    queryFn: async () => {
      if (!userId) {return null;}
      const { queueService } = await import('../services/queueService');
      return queueService.getQueueStatus(userId);
    },
    enabled: !!userId,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always fresh
  });

  // Get personalized suggestions
  const { data: suggestions } = useQuery({
    queryKey: ['personalized-suggestions', userId],
    queryFn: async () => {
      if (!userId || !hasIntelligence) {return null;}
      const { enhancedGenerationService } = await import('../services/enhancedGenerationService');
      return enhancedGenerationService.getPersonalizedSuggestions(userId);
    },
    enabled: !!userId && hasIntelligence,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  return {
    canGenerate,
    queueStatus,
    suggestions,
    hasIntelligence,
  };
};

// Hook for tracking user behavior (intelligence system)
export const useBehaviorTracking = () => {
  const { user } = useAuth();
  const { hasIntelligence } = useSubscription();
  const userId = user?.id;

  const trackBehavior = async (
    eventType: string,
    eventCategory: 'generation' | 'completion' | 'engagement' | 'navigation',
    eventData: any = {},
    options: {
      sessionId?: string;
      playbookId?: string;
      devotionalId?: string;
      duration?: number;
      success?: boolean;
    } = {}
  ) => {
    if (!userId || !hasIntelligence) {return;}

    try {
      await intelligenceService.trackBehavior(userId, {
        event_type: eventType,
        event_category: eventCategory,
        event_data: eventData,
        session_id: options.sessionId,
        playbook_id: options.playbookId,
        devotional_id: options.devotionalId,
        duration_seconds: options.duration,
        success_indicator: options.success,
      });
    } catch (error) {
      console.warn('Failed to track behavior:', error);
      // Don't throw - tracking should not break the app
    }
  };

  return {
    trackBehavior,
    canTrack: hasIntelligence,
  };
};

// Hook for subscription upgrade flow
export const useSubscriptionUpgrade = () => {
  const { upgradeSubscription } = useSubscription();
  const queryClient = useQueryClient();

  const upgradeFlow = async (targetTier: string) => {
    try {
      // In a real app, this would integrate with Stripe
      // For now, we'll just update the subscription directly
      await upgradeSubscription(targetTier);

      // Show success message
      console.log(`Successfully upgraded to ${targetTier}`);

      // Refresh all data
      queryClient.invalidateQueries();

      return true;
    } catch (error) {
      console.error('Upgrade failed:', error);
      throw error;
    }
  };

  return {
    upgradeFlow,
  };
};
