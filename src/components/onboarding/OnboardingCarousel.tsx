/**
 * Modern Onboarding Carousel
 * Inspired by Headway and other successful onboarding patterns
 * Focuses on value demonstration and social proof
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  backgroundColor: string;
  illustration: 'brain' | 'growth' | 'community' | 'success';
  socialProof?: {
    metric: string;
    description: string;
  };
}

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingCarousel: React.FC<Props> = ({ onComplete, onSkip }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [_fadeAnim] = useState(new Animated.Value(1));
  const scrollViewRef = useRef<ScrollView>(null);

  const slides: OnboardingSlide[] = [
    {
      id: 'growth',
      title: 'Your Faith Journey',
      subtitle: 'Personalized & Guided',
      description: 'AI-powered spiritual growth tailored to your unique journey and goals',
      icon: 'trending-up',
      backgroundColor: Colors.growthGreen,
      illustration: 'growth',
      socialProof: {
        metric: '10,000+',
        description: 'believers growing daily',
      },
    },
    {
      id: 'wisdom',
      title: 'Bite-Sized Wisdom',
      subtitle: 'Just 5 Minutes Daily',
      description: 'Powerful devotions and insights that fit your busy schedule',
      icon: 'book',
      backgroundColor: Colors.anchorBlue,
      illustration: 'brain',
      socialProof: {
        metric: '95%',
        description: 'complete their daily reading',
      },
    },
    {
      id: 'community',
      title: 'Faith Community',
      subtitle: 'Never Walk Alone',
      description: 'Connect with believers on similar journeys and grow together',
      icon: 'people',
      backgroundColor: Colors.spiritualPink,
      illustration: 'community',
      socialProof: {
        metric: '4.9★',
        description: 'average user rating',
      },
    },
  ];

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
    } else {
      onComplete();
    }
  }, [currentIndex, slides.length, onComplete]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentIndex < slides.length - 1) {
        handleNext();
      }
    }, 4000); // Auto-advance every 4 seconds

    return () => clearInterval(timer);
  }, [currentIndex, handleNext, slides.length]);



  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      scrollViewRef.current?.scrollTo({
        x: prevIndex * width,
        animated: true,
      });
    }
  };

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const renderIllustration = (type: string, color: string) => {
    const iconSize = 80;

    switch (type) {
      case 'growth':
        return (
          <View style={[styles.illustrationContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name="trending-up" size={iconSize} color={color} />
            <View style={[styles.illustrationAccent, { backgroundColor: color }]} />
          </View>
        );
      case 'brain':
        return (
          <View style={[styles.illustrationContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name="bulb" size={iconSize} color={color} />
            <View style={[styles.illustrationAccent, { backgroundColor: color }]} />
          </View>
        );
      case 'community':
        return (
          <View style={[styles.illustrationContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name="people" size={iconSize} color={color} />
            <View style={[styles.illustrationAccent, { backgroundColor: color }]} />
          </View>
        );
      default:
        return (
          <View style={[styles.illustrationContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name="star" size={iconSize} color={color} />
          </View>
        );
    }
  };

  const renderSlide = (slide: OnboardingSlide, _index: number) => (
    <View key={slide.id} style={styles.slide}>
      <View style={styles.slideContent}>
        {/* Illustration */}
        <View style={styles.illustrationWrapper}>
          {renderIllustration(slide.illustration, slide.backgroundColor)}
        </View>

        {/* Content */}
        <View style={styles.textContent}>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>

          {/* Social Proof */}
          {slide.socialProof && (
            <View style={styles.socialProofContainer}>
              <Text style={[styles.socialProofMetric, { color: slide.backgroundColor }]}>
                {slide.socialProof.metric}
              </Text>
              <Text style={styles.socialProofDescription}>
                {slide.socialProof.description}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, _index) => renderSlide(slide, _index))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Page Indicators */}
        <View style={styles.pageIndicators}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.pageIndicator,
                index === currentIndex
                  ? {
                      ...styles.pageIndicatorActive,
                      backgroundColor: slides[currentIndex].backgroundColor,
                    }
                  : styles.pageIndicatorInactive,
              ]}
            />
          ))}
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentIndex > 0 && (
            <TouchableOpacity onPress={handlePrevious} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={Colors.mediumGray} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            style={[
              styles.continueButton,
              { backgroundColor: slides[currentIndex].backgroundColor },
            ]}
          >
            <Text style={styles.continueButtonText}>
              {currentIndex === slides.length - 1 ? "Let's Start" : 'Continue'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: Colors.mediumGray,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 20,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationWrapper: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  illustrationAccent: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.8,
  },
  textContent: {
    flex: 0.6,
    alignItems: 'center',
    paddingTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.darkerGray,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  socialProofContainer: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  socialProofMetric: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  socialProofDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageIndicator: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  pageIndicatorActive: {
    width: 24,
  },
  pageIndicatorInactive: {
    width: 8,
    backgroundColor: Colors.lightGray,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default OnboardingCarousel;
