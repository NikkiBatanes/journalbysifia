/**
 * OnboardingValuePropositionScreen.tsx
 * Phase 3.1: Three-Slide Value Proposition
 * Individual focus, no community claims, accurate feature representation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

interface ValueSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  features: string[];
}

const valueSlides: ValueSlide[] = [
  {
    id: 1,
    title: 'Biblical Wisdom for Modern Challenges',
    subtitle: 'Get practical, scripture-based guidance',
    description: 'Transform life\'s toughest moments into opportunities for spiritual growth with personalized biblical insights.',
    icon: 'book',
    features: [
      'AI-powered biblical guidance',
      'Personalized to your situation',
      'Practical daily application',
      'Scripture-backed solutions',
    ],
  },
  {
    id: 2,
    title: 'Personalized Growth Plans',
    subtitle: 'AI-powered playbooks tailored to your struggles',
    description: 'Receive step-by-step action plans that turn spiritual insights into measurable progress.',
    icon: 'trending-up',
    features: [
      'Custom playbooks for your challenges',
      'Actionable steps with subtasks',
      'Progress tracking and insights',
      'Biblical affirmations included',
    ],
  },
  {
    id: 3,
    title: 'Smart Journaling & Devotionals',
    subtitle: 'Generated devotionals from your playbooks',
    description: 'Track your spiritual transformation with guided reflection and devotionals created from your personal growth journey.',
    icon: 'journal',
    features: [
      'Devotionals from your playbooks',
      'Guided reflection questions',
      'Progress visualization',
      'Personal transformation tracking',
    ],
  },
];

const OnboardingValuePropositionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const animateSlideChange = (direction: 'next' | 'prev') => {
    const slideValue = direction === 'next' ? -50 : 50;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
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
    if (currentSlide < valueSlides.length - 1) {
      animateSlideChange('next');
      setCurrentSlide(currentSlide + 1);
    } else {
      handleContinue();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      animateSlideChange('prev');
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      console.log('🎯 Value proposition completed, proceeding to challenge selection');

      // Navigate to challenge selection
      navigation.navigate('OnboardingChallengeSelection' as any);
    } catch (error) {
      console.error('Error proceeding to challenge selection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentSlideData = valueSlides[currentSlide];

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
        {/* Header with slide indicator */}
        <View style={styles.header}>
          <View style={styles.slideIndicators}>
            {valueSlides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.slideIndicator,
                  index === currentSlide && styles.slideIndicatorActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Slide content */}
        <View style={styles.slideContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={currentSlideData.icon as any}
              size={64}
              color={Colors.white}
            />
          </View>

          {/* Title and subtitle */}
          <Text style={styles.title}>{currentSlideData.title}</Text>
          <Text style={styles.subtitle}>{currentSlideData.subtitle}</Text>
          <Text style={styles.description}>{currentSlideData.description}</Text>

          {/* Features list */}
          <View style={styles.featuresList}>
            {currentSlideData.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, currentSlide === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentSlide === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentSlide === 0 ? Colors.hopeWhite : Colors.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {currentSlide === valueSlides.length - 1
                ? (isLoading ? 'Loading...' : 'Get Started')
                : 'Next'
              }
            </Text>
            <Ionicons
              name={currentSlide === valueSlides.length - 1 ? 'arrow-forward' : 'chevron-forward'}
              size={20}
              color={Colors.anchorBlue}
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Step 3 of 6</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, styles.progressStep3]} />
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  slideIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.3,
  },
  slideIndicatorActive: {
    opacity: 1,
    backgroundColor: Colors.white,
    width: 24,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.lightBlue,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresList: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    color: Colors.white,
    marginLeft: 12,
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  primaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressStep3: {
    width: '50%',
  },
});

export default OnboardingValuePropositionScreen;
