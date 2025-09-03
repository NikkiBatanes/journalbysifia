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
import { supabase } from '../../services/supabaseClient';

import { OnboardingService } from '../../services/onboardingService';

import { Colors } from '../../theme/colors';

// Dimensions not needed here

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete: _onComplete }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const hasNavigatedRef = useRef(false);


  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting splash screen flow');
    // Reset navigation state in case this is called after login
    hasNavigatedRef.current = false;

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
      if (hasNavigatedRef.current) {
        console.log('[SplashScreen] Navigation already performed, skipping');
        return true;
      }
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
      });

      if (!effectiveUser) {
        console.log('[SplashScreen] ⏳ NO USER - Rechecking session...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('[SplashScreen] 📋 SESSION RECHECK RESULT:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            email: session?.user?.email,
          });

          if (session?.user) {
            effectiveUser = session.user;
            console.log('[SplashScreen] ✅ Found session user on recheck, proceeding as authenticated');
          }
        } catch (sessErr) {
          console.warn('[SplashScreen] ❌ Session recheck failed:', sessErr);
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

      try {
        const onboardingService = new OnboardingService();
        console.log('[SplashScreen] 📋 Checking onboarding completion...');
        const hasCompleted = await onboardingService.hasCompletedOnboarding(effectiveUser.id);

        console.log('[SplashScreen] ✅ COMPLETION CHECK RESULT:', {
          userId: effectiveUser.id,
          hasCompleted,
          decision: hasCompleted ? 'MainTabs' : 'OnboardingWelcome',
        });

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

        // FLOW 2: Detected user but did not finish onboarding → Splash > Personalization directly
        const target = 'OnboardingPersonalization';
        const provider = (effectiveUser as any)?.app_metadata?.provider as string | undefined;
        const isOAuth = provider === 'apple' || provider === 'google';
        const displayName = effectiveUser.user_metadata?.first_name || effectiveUser.email?.split('@')[0] || '';
        const params = {
          // For OAuth, always force entering real name (avoid random/email-derived names)
          name: isOAuth ? '' : displayName,
          registrationMethod: isOAuth ? 'oauth' : 'email',
        };
        console.log('[SplashScreen] 👋 ROUTING TO PERSONALIZATION - Onboarding not completed');
        console.log('[SplashScreen] 📋 FLOW: Splash > Personalization (skip Welcome)');
        try {
          navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
        } catch (navErr) {
          navigation.navigate(target as any, params);
        }
        hasNavigatedRef.current = true;
        return true;
      } catch (obErr) {
        console.warn('[SplashScreen] ❌ ONBOARDING CHECK FAILED. Applying safer fallback based on auth state:', obErr);
        // If we have an authenticated user, prefer going straight to Personalization rather than Welcome
        try {
          const target = effectiveUser ? 'OnboardingPersonalization' : 'OnboardingWelcome';
          const provider = (effectiveUser as any)?.app_metadata?.provider as string | undefined;
          const isOAuth = provider === 'apple' || provider === 'google';
          const displayName = effectiveUser?.user_metadata?.first_name || effectiveUser?.email?.split('@')[0] || '';
          const params = effectiveUser
            ? { name: isOAuth ? '' : displayName, registrationMethod: isOAuth ? 'oauth' : 'email' }
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
    let navigationTimeout: ReturnType<typeof setTimeout> | null = null;

    // Set a minimum splash display time of 3 seconds to allow auth state propagation
    navigationTimeout = setTimeout(async () => {
      console.log('[SplashScreen] ⏰ Minimum splash time elapsed, making routing decision...');
      const redirected = await navigateToCorrectScreen();
      console.log('[SplashScreen] 📊 Navigation result:', { redirected });

      if (!redirected) {
        console.log('[SplashScreen] ⚠️ Navigation failed, retrying...');
        // Retry after a short delay
        setTimeout(() => {
          navigateToCorrectScreen();
        }, 500);
      }
    }, 3000);

    // Cleanup function for timeout
    return () => {
      console.log('[SplashScreen] Cleaning up animations and navigation timeout');
      if (navigationTimeout) {clearTimeout(navigationTimeout);}
    };
  }, [navigation, user]);

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
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
});

export default OnboardingSplashScreen;
