/**
 * Enhanced Onboarding Integration Component
 * Automatically triggers onboarding for testing and user experience
 * Handles logout-to-onboarding flow for comprehensive testing
 * Phase 3: Context Integration + Testing Enhancement
 */

import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useOnboarding } from '../../context/OnboardingContext';

type NavigationProp = any;

interface OnboardingIntegrationProps {
  children: React.ReactNode;
}

export const OnboardingIntegration: React.FC<OnboardingIntegrationProps> = ({ children }) => {
  const navigation = useNavigation<NavigationProp>();
  const { user, isAuthenticated } = useAuth();
  const {
    isOnboardingRequired,
    isOnboardingCompleted,
    currentStep,
    loading: onboardingLoading,
    // refreshOnboardingData: _refreshOnboardingData,
  } = useOnboarding();

  // Track previous auth state for logout detection
  const prevAuthState = useRef(isAuthenticated);
  const hasJustLoggedOut = useRef(false);

  const isIntegrationReady = isAuthenticated !== undefined && !onboardingLoading;
  const shouldShowOnboarding = isAuthenticated && (isOnboardingRequired || !isOnboardingCompleted || hasJustLoggedOut.current);

  /**
   * Logout Detection Effect
   * Detects when user logs out and prepares for onboarding trigger
   */
  useEffect(() => {
    if (prevAuthState.current === true && isAuthenticated === false) {
      // User just logged out - prepare to show onboarding on next login
      hasJustLoggedOut.current = true;
      console.log('🔄 User logged out - onboarding will be triggered on next login');
    } else if (prevAuthState.current === false && isAuthenticated === true && hasJustLoggedOut.current) {
      // User just logged back in after logout - trigger onboarding
      console.log('🚀 User logged in after logout - triggering onboarding');
      setTimeout(() => {
        navigation.navigate('ModernOnboarding' as any);
        hasJustLoggedOut.current = false;
      }, 500); // Small delay to ensure navigation is ready
    }

    prevAuthState.current = isAuthenticated;
  }, [isAuthenticated, navigation]);

  /**
   * Enhanced Navigation Effect
   * Handles onboarding navigation with improved testing support
   */
  useEffect(() => {
    if (!isIntegrationReady || onboardingLoading) {
      return;
    }

    if (shouldShowOnboarding && !hasJustLoggedOut.current) {
      console.log('🎯 Triggering onboarding flow:', {
        isOnboardingRequired,
        isOnboardingCompleted,
        currentStep,
        userHasAccount: !!user,
      });

      // Navigate to the new modern onboarding flow
      // This replaces the old multi-screen approach with a unified, engaging experience
      navigation.navigate('ModernOnboarding' as any);
    }
  }, [
    isIntegrationReady,
    shouldShowOnboarding,
    currentStep,
    onboardingLoading,
    navigation,
    isOnboardingRequired,
    isOnboardingCompleted,
    user,
  ]);

  /**
   * Development Testing Helper
   * Logs onboarding state for debugging
   */
  useEffect(() => {
    if (__DEV__ && isIntegrationReady) {
      console.log('📊 Onboarding Integration State:', {
        isAuthenticated,
        isOnboardingRequired,
        isOnboardingCompleted,
        currentStep,
        shouldShowOnboarding,
        hasJustLoggedOut: hasJustLoggedOut.current,
        userId: user?.id,
      });
    }
  }, [isAuthenticated, isOnboardingRequired, isOnboardingCompleted, currentStep, shouldShowOnboarding, user, isIntegrationReady]);

  return (
    <>
      {children}
      {/* Development Testing Indicator */}
      {__DEV__ && shouldShowOnboarding && (
        <>
          {/* This will be visible in dev mode to indicate onboarding should trigger */}
        </>
      )}
    </>
  );
};

/**
 * Testing Utilities for Onboarding Integration
 * Available in development mode only
 */
export const OnboardingTestingUtils = {
  /**
   * Force trigger onboarding by simulating logout/login cycle
   */
  triggerOnboardingTest: async (navigation: any, refreshOnboardingData: () => Promise<void>) => {
    if (!__DEV__) {
      console.warn('OnboardingTestingUtils only available in development mode');
      return;
    }

    console.log('🧪 Triggering onboarding test flow...');

    // Refresh onboarding data to reset state
    await refreshOnboardingData();

    // Navigate to onboarding
    setTimeout(() => {
      navigation.navigate('ModernOnboarding');
    }, 100);
  },

  /**
   * Log current onboarding state for debugging
   */
  logOnboardingState: (context: any) => {
    if (!__DEV__) {return;}

    console.log('🔍 Current Onboarding State:', {
      isOnboardingRequired: context.isOnboardingRequired,
      isOnboardingCompleted: context.isOnboardingCompleted,
      currentStep: context.currentStep,
      loading: context.loading,
      error: context.error,
    });
  },
};

/**
 * Higher-Order Component for Enhanced Onboarding Integration
 * Includes automatic testing triggers and logout detection
 */
export const withOnboardingIntegration = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <OnboardingIntegration>
      <Component {...props} />
    </OnboardingIntegration>
  );
};

/**
 * Hook for accessing onboarding testing utilities
 * Development mode only
 */
export const useOnboardingTesting = () => {
  const navigation = useNavigation();
  const { refreshOnboardingData } = useOnboarding();

  return {
    triggerOnboardingTest: () => OnboardingTestingUtils.triggerOnboardingTest(navigation, refreshOnboardingData),
    logOnboardingState: (context: any) => OnboardingTestingUtils.logOnboardingState(context),
  };
};
