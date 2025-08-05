/**
 * Modern Onboarding Screen
 * Orchestrates the new onboarding flow with carousel, assessment, and preview
 * Implements the customer acquisition-focused onboarding strategy
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/IndustryStandardAuthContext';

// Import new onboarding components
import OnboardingCarousel from '../../components/onboarding/OnboardingCarousel';
import SmartAssessment from '../../components/onboarding/SmartAssessment';
import PersonalizedPreview from '../../components/onboarding/PersonalizedPreview';

interface Props {
  navigation: any;
}

type OnboardingStep = 'carousel' | 'assessment' | 'preview' | 'complete';

interface AssessmentResult {
  questionId: string;
  answer: any;
  confidence: number;
  timeSpent: number;
}

interface UserProfile {
  spiritualMaturity: 'new' | 'growing' | 'mature';
  timeAvailability: number;
  primaryGoals: string[];
  learningStyle: 'visual' | 'audio' | 'reading' | 'interactive';
  confidenceScore: number;
}

const ModernOnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const {
    initializeOnboarding,
    updateStepProgress,
    updateFaithJourney,
    updatePersonalizationProfile,
    completeOnboarding,
  } = useOnboarding();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('carousel');
  const [_assessmentResults, _setAssessmentResults] = useState<AssessmentResult[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    // Initialize onboarding tracking
    if (user?.id) {
      initializeOnboarding(user.id).catch(console.error);
    }
  }, [user?.id, initializeOnboarding]);

  const handleCarouselComplete = async () => {
    try {
      // Track carousel completion
      await updateStepProgress({
        step_name: 'welcome_carousel',
        step_number: 1,
        data: {
          completed_slides: 3,
          time_spent: Math.floor((Date.now() - startTime) / 1000),
        },
        time_spent_seconds: Math.floor((Date.now() - startTime) / 1000),
        interactions_count: 1,
        completion_method: 'completed',
      });

      setCurrentStep('assessment');
    } catch (error) {
      console.error('Error tracking carousel completion:', error);
      setCurrentStep('assessment'); // Continue anyway
    }
  };

  const handleCarouselSkip = async () => {
    try {
      // Track carousel skip
      await updateStepProgress({
        step_name: 'welcome_carousel',
        step_number: 1,
        data: {
          skipped: true,
          time_spent: Math.floor((Date.now() - startTime) / 1000),
        },
        time_spent_seconds: Math.floor((Date.now() - startTime) / 1000),
        interactions_count: 1,
        completion_method: 'skipped',
      });

      setCurrentStep('assessment');
    } catch (error) {
      console.error('Error tracking carousel skip:', error);
      setCurrentStep('assessment'); // Continue anyway
    }
  };

  const handleAssessmentComplete = async (results: AssessmentResult[], profile: UserProfile) => {
    try {
      _setAssessmentResults(results);
      setUserProfile(profile);

      // Save assessment results
      await updateStepProgress({
        step_name: 'smart_assessment',
        step_number: 2,
        data: {
          assessment_results: results,
          user_profile: profile,
          questions_answered: results.length,
          avg_confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
        },
        time_spent_seconds: results.reduce((sum, r) => sum + r.timeSpent, 0) / 1000,
        interactions_count: results.length,
        completion_method: 'completed',
      });

      // Update faith journey profile
      await updateFaithJourney({
        spiritual_maturity: mapSpiritualMaturity(profile.spiritualMaturity),
        has_accepted_christ: profile.spiritualMaturity !== 'new',
        areas_of_growth: profile.primaryGoals,
        growth_desires: profile.primaryGoals,
      });

      // Update personalization profile
      await updatePersonalizationProfile({
        learning_style: mapLearningStyle(profile.learningStyle),
        daily_commitment_minutes: profile.timeAvailability,
        preferred_content_length: profile.timeAvailability <= 5 ? 'short' :
                                  profile.timeAvailability <= 15 ? 'medium' : 'long',
        personalization_score: Math.round(profile.confidenceScore * 100),
        confidence_level: Math.round(profile.confidenceScore * 100),
      });

      setCurrentStep('preview');
    } catch (error) {
      console.error('Error saving assessment results:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    }
  };

  const handlePreviewContinue = async () => {
    try {
      if (!userProfile) {return;}

      // Track preview completion
      await updateStepProgress({
        step_name: 'personalized_preview',
        step_number: 3,
        data: {
          user_profile: userProfile,
          recommendations_shown: 4,
          milestones_shown: 4,
        },
        time_spent_seconds: Math.floor((Date.now() - startTime) / 1000),
        interactions_count: 1,
        completion_method: 'completed',
      });

      // Complete onboarding
      await completeOnboarding(user?.id || '');

      // Navigate to first experience or main app
      setCurrentStep('complete');

      // Navigate to the first recommended content or main app
      navigation.replace('MainApp'); // or navigate to first win experience

    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'assessment':
        setCurrentStep('carousel');
        break;
      case 'preview':
        setCurrentStep('assessment');
        break;
      default:
        navigation.goBack();
    }
  };

  // Helper functions to map profile data to database enums
  const mapSpiritualMaturity = (maturity: string) => {
    switch (maturity) {
      case 'new': return 'new_believer';
      case 'growing': return 'growing';
      case 'mature': return 'mature';
      default: return 'unsure';
    }
  };

  const mapLearningStyle = (style: string) => {
    switch (style) {
      case 'visual': return 'visual';
      case 'audio': return 'auditory';
      case 'reading': return 'reading';
      case 'interactive': return 'kinesthetic';
      default: return 'reading';
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'carousel':
        return (
          <OnboardingCarousel
            onComplete={handleCarouselComplete}
            onSkip={handleCarouselSkip}
          />
        );

      case 'assessment':
        return (
          <SmartAssessment
            onComplete={handleAssessmentComplete}
            onBack={handleBack}
          />
        );

      case 'preview':
        return userProfile ? (
          <PersonalizedPreview
            userProfile={userProfile}
            onContinue={handlePreviewContinue}
            onBack={handleBack}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderCurrentStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
});

export default ModernOnboardingScreen;
