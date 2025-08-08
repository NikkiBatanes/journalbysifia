import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trialAccessService, TrialStatus, FeatureAccess } from '../services/trialAccessService';
import { useAuth } from '../context/IndustryStandardAuthContext';

/**
 * Hook for managing trial status and feature access
 */
export const useTrialAccess = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get trial status
  const {
    data: trialStatus,
    isLoading: isLoadingTrial,
    error: trialError,
  } = useQuery<TrialStatus>({
    queryKey: ['trial-status', user?.id],
    queryFn: () => trialAccessService.getTrialStatus(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider fresh for 30 seconds
  });

  // Get feature access
  const {
    data: featureAccess,
    isLoading: isLoadingAccess,
    error: accessError,
  } = useQuery<FeatureAccess>({
    queryKey: ['feature-access', user?.id],
    queryFn: () => trialAccessService.getFeatureAccess(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Start trial mutation
  const startTrialMutation = useMutation({
    mutationFn: () => trialAccessService.startTrial(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['feature-access', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
    },
  });

  return {
    // Trial status
    trialStatus,
    isLoadingTrial,
    trialError,

    // Feature access
    featureAccess,
    isLoadingAccess,
    accessError,

    // Actions
    startTrial: startTrialMutation.mutate,
    isStartingTrial: startTrialMutation.isPending,

    // Computed values
    isLoading: isLoadingTrial || isLoadingAccess,
    hasActiveAccess: trialStatus?.fullAccessEnabled || false,
    daysRemaining: trialStatus?.daysRemaining || 0,
    hasExpired: trialStatus?.hasExpired || false,
  };
};

/**
 * Hook for checking specific feature access
 */
export const useFeatureAccess = (feature: keyof FeatureAccess) => {
  const { featureAccess, isLoadingAccess } = useTrialAccess();

  return {
    hasAccess: featureAccess?.[feature] || false,
    isLoading: isLoadingAccess,
  };
};

/**
 * Hook for content generation limits
 */
export const useContentGeneration = () => {
  const { user } = useAuth();
  const { featureAccess } = useTrialAccess();

  const checkCanGenerate = async (contentType: 'playbook' | 'devotional') => {
    if (!user?.id) {return { canGenerate: false, reason: 'not_authenticated' };}

    return await trialAccessService.canGenerateContent(user.id, contentType);
  };

  return {
    playbooksRemaining: featureAccess?.playbooksRemaining || 0,
    devotionalsRemaining: featureAccess?.devotionalsRemaining || 0,
    checkCanGenerate,
    hasUnlimitedAccess: featureAccess?.playbooksRemaining === 999, // During trial
  };
};

/**
 * Hook for trial countdown and notifications
 */
export const useTrialCountdown = () => {
  const { trialStatus } = useTrialAccess();
  const [showUrgency, setShowUrgency] = useState(false);

  useEffect(() => {
    if (trialStatus?.isActive && trialStatus.daysRemaining <= 1) {
      setShowUrgency(true);
    } else {
      setShowUrgency(false);
    }
  }, [trialStatus]);

  const getCountdownMessage = () => {
    if (!trialStatus?.isActive) {return null;}

    const { daysRemaining } = trialStatus;

    if (daysRemaining === 0) {
      return 'Your trial expires today! Upgrade to keep full access.';
    } else if (daysRemaining === 1) {
      return "Only 1 day left in your trial! Don't lose access to premium features.";
    } else {
      return `${daysRemaining} days left in your trial`;
    }
  };

  const getUrgencyLevel = (): 'low' | 'medium' | 'high' => {
    if (!trialStatus?.isActive) {return 'low';}

    if (trialStatus.daysRemaining === 0) {return 'high';}
    if (trialStatus.daysRemaining === 1) {return 'medium';}
    return 'low';
  };

  return {
    message: getCountdownMessage(),
    urgencyLevel: getUrgencyLevel(),
    showUrgency,
    daysRemaining: trialStatus?.daysRemaining || 0,
    isActive: trialStatus?.isActive || false,
  };
};

/**
 * Hook for upgrade prompts when features are blocked
 */
export const useUpgradePrompts = () => {
  const { featureAccess, hasExpired } = useTrialAccess();

  const getUpgradePrompt = (feature: string) => {
    return trialAccessService.getUpgradePrompt(feature);
  };

  const shouldShowUpgradePrompt = (feature: keyof FeatureAccess): boolean => {
    if (!featureAccess) {return false;}

    // Show upgrade prompt if trial expired and feature is locked
    return hasExpired && !featureAccess[feature];
  };

  const getBlockedFeatureMessage = (feature: keyof FeatureAccess): string => {
    if (!hasExpired) {return '';}

    const messages = {
      smartJournalingEnabled: 'Smart Journaling is now locked. Upgrade to Starter to unlock AI-powered insights.',
      journalTemplatesAccess: 'Premium templates are now locked. Upgrade to access all 20+ guided templates.',
      playbooksRemaining: 'You\'ve reached your playbook limit. Upgrade to generate unlimited personalized plans.',
      devotionalsRemaining: 'You\'ve reached your devotional limit. Upgrade for unlimited daily devotionals.',
      intelligenceEnabled: 'Advanced AI features are locked. Upgrade to Transformation for enhanced personalization.',
      advancedAnalytics: 'Analytics are locked. Upgrade to track your spiritual growth journey.',
      prioritySupport: 'Priority support is locked. Upgrade for faster response times.',
    };

    return messages[feature] || 'This feature requires a subscription. Upgrade to unlock.';
  };

  return {
    getUpgradePrompt,
    shouldShowUpgradePrompt,
    getBlockedFeatureMessage,
    hasExpiredTrial: hasExpired,
  };
};
