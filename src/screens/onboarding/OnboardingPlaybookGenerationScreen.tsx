/**
 * OnboardingPlaybookGenerationScreen.tsx
 * Phase 3.3: REAL Playbook Generation using actual API
 * Shows real AI-generated content with beautiful UI, auto-saves to playbooks
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { updateOnboardingStep } = useUserState();
  const params = route.params as RouteParams;
  const isMounted = useRef(true);

  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedPlaybook, setGeneratedPlaybook] = useState<GeneratedPlaybook | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced animations for better UI
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.8)).current;
  const breathingAnim = useRef(new Animated.Value(0.8)).current;

  // Breathing animation text
  const [breathingText, setBreathingText] = useState('Breathe in peace...');
  const [breathingPhase, setBreathingPhase] = useState<'in' | 'out'>('in');
  // No manual measurement: we'll use flex spacers and safe-area padding

  const generationSteps = [
    { title: 'Listening to your heart…', description: '' },
    { title: 'Finding God\'s Word for your season…', description: '' },
    { title: 'Preparing your steps…', description: '' },
    { title: 'Equipping you for the journey…', description: '' },
    { title: 'Finalizing Your Playbook', description: '' },
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
          const maxAttempts = 35; // 35 attempts = 35 seconds max wait - faster with early direct DB checks
          let attempts = 0;

          const poll = async (): Promise<void> => {
            attempts++;

            try {
              const status = await enhancedGenerationService.checkGenerationStatus(response.queueId!);
              console.log(`[Polling ${attempts}/${maxAttempts}] Status:`, status.status);

              // ENTERPRISE FIX: Database security issues are blocking queue status updates
              // Check for direct playbook creation much earlier to bypass broken queue system
              let playbookExists = false;
              let directPlaybook = null;
              
              if (status.status === 'processing' && attempts > 5) {
                // After 15 seconds, start checking if playbook exists directly
                try {
                  const { supabase } = await import('../../services/supabaseClient');
                  const { data: recentPlaybooks } = await supabase
                    .from('playbooks')
                    .select('*')
                    .eq('user_id', user?.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (recentPlaybooks && recentPlaybooks.length > 0) {
                    const recentPlaybook = recentPlaybooks[0];
                    const playbookAge = Date.now() - new Date(recentPlaybook.created_at).getTime();
                    
                    // If playbook was created in the last 60 seconds, it's likely our generated one
                    if (playbookAge < 60000) {
                      console.log('🎯 Found recently created playbook, using as completion fallback');
                      playbookExists = true;
                      directPlaybook = recentPlaybook;
                    }
                  }
                } catch (error) {
                  console.log('Could not check for direct playbook:', error);
                }
              }

              if ((status.status === 'completed' && status.resultId) || playbookExists) {
                // Get the actual playbook from database
                console.log('🎯 Playbook completed, fetching from database...');

                let playbook = null;
                let error = null;

                // Use direct playbook if we found one via fallback, otherwise fetch by resultId
                if (playbookExists && directPlaybook) {
                  console.log('✅ Using direct playbook from fallback detection');
                  playbook = directPlaybook;
                } else {
                  // Use the existing supabase client to fetch the playbook
                  const { supabase } = await import('../../services/supabaseClient');

                  console.log(`🔍 Attempting to fetch playbook with result_id: ${status.resultId}`);

                  // Try fetching by result_id first
                  let result = await supabase
                    .from('playbooks')
                    .select('*')
                    .eq('id', status.resultId)
                    .single();
                  
                  // If that fails, try fetching the most recent playbook for this user
                  if (result.error && result.error.code === 'PGRST116') {
                    console.log('🔄 Result ID not found, trying to fetch most recent playbook...');
                    
                    const fallbackResult = await supabase
                      .from('playbooks')
                      .select('*')
                      .eq('user_id', user?.id)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();
                    
                    if (fallbackResult.data) {
                      const playbookAge = Date.now() - new Date(fallbackResult.data.created_at).getTime();
                      // If playbook was created in the last 2 minutes, it's likely our generated one
                      if (playbookAge < 120000) {
                        console.log('✅ Found recent playbook via fallback, using it');
                        result = fallbackResult;
                      }
                    }
                  }
                  
                  playbook = result.data;
                  error = result.error;
                }

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

                  // First ensure progress bar is complete, then navigate immediately
                  return new Promise<void>((resolve) => {
                    // Animate progress to 100%
                    Animated.timing(progressAnim, {
                      toValue: 100,
                      duration: 800,
                      useNativeDriver: false,
                    }).start(() => {
                      // Keep isGenerating true to avoid blank state, navigate immediately
                      setGeneratedPlaybook(realGeneratedPlaybook);
                      console.log('✅ Real playbook generation completed. Navigating to Ready screen...');

                      // Use replace to avoid brief blank flash and back-stack flicker
                      (navigation as any).replace('OnboardingPlaybookReady', {
                        playbook: realGeneratedPlaybook,
                        challengeCategory: params.challengeCategory,
                        specificChallenge: params.specificChallenge,
                        userInput: params.userInput,
                      });

                      resolve();
                    });
                  });
                } else {
                  console.error('❌ Error fetching playbook from database:', error);
                  throw new Error('Failed to fetch generated playbook');
                }

              } else if (status.status === 'failed') {
                throw new Error(status.message || 'Playbook generation failed');
              } else if (attempts >= maxAttempts) {
                throw new Error('Playbook generation timed out. Please try again.');
              } else {
                // Continue polling - much faster for onboarding
                setTimeout(poll, 1000); // Poll every 1 second for responsive onboarding
              }
            } catch (error) {
              console.error('❌ Error during polling:', error);
              throw error;
            }
          };

          // Start polling immediately for faster onboarding
          setTimeout(poll, 500); // Wait only 0.5 seconds before first poll
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

  // Breathing animation cycle
  useEffect(() => {
    const breathingCycle = () => {
      // Breathe in phase
      Animated.timing(breathingAnim, {
        toValue: 1.1,
        duration: 3000,
        useNativeDriver: true,
      }).start((finished) => {
        if (!isMounted.current || !finished) return;
        // Use setTimeout to avoid useInsertionEffect warning
        setTimeout(() => {
          if (isMounted.current) {
            setBreathingText('Breathe out worry...');
            setBreathingPhase('out');
          }
        }, 0);

        // Breathe out phase
        Animated.timing(breathingAnim, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: true,
        }).start((animationFinished) => {
          if (!isMounted.current || !animationFinished) return;
          // Use setTimeout to avoid useInsertionEffect warning
          setTimeout(() => {
            if (isMounted.current) {
              setBreathingText('Breathe in peace...');
              setBreathingPhase('in');
            }
          }, 0);
        });
      });
    };

    const interval = setInterval(breathingCycle, 6000);
    breathingCycle(); // Start immediately

    return () => clearInterval(interval);
  }, [breathingAnim]);

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
          const isLastStep = nextStep >= generationSteps.length;
          
          // Animate progress bar
          Animated.timing(progressAnim, {
            toValue: (isLastStep ? generationSteps.length : nextStep) / generationSteps.length * 100,
            duration: 1000, // Slightly longer for smoother animation
            useNativeDriver: false,
          }).start(() => {
            // Only proceed to next step after animation completes
            if (isLastStep) {
              clearInterval(stepInterval);
              return;
            }
          });

          if (isLastStep) {
            clearInterval(stepInterval);
            return prev;
          }
          
          return nextStep;
        });
      }, 3000); // 3 seconds per step for better readability

      return () => clearInterval(stepInterval);
    }
  }, [isGenerating, generationSteps.length, progressAnim]);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      // Update onboarding progress
      updateOnboardingStep('playbook_generated', 3);

      console.log('📚 Playbook completed, proceeding directly to OnboardingPlaybookReady');

      // Navigate directly to OnboardingPlaybookReady (skip intermediate screen)
      (navigation as any).replace('OnboardingPlaybookReady', {
        playbook: generatedPlaybook,
        onboardingData: {
          name: params?.userInput?.split(' ')[0] || 'Friend',
          ageGroup: 'Adult',
          faithJourney: 'Growing in Faith',
          challenge: params?.challengeCategory || 'Personal Growth',
          challengeDetails: params?.specificChallenge || 'Seeking spiritual growth',
        },
      });
    } catch (error) {
      console.error('Error proceeding to playbook detail:', error);
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
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View 
        style={[styles.content, { opacity: fadeAnim }]}
      > 
        {/* Progress Indicator */}
        {/* No progress indicator needed */}

        {isGenerating ? (
          // Beautiful generation in progress with breathing animation
          <View style={styles.centerBlockContainer}>
            <View style={styles.centerBlock}>
              {/* Logo with breathing animation */}
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    transform: [
                      { scale: breathingAnim },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('../../../assets/images/siFiaAppIcon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Title */}
              <Text style={styles.generationTitle}>Creating Your Playbook</Text>

              {/* Simple Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
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
              </View>

              {/* Current Step Text */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stepTextContainer}
              >
                <Text style={styles.currentStepText}>
                  {generationSteps[Math.min(currentStep, generationSteps.length - 1)]?.title}
                </Text>
              </ScrollView>
            </View>
          </View>
        ) : null}
        {/* Breathing Text pinned to bottom of the screen */}
        <Text style={[styles.breathingText, { bottom: insets.bottom + 24 }]}>
          {breathingText}
        </Text>
      </Animated.View>
    </SafeAreaView>
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
    justifyContent: 'center',
    position: 'relative',
  },
  centerBlockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
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
    marginBottom: 24,
    width: '100%',
    paddingHorizontal: 20,
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
  centeredContent: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerBlock: {
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  progressBarContainer: {
    width: '80%',
    marginBottom: 30,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  breathingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
  },
  stepTextContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  currentStepText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
    includeFontPadding: false,
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
