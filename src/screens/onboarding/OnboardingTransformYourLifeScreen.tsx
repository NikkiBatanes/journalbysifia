/**
 * OnboardingTransformYourLifeScreen.tsx
 * Transform Your Life Through Faith-Driven Action
 * Introduction screen with key features overview
 */

import React, { useState, useRef, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Lottie from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { OnboardingStyles, OnboardingTypography, OnboardingSpacing } from '../../theme/onboardingStyles';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { onboardingService } from '../../services/onboardingService';

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
  const { user, isLoggingOut } = useAuth();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;
  const isVerySmallPhone = !isTablet && screenSize.height <= 700; // iPhone SE 2nd/3rd gen (667)
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.92, 720);
  const logoSize = isVerySmallPhone ? 100 : (isTablet ? 120 : 100); // iPad (120), iPhone (100)
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    // Check for immediate navigation needs (post-auth redirect, completed onboarding)
    const checkImmediateNavigation = async () => {
      if (hasNavigatedRef.current || isNavigatingRef.current) {
        return;
      }

      // Check for post-auth redirect
      try {
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};
          const isLoginFlow = redirect?.is_login_flow === true;

          if (user && target && isLoginFlow) {
            // Login flow - bypass all checks
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            await AsyncStorage.removeItem('post_auth_redirect');
            hasNavigatedRef.current = true;
            return;
          }
        }
      } catch (e) {
        Logger.warn('Error checking redirect', { component: 'OnboardingTransformYourLifeScreen', error: e as Error });
      }

      // Check if user has completed onboarding
      if (user && !isLoggingOut) {
        try {
          const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
          if (hasCompleted) {
            navigation.reset({ index: 0, routes: [{ name: 'UserInput' as any }] });
            hasNavigatedRef.current = true;
            return;
          }
        } catch (e) {
          Logger.warn('Error checking onboarding completion', { component: 'OnboardingTransformYourLifeScreen', error: e as Error });
        }
      }
    };

    // Run check after a short delay to allow auth state to settle
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        checkImmediateNavigation();
      }
    }, 1000); // 1 second delay

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeout);
    };
  }, [user, isLoggingOut, navigation]);

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

  // Respond to orientation changes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  // Create dynamic styles based on screen size
  const dynamicStyles = React.useMemo(() => StyleSheet.create({
    logoSection: {
      ...OnboardingStyles.logoSection,
      marginBottom: isVerySmallPhone ? 0 : OnboardingSpacing.sm,
      alignItems: 'center',
    },
    animationContainer: {
      width: '100%',
      aspectRatio: 1.2,
      maxHeight: isVerySmallPhone ? 240 : (isTablet ? 380 : 320),
      marginTop: isVerySmallPhone ? OnboardingSpacing.xxxl : -OnboardingSpacing.xxxl,
      marginBottom: 0,
      alignSelf: 'center',
      overflow: 'visible',
      transform: isVerySmallPhone ? [{ translateY: -70 }] : [],
    },
    transformTitle: {
      ...OnboardingTypography.heroTitle,
      color: Colors.hopeWhite,
      textAlign: isVerySmallPhone ? 'left' : 'center',
      marginBottom: isVerySmallPhone ? OnboardingSpacing.xs : OnboardingSpacing.md,
      fontSize: isVerySmallPhone ? 20 : 28, // Even smaller font for very small phones
      lineHeight: isVerySmallPhone ? 24 : 34,
    },
    textContainer: {
      width: '100%',
      paddingHorizontal: isVerySmallPhone ? 12 : 24,
      marginBottom: isVerySmallPhone ? OnboardingSpacing.xs : OnboardingSpacing.md,
    },
    mainText: {
      ...OnboardingTypography.subtitle,
      color: Colors.hopeWhite,
      textAlign: 'left',
      marginBottom: isVerySmallPhone ? 0 : OnboardingSpacing.sm,
      fontSize: isVerySmallPhone ? 13 : 15, // Even smaller font for very small phones
      lineHeight: isVerySmallPhone ? 16 : 20,
    },
  }), [isVerySmallPhone, isTablet]);

  const handleContinue = async () => {
    // Haptic feedback for primary action
    triggerLightHaptic();
    setIsLoading(true);

    try {
      // Navigate to next screen
      navigation.navigate('OnboardingWhenToOpenSiFia' as any);
    } catch (error) {
      Logger.error('Error proceeding to when-to-open screen', error as Error, { component: 'OnboardingTransformYourLifeScreen' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <View style={[OnboardingStyles.innerContainer, { width: contentWidth }, styles.innerContainerCentered]}>
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
        <View style={dynamicStyles.logoSection}>
          <Image
            source={require('../../../assets/icons/siFia-logo-white.png')}
            style={[styles.logoImage, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />

          {/* Lottie Animation */}
          <View style={dynamicStyles.animationContainer}>
            <Lottie
              source={require('../../../assets/animations/Jesus walking on water.json')}
              autoPlay
              loop
              style={styles.animation}
            />
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.textContainer}>
            <ThemedText weight="bold" style={[OnboardingStyles.mainTitle, dynamicStyles.transformTitle, styles.titleLeftAlign]}>A pause before you respond.</ThemedText>
          </View>

          <View style={dynamicStyles.textContainer}>
            <ThemedText style={dynamicStyles.mainText}>
              {'siFia helps you bring real moments before God when emotions are involved and the next faithful step isn’t clear.'}
            </ThemedText>
          </View>

          {/* Features List - Temporarily Hidden */}
          <View style={styles.featuresList}>
            <View style={[styles.featureItem, styles.hiddenFeature]} />
            <View style={[styles.featureItem, styles.hiddenFeature]} />
            <View style={[styles.featureItem, styles.hiddenFeatureWithMargin]} />

            {/* Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.finishButton,
                !isTablet && { marginBottom: Math.max(52, insets.bottom + 20) },
                isLoading && OnboardingStyles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={isLoading}
            >
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                {isLoading ? 'Continuing...' : 'Continue'}
              </ThemedText>
            </TouchableOpacity>

          </View>
        </View>

      </Animated.View>
      </View>
    </SafeAreaView>
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
    aspectRatio: 1.2, // Allow more vertical space for the illustration
    maxHeight: 320, // Increase height so the figure appears larger
    marginTop: -OnboardingSpacing.xxxl, // Move up very significantly
    marginBottom: 0, // No bottom margin
    alignSelf: 'center',
    overflow: 'visible', // Ensure no clipping of the waves
  },
  animation: {
    width: '115%',
    height: '115%',
    alignSelf: 'center',
    transform: [{ scale: 1.05 }],
  },
  logoImage: {
    // Remove fixed dimensions to allow dynamic sizing
    overflow: 'hidden',
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
  startButtonPhone: {
    marginBottom: 52,
  },
  startButtonText: {
    // Additional custom styling if needed
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  finishButton: {
    marginTop: 32,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
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
  innerContainerCentered: {
    alignSelf: 'center',
  },
  startButtonFullWidth: {
    width: '100%',
  },
});

export default withErrorBoundary(OnboardingTransformYourLifeScreen, 'OnboardingTransformYourLifeScreen');
