/**
 * OnboardingSplashScreen.tsx
 * Clean splash screen with logo and loading animation
 * New Design: Simple, centered logo with loading indicator
 */

import React, { useEffect, useRef, useCallback } from 'react';
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
import { supabase } from '../../services/supabaseClient';

import { OnboardingService } from '../../services/onboardingService';

import { Colors } from '../../theme/colors';

// Dimensions not needed here

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete: _onComplete }) => {
  const navigation = useNavigation();
  const { user, isLoggingOut } = useAuth();
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);


  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting splash screen flow');
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
      console.error('[SplashScreen] Error setting status bar:', error);
    }

    // Show logo instantly (removed fade-in)

    // Removed loading dots animation for a cleaner splash

    // Conditional navigation: decide based on post-auth redirect, auth + subscription status
    const navigateToCorrectScreen = async (): Promise<boolean> => {
      // Prevent concurrent navigation attempts
      if (hasNavigatedRef.current || isNavigatingRef.current) {
        console.log('[SplashScreen] Navigation already in progress or completed, skipping');
        return true;
      }
      
      // Check if component is still mounted
      if (!isMountedRef.current) {
        console.log('[SplashScreen] Component unmounted, aborting navigation');
        return false;
      }
      
      isNavigatingRef.current = true;
      console.log('[SplashScreen] 🚀 STARTING CONDITIONAL NAVIGATION LOGIC');
      console.log('[SplashScreen] 👤 AUTH STATE:', {
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

          const onboardingRoutes = new Set([
            'TransformJourney',
            'OnboardingPersonalization',
            'OnboardingWelcome',
          ]);

          if (user && target && onboardingRoutes.has(target)) {
            try {
              const onboardingService = new OnboardingService();
              const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
              if (hasCompleted) {
                console.log('[SplashScreen] Ignoring stale onboarding redirect for completed user. Clearing key.');
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
              } else {
                console.log('[SplashScreen] Honoring onboarding redirect for user still in onboarding →', target, params);
                try {
                  navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                } catch (navErr) {
                  console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
                  navigation.navigate(target as any, params);
                }
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                hasNavigatedRef.current = true;
                return true;
              }
            } catch (chkErr) {
              console.warn('[SplashScreen] Onboarding completion check failed. Proceeding to honor redirect:', chkErr);
              try {
                navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
              } catch (navErr) {
                console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
                navigation.navigate(target as any, params);
              }
            }
          } else if (user && target) {
            console.log('[SplashScreen] Found post_auth_redirect → navigating immediately to', target, params);
            try {
              navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            } catch (navErr) {
              console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
              navigation.navigate(target as any, params);
            }
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
            hasNavigatedRef.current = true;
            return true;
          } else {
            // If user is not yet available, keep the redirect key for the later check after session resolves.
            console.log('[SplashScreen] Redirect present but user not ready yet. Will re-check after session resolution.');
          }
        }
      } catch (e) {
        console.warn('[SplashScreen] Error reading post_auth_redirect:', e);
      }

      // Not authenticated → re-check session quickly to avoid race after login
      let effectiveUser = user as any;
      console.log('[SplashScreen] 🔍 INITIAL USER CHECK:', {
        hasUser: !!effectiveUser,
        userId: effectiveUser?.id,
        email: effectiveUser?.email,
        userObject: effectiveUser ? JSON.stringify(effectiveUser, null, 2) : 'null',
      });

      if (!effectiveUser) {
        console.log('[SplashScreen] ⏳ NO USER - Rechecking session with retry logic...');

        // Try multiple times with delays to handle auth state propagation timing
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`[SplashScreen] 🔄 Session check attempt ${attempt}/3`);
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[SplashScreen] 📋 SESSION RECHECK RESULT:', {
              attempt,
              hasSession: !!session,
              hasUser: !!session?.user,
              userId: session?.user?.id,
              email: session?.user?.email,
              sessionObject: session ? JSON.stringify(session, null, 2) : 'null',
            });

            if (session?.user) {
              effectiveUser = session.user;
              console.log('[SplashScreen] ✅ Found session user on recheck, proceeding as authenticated');
              break;
            }

            // Wait before next attempt (except on last attempt)
            if (attempt < 3) {
              console.log(`[SplashScreen] ⏳ Waiting 1s before attempt ${attempt + 1}...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (sessErr) {
            console.warn(`[SplashScreen] ❌ Session recheck attempt ${attempt} failed:`, sessErr);
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
          const onboardingRoutes = new Set([
            'TransformJourney',
            'OnboardingPersonalization',
            'OnboardingWelcome',
          ]);

          if (effectiveUser && target) {
            if (onboardingRoutes.has(target)) {
              try {
                const onboardingService = new OnboardingService();
                const hasCompleted = await onboardingService.hasCompletedOnboarding(effectiveUser.id);
                if (hasCompleted) {
                  console.log('[SplashScreen] (post-user) Ignoring stale onboarding redirect for completed user. Clearing key.');
                  try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                } else {
                  console.log('[SplashScreen] (post-user) Honoring onboarding redirect →', target, params);
                  try {
                    navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                  } catch (navErr) {
                    console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
                    navigation.navigate(target as any, params);
                  }
                  try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                  hasNavigatedRef.current = true;
                  return true;
                }
              } catch (chkErr) {
                console.warn('[SplashScreen] (post-user) Onboarding check failed. Proceeding to honor redirect:', chkErr);
                try {
                  navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
                } catch (navErr) {
                  console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
                  navigation.navigate(target as any, params);
                }
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                hasNavigatedRef.current = true;
                return true;
              }
            } else {
              console.log('[SplashScreen] (post-user) Redirect to non-onboarding route →', target);
              try {
                navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
              } catch (navErr) {
                console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
                navigation.navigate(target as any, params);
              }
              try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
              hasNavigatedRef.current = true;
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('[SplashScreen] Error re-reading post_auth_redirect:', e);
      }

      // FLOW 1: No detected user → Splash > TransformJourney > Welcome
      if (!effectiveUser) {
        const target = 'TransformJourney';
        console.log('[SplashScreen] 🚫 NO USER DETECTED → ROUTING TO', target);
        console.log('[SplashScreen] 📋 FLOW: Splash > TransformJourney > Welcome');
        try {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        } catch (e) {
          navigation.navigate(target as any);
        }
        hasNavigatedRef.current = true;
        return true;
      }

      // FLOW 2 & 3: Detected user → Check onboarding completion
      console.log('[SplashScreen] 🔍 AUTHENTICATED USER DETECTED:', {
        userId: effectiveUser.id,
        email: effectiveUser.email,
      });

      // Check if this is a logout scenario - if so, route to welcome instead of personalization
      if (isLoggingOut) {
        console.log('[SplashScreen] 🚪 LOGOUT DETECTED - Routing to welcome screen');
        const target = 'OnboardingWelcome';
        navigation.reset({ index: 0, routes: [{ name: target as any }] });
        hasNavigatedRef.current = true;
        return true;
      }

      try {
        const onboardingService = new OnboardingService();
        console.log('[SplashScreen] 📋 Checking onboarding completion for user:', effectiveUser.id);
        console.log('[SplashScreen] 👤 User details:', {
          id: effectiveUser.id,
          email: effectiveUser.email,
          created_at: effectiveUser.created_at,
          provider: (effectiveUser as any)?.app_metadata?.provider,
          identities: (effectiveUser as any)?.identities,
          app_metadata: (effectiveUser as any)?.app_metadata,
          user_metadata: (effectiveUser as any)?.user_metadata,
        });

        const hasCompleted = await onboardingService.hasCompletedOnboarding(effectiveUser.id);

        console.log('[SplashScreen] ✅ COMPLETION CHECK RESULT:', {
          userId: effectiveUser.id,
          hasCompleted,
          decision: hasCompleted ? 'MainTabs' : 'OnboardingPersonalization',
        });

        // Additional debug: Check both database sources directly
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('id', effectiveUser.id)
            .single();
          console.log('[SplashScreen] 🔍 Direct user_profiles check:', profile);
        } catch (e) {
          console.log('[SplashScreen] ❌ Direct user_profiles check failed:', e);
        }

        if (hasCompleted) {
          // FLOW 3: Detected user finished onboarding → Splash > Home/Dashboard
          const target = 'MainTabs';
          console.log('[SplashScreen] 🏠 ROUTING TO MAIN TABS - Onboarding completed');
          console.log('[SplashScreen] 📋 FLOW: Splash > Home/Dashboard');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any }] });
          } catch (navErr) {
            navigation.navigate(target as any);
          }
          hasNavigatedRef.current = true;
          return true;
        }

        // FLOW 2: Detected user but did not finish onboarding
        // Check if this is a fresh account creation vs returning incomplete user
        const isNewUser = Date.now() - new Date(effectiveUser.created_at).getTime() < 5 * 60 * 1000; // 5 minutes

        if (isNewUser) {
          // Fresh account creation → go to personalization
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

          console.log('[SplashScreen] Provider detection:', {
            app_metadata_provider: (effectiveUser as any)?.app_metadata?.provider,
            identities_provider: (effectiveUser as any)?.identities?.[0]?.provider,
            final_provider: provider,
            isOAuth,
          });

          // For OAuth users, always force name collection to avoid random Apple names
          let displayName = '';
          if (isOAuth) {
            // For Apple/Google users, always start with empty name to force collection
            // This prevents random Apple-generated names like "pzgttqhzgh"
            displayName = '';
            console.log('[SplashScreen] OAuth user - forcing name collection:', {
              provider,
              reason: 'Avoiding random/private relay names from Apple',
            });
          } else {
            // For email users, use first name or email prefix
            displayName = effectiveUser.user_metadata?.first_name || effectiveUser.email?.split('@')[0] || '';
          }

          const params = {
            name: displayName,
            registrationMethod: isOAuth ? 'oauth' : 'email',
          };
          console.log('[SplashScreen] 👋 NEW USER - ROUTING TO PERSONALIZATION');
          console.log('[SplashScreen] 📋 FLOW: Splash > Personalization (new account)');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
          } catch (navErr) {
            navigation.navigate(target as any, params);
          }
          hasNavigatedRef.current = true;
          return true;
        } else {
          // Returning user with incomplete onboarding → route to personalization
          console.log('[SplashScreen] 🔄 RETURNING INCOMPLETE USER - Routing to personalization');

          // Default: route to personalization
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

          console.log('[SplashScreen] Provider detection (returning user):', {
            app_metadata_provider: (effectiveUser as any)?.app_metadata?.provider,
            identities_provider: (effectiveUser as any)?.identities?.[0]?.provider,
            final_provider: provider,
            isOAuth,
          });

          // For OAuth users, always force name collection to avoid random Apple names (including on app reload)
          let displayName = '';
          if (isOAuth) {
            // For Apple/Google users, always start with empty name to force collection
            // This prevents random Apple-generated names like "aoigeaoirg" on app reload
            displayName = '';
            console.log('[SplashScreen] Returning OAuth user - forcing name collection on reload:', {
              provider,
              reason: 'Avoiding random/private relay names from Apple on app reload',
            });
          } else {
            // For email users, use first name or email prefix
            displayName = effectiveUser.user_metadata?.first_name || effectiveUser.email?.split('@')[0] || '';
          }

          const params = {
            name: displayName,
            registrationMethod: isOAuth ? 'oauth' : 'email',
          };
          console.log('[SplashScreen] 👋 ROUTING TO PERSONALIZATION - Onboarding not completed');
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
          } catch (navErr) {
            navigation.navigate(target as any, params);
          }
          hasNavigatedRef.current = true;
          return true;
        }
      } catch (obErr) {
        console.warn('[SplashScreen] ❌ ONBOARDING CHECK FAILED. Applying safer fallback based on auth state:', obErr);
        // If we have an authenticated user, prefer going straight to Personalization rather than Welcome
        try {
          const target = effectiveUser ? 'OnboardingPersonalization' : 'OnboardingWelcome';

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

          console.log('[SplashScreen] Provider detection (fallback):', {
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
          console.log('[SplashScreen] 🛟 Fallback routing to', target, params || {});
          try {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
          } catch (navErr) {
            console.warn('[SplashScreen] reset failed during fallback, falling back to navigate:', navErr);
            navigation.navigate(target as any, params as any);
          }
        } catch (finalNavErr) {
          console.warn('[SplashScreen] Final fallback navigation error:', finalNavErr);
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
        console.log('[SplashScreen] Component unmounted during timeout, aborting navigation');
        return;
      }
      console.log('[SplashScreen] ⏰ Minimum splash time elapsed, making routing decision...');
      try {
        const redirected = await navigateToCorrectScreen();
        console.log('[SplashScreen] 📊 Navigation result:', { redirected });

        if (!redirected) {
          console.log('[SplashScreen] ⚠️ Navigation failed, falling back to welcome screen');
          // Fallback to welcome screen if all else fails
          navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' as any }] });
          hasNavigatedRef.current = true;
        }
      } catch (error) {
        console.error('[SplashScreen] ❌ Navigation error:', error);
        // Emergency fallback
        navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' as any }] });
        hasNavigatedRef.current = true;
      }
    }, 2000); // Increased from 500ms to 2000ms to allow auth state to propagate

    // Cleanup function for timeout and refs
    return () => {
      console.log('[SplashScreen] Cleaning up animations and navigation timeout');
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
    width: 200,
    height: 200,
    overflow: 'hidden',
  },
});

export default OnboardingSplashScreen;
