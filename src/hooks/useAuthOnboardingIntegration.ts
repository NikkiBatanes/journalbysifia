/**
 * Auth Onboarding Integration Hook
 * Connects onboarding trigger to new user registration
 * Phase 3: Auth Integration
 */

import { useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { databaseIntegrationService } from '../services/databaseIntegrationService';

export interface AuthOnboardingIntegrationOptions {
  autoStartOnboarding?: boolean;
  skipOnboardingForExistingUsers?: boolean;
  validateSchemaOnMount?: boolean;
}

export const useAuthOnboardingIntegration = (
  options: AuthOnboardingIntegrationOptions = {}
) => {
  const {
    autoStartOnboarding = true,
    skipOnboardingForExistingUsers = true,
    validateSchemaOnMount = true,
  } = options;

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const {
    isOnboardingRequired,
    isOnboardingCompleted,
    startOnboarding,
    refreshOnboardingData,
    loading: onboardingLoading,
  } = useOnboarding();

  /**
   * Handle new user registration
   */
  const handleNewUserRegistration = useCallback(async () => {
    if (!user?.id || !isAuthenticated || authLoading || onboardingLoading) {
      return;
    }

    try {
      // Check if this is a new user (created recently)
      const userCreatedAt = new Date(user.created_at || user.email_confirmed_at || Date.now());
      const now = new Date();
      const timeDifference = now.getTime() - userCreatedAt.getTime();
      const isNewUser = timeDifference < (5 * 60 * 1000); // 5 minutes threshold

      if (isNewUser || (!skipOnboardingForExistingUsers && !isOnboardingCompleted)) {
        // Refresh onboarding data to check current status
        await refreshOnboardingData();

        // Start onboarding if required and auto-start is enabled
        if (autoStartOnboarding && isOnboardingRequired && !isOnboardingCompleted) {
          await startOnboarding();
        }
      }
    } catch (error) {
      console.error('Error handling new user registration:', error);
    }
  }, [
    user,
    isAuthenticated,
    authLoading,
    onboardingLoading,
    isOnboardingRequired,
    isOnboardingCompleted,
    autoStartOnboarding,
    skipOnboardingForExistingUsers,
    startOnboarding,
    refreshOnboardingData,
  ]);

  /**
   * Validate database schema on mount
   */
  const validateSchema = useCallback(async () => {
    if (!validateSchemaOnMount) {return;}

    try {
      const validation = await databaseIntegrationService.validateOnboardingSchema();

      if (!validation.isValid) {
        console.warn('Onboarding schema validation failed:', {
          missingTables: validation.missingTables,
          missingFunctions: validation.missingFunctions,
          missingEnums: validation.missingEnums,
          errors: validation.errors,
        });
      } else {
        console.log('Onboarding schema validation passed');
      }
    } catch (error) {
      console.error('Schema validation error:', error);
    }
  }, [validateSchemaOnMount]);

  /**
   * Monitor auth state changes
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      handleNewUserRegistration();
    }
  }, [isAuthenticated, user, handleNewUserRegistration]);

  /**
   * Validate schema on component mount
   */
  useEffect(() => {
    validateSchema();
  }, [validateSchema]);

  return {
    isIntegrationReady: isAuthenticated && !authLoading && !onboardingLoading,
    shouldShowOnboarding: isOnboardingRequired && !isOnboardingCompleted,
    handleNewUserRegistration,
    validateSchema,
  };
};
