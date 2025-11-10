/**
 * OnboardingWelcomeScreen.tsx
 * Welcome slideshow with three feature slides
 * Shows Biblical Wisdom, Personalized Playbooks, and Smart Journaling
 */

import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
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
import ThemedText from '../../components/common/ThemedText';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  features: string[];
  icon: string;
  color: string;
  iconSize?: number;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'When life feels heavy,\nGod\'s Word is light.',
    subtitle: 'We\'ll help you hear His voice in your exact situation and give you simple steps to live it out today.',
    features: [
      'Hear God\'s voice in your exact situation',
      'Simple, faith-driven steps you can do now',
      'Encouragement that lasts beyond Sunday',
    ],
    icon: 'book-outline',
    color: '#FF6B6B',
    iconSize: 62,
  },
  {
    id: 2,
    title: 'A plan for your heart,\nnot just your calendar.',
    subtitle: 'Your playbook is more than a checklist. \nIt\'s a companion for your walk with God.',
    features: [
      'Made for your season of life',
      'Clear steps that bring real progress',
      'Reminders that keep your spirit steady',
    ],
    icon: 'map-outline',
    color: '#4ECDC4',
    iconSize: 62,
  },
  {
    id: 3,
    title: 'Grow steady,\neven in the storm.',
    subtitle: 'Guided devotionals and journaling prompts \nwill help you keep your heart anchored in truth.',
    features: [
      'Daily moments with God',
      'Reflections that reveal His work in you',
      'A clear picture of your growth over time',
    ],
    icon: 'create-outline',
    color: '#45B7D1',
    iconSize: 62,
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
  const { isAuthenticated, user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // If we landed on Welcome but user is already authenticated and a post-auth redirect exists,
  // honor it immediately to avoid timing issues where Splash routed too early.
  useEffect(() => {
    let isActive = true;
    const unsubscribe = (navigation as any).addListener?.('focus', async () => {
      try {
        if (!isAuthenticated) {return;}
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};

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
          // For Google users, use the Google-provided name from user_metadata
          displayName = user?.user_metadata?.first_name || user?.user_metadata?.full_name || '';
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

  // Auto slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const nextSlide = (prev + 1) % slides.length;
        if (nextSlide !== prev) {
          animateToSlide(nextSlide);
        }
        return nextSlide;
      });
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, []);

  const animateToSlide = (slideIndex: number) => {
    flatListRef.current?.scrollToIndex({
      index: slideIndex,
      animated: true,
    });
  };

  // Unused manual navigation handlers removed to satisfy lint; carousel uses dots and auto-advance.

  const onScrollEnd = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
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
          displayName = user?.user_metadata?.first_name || user?.user_metadata?.full_name || '';
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
          displayName = user?.user_metadata?.first_name || user?.user_metadata?.full_name || '';
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

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slideContainer, { width }]}>
      {/* Slide Icon */}
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={item.iconSize || 60} color={item.color} />
      </View>

      {/* Slide Title */}
      <ThemedText weight="bold" style={styles.slideTitle}>{item.title}</ThemedText>

      {/* Slide Subtitle */}
      <ThemedText style={styles.slideSubtitle}>{item.subtitle}</ThemedText>

      {/* Features List */}
      <View style={styles.featuresList}>
        {item.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.iconMarginTop} />
            <ThemedText style={styles.featureText}>{feature}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <OnboardingErrorBoundary>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={OnboardingStyles.innerContainer}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Carousel */}
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="center"
          contentContainerStyle={styles.carouselContainer}
        />

        {/* Navigation Dots */}
        <View style={styles.dotsContainer}>
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
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.createButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={handleCreateAccount}
            disabled={isLoading}
          >
            <ThemedText weight="medium" style={styles.createButtonText}>
              {isAuthenticated ? 'Continue Setup' : 'Create an Account'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <ThemedText weight="medium" style={styles.loginButtonText}>
              {isAuthenticated ? 'Get Started' : 'Login'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Terms Text */}
        <ThemedText style={styles.termsText}>
          By continuing, you agree to our{' '}
          <ThemedText
            style={styles.linkText}
            onPress={() => Linking.openURL('https://sifia.app/terms')}
          >
            Terms of Service
          </ThemedText>
          {' '}and{' '}
          <ThemedText
            style={styles.linkText}
            onPress={() => Linking.openURL('https://sifia.app/privacy')}
          >
            Privacy Policy
          </ThemedText>
        </ThemedText>
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
    marginTop: 56,
    marginBottom: OnboardingSpacing.md,
  },
  logoImage: {
    width: 120,
    height: 120,
  },

  // Carousel Styles
  carouselContainer: {
    alignItems: 'center',
  },
  slideContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },

  // Slide Content Styles
  iconContainer: {
    ...OnboardingStyles.iconContainer,
    marginBottom: 24,
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    ...OnboardingStyles.mainTitle,
    marginBottom: OnboardingSpacing.md,
    textAlign: 'center',
  },
  slideSubtitle: {
    ...OnboardingStyles.subtitle,
    marginBottom: OnboardingSpacing.xxl,
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
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  dot: OnboardingStyles.dot,
  activeDot: OnboardingStyles.activeDot,

  // Button Section
  buttonSection: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: OnboardingSpacing.lg,
  },
  createButton: OnboardingStyles.primaryButton,
  createButtonText: OnboardingStyles.primaryButtonText,

  // Fix login button to match primary button styling
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 12,
  },
  loginButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.system.medium,
    marginLeft: 12,
    fontWeight: '500',
  },

  termsText: {
    ...OnboardingStyles.termsText,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  linkText: OnboardingStyles.linkText,
  iconMarginTop: {
    marginTop: 2,
  },
});

export default withErrorBoundary(OnboardingWelcomeScreen, 'OnboardingWelcomeScreen');
