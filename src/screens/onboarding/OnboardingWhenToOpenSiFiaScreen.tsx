import React, { useState, useRef, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

const BULLETS: string[] = [
  'After a conversation you keep replaying',
  'When guilt feels heavy but unclear',
  'When emotions are strong and you don’t trust your reaction',
  'When you sense God nudging you, but hesitate',
];

const OnboardingWhenToOpenSiFiaScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, isLoggingOut } = useAuth();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;
  const isVerySmallPhone = !isTablet && screenSize.height <= 700;
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.92, 720);
  const featuresPadding = isVerySmallPhone ? 12 : 24;
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
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
        Logger.warn('Error checking redirect', { component: 'OnboardingWhenToOpenSiFiaScreen', error: e as Error });
      }

      if (user && !isLoggingOut) {
        try {
          const hasCompleted = await onboardingService.hasCompletedOnboarding(user.id);
          if (hasCompleted) {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] });
            hasNavigatedRef.current = true;
            return;
          }
        } catch (e) {
          Logger.warn('Error checking onboarding completion', { component: 'OnboardingWhenToOpenSiFiaScreen', error: e as Error });
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
    title: {
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
    featureText: {
      ...OnboardingStyles.featureText,
      marginLeft: 14,
      lineHeight: isVerySmallPhone ? 18 : 22,
      fontSize: isVerySmallPhone ? 13 : 15,
      flex: 1,
      marginBottom: 0,
    },
    footerText: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      alignSelf: 'center',
      marginTop: isVerySmallPhone ? OnboardingSpacing.xs : OnboardingSpacing.md,
    },
  }), [isVerySmallPhone, isTablet]);

  const handleContinue = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    try {
      navigation.navigate('OnboardingPosture' as any);
    } catch (error) {
      Logger.error('Error proceeding to posture screen', error as Error, { component: 'OnboardingWhenToOpenSiFiaScreen' });
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
          <View style={dynamicStyles.logoSection}>
            <View style={dynamicStyles.animationContainer}>
              <Lottie
                source={require('../../../assets/animations/JC 5.json')}
                autoPlay
                loop
                style={styles.animation}
              />
            </View>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.textContainer}>
              <ThemedText weight="bold" style={[OnboardingStyles.mainTitle, dynamicStyles.title, styles.titleLeftAlign]}>
                When to open siFia
              </ThemedText>
            </View>

            <View style={[styles.featuresList, { paddingHorizontal: featuresPadding }]}>
              {BULLETS.map((text, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.iconMarginTop} />
                  <ThemedText style={dynamicStyles.featureText}>{text}</ThemedText>
                </View>
              ))}

              <ThemedText style={dynamicStyles.footerText}>If a moment lingers, bring it here.</ThemedText>

              <TouchableOpacity
                style={[
                  OnboardingStyles.primaryButton,
                  styles.startButton,
                  styles.startButtonFullWidth,
                  !isTablet && styles.startButtonPhone,
                  !isTablet && { marginBottom: Math.max(52, insets.bottom + 20) },
                  isLoading && OnboardingStyles.buttonDisabled,
                ]}
                onPress={handleContinue}
                disabled={isLoading}
              >
                <ThemedText weight="bold" style={[OnboardingStyles.primaryButtonText, styles.startButtonText]}>
                  {isLoading ? 'Continuing...' : 'That makes sense'}
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
    marginTop: -OnboardingSpacing.md,
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
  featureItem: OnboardingStyles.featureItem,
  iconMarginTop: {
    marginTop: 2,
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  startButton: {},
  startButtonPhone: {
    marginBottom: 52,
  },
  startButtonText: {},
  titleLeftAlign: {
    textAlign: 'left',
    width: '100%',
  },
  innerContainerCentered: {
    alignSelf: 'center',
  },
  startButtonFullWidth: {
    width: '100%',
    marginTop: OnboardingSpacing.lg,
  },
});

export default withErrorBoundary(OnboardingWhenToOpenSiFiaScreen, 'OnboardingWhenToOpenSiFiaScreen');
