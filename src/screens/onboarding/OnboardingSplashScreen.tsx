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
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

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

    // Navigate after delay with simple fade out
    setTimeout(async () => {
      // Check if user has completed onboarding
      let shouldGoToMainApp = false;

      if (user?.id) {
        try {
          const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('id', user.id)
            .single();

          if (error && error.code === 'PGRST116') {
            // User profile doesn't exist - create it
            console.log('[SplashScreen] User profile missing, creating...');
            const userMetadata = user.user_metadata || {};
            const firstName = userMetadata.first_name || userMetadata.given_name || user.email?.split('@')[0] || '';
            const lastName = userMetadata.last_name || userMetadata.family_name || '';
            const fullName = userMetadata.full_name || userMetadata.name || `${firstName} ${lastName}`.trim();

            const newProfile = {
              id: user.id,
              email: user.email,
              onboarding_completed: false, // Default to false for new profiles
            };

            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert([newProfile]);

            if (insertError) {
              console.error('Error creating user profile:', insertError);
              shouldGoToMainApp = false;
            } else {
              console.log('[SplashScreen] User profile created, starting onboarding');
              shouldGoToMainApp = false; // New profile = needs onboarding
            }
          } else if (error) {
            console.error('Error checking onboarding status:', error);
            shouldGoToMainApp = false;
          } else {
            shouldGoToMainApp = userProfile?.onboarding_completed === true;
            console.log(`[SplashScreen] User onboarding completed: ${shouldGoToMainApp}`);
          }
        } catch (error) {
          console.error('Unexpected error checking onboarding status:', error);
          shouldGoToMainApp = false;
        }
      }

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (onComplete) {
          onComplete();
        } else if (shouldGoToMainApp) {
          console.log('[SplashScreen] Navigating to main app');
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' as never }],
          });
        } else {
          console.log('[SplashScreen] Continuing with onboarding flow');
          navigation.navigate('TransformJourney' as any);
        }
      });
    }, 2500);
  }, [navigation, onComplete, fadeAnim, dot1Anim, dot2Anim, dot3Anim]);

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
