import React, { useState, useRef, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
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

const OnboardingPostureScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, isLoggingOut } = useAuth();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;
  const isVerySmallPhone = !isTablet && screenSize.height <= 700; // iPhone SE 2nd/3rd gen (667)
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.92, 720);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const checkImmediateNavigation = async () => {
      if (hasNavigatedRef.current || isNavigatingRef.current) {
        return;
      }

      try {
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};
          const isLoginFlow = redirect?.is_login_flow === true;

          if (user && target && isLoginFlow) {
            navigation.reset({ index: 0, routes: [{ name: target as any, params }] });
            await AsyncStorage.removeItem('post_auth_redirect');
            hasNavigatedRef.current = true;
            return;
          }
        }
      } catch (e) {
        Logger.warn('Error checking redirect', { component: 'OnboardingPostureScreen', error: e as Error });
      }

      if (user && !isLoggingOut) {
        try {
          const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
          if (hasCompleted) {
            navigation.reset({ index: 0, routes: [{ name: 'UserInput' as any }] });
            hasNavigatedRef.current = true;
            return;
          }
        } catch (e) {
          Logger.warn('Error checking onboarding completion', { component: 'OnboardingPostureScreen', error: e as Error });
        }
      }
    };

    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        checkImmediateNavigation();
      }
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeout);
    };
  }, [user, isLoggingOut, navigation]);

  useEffect(() => {
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

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  const dynamicStyles = React.useMemo(() => StyleSheet.create({
    logoSection: {
      ...OnboardingStyles.logoSection,
      marginBottom: isVerySmallPhone ? 0 : OnboardingSpacing.sm,
      alignItems: 'center',
    },
    animationContainer: {
      width: '100%',
      aspectRatio: 1.2,
      maxHeight: isVerySmallPhone ? 230 : (isTablet ? 320 : 280),
      marginTop: isVerySmallPhone ? OnboardingSpacing.xxxl + 40 : -OnboardingSpacing.xxxl + 40,
      marginBottom: isVerySmallPhone ? -OnboardingSpacing.md : -OnboardingSpacing.lg,
      alignSelf: 'center',
      overflow: 'visible',
      transform: isVerySmallPhone ? [{ translateY: -70 }] : [],
    },
    postureTitle: {
      ...OnboardingTypography.heroTitle,
      color: Colors.hopeWhite,
      textAlign: isVerySmallPhone ? 'left' : 'center',
      marginBottom: isVerySmallPhone ? OnboardingSpacing.xs : OnboardingSpacing.md,
      fontSize: isVerySmallPhone ? 20 : 28,
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
      fontSize: isVerySmallPhone ? 13 : 15,
      lineHeight: isVerySmallPhone ? 16 : 20,
    },
  }), [isVerySmallPhone, isTablet]);

  const handleContinue = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    try {
      navigation.navigate('OnboardingAccountCreation' as any);
    } catch (error) {
      Logger.error('Error proceeding to account creation screen', error as Error, { component: 'OnboardingPostureScreen' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.sage} />
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
          <View style={dynamicStyles.logoSection}>
            <View style={dynamicStyles.animationContainer}>
              <Lottie
                source={require('../../../assets/animations/JC 4.json')}
                autoPlay
                loop
                style={styles.animation}
              />
            </View>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.textContainer}>
              <ThemedText
                weight="bold"
                style={[OnboardingStyles.mainTitle, dynamicStyles.postureTitle, styles.titleLeftAlign]}
              >
                This isn’t about fixing yourself.
              </ThemedText>
            </View>

            <View style={dynamicStyles.textContainer}>
              <ThemedText style={dynamicStyles.mainText}>
                {'siFia doesn’t replace prayer, Scripture, or the Holy Spirit.\n\nIt creates space to slow down, name what\'s happening, and listen before acting.'}
              </ThemedText>
            </View>

            <View style={styles.featuresList}>
              <View style={[styles.featureItem, styles.hiddenFeature]} />
              <View style={[styles.featureItem, styles.hiddenFeature]} />
              <View style={[styles.featureItem, styles.hiddenFeatureWithMargin]} />

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
  animation: {
    width: '110%',
    height: '110%',
    alignSelf: 'center',
    transform: [{ scale: 1.02 }],
  },
  logoImage: {
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: OnboardingSpacing.md,
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
  startButton: {},
  startButtonPhone: {
    marginBottom: 52,
  },
  startButtonText: {},
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
  titleLeftAlign: {
    textAlign: 'left',
    width: '100%',
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

export default withErrorBoundary(OnboardingPostureScreen, 'OnboardingPostureScreen');
