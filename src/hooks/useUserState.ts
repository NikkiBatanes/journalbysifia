import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { subscriptionService } from '../services/subscriptionService';
import { Subscription, SubscriptionTier } from '../interfaces/subscription';

export interface UserState {
  tier: SubscriptionTier;
  subscription: Subscription | null;
  isLoading: boolean;
  onboardingProgress: OnboardingProgress;
}

export interface OnboardingProgress {
  currentPhase: 1 | 2 | 3 | 4 | 5;
  completedSteps: string[];
  hasGeneratedPlaybook: boolean;
  hasViewedPricing: boolean;
  hasStartedTrial: boolean;
}

export const useUserState = () => {
  const { user } = useAuth();
  const [userState, setUserState] = useState<UserState>({
    tier: 'basic',
    subscription: null,
    isLoading: true,
    onboardingProgress: {
      currentPhase: 1,
      completedSteps: [],
      hasGeneratedPlaybook: false,
      hasViewedPricing: false,
      hasStartedTrial: false,
    },
  });

  // Use the imported subscriptionService instance

  const loadOnboardingProgress = useCallback(async (): Promise<OnboardingProgress> => {
    try {
      const stored = await AsyncStorage.getItem(`onboarding_progress_${user?.id}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
    }

    return {
      currentPhase: 1,
      completedSteps: [],
      hasGeneratedPlaybook: false,
      hasViewedPricing: false,
      hasStartedTrial: false,
    };
  }, [user]);

  const loadUserState = useCallback(async () => {
    if (!user) {return;}

    try {
      setUserState(prev => ({ ...prev, isLoading: true }));

      // Get user subscription
      const subscription = await subscriptionService.getUserSubscription(user.id);

      // Load onboarding progress from AsyncStorage
      const onboardingProgress = await loadOnboardingProgress();

      setUserState({
        tier: subscription.tier,
        subscription,
        isLoading: false,
        onboardingProgress,
      });
    } catch (error) {
      console.error('Error loading user state:', error);
      setUserState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user, loadOnboardingProgress]);

  useEffect(() => {
    if (user) {
      loadUserState();
    }
  }, [user, loadUserState]);

  const saveOnboardingProgress = async (progress: Partial<OnboardingProgress>) => {
    if (!user) {return;}

    const updatedProgress = { ...userState.onboardingProgress, ...progress };

    try {
      await AsyncStorage.setItem(
        `onboarding_progress_${user.id}`,
        JSON.stringify(updatedProgress)
      );

      setUserState(prev => ({
        ...prev,
        onboardingProgress: updatedProgress,
      }));
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
    }
  };

  const updateOnboardingStep = async (step: string, phase?: number) => {
    const newCompletedSteps = [...userState.onboardingProgress.completedSteps];
    if (!newCompletedSteps.includes(step)) {
      newCompletedSteps.push(step);
    }

    const updates: Partial<OnboardingProgress> = {
      completedSteps: newCompletedSteps,
    };

    if (phase) {
      updates.currentPhase = phase as 1 | 2 | 3 | 4 | 5;
    }

    // Update specific flags based on step
    switch (step) {
      case 'playbook_generated':
        updates.hasGeneratedPlaybook = true;
        break;
      case 'pricing_viewed':
        updates.hasViewedPricing = true;
        break;
      case 'trial_started':
        updates.hasStartedTrial = true;
        break;
    }

    await saveOnboardingProgress(updates);
  };

  const activateFreeTrial = async (): Promise<boolean> => {
    if (!user) {return false;}

    try {
      setUserState(prev => ({ ...prev, isLoading: true }));

      const subscription = await subscriptionService.activateFreeTrial(user.id);

      setUserState(prev => ({
        ...prev,
        tier: 'free_trial',
        subscription,
        isLoading: false,
      }));

      updateOnboardingStep('trial_started');

      return true;
    } catch (error) {
      console.error('Error activating free trial:', error);
      setUserState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const getPhaseProgress = (): number => {
    const { currentPhase, completedSteps } = userState.onboardingProgress;

    // Define steps per phase
    const phaseSteps = {
      1: ['splash_viewed', 'transform_journey_viewed', 'welcome_completed'],
      2: ['registration_completed', 'personalization_completed'],
      3: ['faith_journey_completed', 'challenge_selected', 'playbook_generated'],
      4: ['playbook_explored', 'features_demonstrated'],
      5: ['pricing_viewed', 'trial_started'],
    };

    const currentPhaseSteps = phaseSteps[currentPhase] || [];
    const completedInPhase = completedSteps.filter(step =>
      currentPhaseSteps.includes(step)
    ).length;

    return currentPhaseSteps.length > 0
      ? (completedInPhase / currentPhaseSteps.length) * 100
      : 0;
  };

  const canAccessFeature = (feature: string): boolean => {
    const { tier, subscription } = userState;

    if (!subscription) {return false;}

    const limits = subscription.limits;

    // Check specific feature access based on subscription limits
    switch (feature) {
      case 'playbooks':
        return limits.playbooks === -1 || limits.playbooks > 0;
      case 'devotionals':
        return limits.devotionals === -1 || limits.devotionals > 0;
      case 'exports':
        return limits.exports === -1 || limits.exports > 0;
      case 'intelligence':
        return limits.intelligenceEnabled;
      case 'smart_journaling':
        return limits.smartJournalingEnabled;
      case 'calendar_sync':
        return limits.calendarSyncEnabled;
      case 'expounding':
        return limits.expoundingEnabled;
      case 'copy_incomplete_todos':
        return limits.copyIncompleteTodosEnabled;
      case 'answered_prayer_tracking':
        return limits.answeredPrayerTrackingEnabled;
      case 'advanced_analytics':
        return limits.advancedAnalytics;
      case 'priority_support':
        return limits.prioritySupport;
      case 'family_sharing':
        return limits.familyMembers > 0;
      default:
        // For basic features, allow access for all tiers except basic
        return tier !== 'basic';
    }
  };

  const checkUsageLimit = (feature: 'playbooks' | 'devotionals' | 'exports'): { canUse: boolean; remaining: number; limit: number } => {
    const { subscription } = userState;

    if (!subscription) {
      return { canUse: false, remaining: 0, limit: 0 };
    }

    const limits = subscription.limits;
    const limit = limits[feature];

    // Unlimited access
    if (limit === -1) {
      return { canUse: true, remaining: -1, limit: -1 };
    }

    // Get current usage (this would typically come from the subscription service)
    // For now, we'll assume 0 usage - this should be integrated with actual usage tracking
    const currentUsage = 0;
    const remaining = Math.max(0, limit - currentUsage);

    return {
      canUse: remaining > 0,
      remaining,
      limit,
    };
  };

  const getFeatureLimits = () => {
    const { subscription } = userState;

    if (!subscription) {return null;}

    return {
      playbooks: checkUsageLimit('playbooks'),
      devotionals: checkUsageLimit('devotionals'),
      exports: checkUsageLimit('exports'),
      features: {
        intelligence: subscription.limits.intelligenceEnabled,
        smartJournaling: subscription.limits.smartJournalingEnabled,
        calendarSync: subscription.limits.calendarSyncEnabled,
        expounding: subscription.limits.expoundingEnabled,
        advancedAnalytics: subscription.limits.advancedAnalytics,
        prioritySupport: subscription.limits.prioritySupport,
        familySharing: subscription.limits.familyMembers > 0,
      },
    };
  };

  return {
    userState,
    updateOnboardingStep,
    activateFreeTrial,
    getPhaseProgress,
    canAccessFeature,
    checkUsageLimit,
    getFeatureLimits,
    refreshUserState: loadUserState,
  };
};

export default useUserState;
