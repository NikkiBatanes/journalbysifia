/**
 * Enhanced Onboarding Integration Component
 * Automatically triggers onboarding for testing and user experience
 * Handles logout-to-onboarding flow for comprehensive testing
 * Phase 3: Context Integration + Testing Enhancement
 */

import React, { useEffect, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
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
  // Allow onboarding for both authenticated and unauthenticated users for testing
  const shouldShowOnboarding = (isAuthenticated && (isOnboardingRequired || !isOnboardingCompleted)) || hasJustLoggedOut.current || (__DEV__ && !isAuthenticated);

  /**
   * Logout Detection Effect
   * Detects when user logs out and prepares for onboarding trigger
   */
  useEffect(() => {
    if (prevAuthState.current === true && isAuthenticated === false) {
      // User just logged out - prepare to show onboarding on next login
      hasJustLoggedOut.current = true;

    } else if (prevAuthState.current === false && isAuthenticated === true && hasJustLoggedOut.current) {
      // User just logged back in after logout - trigger onboarding

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

      // Always start from splash screen for consistent user experience
      setTimeout(() => {

        navigation.navigate('OnboardingSplash' as any);
      }, 100);
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
    isAuthenticated,
  ]);

  /**
   * Development Testing Helper
   * Logs onboarding state for debugging
   */
  useEffect(() => {
    if (__DEV__ && isIntegrationReady) {

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
      Logger.warn('OnboardingTestingUtils only available in development mode', { component: 'OnboardingIntegration' });
      return;
    }

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
  logOnboardingState: () => {
    if (!__DEV__) {return;}

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
    logOnboardingState: () => OnboardingTestingUtils.logOnboardingState(),
  };
};
