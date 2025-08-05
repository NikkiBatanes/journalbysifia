/**
 * OnboardingSplashScreen.tsx
 * Phase 1.1: Brand Recognition & First Impression
 * Preserves existing UI patterns and animations
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete }) => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Set status bar for splash
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.anchorBlue);
    }

    // Start animations
    const animationSequence = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);

    animationSequence.start();

    // Auto-advance after 3 seconds
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        navigation.navigate('OnboardingNotificationPermission' as any);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [fadeAnim, scaleAnim, navigation, onComplete]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo placeholder - using text for now */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>siFia</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>Where Faith Meets Action</Text>

        {/* Subtle loading indicator */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
          <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
        </View>
      </Animated.View>
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
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  loadingDotDelay1: {
    opacity: 0.5,
  },
  loadingDotDelay2: {
    opacity: 0.3,
  },
});

export default OnboardingSplashScreen;
