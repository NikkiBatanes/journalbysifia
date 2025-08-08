/**
 * OnboardingCompleteScreen.tsx
 * Final screen that transitions users to the main app
 */

import React, { useEffect, useRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import LinearGradient from 'react-native-linear-gradient';
import { AnimationUtils } from '../../utils/animations';

const { height } = Dimensions.get('window');

const OnboardingCompleteScreen: React.FC = () => {
  const navigation = useNavigation();

  // Enhanced animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Enhanced entrance animation sequence
    const animationSequence = Animated.sequence([
      // Logo and content fade in
      Animated.parallel([
        AnimationUtils.fadeIn(fadeAnim, 800, 0),
        AnimationUtils.scaleIn(scaleAnim, 1000, 200),
        AnimationUtils.slideUp(slideAnim, 800, 400),
      ]),
      // Checkmark animation
      AnimationUtils.scaleIn(checkmarkAnim, 600, 300),
      // Progress bar fill
      AnimationUtils.progressBar(progressAnim, 100, 800),
    ]);

    // Start pulsing animation
    const pulseAnimation = AnimationUtils.pulse(pulseAnim, 0.95, 1.05, 2000);

    Animated.parallel([
      animationSequence,
      pulseAnimation,
    ]).start();

    // Auto-navigate to main app after 3 seconds (increased for better UX)
    const timer = setTimeout(() => {
      // Reset navigation stack and go to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' as never }],
      });
    }, 3000);

    return () => clearTimeout(timer);
    // We intentionally only depend on navigation here because these Animated refs are stable (useRef)
    // and this effect should run once on mount to kick off animations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.hopeWhite} />

      {/* Background Gradient */}
      <LinearGradient
        colors={[Colors.hopeWhite, '#f8f9fa', Colors.hopeWhite]}
        style={styles.background}
      />

      {/* Animation Area (30% of screen) */}
      <View style={styles.animationArea}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>siFia</Text>
            <Text style={styles.logoSubtext}>Complete</Text>
          </View>
        </Animated.View>
      </View>

      {/* Modal Content Area (70% of screen) */}
      <Animated.View
        style={[
          styles.modalContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.contentContainer}>
          {/* Animated Checkmark */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                opacity: checkmarkAnim,
                transform: [{ scale: checkmarkAnim }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={100} color={Colors.growthGreen} />
          </Animated.View>

          <Text style={styles.title}>Welcome to siFia!</Text>
          <Text style={styles.subtitle}>
            Your spiritual growth journey begins now
          </Text>

          {/* Progress Completion */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Setup Complete</Text>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Color accents */}
            <View style={styles.colorAccents}>
              <View style={[styles.colorAccent, { backgroundColor: Colors.alertCoral }]} />
              <View style={[styles.colorAccent, { backgroundColor: Colors.growthGreen }]} />
              <View style={[styles.colorAccent, { backgroundColor: Colors.faithGold }]} />
            </View>
          </View>

          <Text style={styles.redirectText}>Redirecting to your dashboard...</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  // Upper animation area (30% of screen)
  animationArea: {
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.growthGreen,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    letterSpacing: 1,
  },
  // Modal-like bottom content (70% of screen)
  modalContent: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
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
  contentContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  checkmarkContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 10,
    fontWeight: '600',
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
  },
  colorAccents: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  colorAccent: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  redirectText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default OnboardingCompleteScreen;
