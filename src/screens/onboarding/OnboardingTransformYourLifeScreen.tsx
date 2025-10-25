/**
 * OnboardingTransformYourLifeScreen.tsx
 * Transform Your Life Through Faith-Driven Action
 * Introduction screen with key features overview
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import Lottie from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { OnboardingStyles, OnboardingTypography, OnboardingSpacing } from '../../theme/onboardingStyles';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';

// Feature interface removed as it's not currently used in the component

/* const features = [
  {
    id: 'playbooks',
    title: 'AI-powered playbooks for your unique challenges',
    description: 'Personalized guidance tailored to your specific life situations',
    icon: 'book',
    color: Colors.alertCoral,
  },
  {
    id: 'devotionals',
    title: 'Custom devotionals to strengthen your faith',
    description: 'Daily spiritual nourishment designed just for you',
    icon: 'heart',
    color: Colors.alertCoral,
  },
  {
    id: 'journaling',
    title: 'Smart journaling to deepen your reflection',
    description: 'Guided reflection tools to track your spiritual growth',
    icon: 'pencil',
    color: Colors.alertCoral,
  },
]; */

const OnboardingTransformYourLifeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContinue = async () => {
    // Haptic feedback for primary action
    triggerLightHaptic();
    setIsLoading(true);

    try {
      console.log('🎯 Feature showcase completed, proceeding to welcome screen');

      // Navigate to welcome screen
      navigation.navigate('OnboardingWelcome' as any);
    } catch (error) {
      console.error('Error proceeding to welcome screen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          {/* Lottie Animation */}
          <View style={styles.animationContainer}>
            <Lottie
              source={require('../../../assets/animations/Jesus walking on water.json')}
              autoPlay
              loop
              style={styles.animation}
              colorFilters={[
                {
                  keypath: '*',
                  color: Colors.hopeWhite, // Replace with your desired color
                },
              ]}
            />
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.textContainer}>
            <ThemedText weight="bold" style={[OnboardingStyles.mainTitle, styles.transformTitle, styles.titleLeftAlign]}>This is the start of something new.</ThemedText>
          </View>

          <View style={styles.textContainer}>
            <ThemedText style={styles.mainText}>
            God has a way of meeting us right in the middle of our story, not when everything is perfect, but when our hearts are open.
            </ThemedText>
            <ThemedText style={[styles.mainText, styles.textWithMarginTop]}>
            Let's take the first step together.
            </ThemedText>
          </View>

          {/* Features List - Temporarily Hidden */}
          <View style={styles.featuresList}>
            <View style={[styles.featureItem, styles.hiddenFeature]} />
            <View style={[styles.featureItem, styles.hiddenFeature]} />
            <View style={[styles.featureItem, styles.hiddenFeatureWithMargin]} />

            {/* Button */}
            <TouchableOpacity
              style={[OnboardingStyles.primaryButton, styles.startButton, isLoading && OnboardingStyles.buttonDisabled]}
              onPress={handleContinue}
              disabled={isLoading}
            >
              <ThemedText weight="bold" style={[OnboardingStyles.primaryButtonText, styles.startButtonText]}>
                {isLoading ? 'Starting...' : 'Start My Journey'}
              </ThemedText>
            </TouchableOpacity>

            {/* Sign in link */}
            <View style={styles.signInRow}>
              <ThemedText style={styles.signInText}>Already a member? </ThemedText>
              <TouchableOpacity onPress={() => { triggerLightHaptic(); (navigation as any).navigate('Auth' as any, { screen: 'Login' }); }}>
                <ThemedText weight="semiBold" style={styles.signInLink}>Login</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>


      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: OnboardingStyles.container,
  content: OnboardingStyles.content,
  logoSection: {
    ...OnboardingStyles.logoSection,
    marginBottom: OnboardingSpacing.md,
    alignItems: 'center',
  },
  animationContainer: {
    width: '100%',
    aspectRatio: 1.5, // Wider aspect ratio for waves
    maxHeight: 250, // Slightly taller to fit all waves
    marginTop: OnboardingSpacing.sm,
    marginBottom: OnboardingSpacing.md,
    alignSelf: 'center',
    overflow: 'visible', // Ensure no clipping of the waves
  },
  animation: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformTitle: {
    ...OnboardingTypography.heroTitle,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: OnboardingSpacing.md,
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: OnboardingSpacing.md,
  },
  mainText: {
    ...OnboardingTypography.subtitle,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: OnboardingSpacing.sm,
  },
  subText: {
    ...OnboardingTypography.subtitle,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'left',
    fontStyle: 'italic',
  },

  featuresList: {
    width: '100%',
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
    lineHeight: 22,
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  startButton: {
    // Additional custom styling if needed
  },
  startButtonText: {
    // Additional custom styling if needed
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signInText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  signInLink: {
    color: Colors.alertCoral,
    fontSize: 14,
    fontWeight: '600',
  },
  trialText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 10,
  },
  titleLeftAlign: {
    textAlign: 'left',
    width: '100%',
  },
  textWithMarginTop: {
    marginTop: 20,
  },
  hiddenFeature: {
    opacity: 0,
    height: 0,
  },
  hiddenFeatureWithMargin: {
    opacity: 0,
    height: 0,
    marginBottom: 30,
  },

});

export default withErrorBoundary(OnboardingTransformYourLifeScreen, 'OnboardingTransformYourLifeScreen');
