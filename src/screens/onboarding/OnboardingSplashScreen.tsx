/**
 * OnboardingSplashScreen.tsx
 * Clean splash screen with logo and loading animation
 * New Design: Simple, centered logo with loading indicator
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Platform,
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  // Elegant loading dots animations
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.4)).current;
  const dot3Anim = useRef(new Animated.Value(0.4)).current;

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

    // Simple logo fade-in
    try {
      console.log('[SplashScreen] Starting logo fade-in animation');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        console.log('[SplashScreen] Logo fade-in animation completed');
      });
    } catch (error) {
      console.error('[SplashScreen] Error in fade-in animation:', error);
    }

    // Start elegant pulsing dots animation
    const animateDot = (dotAnim: Animated.Value, delay: number, dotNum: number) => {
      console.log(`[SplashScreen] Starting dot ${dotNum} animation with delay ${delay}ms`);
      try {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dotAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(dotAnim, {
              toValue: 0.4,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
      } catch (error) {
        console.error(`[SplashScreen] Error creating dot ${dotNum} animation:`, error);
        return { start: () => {}, stop: () => {} };
      }
    };

    // Start staggered dot animations
    let anim1: any, anim2: any, anim3: any;
    try {
      console.log('[SplashScreen] Starting dot animations');
      anim1 = animateDot(dot1Anim, 0, 1);
      anim2 = animateDot(dot2Anim, 200, 2);
      anim3 = animateDot(dot3Anim, 400, 3);

      anim1.start();
      anim2.start();
      anim3.start();
    } catch (error) {
      console.error('[SplashScreen] Error starting dot animations:', error);
    }

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

      // 0) Immediate post-auth redirect to avoid splash flash after sign-up/login
      try {
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};

          // If user is authenticated and has completed onboarding, do NOT redirect
          // to any onboarding routes even if a redirect exists (e.g., stale key).
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
                // Fall through to standard completed-user flow instead of early return
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
            // Do not navigate here; continue to standard flow below
          } else if (user && target) {
            console.log('[SplashScreen] Found post_auth_redirect → navigating immediately to', target, params);
            try {
              navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            } catch (navErr) {
              console.warn('[SplashScreen] reset failed, falling back to navigate:', navErr);
              navigation.navigate(target as any, params);
            }
            // Clear the flag so it doesn't fire again
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
            hasNavigatedRef.current = true;
            return true;
          } else {
            // Malformed redirect – clear it
            try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
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

        // FLOW 2: Detected user but did not finish onboarding → Splash > Welcome with Continue Setup
        const target = 'OnboardingWelcome';
        console.log('[SplashScreen] 👋 ROUTING TO WELCOME - Onboarding not completed');
        console.log('[SplashScreen] 📋 FLOW: Splash > Welcome (Continue Setup) > Personalization');
        try {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        } catch (navErr) {
          navigation.navigate(target as any);
        }
        hasNavigatedRef.current = true;
        return true;
      } catch (obErr) {
        console.warn('[SplashScreen] ❌ ONBOARDING CHECK FAILED; defaulting to Welcome as safe fallback:', obErr);
        const target = 'OnboardingWelcome';
        try {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        } catch (navErr) {
          navigation.navigate(target as any);
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

    // Cleanup function for both animations and timeout
    return () => {
      console.log('[SplashScreen] Cleaning up animations and navigation timeout');
      if (anim1) {anim1.stop();}
      if (anim2) {anim2.stop();}
      if (anim3) {anim3.stop();}
      if (navigationTimeout) {clearTimeout(navigationTimeout);}
    };
  }, [dot1Anim, dot2Anim, dot3Anim, fadeAnim, navigation, user]); // Added missing dependencies

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Animated.Image
          source={require('../../../assets/icons/siFiaTransparent.png')}
          style={[
            styles.logoImage,
            {
              opacity: fadeAnim,
            },
          ]}
          resizeMode="contain"
        />

        {/* Loading Dots */}
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.dot, { opacity: dot1Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Anim }]} />
        </View>


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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
  },
});

export default OnboardingSplashScreen;
