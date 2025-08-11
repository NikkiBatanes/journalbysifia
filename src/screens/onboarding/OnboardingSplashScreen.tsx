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
import { subscriptionService } from '../../services/subscriptionService';
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

  // Elegant loading dots animations
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.4)).current;
  const dot3Anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting splash screen flow');

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

    // Conditional navigation: decide based on auth + subscription status
    const navigateToCorrectScreen = async () => {
      console.log('[SplashScreen] Starting conditional navigation logic');

      // Not authenticated → pre-onboarding
      if (!user) {
        const target = 'TransformJourney';
        console.log('[SplashScreen] No user →', target);
        try {
          navigation.navigate(target as any);
        } catch (e) {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        }
        return;
      }

      // Authenticated → prioritize onboarding completion check first
      try {
        const onboardingService = new OnboardingService();
        const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);

        // Look at local onboarding progress to avoid looping users back to personalization
        let personalizationCompletedLocally = false;
        try {
          const stored = await AsyncStorage.getItem(`onboarding_progress_${user.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            const steps: string[] = parsed?.completedSteps || [];
            personalizationCompletedLocally = steps.includes('personalization_completed');
          }
        } catch {}

        if (!hasCompleted && !personalizationCompletedLocally) {
          console.log('[SplashScreen] Onboarding not completed → initializing (if needed) and navigating to OnboardingPersonalization');
          try {
            // Initialize onboarding session; ignore errors to avoid blocking
            await onboardingService.initializeOnboarding(user.id);
          } catch (initErr) {
            console.warn('[SplashScreen] Onboarding initialization failed or not required:', initErr);
          }

          const target = 'OnboardingPersonalization';
          try {
            navigation.navigate(target as any);
          } catch (navErr) {
            navigation.reset({ index: 0, routes: [{ name: target as any }] });
          }
          return;
        }
      } catch (obErr) {
        console.warn('[SplashScreen] Onboarding check failed, proceeding to subscription gate:', obErr);
      }

      // Onboarding completed → check subscription to decide app access
      try {
        const sub = await subscriptionService.getUserSubscription(user.id);
        const status = (sub as any)?.status || 'unknown';
        const tier = (sub as any)?.tier || 'unknown';
        const trialEnd = (sub as any)?.trial_end_date ? new Date((sub as any).trial_end_date) : null;
        const trialActive = status === 'trialing' && trialEnd ? trialEnd > new Date() : false;

        // Access granted if active/past_due or trial active; otherwise fallback to MainTabs with restricted features
        const allowMain = status === 'active' || status === 'past_due' || trialActive || (tier && tier !== 'free_trial');
        const target = allowMain ? 'MainTabs' : 'OnboardingPersonalization';
        console.log('[SplashScreen] Subscription gate →', { status, tier, trialActive, target });

        try {
          navigation.navigate(target as any);
          console.log(`[SplashScreen] Successfully navigated to ${target}`);
        } catch (navError) {
          console.error('[SplashScreen] Error navigating:', navError);
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        }
      } catch (subErr) {
        console.warn('[SplashScreen] Subscription check failed, defaulting to MainTabs:', subErr);
        const target = 'MainTabs';
        try {
          navigation.navigate(target as any);
        } catch {
          navigation.reset({ index: 0, routes: [{ name: target as any }] });
        }
      }
    };

    // Navigate after a short delay
    console.log('[SplashScreen] Setting up navigation timeout for 1.5 seconds');
    const navigationTimeout = setTimeout(() => {
      console.log('[SplashScreen] Navigation timeout triggered after 1.5 seconds');
      // Execute async navigation logic
      navigateToCorrectScreen();
    }, 1500); // Reduced to 1.5 seconds for faster navigation

    // Cleanup function for both animations and timeout
    return () => {
      console.log('[SplashScreen] Cleaning up animations and navigation timeout');
      if (anim1) {anim1.stop();}
      if (anim2) {anim2.stop();}
      if (anim3) {anim3.stop();}
      clearTimeout(navigationTimeout);
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
