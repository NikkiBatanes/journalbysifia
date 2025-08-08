/**
 * OnboardingOriginalFeatureShowcaseScreen.tsx
 * Original Feature Showcase Screen - Detailed feature presentation
 * Shows comprehensive features with descriptions and benefits
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
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

import { Colors } from '../../theme/colors';
import { OnboardingStyles, OnboardingTypography } from '../../theme/onboardingStyles';

interface DetailedFeature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  benefits: string[];
  color: string;
}

const detailedFeatures: DetailedFeature[] = [
  {
    id: 'ai_guidance',
    title: 'AI-Powered Biblical Guidance',
    subtitle: 'Personalized wisdom for every challenge',
    description: 'Get scripture-based advice tailored to your specific life situations, powered by advanced AI that understands context and provides relevant biblical insights.',
    icon: 'book-outline',
    benefits: [
      'Contextual scripture recommendations',
      'Personalized biblical interpretations',
      'Daily wisdom for decision making',
      'Historical and cultural context',
    ],
    color: Colors.alertCoral,
  },
  {
    id: 'smart_playbooks',
    title: 'Smart Action Playbooks',
    subtitle: 'Step-by-step spiritual growth plans',
    description: 'Receive detailed, actionable plans that break down your spiritual goals into manageable steps with biblical foundations and practical applications.',
    icon: 'library-outline',
    benefits: [
      'Customized growth strategies',
      'Progress tracking and milestones',
      'Biblical foundation for each step',
      'Adaptive plans that evolve with you',
    ],
    color: Colors.alertCoral,
  },
  {
    id: 'reflective_journaling',
    title: 'Reflective Journaling & Devotionals',
    subtitle: 'Deepen your spiritual connection',
    description: 'Experience guided reflection through intelligent journaling prompts and personalized devotionals that help you process life events through a faith lens.',
    icon: 'journal-outline',
    benefits: [
      'Guided reflection questions',
      'Mood and spiritual health tracking',
      'Personalized devotional content',
      'Prayer request management',
    ],
    color: Colors.alertCoral,
  },
  {
    id: 'community_support',
    title: 'Faith Community Connection',
    subtitle: 'Connect with like-minded believers',
    description: 'Join a supportive community of believers who share similar challenges and growth goals, fostering accountability and encouragement.',
    icon: 'people-outline',
    benefits: [
      'Anonymous sharing options',
      'Prayer circle participation',
      'Accountability partnerships',
      'Group challenges and activities',
    ],
    color: Colors.alertCoral,
  },
];

const OnboardingOriginalFeatureShowcaseScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const params = route.params as any;
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

  const handleNext = () => {
    if (currentFeature < detailedFeatures.length - 1) {
      setCurrentFeature(currentFeature + 1);
    } else {
      handleGetStarted();
    }
  };

  const handlePrevious = () => {
    if (currentFeature > 0) {
      setCurrentFeature(currentFeature - 1);
    }
  };

  const handleGetStarted = async () => {
    setIsLoading(true);
    try {
      // Check if we have a generated playbook (coming from onboarding flow)
      if (params?.generatedPlaybook) {
        console.log('[FeatureShowcase] Continuing onboarding flow to playbook navigation');
        // Continue the onboarding flow to playbook navigation
        navigation.navigate('OnboardingPlaybookNavigation' as any, {
          generatedPlaybook: params.generatedPlaybook,
        });
        return;
      }

      // No playbook means user is accessing feature showcase independently
      if (user?.id) {
        // Check if user has completed onboarding
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (userProfile?.onboarding_completed) {
          // User has completed onboarding, go to main app
          console.log('[FeatureShowcase] User has completed onboarding, navigating to MainTabs');
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' as never }],
          });
          return;
        }
      }

      // User hasn't completed onboarding and no playbook, start personalization
      let displayName = '';
      if (user) {
        displayName = (user.user_metadata?.first_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '').trim();
      }

      console.log('[FeatureShowcase] Starting onboarding from personalization');
      navigation.navigate('OnboardingPersonalization' as any, { name: displayName });
    } catch (error) {
      console.error('Error proceeding from feature showcase:', error);
      // Fallback to personalization on error
      navigation.navigate('OnboardingPersonalization' as any);
    } finally {
      setIsLoading(false);
    }
  };

  const currentFeatureData = detailedFeatures[currentFeature];

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Features</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentFeature + 1} of {detailedFeatures.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentFeature + 1) / detailedFeatures.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Feature Content */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.featureContainer}>
            {/* Feature Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${currentFeatureData.color}20` }]}>
              <Ionicons
                name={currentFeatureData.icon}
                size={48}
                color={currentFeatureData.color}
              />
            </View>

            {/* Feature Title & Subtitle */}
            <Text style={[OnboardingStyles.sectionTitle, styles.featureTitle]}>
              {currentFeatureData.title}
            </Text>
            <Text style={[OnboardingStyles.subtitle, styles.featureSubtitle]}>
              {currentFeatureData.subtitle}
            </Text>

            {/* Feature Description */}
            <Text style={[OnboardingStyles.description, styles.featureDescription]}>
              {currentFeatureData.description}
            </Text>

            {/* Benefits List */}
            <View style={styles.benefitsList}>
              <Text style={styles.benefitsTitle}>Key Benefits:</Text>
              {currentFeatureData.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.alertCoral} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Navigation Controls */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, currentFeature === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentFeature === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentFeature === 0 ? 'rgba(255,255,255,0.3)' : Colors.hopeWhite}
            />
          </TouchableOpacity>

          <View style={styles.dotsContainer}>
            {detailedFeatures.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentFeature && styles.activeDot,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNext}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[OnboardingStyles.primaryButton, styles.actionButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={currentFeature === detailedFeatures.length - 1 ? handleGetStarted : handleNext}
            disabled={isLoading}
          >
            <Text style={[OnboardingStyles.primaryButtonText, styles.actionButtonText]}>
              {isLoading
                ? 'Loading...'
                : currentFeature === detailedFeatures.length - 1
                  ? 'Get Started'
                  : 'Next Feature'
              }
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[OnboardingStyles.secondaryButton, styles.skipButton]}
            onPress={handleGetStarted}
          >
            <Text style={[OnboardingStyles.secondaryButtonText, styles.skipButtonText]}>
              Skip Tour
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: OnboardingStyles.container,
  content: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...OnboardingTypography.sectionTitle,
    color: Colors.hopeWhite,
  },
  headerRight: {
    width: 40,
  },
  progressContainer: OnboardingStyles.progressContainer,
  progressText: OnboardingStyles.progressText,
  progressBar: OnboardingStyles.progressBar,
  progressFill: OnboardingStyles.progressFill,
  scrollContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  featureContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  featureSubtitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  featureDescription: {
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  benefitsList: {
    width: '100%',
    paddingHorizontal: 16,
  },
  benefitsTitle: {
    ...OnboardingTypography.body,
    color: Colors.hopeWhite,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  benefitText: {
    ...OnboardingTypography.caption,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dotsContainer: OnboardingStyles.dotsContainer,
  dot: OnboardingStyles.dot,
  activeDot: OnboardingStyles.activeDot,
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  actionButton: {
    marginBottom: 12,
  },
  actionButtonText: {
    // Additional styling if needed
  },
  skipButton: {
    // Additional styling if needed
  },
  skipButtonText: {
    // Additional styling if needed
  },
});

export default OnboardingOriginalFeatureShowcaseScreen;
