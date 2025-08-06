/**
 * OnboardingWelcomeScreen.tsx
 * Welcome slideshow with three feature slides
 * Shows Biblical Wisdom, Personalized Playbooks, and Smart Journaling
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { OnboardingStyles, OnboardingTypography, OnboardingSpacing } from '../../theme/onboardingStyles';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  features: string[];
  icon: string;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Biblical Wisdom for\nYour Challenges',
    subtitle: 'Transform life\'s struggles with\nscripture-based guidance.',
    features: [
      'AI-powered insights tailored to your situation',
      'Practical steps for daily application',
      'Scripture-backed solutions for growth'
    ],
    icon: 'book-outline',
    color: '#FF6B6B'
  },
  {
    id: 2,
    title: 'Personalized Playbooks\nfor Your Journey',
    subtitle: 'Turn faith into action with\nstep-by-step plans',
    features: [
      'Custom playbooks for your unique challenges',
      'Actionable steps with clear subtasks',
      'Progress tracking with biblical affirmations'
    ],
    icon: 'map-outline',
    color: '#4ECDC4'
  },
  {
    id: 3,
    title: 'Smart Journaling &\nDevotionals',
    subtitle: 'Deepen your faith with guided\nreflection and inspiration.',
    features: [
      'Custom devotionals built from your playbooks',
      'AI-guided journaling for personal insights',
      'Progress visualization to track your growth'
    ],
    icon: 'create-outline',
    color: '#45B7D1'
  }
];

const OnboardingWelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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

  // Auto slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const nextSlide = (prev + 1) % slides.length;
        if (nextSlide !== prev) {
          animateSlideChange('next');
        }
        return nextSlide;
      });
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const animateSlideChange = (direction: 'next' | 'prev') => {
    const slideValue = direction === 'next' ? -30 : 30;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: slideValue,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      animateSlideChange('next');
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      animateSlideChange('prev');
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    setTimeout(() => {
      navigation.navigate('Auth', { screen: 'Register' });
      setIsLoading(false);
    }, 500);
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setTimeout(() => {
      navigation.navigate('Auth', { screen: 'Login' });
      setIsLoading(false);
    }, 500);
  };

  const currentSlideData = slides[currentSlide];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Slide Content */}
        <Animated.View
          style={[
            styles.slideContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Slide Icon */}
          <View style={[styles.iconContainer, { backgroundColor: currentSlideData.color + '20' }]}>
            <Ionicons name={currentSlideData.icon} size={60} color={currentSlideData.color} />
          </View>

          {/* Slide Title */}
          <Text style={styles.slideTitle}>{currentSlideData.title}</Text>

          {/* Slide Subtitle */}
          <Text style={styles.slideSubtitle}>{currentSlideData.subtitle}</Text>

          {/* Features List */}
          <View style={styles.featuresList}>
            {currentSlideData.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Navigation Dots */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.activeDot
              ]}
              onPress={() => setCurrentSlide(index)}
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
              Create an account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              Login
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: OnboardingStyles.container,
  scrollContent: OnboardingStyles.scrollContent,
  logoSection: OnboardingStyles.logoSection,
  logoImage: OnboardingStyles.logoImage,
  slideContent: {
    alignItems: 'center',
    marginBottom: OnboardingSpacing.xxxl,
  },
  iconContainer: OnboardingStyles.iconContainer,
  slideTitle: {
    ...OnboardingStyles.mainTitle,
    marginBottom: OnboardingSpacing.md,
  },
  slideSubtitle: {
    ...OnboardingStyles.subtitle,
    marginBottom: OnboardingSpacing.xxl,
  },
  featuresList: OnboardingStyles.featuresList,
  featureItem: OnboardingStyles.featureItem,
  featureText: OnboardingStyles.featureText,
  dotsContainer: OnboardingStyles.dotsContainer,
  dot: OnboardingStyles.dot,
  activeDot: OnboardingStyles.activeDot,

  buttonSection: {
    width: '100%',
    marginBottom: OnboardingSpacing.lg,
  },
  createButton: OnboardingStyles.primaryButton,
  createButtonText: OnboardingStyles.primaryButtonText,
  loginButton: OnboardingStyles.secondaryButton,
  loginButtonText: OnboardingStyles.secondaryButtonText,
  termsText: OnboardingStyles.termsText,
  linkText: OnboardingStyles.linkText,
});

export default OnboardingWelcomeScreen;
