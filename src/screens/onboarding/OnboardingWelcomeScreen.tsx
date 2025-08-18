/**
 * OnboardingWelcomeScreen.tsx
 * Welcome slideshow with three feature slides
 * Shows Biblical Wisdom, Personalized Playbooks, and Smart Journaling
 */

import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { OnboardingStyles, OnboardingSpacing } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';

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

const OnboardingWelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated, user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const flatListRef = useRef<FlatList>(null);
  // Note: translateX was previously defined but unused; removed to satisfy lint.

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
        if (!isAuthenticated) return;
        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};

          if (!isActive || !target) return;

          try {
            (navigation as any).reset?.({ index: 0, routes: [{ name: target, params }] });
          } catch {
            (navigation as any).navigate(target as any, params);
          }
          try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
          return;
        }

        // No redirect key present; if authenticated, forward to personalization by default
        const displayName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || '';
        try {
          (navigation as any).reset?.({ index: 0, routes: [{ name: 'OnboardingPersonalization', params: { name: displayName, registrationMethod: 'email' } }] });
        } catch {
          (navigation as any).navigate('OnboardingPersonalization' as any, { name: displayName, registrationMethod: 'email' });
        }
      } catch (e) {
        // Non-fatal: ignore
      }
    });

    return () => {
      isActive = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isAuthenticated, navigation]);

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
    setIsLoading(true);
    setTimeout(() => {
      if (isAuthenticated) {
        // If already authenticated, go to personalization
        navigation.navigate('OnboardingPersonalization' as any, {
          name: user?.user_metadata?.first_name || user?.email?.split('@')[0] || '',
          registrationMethod: 'email',
        });
      } else {
        // If not authenticated, go to registration
        navigation.navigate('Auth', { screen: 'Register' });
      }
      setIsLoading(false);
    }, 500);
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setTimeout(() => {
      if (isAuthenticated) {
        // If already authenticated, go to personalization
        navigation.navigate('OnboardingPersonalization' as any, {
          name: user?.user_metadata?.first_name || user?.email?.split('@')[0] || '',
          registrationMethod: 'email',
        });
      } else {
        // If not authenticated, go to login
        navigation.navigate('Auth', { screen: 'Login' });
      }
      setIsLoading(false);
    }, 500);
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slideContainer, { width }]}>
      {/* Slide Icon */}
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={item.iconSize || 60} color={item.color} />
      </View>

      {/* Slide Title */}
      <Text style={styles.slideTitle}>{item.title}</Text>

      {/* Slide Subtitle */}
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

      {/* Features List */}
      <View style={styles.featuresList}>
        {item.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.iconMarginTop} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.container}>
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
            <Text style={styles.createButtonText}>
              {isAuthenticated ? 'Continue Setup' : 'Create an account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isAuthenticated ? 'Get Started' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms Text */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
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
    marginBottom: 10,
  },
  logoImage: OnboardingStyles.logoImage,

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

export default OnboardingWelcomeScreen;
