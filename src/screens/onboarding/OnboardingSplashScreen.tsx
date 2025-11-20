/**
 * OnboardingSplashScreen.tsx
 * Clean splash screen with logo and loading animation
 * New Design: Simple, centered logo with loading indicator
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { supabase } from '../../services/supabaseClient';

import { Colors } from '../../theme/colors';
import { useScreenStatusBar } from '../../hooks/useScreenStatusBar';
import { logger } from '../../utils/logger';
import { onboardingService } from '../../services/onboardingService';
import { getCurrentLocation } from '../../services/calendarSyncService';

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete: _onComplete }) => {
  useScreenStatusBar('auto', Colors.hopeWhite);
  const navigation = useNavigation();
  const { user, isLoggingOut } = useAuth();
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);


  useEffect(() => {
    logger.debug('Component mounted, starting splash screen flow');
    // Reset navigation state in case this is called after login
    hasNavigatedRef.current = false;
    isMountedRef.current = true;
    isNavigatingRef.current = false;

    // Set status bar for splash
    try {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(Colors.anchorBlue);
      }
    } catch (error) {
      logger.error('Error setting status bar:', error as Error);
    }

    // Show logo instantly (removed fade-in)

    // Removed loading dots animation for a cleaner splash

    // Conditional navigation: decide based on post-auth redirect, auth + subscription status
    const navigateToCorrectScreen = async (): Promise<boolean> => {
      // Prevent concurrent navigation attempts
      if (hasNavigatedRef.current || isNavigatingRef.current) {
        logger.onboarding.navigation('Splash', 'NavigationCheck');
        return true;
      }

      // Check if component is still mounted
      if (!isMountedRef.current) {
        logger.debug('Component unmounted, aborting navigation');
        return false;
      }

      isNavigatingRef.current = true;
        logger.onboarding.navigation('Splash', 'ConditionalNavigationStart');
      logger.debug('👤 AUTH STATE:', {
        user: !!user,
        userId: user?.id,
        email: user?.email,
        userObject: user ? 'exists' : 'null',
      });

      // 0) Immediate post-auth redirect (early check)
      // IMPORTANT: Do not clear the redirect if user session isn't ready yet; we'll re-check after resolving user below.
      try {
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};
          const isLoginFlow = redirect?.is_login_flow === true;

          // CRITICAL: If this is a login flow, bypass all onboarding checks and go straight to target
          if (user && target && isLoginFlow) {
            logger.debug(`🔐 LOGIN FLOW DETECTED → Bypassing onboarding checks, navigating to ${target}`);
            try {
              navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            } catch (navErr) {
              logger.warn('reset failed, falling back to navigate:', navErr as Error);
              navigation.navigate(target as any, params);
            }
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
            hasNavigatedRef.current = true;
            return true;
          }

          const onboardingRoutes = new Set([
            'TransformJourney',
            'OnboardingPersonalization',
            'OnboardingWelcome',
          ]);

          if (user && target && onboardingRoutes.has(target)) {
            try {
              const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
              if (hasCompleted) {
        logger.onboarding.navigation('RedirectCheck', 'EarlyCheck');
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
              } else {
                logger.debug(`Honoring onboarding redirect for user still in onboarding → ${target}`, { target, params });
                try {
                  navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                } catch (navErr) {
                  logger.warn('reset failed, falling back to navigate:', navErr as Error);
                  navigation.navigate(target as any, params);
                }
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                hasNavigatedRef.current = true;
                return true;
              }
            } catch (chkErr) {
              logger.warn('Onboarding completion check failed. Proceeding to honor redirect:', chkErr as Error);
              try {
                navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
              } catch (navErr) {
                logger.warn('reset failed, falling back to navigate:', navErr as Error);
                navigation.navigate(target as any, params);
              }
            }
          } else if (user && target) {
            logger.debug(`Found post_auth_redirect → navigating immediately to ${target}`);
            try {
              navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            } catch (navErr) {
              logger.warn('reset failed, falling back to navigate:', navErr as Error);
              navigation.navigate(target as any, params);
            }
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
            hasNavigatedRef.current = true;
            return true;
          } else {
            // If user is not yet available, keep the redirect key for the later check after session resolves.
            logger.debug('Redirect present but user not ready yet. Will re-check after session resolution.');
          }
        }
      } catch (e) {
        logger.warn('Error reading post_auth_redirect:', e as Error);
      }

      // Not authenticated → re-check session quickly to avoid race after login
      let effectiveUser = user as any;
      logger.debug('🔍 INITIAL USER CHECK:', {
        hasUser: !!effectiveUser,
        userId: effectiveUser?.id,
        email: effectiveUser?.email,
        userObject: effectiveUser ? 'exists' : 'null',
      });

      if (!effectiveUser) {
        logger.debug('⏳ NO USER - Rechecking session with retry logic...');

        // Try multiple times with delays to handle auth state propagation timing
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logger.debug(`Session check attempt ${attempt}/3`);
            const { data: { session } } = await supabase.auth.getSession();
            logger.debug('📋 SESSION RECHECK RESULT:', {
              attempt,
              hasSession: !!session,
              hasUser: !!session?.user,
              userId: session?.user?.id,
              email: session?.user?.email,
              sessionObject: session ? JSON.stringify(session, null, 2) : 'null',
            });

            if (session?.user) {
              effectiveUser = session.user;
        logger.onboarding.navigation('SessionRecheck', 'NoUserFound');
              break;
            }

            // Wait before next attempt (except on last attempt)
            if (attempt < 3) {
              logger.debug(`⏳ Waiting 1s before attempt ${attempt + 1}...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (sessErr) {
            logger.error(`Session recheck attempt ${attempt} failed`, sessErr as Error, { attempt });
          }
        }
      }

      // Re-check redirect AFTER resolving effective user so we can honor it reliably post-signup
      try {
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};
          const isLoginFlow = redirect?.is_login_flow === true;

          // CRITICAL: If this is a login flow, bypass all onboarding checks and go straight to target
          if (effectiveUser && target && isLoginFlow) {
            logger.debug(`🔐 LOGIN FLOW DETECTED (post-user) → Bypassing onboarding checks, navigating to ${target}`);
            try {
              navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            } catch (navErr) {
              logger.warn('reset failed, falling back to navigate:', navErr as Error);
              navigation.navigate(target as any, params);
            }
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
            hasNavigatedRef.current = true;
            return true;
          }

          const onboardingRoutes = new Set([
            'TransformJourney',
            'OnboardingPersonalization',
            'OnboardingWelcome',
          ]);

          if (effectiveUser && target) {
            if (onboardingRoutes.has(target)) {
              try {
              const hasCompleted = await onboardingService.hasCompletedOnboarding(effectiveUser.id);
                if (hasCompleted) {
        logger.onboarding.navigation('RedirectCheck', 'PostUserCheck');
                  try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                } else {
                  logger.debug(`(post-user) Honoring onboarding redirect → ${target}`, { target, params });
                  try {
                    navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                  } catch (navErr) {
                    logger.warn(`reset failed, falling back to navigate: ${(navErr as any)?.message || 'Unknown error'}`);
                    navigation.navigate(target as any, params);
                  }
                  try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                  hasNavigatedRef.current = true;
                  return true;
                }
              } catch (chkErr) {
                logger.warn('(post-user) Onboarding check failed. Proceeding to honor redirect:', chkErr as Error);
                try {
                  navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                } catch (navErr) {
                  logger.warn('reset failed, falling back to navigate:', navErr as Error);
                  navigation.navigate(target as any, params);
                }
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                hasNavigatedRef.current = true;
                return true;
              }
            } else {
              logger.debug(`(post-user) Redirect to non-onboarding route → ${target}`);
              try {
                navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
              } catch (navErr) {
                logger.warn('reset failed, falling back to navigate:', navErr as Error);
                navigation.navigate(target as any, params);
              }
              try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
              hasNavigatedRef.current = true;
              return true;
            }
          }
        }
              } catch (e) {
        logger.warn('Error re-reading post_auth_redirect:', e as Error);
      }

      // FLOW 1: No detected user → Splash > TransformJourney > Welcome
      if (!effectiveUser) {
        const target = 'TransformJourney';
        logger.debug('🚫 NO USER DETECTED → ROUTING TO', { target });
        logger.debug('📋 FLOW: Splash > TransformJourney > Welcome');
        try {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        } catch (e) {
          navigation.navigate(target as any);
        }
        hasNavigatedRef.current = true;
        return true;
      }

      // FLOW 2 & 3: Detected user → Check onboarding completion
      logger.debug('🔍 AUTHENTICATED USER DETECTED:', {
        userId: effectiveUser.id,
        email: effectiveUser.email,
      });

      // Check if this is a logout scenario - if so, route to welcome instead of personalization
      if (isLoggingOut) {
        logger.debug('🚪 LOGOUT DETECTED - Routing to welcome screen');
        const target = 'OnboardingWelcome';
        navigation.reset({ index: 0, routes: [{ name: target as any }] });
        hasNavigatedRef.current = true;
        return true;
      }

      try {
        logger.debug('📋 Checking onboarding completion for user:', effectiveUser.id);
        logger.debug('👤 User details:', {
          id: effectiveUser.id,
          email: effectiveUser.email,
          created_at: effectiveUser.created_at,
          provider: (effectiveUser as any)?.app_metadata?.provider,
          identities: (effectiveUser as any)?.identities,
          app_metadata: (effectiveUser as any)?.app_metadata,
          user_metadata: (effectiveUser as any)?.user_metadata,
        });

        const hasCompleted = await onboardingService.hasCompletedOnboarding(effectiveUser.id);

        logger.onboarding.navigation('CompletionCheck', 'Result', { decision: hasCompleted ? 'MainTabs' : 'OnboardingPersonalization' });

        // Additional debug: Check both database sources directly
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('id', effectiveUser.id)
            .single();
          logger.debug('🔍 Direct user_profiles check:', profile ? { profile } : { status: 'No profile found' });
        } catch (e) {
          logger.debug('❌ Direct user_profiles check failed:', e as Error);
        }

        if (hasCompleted) {
          // FLOW 3: Detected user finished onboarding → Splash > Home/Dashboard
          const target = 'MainTabs';
        logger.onboarding.navigation('Splash', 'MainTabsRoute');
          logger.debug('📋 FLOW: Splash > Home/Dashboard');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any }] });
          } catch (navErr) {
            navigation.navigate(target as any);
          }
          hasNavigatedRef.current = true;
          return true;
        }

        // FLOW 2: Detected user but did not finish onboarding → Show tutorial first
        logger.debug('🎯 USER HAS NOT COMPLETED ONBOARDING - Showing tutorial first');

        // Check if this is a fresh account creation vs returning incomplete user
        const isNewUser = Date.now() - new Date(effectiveUser.created_at).getTime() < 5 * 60 * 1000; // 5 minutes

        if (isNewUser) {
          // Fresh account creation → go to personalization directly (skip tutorial for very new users)
          const target = 'OnboardingPersonalization';

          // More robust provider detection for Apple login users
          let provider = (effectiveUser as any)?.app_metadata?.provider as string | undefined;
          if (!provider && (effectiveUser as any)?.identities) {
            // Check identities array for provider info
            const identities = (effectiveUser as any).identities;
            if (Array.isArray(identities) && identities.length > 0) {
              provider = identities[0]?.provider;
            }
          }

          const isOAuth = provider === 'apple' || provider === 'google';

          logger.debug('Provider detection:', {
            app_metadata_provider: (effectiveUser as any)?.app_metadata?.provider,
            identities_provider: (effectiveUser as any)?.identities?.[0]?.provider,
            final_provider: provider,
            isOAuth,
          });

          // Determine display name based on provider
          let displayName = '';
          if (provider === 'apple') {
            // For Apple users, always force name collection to avoid private relay names
            displayName = '';
            logger.debug('Apple user - forcing name collection:', {
              reason: 'Avoiding random/private relay names from Apple',
            });
          } else if (provider === 'google') {
            // For Google users, use the Google-provided name from user_metadata
            // This was saved during Google sign-in
            displayName = effectiveUser.user_metadata?.first_name || effectiveUser.user_metadata?.full_name || '';
            logger.debug('Google user - using Google-provided name:', {
              first_name: effectiveUser.user_metadata?.first_name,
              full_name: effectiveUser.user_metadata?.full_name,
            });
          } else {
            // For email users, use first name or email prefix
            displayName = effectiveUser.user_metadata?.first_name || effectiveUser.email?.split('@')[0] || '';
          }

          const params = {
            name: displayName,
            registrationMethod: isOAuth ? 'oauth' : 'email',
          };

          try {
            await getCurrentLocation();
          } catch (locationError) {
            logger.warn('Location warmup before personalization failed', locationError as Error);
          }

          logger.debug('👋 NEW USER - ROUTING TO PERSONALIZATION');
          logger.debug('📋 FLOW: Splash > Personalization (new account)');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
          } catch (navErr) {
            navigation.navigate(target as any, params);
          }
          hasNavigatedRef.current = true;
          return true;
        } else {
          // Returning user with incomplete onboarding → show tutorial first
          logger.debug('🔄 RETURNING INCOMPLETE USER - Showing tutorial before personalization');

          // Show tutorial for existing users who haven't completed onboarding
          const target = 'TransformJourney';
          logger.onboarding.stepCompleted('🎬 ROUTING TO TUTORIAL - Show value proposition');
          logger.debug('📋 FLOW: Splash > TransformJourney > Welcome > Personalization');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any }] });
          } catch (navErr) {
            navigation.navigate(target as any);
          }
          hasNavigatedRef.current = true;
          return true;
        }
      } catch (obErr) {
        logger.warn('❌ ONBOARDING CHECK FAILED. Applying safer fallback based on auth state:', obErr as Error);
        // If we have an authenticated user, prefer going straight to Personalization rather than Welcome
        try {
          const target = effectiveUser ? 'TransformJourney' : 'OnboardingWelcome';

          // More robust provider detection for Apple login users
          let provider = (effectiveUser as any)?.app_metadata?.provider as string | undefined;
          if (!provider && (effectiveUser as any)?.identities) {
            // Check identities array for provider info
            const identities = (effectiveUser as any).identities;
            if (Array.isArray(identities) && identities.length > 0) {
              provider = identities[0]?.provider;
            }
          }

          const isOAuth = provider === 'apple' || provider === 'google';

          logger.debug('Provider detection (fallback):', {
            app_metadata_provider: (effectiveUser as any)?.app_metadata?.provider,
            identities_provider: (effectiveUser as any)?.identities?.[0]?.provider,
            final_provider: provider,
            isOAuth,
          });

          // For OAuth users, always force name collection to avoid random Apple names
          let displayName = '';
          if (effectiveUser) {
            if (isOAuth) {
              // For Apple/Google users, always start with empty name to force collection
              // This prevents random Apple-generated names like "pzgttqhzgh"
              displayName = '';
            } else {
              // For email users, use first name or email prefix
              displayName = effectiveUser.user_metadata?.first_name || effectiveUser.email?.split('@')[0] || '';
            }
          }

          const params = effectiveUser
            ? { name: displayName, registrationMethod: isOAuth ? 'oauth' : 'email' }
            : undefined;
          logger.debug('🛟 Fallback routing to', { target, params: params || {} });
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
          } catch (navErr) {
            logger.warn('reset failed during fallback, falling back to navigate:', navErr as Error);
            navigation.navigate(target as any, params as any);
          }
        } catch (finalNavErr) {
          logger.warn('Final fallback navigation error:', finalNavErr as Error);
        }
        hasNavigatedRef.current = true;
        return true;
      }


    };

    // Always show splash screen for minimum time before making routing decisions
    // Set a longer minimum splash display time to allow auth state propagation after sign-in
    navigationTimeoutRef.current = setTimeout(async () => {
      // Check if component is still mounted before proceeding
      if (!isMountedRef.current) {
        logger.debug('Component unmounted during timeout, aborting navigation');
        return;
      }
      logger.debug('⏰ Minimum splash time elapsed, making routing decision...');
      try {
        const redirected = await navigateToCorrectScreen();
        logger.onboarding.navigation('NavigationTimeout', 'Result', { redirected });

        if (!redirected) {
          logger.warn('⚠️ Navigation failed, falling back to welcome screen');
          // Fallback to welcome screen if all else fails
          navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' as any }] });
          hasNavigatedRef.current = true;
        }
      } catch (error) {
        logger.error('❌ Navigation error:', error as Error);
        // Emergency fallback
        navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' as any }] });
        hasNavigatedRef.current = true;
      }
    }, 2000); // Increased from 500ms to 2000ms to allow auth state to propagate

    // Cleanup function for timeout and refs
    return () => {
      logger.debug('Cleaning up animations and navigation timeout');
      isMountedRef.current = false;
      isNavigatingRef.current = false;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, user]); // isLoggingOut intentionally excluded - checked within effect

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Image
          source={require('../../../assets/icons/siFiaTransparent.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
    overflow: 'hidden',
  },
});

export default withErrorBoundary(OnboardingSplashScreen, 'OnboardingSplashScreen');
