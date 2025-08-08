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
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { Colors } from '../../theme/colors';

// Dimensions not needed here

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Elegant loading dots animations
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.4)).current;
  const dot3Anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Set status bar for splash
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.anchorBlue);
    }

    // Simple logo fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Start elegant pulsing dots animation
    const animateDot = (dotAnim: Animated.Value, delay: number) => {
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
    };

    // Start staggered dot animations
    animateDot(dot1Anim, 0).start();
    animateDot(dot2Anim, 200).start();
    animateDot(dot3Anim, 400).start();

    // Navigate after delay with proper routing logic
    const navigateToCorrectScreen = async () => {
      try {
        if (!user) {
          // User not authenticated, go to onboarding
          console.log('[SplashScreen] User not authenticated, navigating to Transform Journey');
          navigation.navigate('TransformJourney' as any);
          return;
        }

        // Check user's onboarding status
        console.log('[SplashScreen] Checking user onboarding status for:', user.id);
        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[SplashScreen] Error fetching user profile:', error);
          // If error, assume onboarding not completed
          navigation.navigate('TransformJourney' as any);
          return;
        }

        if (userProfile?.onboarding_completed) {
          console.log('[SplashScreen] User onboarding completed, navigating to main app');
          navigation.navigate('MainTabs' as any);
        } else {
          console.log('[SplashScreen] User onboarding not completed, continuing onboarding');
          navigation.navigate('OnboardingPersonalization' as any);
        }
      } catch (error) {
        console.error('[SplashScreen] Error in navigation logic:', error);
        // Fallback to onboarding
        navigation.navigate('TransformJourney' as any);
      }
    };

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (onComplete) {
          onComplete();
        } else {
          navigateToCorrectScreen();
        }
      });
    }, 2500);
  }, [navigation, onComplete, fadeAnim, dot1Anim, dot2Anim, dot3Anim, user]);

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

        {/* Simple Loading Dots */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1Anim,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2Anim,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3Anim,
              },
            ]}
          />
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
