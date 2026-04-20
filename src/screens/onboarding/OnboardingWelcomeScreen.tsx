/**
 * OnboardingWelcomeScreen.tsx
 * Welcome slideshow with three feature slides
 * Shows Biblical Wisdom, Personalized Playbooks, and Smart Journaling
 */

import React, { useState, useRef, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil as LucidePencil } from 'lucide-react-native';
import LottieView from 'lottie-react-native';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Linking,
  Dimensions,
  FlatList,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { Fonts } from '../../theme/fonts';
import { OnboardingStyles, OnboardingSpacing } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../../utils/haptics';
import { supabase } from '../../services/supabaseClient';
import ThemedText from '../../components/common/ThemedText';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';

// const { height: _height } = Dimensions.get('window');

// Pre-load Lottie files to avoid dynamic requires
const JC3_ANIMATION = require('../../../assets/animations/JC 3.json');
const JC4_ANIMATION = require('../../../assets/animations/JC 4.json');
const JC5_ANIMATION = require('../../../assets/animations/JC 5.json');

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  features: string[];
  icon?: string;
  color: string;
  iconSize?: number;
  useLucidePencil?: boolean;
  useLottie?: boolean;
  lottieFile?: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'When life feels heavy',
    subtitle: 'Faith can be sincere\nand still feel confusing in real life.',
    features: [
      'You love God',
      'You want to respond faithfully',
      'But emotions, pressure, and decisions feel tangled',
    ],
    color: Colors.alertCoral,
    useLottie: true,
    lottieFile: 'JC 5.json',
  },
  {
    id: 2,
    title: 'Clarity before action',
    subtitle: 'siFia helps you slow down and reflect before God.',
    features: [
      'Space to name what you are carrying',
      'Scripture to ground your thoughts',
      'Discernment before reacting',
    ],
    color: Colors.alertCoral,
    useLottie: true,
    lottieFile: 'JC 4.json',
  },
  {
    id: 3,
    title: 'A gentle structure for real life',
    subtitle: 'Not answers. Not pressure.\nJust guidance rooted in faith.',
    features: [
      'Scripture-rooted reflection',
      'Honest discernment',
      'One faithful response at a time',
    ],
    color: Colors.alertCoral,
    useLottie: true,
    lottieFile: 'JC 3.json',
  },
];

// Helper function to extract first name from email username
const extractNameFromEmail = (emailUsername: string): string => {
  if (!emailUsername) {
    return '';
  }

  let cleanUsername = emailUsername.toLowerCase();

  // Remove common prefixes
  cleanUsername = cleanUsername.replace(/^(by|the|my|user|admin|contact)/, '');

  // Look for common name patterns
  if (cleanUsername.includes('nikki')) {
    return 'Nikki';
  } else if (cleanUsername.includes('john')) {
    return 'John';
  } else if (cleanUsername.includes('maria')) {
    return 'Maria';
  } else if (cleanUsername.includes('alex')) {
    return 'Alex';
  }

  // If username looks like it contains a first name (4-12 chars, mostly letters)
  if (cleanUsername.length >= 4 && cleanUsername.length <= 12 && /^[a-z]+$/.test(cleanUsername)) {
    // Capitalize first letter
    return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
  }

  // If all else fails, return the original username capitalized
  return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
};

const OnboardingWelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;

  // Proper device classification based on actual iPhone dimensions (in points)
  // iPhone SE 2nd gen: 375x667, iPhone SE 3rd gen: 375x667
  const isVerySmallPhone = !isTablet && screenSize.height <= 700; // iPhone SE 2nd/3rd gen (667)
  const isSmallPhone = !isTablet && screenSize.height > 700 && screenSize.height <= 850; // iPhone 14 Pro (844) and similar
  const isRegularPhone = !isTablet && screenSize.height > 850 && screenSize.height < 950; // iPhone 17: 402x874

  // Debug: Log screen dimensions and classification only when they change
  useEffect(() => {
    Logger.info('SCREEN DEBUG:', {
      width: screenSize.width,
      height: screenSize.height,
      isTablet,
    });

    Logger.info('DEVICE CLASSIFICATION:', {
      isVerySmallPhone,
      isSmallPhone,
      isRegularPhone,
      isTablet,
    });
  }, [screenSize, isTablet, isSmallPhone, isRegularPhone, isVerySmallPhone]);
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.9, 720);
  // Width of the actual FlatList viewport; defaults to screen, but measured on layout
  const [listWidth, setListWidth] = useState(screenSize.width);
  const { isAuthenticated, user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasNudgedRef = useRef(false);

  // Listen to dimension changes to respond to rotation
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  // If we landed on Welcome but user is already authenticated and a post-auth redirect exists,
  // honor it immediately to avoid timing issues where Splash routed too early.
  useEffect(() => {
    let isActive = true;
    const unsubscribe = (navigation as any).addListener?.('focus', async () => {
      try {
        if (!isAuthenticated) {return;}

        // Wait a moment for auth context to potentially update the redirect
        await new Promise(resolve => setTimeout(resolve, 500));

        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};

          // Check if user has completed onboarding before honoring redirect
          if (user && target === 'OnboardingPersonalization') {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('onboarding_completed')
                .eq('id', user.id)
                .single();

              if (profile?.onboarding_completed) {
                // User completed onboarding - ignore personalization redirect and go to UserInput
                Logger.info('WelcomeScreen: User completed onboarding - ignoring personalization redirect, navigating to UserInput');
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                (navigation as any).reset?.({ index: 0, routes: [{ name: 'UserInput', params: {} }] });
                return;
              }
            } catch (error) {
              Logger.warn('WelcomeScreen: Error checking onboarding status', { errorMessage: String(error) });
            }
          }

          if (!isActive || !target) {return;}

          try {
            (navigation as any).reset?.({ index: 0, routes: [{ name: target, params }] });
          } catch {
            (navigation as any).navigate(target as any, params);
          }
          try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
          return;
        }

        // No redirect key present; if authenticated, forward to personalization by default
        // Detect if this is an OAuth user (Apple/Google)
        const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
        const isOAuth = provider === 'apple' || provider === 'google';

        // Determine display name based on provider
        let displayName = '';
        if (provider === 'apple') {
          // For Apple users, force name collection to avoid private relay names
          displayName = '';
        } else if (provider === 'google') {
          // For Google users, extract first name from full_name
          const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
          displayName = fullName.split(' ')[0] || fullName;
        } else {
          // For email users, extract from email or metadata
          displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
        }

        const registrationMethod = isOAuth ? 'oauth' : 'email';

        try {
          (navigation as any).reset?.({ index: 0, routes: [{ name: 'OnboardingPersonalization', params: { name: displayName, registrationMethod } }] });
        } catch {
          (navigation as any).navigate('OnboardingPersonalization' as any, { name: displayName, registrationMethod });
        }
      } catch (e) {
        // Non-fatal: ignore
      }
    });

    return () => {
      isActive = false;
      if (typeof unsubscribe === 'function') {unsubscribe();}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigation]); // user.email and user.user_metadata intentionally excluded - checked within effect

  // Subtle swipe nudge to hint at carousel interaction without auto-sliding
  useEffect(() => {
    if (hasNudgedRef.current) {return;}
    hasNudgedRef.current = true;

    const timeout = setTimeout(() => {
      const list = flatListRef.current;
      if (!list) {return;}

      list.scrollToOffset({ offset: 40, animated: true });

      const returnTimeout = setTimeout(() => {
        list.scrollToOffset({ offset: 0, animated: true });
      }, 400);

      return () => clearTimeout(returnTimeout);
    }, 1600);

    return () => clearTimeout(timeout);
  }, []);

  const animateToSlide = (slideIndex: number) => {
    flatListRef.current?.scrollToIndex({
      index: slideIndex,
      animated: true,
    });
  };

  // Unused manual navigation handlers removed to satisfy lint; carousel uses dots and auto-advance.

  const onScrollEnd = (event: any) => {
    const widthForPaging = listWidth || screenSize.width;
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / widthForPaging);
    setCurrentSlide(slideIndex);
  };

  const handleCreateAccount = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    // Small delay for haptic feedback, then navigate immediately
    setTimeout(() => {
      if (isAuthenticated) {
        // If already authenticated, go to personalization
        // Detect if this is an OAuth user
        const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
        const isOAuth = provider === 'apple' || provider === 'google';

        // Determine display name based on provider
        let displayName = '';
        if (provider === 'apple') {
          displayName = ''; // Force collection for Apple
        } else if (provider === 'google') {
          const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
          displayName = fullName.split(' ')[0] || fullName;
        } else {
          displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
        }

        const registrationMethod = isOAuth ? 'oauth' : 'email';

        navigation.navigate('OnboardingPersonalization' as any, {
          name: displayName,
          registrationMethod,
        });
      } else {
        // If not authenticated, go to registration
        navigation.navigate('Auth', { screen: 'Register' });
      }
      setIsLoading(false);
    }, 100); // Reduced from 500ms to 100ms to minimize overlap
  };

  const handleLogin = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    // Small delay for haptic feedback, then navigate immediately
    setTimeout(() => {
      if (isAuthenticated) {
        // If already authenticated, go to personalization
        // Detect if this is an OAuth user
        const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
        const isOAuth = provider === 'apple' || provider === 'google';

        // Determine display name based on provider
        let displayName = '';
        if (provider === 'apple') {
          displayName = ''; // Force collection for Apple
        } else if (provider === 'google') {
          const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
          displayName = fullName.split(' ')[0] || fullName;
        } else {
          displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
        }

        const registrationMethod = isOAuth ? 'oauth' : 'email';

        navigation.navigate('OnboardingPersonalization' as any, {
          name: displayName,
          registrationMethod,
        });
      } else {
        // If not authenticated, go to login
        navigation.navigate('Auth', { screen: 'Login' });
      }
      setIsLoading(false);
    }, 100); // Reduced from 500ms to 100ms to minimize overlap
  };

  // Create dynamic styles based on screen size
  const dynamicStyles = React.useMemo(() => StyleSheet.create({
    logoSection: {
      ...OnboardingStyles.logoSection,
      paddingHorizontal: 24,
      marginTop: isVerySmallPhone ? 5 : (isSmallPhone ? 12 : 20),
      marginBottom: isVerySmallPhone ? -30 : (isSmallPhone ? -65 : -90),
    },
    slideContainer: {
      ...styles.slideContainer,
      paddingTop: isVerySmallPhone ? -80 : (isSmallPhone ? -130 : -220),
    },
    lottieIconUnderLogo: {
      width: isVerySmallPhone ? 160 : (isSmallPhone ? 310 : 350),
      height: isVerySmallPhone ? 160 : (isSmallPhone ? 310 : 350),
      marginBottom: isTablet ? 24 : 0,
    },
    buttonSectionSmallPhone: {
      ...styles.buttonSectionSmallPhone,
      marginTop: isVerySmallPhone ? 0 : (isSmallPhone ? 8 : 10),
      marginBottom: isVerySmallPhone ? 6 : (isSmallPhone ? 8 : 10),
    },
    termsContainer: {
      ...styles.termsContainer,
      marginTop: isVerySmallPhone ? 8 : (isSmallPhone ? 6 : 0),
      marginBottom: isVerySmallPhone ? 0 : (isSmallPhone ? 4 : 10),
    },
    primaryButtonCompact: {
      ...(isVerySmallPhone || isSmallPhone) ? {
        height: isVerySmallPhone ? 48 : 52,
        paddingVertical: isVerySmallPhone ? 12 : 14,
        paddingHorizontal: 32,
        backgroundColor: Colors.alertCoral,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      } : {},
    },
    loginButtonCompact: {
      ...(isVerySmallPhone || isSmallPhone) ? {
        height: isVerySmallPhone ? 48 : 52,
        paddingVertical: isVerySmallPhone ? 12 : 14,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginTop: isVerySmallPhone ? 8 : 10,
      } : {},
    },
  }), [isVerySmallPhone, isSmallPhone, isTablet]);

  const renderSlide = ({ item }: { item: Slide }) => (
    <View
      style={[
        dynamicStyles.slideContainer,
        {
          width: listWidth || screenSize.width,
          // On tablets, push the slide content further down so the middle content sits lower
          paddingTop: isTablet ? styles.tabletPaddingTop.paddingTop : dynamicStyles.slideContainer.paddingTop,
        },
      ]}
    >
      {/* Slide Icon */}
      <View style={styles.lottieContainer}>
        {item.useLottie ? (
          null // Lottie animations are now displayed under the logo
        ) : item.useLucidePencil ? (
          <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
            <LucidePencil
              size={item.iconSize || 60}
              color={Colors.alertCoral}
              strokeWidth={1.75}
            />
          </View>
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon || 'help-outline'} size={item.iconSize || 60} color={item.color} />
          </View>
        )}
      </View>

      {/* Slide Title */}
      <ThemedText weight="bold" style={styles.slideTitle}>{item.title}</ThemedText>

      {/* Slide Subtitle */}
      <ThemedText style={styles.slideSubtitle}>{item.subtitle}</ThemedText>

      {/* Features List */}
      <View style={[{ width: contentWidth }, styles.centeredContainer]}>
        <View style={styles.featuresList}>
          {item.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.iconMarginTop} />
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <OnboardingErrorBoundary>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={OnboardingStyles.innerContainer}>
        {/* Logo Section */}
        <View style={dynamicStyles.logoSection}>
          {/* Lottie Animation under logo */}
          {currentSlide >= 0 && slides[currentSlide] && slides[currentSlide].useLottie && (
            <View style={styles.logoLottieContainer}>
              <LottieView
                source={
                  slides[currentSlide].lottieFile === 'JC 3.json' ? JC3_ANIMATION :
                  slides[currentSlide].lottieFile === 'JC 4.json' ? JC4_ANIMATION :
                  JC5_ANIMATION
                }
                autoPlay
                loop
                style={dynamicStyles.lottieIconUnderLogo}
              />
            </View>
          )}
        </View>

        {/* Carousel */}
        <View onLayout={({ nativeEvent }) => {
          const w = Math.max(1, Math.floor(nativeEvent.layout.width));
          if (w > 0 && w !== listWidth) { setListWidth(w); }
        }}>
        <FlatList
          key={`welcome-list-${listWidth}`}
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          decelerationRate="fast"
          snapToInterval={listWidth || screenSize.width}
          snapToAlignment="center"
          getItemLayout={(_, index) => ({ length: listWidth || screenSize.width, offset: (listWidth || screenSize.width) * index, index })}
          contentContainerStyle={[styles.carouselContainer, styles.carouselContentContainer]}
        />
        </View>

        {/* Navigation Dots */}
        <View style={[styles.dotsContainer, { width: contentWidth }, styles.centeredContainer]}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.activeDot,
              ]}
              onPress={() => {
                setCurrentSlide(index);
                animateToSlide(index);
              }}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <View
          style={[
            styles.buttonSection,
            (isVerySmallPhone || isSmallPhone) ? dynamicStyles.buttonSectionSmallPhone : (isTablet ? styles.buttonSectionTablet : styles.buttonSectionRegularPhone),
            {
              width: contentWidth,
            },
            styles.centeredContainer,
          ]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, styles.finishButton, dynamicStyles.primaryButtonCompact, isLoading && OnboardingStyles.buttonDisabled, styles.fullWidthButton, { maxWidth: contentWidth }]}
            onPress={handleCreateAccount}
            disabled={isLoading}
          >
            <ThemedText weight="semiBold" style={styles.primaryButtonText}>
              {isAuthenticated ? 'Continue Setup' : 'Create an Account'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, dynamicStyles.loginButtonCompact, isLoading && OnboardingStyles.buttonDisabled, styles.fullWidthButton, { maxWidth: contentWidth }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
              {isAuthenticated ? 'Get Started' : 'Login'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Terms Text */}
        <View style={[dynamicStyles.termsContainer, { width: contentWidth }, styles.centeredContainer]}>
          <ThemedText style={styles.termsText}>
            By continuing, you agree to our{' '}
            <ThemedText style={styles.linkText} onPress={() => Linking.openURL('https://sifia.app/legal/terms')}>
              Terms of Service
            </ThemedText>
            {' '}and{' '}
            <ThemedText style={styles.linkText} onPress={() => Linking.openURL('https://sifia.app/legal/privacy')}>
              Privacy Policy
            </ThemedText>
          </ThemedText>
        </View>
      </View>
      </View>
    </OnboardingErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    ...OnboardingStyles.container,
    paddingHorizontal: 0,
  },
  scrollContent: OnboardingStyles.scrollContent,
  logoSection: {
    ...OnboardingStyles.logoSection,
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: -90,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  logoLottieContainer: {
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieIconUnderLogo: {
    width: 350,
    height: 350,
  },

  // Carousel Styles
  carouselContainer: {
    alignItems: 'center',
  },
  slideContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: -220,
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },

  // Slide Content Styles
  lottieContainer: {
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    ...OnboardingStyles.iconContainer,
    marginBottom: 24,
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieIcon: {
    width: 60,
    height: 60,
  },
  lottieIconLarge: {
    width: 150,
    height: 150,
  },
  lottieIconExtraLarge: {
    width: 350,
    height: 350,
  },
  slideTitle: {
    ...OnboardingStyles.mainTitle,
    marginBottom: OnboardingSpacing.sm,
    textAlign: 'center',
    marginTop: 0,
  },
  slideSubtitle: {
    ...OnboardingStyles.subtitle,
    marginBottom: OnboardingSpacing.lg,
    textAlign: 'center',
  },
  featuresList: {
    ...OnboardingStyles.featuresList,
    alignSelf: 'stretch',
  },
  featureItem: OnboardingStyles.featureItem,
  featureText: OnboardingStyles.featureText,

  // Navigation Dots
  dotsContainer: {
    ...OnboardingStyles.dotsContainer,
    marginTop: -50,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  dot: OnboardingStyles.dot,
  activeDot: OnboardingStyles.activeDot,

  // Button Section
  buttonSection: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  buttonSectionSmallPhone: {
    marginTop: 10,
    marginBottom: 10,
  },
  buttonSectionRegularPhone: {
    marginTop: 10,
  },
  buttonSectionTablet: {
    marginTop: 40,
  },
  createButton: OnboardingStyles.primaryButton,
  createButtonText: OnboardingStyles.primaryButtonText,
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

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },

  termsText: {
    ...OnboardingStyles.termsText,
    paddingHorizontal: 24,
    marginBottom: 10,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  termsContainer: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  linkText: OnboardingStyles.linkText,
  iconMarginTop: {
    marginTop: 2,
  },
  centeredContainer: {
    alignSelf: 'center',
  },
  carouselContentContainer: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  fullWidthButton: {
    alignSelf: 'center',
    width: '100%',
  },
  // Dynamic padding styles
  tabletPaddingTop: {
    paddingTop: 30,
  },
  phonePaddingTop: {
    paddingTop: 10,
  },
  dynamicMarginTop: {
    marginTop: 0,
  },
  smallPhoneMarginTop: {
    marginTop: -30,
  },
  regularPhoneMarginTop: {
    marginTop: 80,
  },
  zeroMarginTop: {
    marginTop: 70,
  },
});

export default withErrorBoundary(OnboardingWelcomeScreen, 'OnboardingWelcomeScreen');
