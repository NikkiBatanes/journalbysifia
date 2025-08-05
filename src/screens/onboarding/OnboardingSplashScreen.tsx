/**
 * OnboardingSplashScreen.tsx
 * Enhanced UI: Upper animation area + modal-like bottom with logo
 * Phase 2.0: Modern Layout Design
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

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
      
      {/* Upper Animation Area */}
      <View style={styles.animationArea}>
        <Animated.View
          style={[
            styles.logoAnimationContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo placeholder - will be replaced with SVG/Lottie */}
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>siFia</Text>
          </View>
        </Animated.View>
      </View>

      {/* Modal-like Bottom Content */}
      <Animated.View
        style={[
          styles.modalContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: Animated.multiply(fadeAnim, -20) }],
          },
        ]}
      >
        {/* Welcome Content */}
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Welcome to siFia</Text>
          <Text style={styles.welcomeSubtitle}>Where Faith Meets Action</Text>
          
          {/* Loading Animation */}
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
            <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  // Upper animation area (30% of screen)
  animationArea: {
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoAnimationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 1,
  },
  // Modal-like bottom content (70% of screen)
  modalContent: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 40,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  welcomeContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.anchorBlue,
    marginHorizontal: 4,
    opacity: 0.8,
  },
  loadingDotDelay1: {
    opacity: 0.6,
  },
  loadingDotDelay2: {
    opacity: 0.4,
  },
});

export default OnboardingSplashScreen;
