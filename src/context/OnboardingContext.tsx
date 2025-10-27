/**
 * Onboarding Context
 * Manages onboarding state and flow throughout the app
 * Integrates with existing authentication system
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Logger } from '../utils/ProductionLogger';
import { useAuth } from './IndustryStandardAuthContext';
import {
  onboardingService,
  OnboardingProgress,
  FaithJourneyProfile,
  PersonalizationProfile,
  OnboardingStepData,
  ChristAcceptanceData,
  OnboardingStepStatus,
} from '../services/onboardingService';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface OnboardingContextType {
  // State
  isOnboardingRequired: boolean;
  isOnboardingCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  progress: OnboardingProgress | null;
  faithJourney: FaithJourneyProfile | null;
  personalization: PersonalizationProfile | null;
  loading: boolean;
  error: string | null;

  // Actions
  initializeOnboarding: (userId: string) => Promise<void>;
  startOnboarding: () => Promise<void>;
  updateStepProgress: (stepData: OnboardingStepData) => Promise<void>;
  updateFaithJourney: (data: Partial<FaithJourneyProfile>) => Promise<void>;
  updatePersonalization: (data: Partial<PersonalizationProfile>) => Promise<void>;
  updatePersonalizationProfile: (data: Partial<PersonalizationProfile>) => Promise<void>;
  recordChristAcceptance: (data: ChristAcceptanceData) => Promise<void>;
  completeOnboarding: (userId?: string) => Promise<void>;
  abandonOnboarding: (currentStep: string) => Promise<void>;
  skipStep: (stepName: string, stepNumber: number) => Promise<void>;

  // Utilities
  refreshOnboardingData: () => Promise<void>;
  getStepProgress: (stepName: string) => boolean;
  canSkipStep: (stepName: string) => boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// =============================================
// ONBOARDING PROVIDER
// =============================================

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // State
  const [isOnboardingRequired, setIsOnboardingRequired] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(6); // Welcome, Faith Journey, Profile, Goals, Preferences, Trial
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [faithJourney, setFaithJourney] = useState<FaithJourneyProfile | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // INITIALIZATION
  // =============================================

  const initializeOnboarding = useCallback(async () => {

    if (!user?.id || !isAuthenticated) {
      // In development, allow onboarding for unauthenticated users for testing
      if (__DEV__ && !isAuthenticated) {

        setIsOnboardingRequired(true);
        setIsOnboardingCompleted(false);
        setCurrentStep(1);
        setProgress(null);
        setFaithJourney(null);
        setPersonalization(null);
        return;
      }

      setIsOnboardingRequired(false);
      setIsOnboardingCompleted(false);
      setProgress(null);
      setFaithJourney(null);
      setPersonalization(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if user has existing onboarding data
      const existingProgress = await onboardingService.getOnboardingProgress(user.id);

      if (existingProgress) {
        // User has existing data, load it
        const [progressData, faithData, personalizationData] = await Promise.all([
          onboardingService.getOnboardingProgress(user.id),
          onboardingService.getFaithJourneyProfile(user.id),
          onboardingService.getPersonalizationProfile(user.id),
        ]);

        setProgress(progressData);
        setFaithJourney(faithData);
        setPersonalization(personalizationData);

        if (progressData) {
          setCurrentStep(progressData.current_step);
          setIsOnboardingCompleted(progressData.is_completed);
          setIsOnboardingRequired(!progressData.is_completed);
        }
      } else {
        // Initialize onboarding for new user
        await onboardingService.initializeOnboarding(user.id);
        setIsOnboardingRequired(true);
        setIsOnboardingCompleted(false);

        // Load the newly initialized data
        const [progressData, faithData, personalizationData] = await Promise.all([
          onboardingService.getOnboardingProgress(user.id),
          onboardingService.getFaithJourneyProfile(user.id),
          onboardingService.getPersonalizationProfile(user.id),
        ]);

        setProgress(progressData);
        setFaithJourney(faithData);
        setPersonalization(personalizationData);

        if (progressData) {
          setCurrentStep(progressData.current_step);
          setIsOnboardingCompleted(progressData.is_completed);
          setIsOnboardingRequired(!progressData.is_completed);
        }
      }
    } catch (err) {
      Logger.error('[OnboardingContext] Error initializing onboarding', err as Error, {
      component: 'OnboardingContext',
    });

      // Check if this is a foreign key constraint error (deleted user)
      // Handle different error object structures
      let errorMessage = '';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = JSON.stringify(err);
        // Check nested error properties
        if ((err as any).message) {errorMessage += (err as any).message;}
        if ((err as any).details) {errorMessage += (err as any).details;}
        if ((err as any).code) {errorMessage += (err as any).code;}
      } else {
        errorMessage = String(err);
      }

      const isDeletedUserError = errorMessage.includes('foreign key constraint') ||
                                errorMessage.includes('not present in table "users"') ||
                                errorMessage.includes('23503') ||
                                errorMessage.includes('user_subscriptions') ||
                                errorMessage.includes('onboarding_progress');

      if (isDeletedUserError) {

        // Force logout to clear cached authentication data
        try {
          // Import supabase client directly to force sign out
          const { supabase } = await import('../services/supabaseClient');

          // Clear all cached data and force re-authentication
          setIsOnboardingRequired(false); // Set to false initially
          setIsOnboardingCompleted(false);
          setCurrentStep(1);
          setProgress(null);
          setFaithJourney(null);
          setPersonalization(null);
          setError(null);

          // Force sign out to clear cached user data
          await supabase.auth.signOut();

          // Note: In React Native, app state will reset on next launch
          // No need for window.location.reload() as that's web-only
        } catch (logoutError) {
          console.error('[OnboardingContext] Error during forced logout:', logoutError);
          // Even if logout fails, clear the local state
          setIsOnboardingRequired(false);
          setIsOnboardingCompleted(false);
          setProgress(null);
          setFaithJourney(null);
          setPersonalization(null);
          setError(null);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to initialize onboarding');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAuthenticated]);

  const loadOnboardingData = useCallback(async () => {
    if (!user?.id) {return;}

    try {
      // Load all onboarding data in parallel
      const [progressData, faithData, personalizationData] = await Promise.all([
        onboardingService.getOnboardingProgress(user.id),
        onboardingService.getFaithJourneyProfile(user.id),
        onboardingService.getPersonalizationProfile(user.id),
      ]);

      setProgress(progressData);
      setFaithJourney(faithData);
      setPersonalization(personalizationData);

      if (progressData) {
        setCurrentStep(progressData.current_step);
        setIsOnboardingCompleted(progressData.is_completed);
        setIsOnboardingRequired(!progressData.is_completed);
      }
    } catch (err) {
      Logger.error('[OnboardingContext] Error loading onboarding data', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to load onboarding data');
    }
  }, [user?.id]);

  // Initialize when user changes
  useEffect(() => {
    initializeOnboarding();
  }, [initializeOnboarding]);

  // =============================================
  // ACTIONS
  // =============================================

  const startOnboarding = useCallback(async () => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.initializeOnboarding(user.id);
      setIsOnboardingRequired(true);
      setIsOnboardingCompleted(false);
      setCurrentStep(1);
      await loadOnboardingData();
    } catch (err) {
      Logger.error('[OnboardingContext] Error starting onboarding', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  const updateStepProgress = useCallback(async (stepData: OnboardingStepData) => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.updateStepProgress(user.id, stepData);
      await loadOnboardingData();

      // Move to next step if completed
      if (stepData.completion_method === 'completed') {
        setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      }
    } catch (err) {
      Logger.error('[OnboardingContext] Error updating step progress', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData, totalSteps]);

  const updateFaithJourney = useCallback(async (data: Partial<FaithJourneyProfile>) => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.updateFaithJourneyProfile(user.id, data);
      await loadOnboardingData();
    } catch (err) {
      Logger.error('[OnboardingContext] Error updating faith journey', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to update faith journey');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  const updatePersonalization = useCallback(async (data: Partial<PersonalizationProfile>) => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.updatePersonalizationProfile(user.id, data);
      await loadOnboardingData();
    } catch (err) {
      Logger.error('[OnboardingContext] Error updating personalization', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to update personalization');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  const recordChristAcceptance = useCallback(async (data: ChristAcceptanceData) => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.recordChristAcceptance(user.id, data);
      await loadOnboardingData();
    } catch (err) {
      Logger.error('[OnboardingContext] Error recording Christ acceptance', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to record acceptance');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  const completeOnboarding = useCallback(async () => {
    if (!user?.id) {return;}

    setLoading(true);
    setError(null);

    try {
      await onboardingService.completeOnboarding(user.id);
      setIsOnboardingCompleted(true);
      setIsOnboardingRequired(false);
      await loadOnboardingData();
    } catch (err) {
      Logger.error('[OnboardingContext] Error completing onboarding', err as Error, {
      component: 'OnboardingContext',
    });
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  const abandonOnboarding = useCallback(async (currentStepName: string) => {
    if (!user?.id) {return;}

    try {
      await onboardingService.abandonOnboarding(user.id, currentStepName);
      // Don't reload data - user is leaving onboarding
    } catch (err) {
      Logger.error('[OnboardingContext] Error abandoning onboarding', err as Error, {
      component: 'OnboardingContext',
    });
      // Don't show error to user when abandoning
    }
  }, [user?.id]);

  const skipStep = useCallback(async (stepName: string, stepNumber: number) => {
    if (!user?.id) {return;}

    const stepData: OnboardingStepData = {
      step_name: stepName,
      step_number: stepNumber,
      data: {},
      completion_method: 'skipped' as OnboardingStepStatus,
    };

    await updateStepProgress(stepData);
  }, [user?.id, updateStepProgress]);

  const refreshOnboardingData = useCallback(async () => {
    await loadOnboardingData();
  }, [loadOnboardingData]);

  // =============================================
  // UTILITIES
  // =============================================

  const getStepProgress = useCallback((stepName: string): boolean => {
    return progress?.completed_steps.includes(stepName) || false;
  }, [progress]);

  const canSkipStep = useCallback((stepName: string): boolean => {
    // Define which steps can be skipped
    const skippableSteps = ['preferences', 'personalization', 'goals'];
    return skippableSteps.includes(stepName.toLowerCase());
  }, []);

  const initializeOnboardingForUser = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      await onboardingService.initializeOnboarding(userId);
      await loadOnboardingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize onboarding');
    } finally {
      setLoading(false);
    }
  }, [loadOnboardingData]);

  const updatePersonalizationProfile = useCallback(async (data: Partial<PersonalizationProfile>) => {
    if (!user?.id) {return;}

    try {
      setLoading(true);
      await onboardingService.updatePersonalizationProfile(user.id, data);
      await loadOnboardingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update personalization profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadOnboardingData]);

  // =============================================
  // CONTEXT VALUE
  // =============================================

  const contextValue: OnboardingContextType = {
    // State
    isOnboardingRequired,
    isOnboardingCompleted,
    currentStep,
    totalSteps,
    progress,
    faithJourney,
    personalization,
    loading,
    error,

    // Actions
    initializeOnboarding: initializeOnboardingForUser,
    startOnboarding,
    updateStepProgress,
    updateFaithJourney,
    updatePersonalization,
    updatePersonalizationProfile,
    recordChristAcceptance,
    completeOnboarding,
    abandonOnboarding,
    skipStep,

    // Utilities
    refreshOnboardingData,
    getStepProgress,
    canSkipStep,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

// =============================================
// HOOK
// =============================================

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
