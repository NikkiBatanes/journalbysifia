/**
 * OnboardingFeatureShowcaseScreen.tsx
 * Phase 4.1: Core Features Showcase
 * Accurate feature representation, no audio/video claims
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  benefits: string[];
  demoText: string;
}

const features: Feature[] = [
  {
    id: 'playbooks',
    title: 'Personalized Playbooks',
    description: 'AI-generated biblical guidance tailored to your specific life challenges',
    icon: 'book',
    benefits: [
      'Custom action steps with subtasks',
      'Biblical affirmations for encouragement',
      'Scripture-backed solutions',
      'Progress tracking and insights',
    ],
    demoText: 'Like the playbook we just created for your challenge!',
  },
  {
    id: 'journaling',
    title: 'Smart Journaling',
    description: 'Guided reflection integrated with your playbook progress',
    icon: 'journal',
    benefits: [
      'Reflection prompts from your playbooks',
      'Progress visualization',
      'Spiritual growth tracking',
      'Personal insights discovery',
    ],
    demoText: 'Journal about your action steps and see your growth over time.',
  },
  {
    id: 'devotionals',
    title: 'Generated Devotionals',
    description: 'Personalized devotionals created FROM your playbooks',
    icon: 'heart',
    benefits: [
      'Devotionals based on your playbooks',
      'Daily spiritual nourishment',
      'Reflection questions included',
      'Prayer prompts and guidance',
    ],
    demoText: 'Each playbook can generate multiple devotionals for deeper study.',
  },
  {
    id: 'progress',
    title: 'Progress Tracking',
    description: 'Visual insights into your spiritual transformation journey',
    icon: 'trending-up',
    benefits: [
      'Completion tracking for action steps',
      'Spiritual growth metrics',
      'Achievement celebrations',
      'Consistency insights',
    ],
    demoText: 'See how consistently you\'re growing in your faith journey.',
  },
];

const OnboardingFeatureShowcaseScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [currentFeature, setCurrentFeature] = useState(0);
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

  const animateFeatureChange = (direction: 'next' | 'prev') => {
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
    if (currentFeature < features.length - 1) {
      animateFeatureChange('next');
      setCurrentFeature(currentFeature + 1);
    } else {
      handleContinue();
    }
  };

  const handlePrevious = () => {
    if (currentFeature > 0) {
      animateFeatureChange('prev');
      setCurrentFeature(currentFeature - 1);
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      console.log('🎯 Feature showcase completed, proceeding to playbook navigation');

      // Navigate to playbook navigation demo
      navigation.navigate('OnboardingPlaybookNavigation' as any, {
        generatedPlaybook: (route.params as any)?.generatedPlaybook,
      });
    } catch (error) {
      console.error('Error proceeding to playbook navigation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentFeatureData = features[currentFeature];

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Discover Your Spiritual Growth Tools</Text>
          <Text style={styles.subtitle}>
            Everything you need to transform challenges into spiritual victories
          </Text>
        </View>

        {/* Feature indicators */}
        <View style={styles.featureIndicators}>
          {features.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.featureIndicator,
                index === currentFeature && styles.featureIndicatorActive,
              ]}
              onPress={() => {
                if (index !== currentFeature) {
                  animateFeatureChange(index > currentFeature ? 'next' : 'prev');
                  setCurrentFeature(index);
                }
              }}
            />
          ))}
        </View>

        {/* Feature content */}
        <ScrollView
          contentContainerStyle={styles.featureContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Feature icon */}
          <View style={styles.featureIconContainer}>
            <Ionicons
              name={currentFeatureData.icon as any}
              size={64}
              color={Colors.white}
            />
          </View>

          {/* Feature details */}
          <Text style={styles.featureTitle}>{currentFeatureData.title}</Text>
          <Text style={styles.featureDescription}>{currentFeatureData.description}</Text>

          {/* Demo text */}
          <View style={styles.demoContainer}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.lightBlue} />
            <Text style={styles.demoText}>{currentFeatureData.demoText}</Text>
          </View>

          {/* Benefits list */}
          <View style={styles.benefitsList}>
            <Text style={styles.benefitsTitle}>Key Benefits:</Text>
            {currentFeatureData.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Feature preview card */}
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Ionicons name={currentFeatureData.icon as any} size={24} color={Colors.anchorBlue} />
              <Text style={styles.previewTitle}>{currentFeatureData.title}</Text>
            </View>
            <Text style={styles.previewDescription}>
              {currentFeature === 0 && 'Your personalized playbooks will appear here, ready to guide you through any challenge.'}
              {currentFeature === 1 && 'Write reflections, track progress, and discover insights about your spiritual growth.'}
              {currentFeature === 2 && 'Daily devotionals generated from your playbooks for deeper spiritual nourishment.'}
              {currentFeature === 3 && 'Visual charts and insights showing your consistency and spiritual growth over time.'}
            </Text>
          </View>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, currentFeature === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentFeature === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentFeature === 0 ? Colors.hopeWhite : Colors.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {currentFeature === features.length - 1
                ? (isLoading ? 'Loading...' : 'Try Your Playbook')
                : 'Next Feature'
              }
            </Text>
            <Ionicons
              name={currentFeature === features.length - 1 ? 'play' : 'chevron-forward'}
              size={20}
              color={Colors.anchorBlue}
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Step 5 of 6</Text>
          <View style={styles.progressBar}>
              <View style={[styles.progressFill, styles.progressStep5]} />
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  featureIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  featureIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.3,
  },
  featureIndicatorActive: {
    opacity: 1,
    backgroundColor: Colors.white,
    width: 24,
  },
  featureContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  featureIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  featureDescription: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  demoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  demoText: {
    fontSize: 14,
    color: Colors.lightBlue,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  benefitsList: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginLeft: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: Colors.anchorBlue,
    lineHeight: 20,
    opacity: 0.8,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  progressStep5: {
    width: '83.33%',
  },
});

export default OnboardingFeatureShowcaseScreen;
