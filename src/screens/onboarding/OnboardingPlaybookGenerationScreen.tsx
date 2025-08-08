/**
 * OnboardingPlaybookGenerationScreen.tsx
 * Phase 3.3: REAL Playbook Generation using actual API
 * Shows real AI-generated content, auto-saves to playbooks
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { enhancedGenerationService } from '../../services/enhancedGenerationService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useUserState } from '../../hooks/useUserState';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';

interface RouteParams {
  challengeCategory: string;
  specificChallenge: string;
  userInput: string;
}

interface GeneratedPlaybook {
  id: string;
  title: string;
  truthInLove: string;
  actionSteps: Array<{
    title: string;
    description: string;
    subtasks: string[];
  }>;
  affirmations: string[];
  bibleVerse: {
    text: string;
    reference: string;
  };
  directChallenge: string;
}

const OnboardingPlaybookGenerationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { updateOnboardingStep } = useUserState();
  const params = route.params as RouteParams;

  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedPlaybook, setGeneratedPlaybook] = useState<GeneratedPlaybook | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  const generationSteps = [
    'Analyzing your challenge...',
    'Finding relevant scripture...',
    'Creating action steps...',
    'Generating affirmations...',
    'Finalizing your playbook...',
  ];

  const generatePlaybook = useCallback(async () => {
    try {
      console.log('🎯 Starting real playbook generation with params:', params);

      if (!user?.id) {
        // For demo purposes, create a mock user ID
        console.log('🧪 No user ID, using demo mode');
      }

      const userId = user?.id || 'demo-user-onboarding';
      const userName = (user as any)?.user_metadata?.full_name || 'Friend';

      // Use real generation service
      const response = await enhancedGenerationService.generatePlaybook({
        userId,
        userInput: params.userInput || 'Help me grow in my faith journey',
        userName,
        isOnboarding: true, // Mark as onboarding playbook (free)
      });

      if (response.success && response.queueId) {
        console.log('✅ Playbook generation queued successfully, queueId:', response.queueId);

        // Poll for completion
        const pollForCompletion = async () => {
          const maxAttempts = 30; // 30 attempts = 2.5 minutes max wait
          let attempts = 0;

          const poll = async (): Promise<void> => {
            attempts++;

            try {
              const status = await enhancedGenerationService.checkGenerationStatus(response.queueId!);
              console.log(`[Polling ${attempts}/${maxAttempts}] Status:`, status.status);

              if (status.status === 'completed' && status.resultId) {
                // Get the actual playbook from database
                console.log('🎯 Playbook completed, fetching from database...');

                // Import supabase to fetch the playbook
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  process.env.EXPO_PUBLIC_SUPABASE_URL!,
                  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data: playbook, error } = await supabase
                  .from('playbooks')
                  .select('*')
                  .eq('id', status.resultId)
                  .single();

                if (playbook && !error) {
                  console.log('✅ Real playbook fetched from database:', playbook.title);

                  // Convert database playbook to UI format
                  const realGeneratedPlaybook: GeneratedPlaybook = {
                    id: playbook.id,
                    title: playbook.title,
                    truthInLove: playbook.truth_in_love || playbook.content?.truthInLove || 'God loves you and is with you in this journey.',
                    actionSteps: playbook.action_steps || playbook.content?.actionSteps || [],
                    affirmations: playbook.affirmations || playbook.content?.affirmations || [
                      'I am loved unconditionally by God',
                      'God gives me strength for each challenge',
                      'I can find peace in God\'s presence',
                    ],
                    bibleVerse: playbook.bible_verse || playbook.content?.bibleVerse || {
                      text: 'Cast all your anxiety on him because he cares for you.',
                      reference: '1 Peter 5:7',
                    },
                    directChallenge: playbook.direct_challenge || playbook.content?.directChallenge || 'Take one step forward in faith this week.',
                  };

                  setGeneratedPlaybook(realGeneratedPlaybook);
                  setIsGenerating(false);

                  // Animate content appearance
                  Animated.timing(contentFadeAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                  }).start();

                  console.log('✅ Real playbook generation completed and displayed');
                } else {
                  console.error('❌ Error fetching playbook from database:', error);
                  throw new Error('Failed to fetch generated playbook');
                }

              } else if (status.status === 'failed') {
                throw new Error(status.message || 'Playbook generation failed');
              } else if (attempts >= maxAttempts) {
                throw new Error('Playbook generation timed out. Please try again.');
              } else {
                // Continue polling
                setTimeout(poll, 5000); // Poll every 5 seconds
              }
            } catch (error) {
              console.error('❌ Error during polling:', error);
              throw error;
            }
          };

          // Start polling
          setTimeout(poll, 2000); // Wait 2 seconds before first poll
        };

        pollForCompletion().catch((error) => {
          console.error('❌ Playbook generation failed:', error);
          setGenerationError(error.message || 'Failed to generate playbook. Please try again.');
          setIsGenerating(false);
        });

      } else {
        throw new Error(response.message || 'Failed to generate playbook');
      }

    } catch (error) {
      console.error('❌ Error generating playbook:', error);
      setGenerationError('Unable to generate your playbook. Please try again.');
      setIsGenerating(false);
    }
  }, [params, user, contentFadeAnim]);

  useEffect(() => {
    // Start entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Start playbook generation
    generatePlaybook();
  }, [fadeAnim, generatePlaybook]);

  useEffect(() => {
    if (isGenerating) {
      // Animate through generation steps
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = prev + 1;
          if (nextStep >= generationSteps.length) {
            clearInterval(stepInterval);
            return prev;
          }

          // Animate progress bar
          Animated.timing(progressAnim, {
            toValue: (nextStep / generationSteps.length) * 100,
            duration: 800,
            useNativeDriver: false,
          }).start();

          return nextStep;
        });
      }, 1500);

      return () => clearInterval(stepInterval);
    }
  }, [isGenerating, generationSteps.length, progressAnim]);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      // Update onboarding progress
      updateOnboardingStep('playbook_generated', 3);

      console.log('📚 Playbook completed, proceeding to feature exploration');

      // Navigate to playbook navigation screen (Phase 4)
      navigation.navigate('OnboardingPlaybookNavigation' as any, {
        generatedPlaybook,
      });
    } catch (error) {
      console.error('Error proceeding to feature showcase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setGenerationError(null);
    setIsGenerating(true);
    setCurrentStep(0);
    setGeneratedPlaybook(null);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    generatePlaybook();
  };

  if (generationError) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.white} />
          <Text style={styles.errorTitle}>Generation Failed</Text>
          <Text style={styles.errorMessage}>{generationError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Progress Indicator */}
        <OnboardingProgressIndicator compact />

        {isGenerating ? (
          // Generation in progress
          <View style={styles.generationContainer}>
            <View style={styles.generationHeader}>
              <Text style={styles.generationTitle}>Creating Your Personal Playbook</Text>
              <Text style={styles.generationSubtitle}>
                Using AI and biblical wisdom to address: {params.specificChallenge}
              </Text>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={styles.currentStepText}>
                {generationSteps[Math.min(currentStep, generationSteps.length - 1)]}
              </Text>
            </View>

            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="large" color={Colors.white} />
            </View>
          </View>
        ) : (
          // Generated playbook display
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.playbookContent, { opacity: contentFadeAnim }]}>
              {/* Success header */}
              <View style={styles.successHeader}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.lightBlue} />
                <Text style={styles.successTitle}>Your Playbook is Ready!</Text>
                <Text style={styles.successSubtitle}>
                  Here's your personalized biblical guidance for {params.specificChallenge}
                </Text>
              </View>

              {generatedPlaybook && (
                <>
                  {/* Playbook title */}
                  <View style={styles.playbookSection}>
                    <Text style={styles.playbookTitle}>{generatedPlaybook.title}</Text>
                  </View>

                  {/* Truth in Love */}
                  <View style={styles.playbookSection}>
                    <Text style={styles.sectionTitle}>Truth in Love</Text>
                    <Text style={styles.truthText}>{generatedPlaybook.truthInLove}</Text>
                  </View>

                  {/* Action Steps Preview */}
                  <View style={styles.playbookSection}>
                    <Text style={styles.sectionTitle}>Action Steps ({generatedPlaybook.actionSteps.length})</Text>
                    {generatedPlaybook.actionSteps.slice(0, 2).map((step, index) => (
                      <View key={index} style={styles.actionStepPreview}>
                        <Text style={styles.actionStepTitle}>{index + 1}. {step.title}</Text>
                        <Text style={styles.actionStepDescription}>{step.description}</Text>
                      </View>
                    ))}
                    {generatedPlaybook.actionSteps.length > 2 && (
                      <Text style={styles.moreStepsText}>
                        +{generatedPlaybook.actionSteps.length - 2} more steps in your full playbook
                      </Text>
                    )}
                  </View>

                  {/* Affirmations */}
                  <View style={styles.playbookSection}>
                    <Text style={styles.sectionTitle}>Your Affirmations</Text>
                    {generatedPlaybook.affirmations.map((affirmation, index) => (
                      <View key={index} style={styles.affirmationItem}>
                        <Ionicons name="heart" size={16} color={Colors.lightBlue} />
                        <Text style={styles.affirmationText}>{affirmation}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Bible Verse */}
                  <View style={styles.playbookSection}>
                    <Text style={styles.sectionTitle}>Your Verse</Text>
                    <View style={styles.verseContainer}>
                      <Text style={styles.verseText}>"{generatedPlaybook.bibleVerse.text}"</Text>
                      <Text style={styles.verseReference}>— {generatedPlaybook.bibleVerse.reference}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Continue button */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                  onPress={handleContinue}
                  disabled={isLoading}
                >
                  <Text style={styles.continueButtonText}>
                    {isLoading ? 'Loading...' : 'Explore More Features'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
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
          </ScrollView>
        )}
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
  generationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generationHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  generationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  generationSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  progressSection: {
    width: '100%',
    marginBottom: 48,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.lightBlue,
    borderRadius: 4,
  },
  currentStepText: {
    fontSize: 16,
    color: Colors.white,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingIndicator: {
    marginTop: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  scrollContent: {
    flexGrow: 1,
  },
  playbookContent: {
    flex: 1,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 12,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  playbookSection: {
    marginBottom: 24,
  },
  playbookTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.lightBlue,
    marginBottom: 12,
  },
  truthText: {
    fontSize: 16,
    color: Colors.white,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  actionStepPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  actionStepDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  moreStepsText: {
    fontSize: 14,
    color: Colors.lightBlue,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  affirmationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  affirmationText: {
    fontSize: 16,
    color: Colors.white,
    marginLeft: 8,
    flex: 1,
    lineHeight: 22,
  },
  verseContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.lightBlue,
  },
  verseText: {
    fontSize: 16,
    color: Colors.white,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 8,
  },
  verseReference: {
    fontSize: 14,
    color: Colors.lightBlue,
    fontWeight: '600',
    textAlign: 'right',
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 32,
  },
  continueButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  continueButtonText: {
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

export default OnboardingPlaybookGenerationScreen;
