import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useNewSubscription } from './useNewSubscription';
import { Subscription, SubscriptionTier } from '../types/subscription';

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
  const { subscription, startTrial } = useNewSubscription(user?.id || '');
  const [userState, setUserState] = useState<UserState>({
    tier: 'seeker',
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

  // Using new subscription system

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
    if (!user?.id) {return;}

    try {
      setUserState(prev => ({ ...prev, isLoading: true }));

      // Load onboarding progress from AsyncStorage
      const onboardingProgress = await loadOnboardingProgress();

      setUserState(prev => ({
        ...prev,
        tier: subscription?.tier || 'seeker',
        subscription,
        isLoading: false,
        onboardingProgress,
      }));
    } catch (error) {
      console.error('Error loading user state:', error);
      setUserState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user?.id, subscription, loadOnboardingProgress]);

  useEffect(() => {
    if (user) {
      loadUserState();
    }
  }, [user, loadUserState]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUserState();
      }
      return () => {};
    }, [user, loadUserState])
  );

  // Refresh when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && user) {
        loadUserState();
      }
    });
    return () => {
      sub.remove();
    };
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

  const activateFreeTrial = useCallback(async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setUserState(prev => ({ ...prev, isLoading: true }));

      await startTrial({ user_id: user.id });

      setUserState(prev => ({
        ...prev,
        onboardingProgress: {
          ...prev.onboardingProgress,
          hasStartedTrial: true,
        },
      }));

      // Update onboarding progress in AsyncStorage
      await updateOnboardingStep('trial_activated', 3);

      return subscription;
    } catch (error) {
      console.error('Error activating free trial:', error);
      setUserState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [user?.id, startTrial, subscription, updateOnboardingStep]);

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

  const getSubscriptionLimits = useCallback(() => {
    if (!subscription) {
      return {
        playbooks: { used: 0, total: 0 },
        devotionals: { used: 0, total: 0 },
        exports: { used: 0, total: 0 },
        intelligenceEnabled: false,
        smartJournalingEnabled: false,
        calendarSyncEnabled: false,
        copyIncompleteTodosEnabled: false,
        answeredPrayerTrackingEnabled: false,
        advancedAnalytics: false,
        prioritySupport: false,
        familyMembers: 0,
      };
    }

    const isUnlimited = subscription.tier === 'transformation' || subscription.tier === 'family';

    return {
      playbooks: {
        used: subscription.playbooks_used,
        total: isUnlimited ? -1 : subscription.playbooks_limit,
      },
      devotionals: {
        used: subscription.devotionals_used,
        total: isUnlimited ? -1 : subscription.devotionals_limit,
      },
      exports: { used: 0, total: -1 }, // No export limits in new system
      intelligenceEnabled: subscription.tier !== 'seeker',
      smartJournalingEnabled: subscription.smart_journaling_enabled,
      calendarSyncEnabled: subscription.tier !== 'seeker',
      copyIncompleteTodosEnabled: subscription.tier !== 'seeker',
      answeredPrayerTrackingEnabled: subscription.tier !== 'seeker',
      advancedAnalytics: subscription.tier === 'transformation' || subscription.tier === 'family',
      prioritySupport: subscription.tier === 'transformation' || subscription.tier === 'family',
      familyMembers: subscription.tier === 'family' ? 6 : 0,
    };
  }, [subscription]);

  const canUseFeature = useCallback((feature: 'playbooks' | 'devotionals' | 'exports') => {
    if (!subscription) {return false;}

    const isUnlimited = subscription.tier === 'transformation' || subscription.tier === 'family';

    switch (feature) {
      case 'playbooks':
        return isUnlimited || subscription.playbooks_used < subscription.playbooks_limit;
      case 'devotionals':
        return isUnlimited || subscription.devotionals_used < subscription.devotionals_limit;
      case 'exports':
        return true; // No export limits in new system
      default:
        return false;
    }
  }, [subscription]);

  const hasFeatureAccess = useCallback((feature: string) => {
    if (!subscription) {return false;}

    switch (feature) {
      case 'intelligence':
        return subscription.tier !== 'seeker';
      case 'smartJournaling':
        return subscription.smart_journaling_enabled;
      case 'calendarSync':
        return subscription.tier !== 'seeker';
      case 'advancedAnalytics':
        return subscription.tier === 'transformation' || subscription.tier === 'family';
      case 'prioritySupport':
        return subscription.tier === 'transformation' || subscription.tier === 'family';
      case 'familyMembers':
        return subscription.tier === 'family';
      default:
        return false;
    }
  }, [subscription]);

  const checkUsageLimit = (feature: 'playbooks' | 'devotionals' | 'exports'): { canUse: boolean; remaining: number; limit: number } => {
    const { used, total } = getSubscriptionLimits()[feature];

    return {
      canUse: canUseFeature(feature),
      remaining: total === -1 ? -1 : total - used,
      limit: total,
    };
  };

  const getFeatureLimits = () => {
    if (!subscription) {return null;}

    return {
      playbooks: checkUsageLimit('playbooks'),
      devotionals: checkUsageLimit('devotionals'),
      exports: checkUsageLimit('exports'),
      features: {
        intelligence: hasFeatureAccess('intelligence'),
        smartJournaling: hasFeatureAccess('smartJournaling'),
        calendarSync: hasFeatureAccess('calendarSync'),
        advancedAnalytics: hasFeatureAccess('advancedAnalytics'),
        prioritySupport: hasFeatureAccess('prioritySupport'),
        familySharing: hasFeatureAccess('familyMembers'),
      },
    };
  };

  return {
    userState,
    updateOnboardingStep,
    activateFreeTrial,
    getPhaseProgress,
    canAccessFeature: hasFeatureAccess,
    checkUsageLimit,
    getFeatureLimits,
    refreshUserState: loadUserState,
  };
};

export default useUserState;
