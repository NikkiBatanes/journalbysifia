/**
 * OnboardingPlaybookGenerationScreen.tsx
 * Phase 3.3: REAL Playbook Generation using actual API
 * Shows real AI-generated content with beautiful UI, auto-saves to playbooks
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors } from '../../theme/colors';
import { enhancedGenerationService } from '../../services/enhancedGenerationService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
// import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { logger } from '../../utils/logger';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { ContentSafetyAlert } from '../../components/ContentSafetyAlert';

interface RouteParams {
  challengeCategory: string;
  specificChallenge: string;
  userInput: string;
  userName: string; // Add userName parameter
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
  const AnimatedThemedText = Animated.createAnimatedComponent(ThemedText);
  // const { updateOnboardingStep } = useUserState(); // Unused for now
  const params = route.params as RouteParams;
  // const isMounted = useRef(true); // Unused, commented out

  const [isGenerating, setIsGenerating] = useState(true);
  const [_generatedPlaybook, setGeneratedPlaybook] = useState<GeneratedPlaybook | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [_isLoading, _setIsLoading] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [navigationData, setNavigationData] = useState<GeneratedPlaybook | null>(null);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [contentBlockedData, setContentBlockedData] = useState<{
    message: string;
    alternatives?: string[];
    category?: string;
  } | null>(null);

  // Disable back navigation entirely on this screen
  useEffect(() => {
    try {
      (navigation as any).setOptions?.({
        headerBackVisible: false,
        gestureEnabled: false,
      });
    } catch {}
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      // Block hardware back (Android)
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => true);

      // Intercept user-initiated navigation attempts but allow programmatic navigation
      const unsubscribe = (navigation as any).addListener?.('beforeRemove', (e: any) => {
        // Allow programmatic navigation (like navigation.replace) to proceed
        if (e.data?.action?.type === 'REPLACE' || shouldNavigate) {
          return; // Let it proceed
        }

        // Block all other navigation attempts (back button, swipe, etc.)
        e.preventDefault();
      });

      return () => {
        backSub?.remove?.();
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }, [navigation, shouldNavigate])
  );

  // Enhanced animations for better UI
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  // const contentFadeAnim = useRef(new Animated.Value(0)).current; // Unused, commented out
  // const pulseValue = useRef(new Animated.Value(0.8)).current; // Unused, commented out
  // Removed breathing text animations; keeping ring animation only

  // Concentric Aura breathing values (three rings)
  const aura1Scale = useRef(new Animated.Value(0.9)).current;
  const aura2Scale = useRef(new Animated.Value(0.9)).current;
  const aura3Scale = useRef(new Animated.Value(0.9)).current;
  const aura1Opacity = useRef(new Animated.Value(0.35)).current;
  const aura2Opacity = useRef(new Animated.Value(0.28)).current;
  const aura3Opacity = useRef(new Animated.Value(0.20)).current;

  // Shimmer effect for current step text and typing dots state
  const shimmerOpacity = useRef(new Animated.Value(0.85)).current;
  const [dotCount, setDotCount] = useState(0);
  // Reserve fixed width for dots so the phrase doesn't shift while dots animate
  const [dotsWidth, setDotsWidth] = useState<number | null>(null);

  // Scale breathing words subtly with the inner ring
  // const textScale = aura1Scale.interpolate({
  //   inputRange: [0.85, 1.1],
  //   outputRange: [0.97, 1.03],
  //   extrapolate: 'clamp',
  // }); // Unused, commented out

  // Breathing text removed from UI; represented as a static step below
  // No manual measurement: we'll use flex spacers and safe-area padding

  const generationSteps = [
    { title: 'Listening to your heart…', description: '' },
    { title: 'Finding God\'s Word for your season…', description: '' },
    { title: 'Preparing your steps…', description: '' },
    { title: 'Equipping you for the journey…', description: '' },
    { title: 'Breathe in peace...', description: '' },
    { title: 'Breathe out worry...', description: '' },
    { title: 'Finalizing Your Playbook', description: '' },
  ];

  // Current step title without trailing ellipsis/dots
  const currentTitle = generationSteps[Math.min(currentStep, generationSteps.length - 1)]?.title || '';
  const baseTitle = currentTitle.replace(/(…|\.{1,3})\s*$/, '').trimEnd();

  // Handle navigation after animation completes
  useEffect(() => {
    if (shouldNavigate && navigationData) {

      (navigation as any).replace('OnboardingPlaybookReady', {
        playbook: navigationData,
        challengeCategory: params.challengeCategory,
        specificChallenge: params.specificChallenge,
        userInput: params.userInput,
      });
    }
  }, [shouldNavigate, navigationData, navigation, params]);

  const generatePlaybook = useCallback(async () => {
    try {

      if (!user?.id) {
        // For demo purposes, create a mock user ID

      }

      const userId = user?.id || 'demo-user-onboarding';
      // Use the userName from onboarding params instead of user metadata
      const userName = params.userName || 'Friend';

      // Use real generation service
      const response = await enhancedGenerationService.generatePlaybook({
        userId,
        userInput: params.userInput || 'Help me grow in my faith journey',
        userName,
        isOnboarding: true, // Mark as onboarding playbook (free)
      });

      if (response.success) {
        if (response.queueId) {

          // Poll for completion
          const pollForCompletion = async () => {
          const maxAttempts = 35; // 35 attempts = 35 seconds max wait - faster with early direct DB checks
          let attempts = 0;

          const poll = async (): Promise<void> => {
            attempts++;

            try {
              const status = await enhancedGenerationService.checkGenerationStatus(response.queueId!);

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

                      playbookExists = true;
                      directPlaybook = recentPlaybook;
                    }
                  }
                } catch (error) {

                }
              }

              if ((status.status === 'completed' && status.resultId) || playbookExists) {
                // Get the actual playbook from database

                let playbook = null;
                let error = null;

                // Always use getPlaybook function to ensure we get complete data with action steps and affirmations
                if (playbookExists && directPlaybook) {

                  // Use getPlaybook to get complete data including action steps and affirmations
                  if (user?.id) {
                    const { getPlaybook } = await import('../../services/modernPlaybookApi');
                    const completePlaybook = await getPlaybook(user.id, directPlaybook.id);
                    if (completePlaybook) {
                      playbook = completePlaybook;

                    } else {
                      error = new Error('Failed to fetch complete playbook data via fallback');
                    }
                  } else {
                    error = new Error('User ID not available for fallback fetch');
                  }
                } else {
                  // Use the proper getPlaybook function to fetch all related data
                  const { getPlaybook } = await import('../../services/modernPlaybookApi');

                  // Try fetching by result_id first using the proper function
                  try {
                    if (!user?.id) {
                      throw new Error('User ID not available');
                    }
                    if (!status.resultId) {
                      throw new Error('Result ID not available');
                    }
                    const result = await getPlaybook(user.id, status.resultId);
                    if (result) {
                      playbook = result;

                    } else {
                      throw new Error('Failed to fetch playbook');
                    }
                  } catch (fetchError) {

                    // Fallback: get the most recent playbook for this user
                    const { supabase } = await import('../../services/supabaseClient');
                    const fallbackResult = await supabase
                      .from('playbooks')
                      .select('id, created_at')
                      .eq('user_id', user?.id)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();

                    if (fallbackResult.data) {
                      const playbookAge = Date.now() - new Date(fallbackResult.data.created_at).getTime();
                      // If playbook was created in the last 2 minutes, it's likely our generated one
                      if (playbookAge < 120000) {

                        if (user?.id) {
                          const fallbackPlaybookResult = await getPlaybook(user.id, fallbackResult.data.id);
                          if (fallbackPlaybookResult) {
                            playbook = fallbackPlaybookResult;
                          } else {
                            error = new Error('Failed to fetch fallback playbook');
                          }
                        } else {
                          error = new Error('User ID not available for fallback fetch');
                        }
                      }
                    } else {
                      error = new Error('No recent playbook found');
                    }
                  }
                }

                if (playbook && !error) {

                  logger.debug('OnboardingGeneration: Action steps from getPlaybook', { actionSteps: playbook.actionSteps });

                  // DEBUG: Log what we got from getPlaybook
                  logger.debug('OnboardingGeneration: Raw playbook from getPlaybook', { playbookData: JSON.stringify(playbook, null, 2) });
                  logger.debug('OnboardingGeneration: Action steps from getPlaybook', { actionSteps: playbook.actionSteps });
                  logger.debug('OnboardingGeneration: Affirmations from getPlaybook', { affirmations: playbook.affirmations });

                  // Convert database playbook to UI format - use any type to avoid TypeScript issues
                  const realGeneratedPlaybook: any = {
                    id: playbook.id,
                    title: playbook.title,
                    truthInLove: playbook.truthInLove || 'God loves you and is with you in this journey.',
                    actionSteps: playbook.actionSteps || [],
                    // Use only affirmations actually returned from the playbook; if none, leave empty
                    affirmations: (playbook.affirmations && playbook.affirmations.length > 0)
                      ? playbook.affirmations.map((aff: any) => typeof aff === 'string' ? (aff || '') : (aff.text || aff || ''))
                      : [],
                    bibleVerse: playbook.bibleVerse || {
                      text: 'Cast all your anxiety on him because he cares for you.',
                      reference: '1 Peter 5:7',
                    },
                    directChallenge: playbook.directChallenge || 'Take one step forward in faith this week.',
                  };

                  // DEBUG: Log what we're passing to the ready screen
                  logger.debug('OnboardingGeneration: Passing to ready screen', { playbookData: JSON.stringify(realGeneratedPlaybook, null, 2) });

                  // First ensure progress bar is complete, then navigate immediately
                  return new Promise<void>((resolve) => {
                    // Animate progress to 100%
                    Animated.timing(progressAnim, {
                      toValue: 100,
                      duration: 800,
                      useNativeDriver: false,
                    }).start(() => {
                      try { triggerLightHaptic(); } catch {}
                      // Keep isGenerating true to avoid blank state, set navigation data
                      setGeneratedPlaybook(realGeneratedPlaybook);
                      setNavigationData(realGeneratedPlaybook);
                      setShouldNavigate(true);

                      resolve();
                    });
                  });
                } else {
                  Logger.error('❌ Error fetching playbook from database', error as Error, { component: 'OnboardingPlaybookGenerationScreen' });
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
              Logger.error('❌ Error during polling', error as Error, { component: 'OnboardingPlaybookGenerationScreen' });
              throw error;
            }
          };

          // Start polling immediately for faster onboarding
          setTimeout(poll, 500); // Wait only 0.5 seconds before first poll
        };

          pollForCompletion().catch((error) => {
            Logger.error('❌ Playbook generation failed', error as Error, { component: 'OnboardingPlaybookGenerationScreen' });

            // Check if content was blocked
            if ((error as any).contentBlocked) {
              setContentBlockedData({
                message: (error as any).christianMessage || 'Content blocked',
                alternatives: (error as any).alternatives,
                category: (error as any).category,
              });
              setContentBlocked(true);
              setIsGenerating(false);
              return;
            }

            // Convert technical errors to user-friendly messages
            const userMessage = error.message?.includes('Circuit breaker is OPEN')
              ? 'We\'re experiencing high demand right now. Please try again in a few moments.'
              : error.message?.includes('Invalid playbook format')
              ? 'We\'re having trouble creating your playbook right now. Please try again in a moment.'
              : error.message?.includes('AI content policy prevented generation')
              ? 'Please rephrase your request and try again.'
              : error.message || 'Failed to generate playbook. Please try again.';
            setGenerationError(userMessage);
            setIsGenerating(false);

            // Development: Reset circuit breaker if it's a circuit breaker error
            if (__DEV__ && error.message?.includes('Circuit breaker is OPEN')) {
              import('../../utils/circuitBreaker').then(({ resetCircuit }) => {
                resetCircuit('openai-generation');
                console.log('🔄 Circuit breaker reset for development');
              });
            }
          });

        } else {
          // Direct generation completed immediately (no queue)

          // Wait a moment for database to be ready, then check for the playbook
          setTimeout(async () => {
            try {
              if (user?.id) {
                const { supabase } = await import('../../services/supabaseClient');
                const { data: recentPlaybooks } = await supabase
                  .from('playbooks')
                  .select('*')
                  .eq('user_id', user.id)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (recentPlaybooks && recentPlaybooks.length > 0) {
                  const recentPlaybook = recentPlaybooks[0];
                  const playbookAge = Date.now() - new Date(recentPlaybook.created_at).getTime();

                  // If playbook was created in the last 30 seconds, it's likely our generated one
                  if (playbookAge < 30000) {

                    // Get complete playbook data
                    const { getPlaybook } = await import('../../services/modernPlaybookApi');
                    const completePlaybook = await getPlaybook(user.id, recentPlaybook.id);

                    if (completePlaybook) {
                      const realGeneratedPlaybook: any = {
                        id: completePlaybook.id,
                        title: completePlaybook.title,
                        truthInLove: completePlaybook.truthInLove || 'God loves you and is with you in this journey.',
                        actionSteps: completePlaybook.actionSteps || [],
                        // Use only affirmations actually returned from the playbook; if none, leave empty
                        affirmations: (completePlaybook.affirmations && completePlaybook.affirmations.length > 0)
                          ? completePlaybook.affirmations.map((aff: any) => typeof aff === 'string' ? (aff || '') : (aff.text || aff || ''))
                          : [],
                        bibleVerse: completePlaybook.bibleVerse || {
                          text: 'Cast all your anxiety on him because he cares for you.',
                          reference: '1 Peter 5:7',
                        },
                        directChallenge: completePlaybook.directChallenge || 'Take one step forward in faith this week.',
                      };

                      // Animate progress to 100% and navigate
                      Animated.timing(progressAnim, {
                        toValue: 100,
                        duration: 800,
                        useNativeDriver: false,
                      }).start(() => {
                        setTimeout(() => {
                          (navigation as any).replace('OnboardingPlaybookReady', {
                            playbook: realGeneratedPlaybook,
                            challengeCategory: params.challengeCategory,
                            specificChallenge: params.specificChallenge,
                            userInput: params.userInput,
                          });
                        }, 500);
                      });
                      return;
                    }
                  }
                }
              }

              // If we get here, direct generation may have failed
              throw new Error('Direct generation completed but no playbook found');

            } catch (directError) {
              Logger.error('❌ Direct generation check failed', directError as Error, {
        component: 'OnboardingPlaybookGenerationScreen',
      });
              // Convert technical errors to user-friendly messages
              const userMessage = (directError as Error).message?.includes('Circuit breaker is OPEN')
                ? 'We\'re experiencing high demand right now. Please try again in a few moments.'
                : 'Unable to generate your playbook. Please try again.';
              setGenerationError(userMessage);
              setIsGenerating(false);
            }
          }, 2000); // Wait 2 seconds for database to be ready
        }
      } else {
        throw new Error(response.message || 'Failed to generate playbook');
      }

    } catch (error) {
      Logger.error('❌ Error generating playbook', error as Error, { component: 'OnboardingPlaybookGenerationScreen' });
      // Convert technical errors to user-friendly messages
      const userMessage = (error as Error).message?.includes('Circuit breaker is OPEN')
        ? 'We\'re experiencing high demand right now. Please try again in a few moments.'
        : (error as Error).message?.includes('Invalid playbook format')
        ? 'We\'re having trouble creating your playbook right now. Please try again in a moment.'
        : (error as Error).message?.includes('AI content policy prevented generation')
        ? 'Please rephrase your request and try again.'
        : 'Unable to generate your playbook. Please try again.';
      setGenerationError(userMessage);
      setIsGenerating(false);
    }
  }, [params, user, navigation, progressAnim]);

  // Sun ring animation (breathing text removed)
  useEffect(() => {
    let stopped = false;

    const animateRing = (
      scaleVal: Animated.Value,
      opacityVal: Animated.Value,
      startDelay: number
    ) => {
      const cycle = () => {
        if (stopped) {return;}
        // Inhale
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.parallel([
            Animated.timing(scaleVal, { toValue: 1.1, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacityVal, { toValue: 0.55, duration: 4000, useNativeDriver: true }),
          ]),
          // Hold
          Animated.parallel([
            Animated.delay(1000),
          ]),
          // Exhale
          Animated.parallel([
            Animated.timing(scaleVal, { toValue: 0.85, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacityVal, { toValue: 0.22, duration: 4000, useNativeDriver: true }),
          ]),
        ]).start(({ finished }) => {
          if (!finished || stopped) { return; }
          cycle();
        });
      };
      cycle();
    };

    // Start rings with slight phase offsets and start text sync
    animateRing(aura1Scale, aura1Opacity, 0);
    animateRing(aura2Scale, aura2Opacity, 250);
    animateRing(aura3Scale, aura3Opacity, 500);

    return () => {
      stopped = true;
      aura1Scale.stopAnimation();
      aura2Scale.stopAnimation();
      aura3Scale.stopAnimation();
      aura1Opacity.stopAnimation();
      aura2Opacity.stopAnimation();
      aura3Opacity.stopAnimation();
    };
  }, [aura1Scale, aura2Scale, aura3Scale, aura1Opacity, aura2Opacity, aura3Opacity]);

  // Removed typewriter breathing text effect

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

  // Shimmer (breathing) effect on the step text
  useEffect(() => {
    let mounted = true;
    const loop = () => {
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && mounted && isGenerating) {loop();}
      });
    };
    if (isGenerating) {loop();}
    return () => {
      mounted = false;
      shimmerOpacity.stopAnimation();
    };
  }, [isGenerating, shimmerOpacity]);

  // Typing effect for trailing dots: cycles '', '.', '..', '...'
  useEffect(() => {
    if (!isGenerating) { return; }
    const id = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(id);
  }, [isGenerating]);

  useEffect(() => {
    if (isGenerating) {
      // Animate through generation steps
      const lastIndex = generationSteps.length - 1;
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => {
          // Stop if already at or beyond last index
          if (prev >= lastIndex) {
            clearInterval(stepInterval);
            return prev;
          }

          const nextStep = prev + 1;

          // Animate progress bar (cap interim at 95%)
          Animated.timing(progressAnim, {
            toValue: Math.min(((nextStep) / generationSteps.length) * 100, 95),
            duration: 1000, // Slightly longer for smoother animation
            useNativeDriver: false,
          }).start();

          // Light haptic on each step advance
          try { triggerLightHaptic(); } catch {}
          // If next would be last index, allow next tick to hit the guard and stop
          return nextStep;
        });
      }, 3000); // 3 seconds per step for better readability

      return () => clearInterval(stepInterval);
    }
  }, [isGenerating, generationSteps.length, progressAnim]);

  // Unused function removed to fix linting issues

  const handleRetry = () => {
    try { triggerLightHaptic(); } catch {}
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
          <ThemedText weight="bold" style={styles.errorTitle}>Generation Failed</ThemedText>
          <ThemedText style={styles.errorMessage}>{generationError}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <ThemedText weight="semiBold" style={styles.retryButtonText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <OnboardingErrorBoundary>
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
              {/* Logo (no aura here) */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../assets/icons/siFiaAppIcon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <ThemedText
                weight="bold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.generationTitle}
              >
                Creating Your Playbook
              </ThemedText>

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
                <View style={styles.stepTextRow}>
                  <AnimatedThemedText weight="medium" style={[styles.currentStepText, styles.noPaddingHorizontal, { opacity: shimmerOpacity }] }>
                    {baseTitle}
                  </AnimatedThemedText>
                  {/* Fixed-width container for dots to prevent re-centering */}
                  <View style={[styles.dotsContainer, dotsWidth ? { width: dotsWidth } : null]}>
                    <ThemedText weight="medium" style={[styles.currentStepText, styles.noPaddingHorizontal] }>
                      {'.'.repeat(dotCount)}
                    </ThemedText>
                  </View>
                  {/* Hidden measurer renders once to get exact width of '...' for the current font */}
                  {dotsWidth == null && (
                    <ThemedText
                      weight="medium"
                      style={[styles.currentStepText, styles.hiddenMeasure]}
                      onLayout={(e) => setDotsWidth(e.nativeEvent.layout.width)}
                    >
                      ...
                    </ThemedText>
                  )}
                </View>
              </ScrollView>
              {/* Spacer to ensure sun and breathing text do not overlap step text */}
              <View style={styles.sunSpacer} />
            </View>
          </View>
        ) : null}
         {/* Bottom Sun Rising Breathing Animation */}
        <View style={[styles.sunContainer, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="none">
          {/* Big concentric semi-circles positioned at bottom */}
          <Animated.View
            style={[
              styles.sunRing,
              styles.sunRing1,
              { transform: [{ scale: aura1Scale }], opacity: aura1Opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.sunRing,
              styles.sunRing2,
              { transform: [{ scale: aura2Scale }], opacity: aura2Opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.sunRing,
              styles.sunRing3,
              { transform: [{ scale: aura3Scale }], opacity: aura3Opacity },
            ]}
          />
        </View>
        {/* Breathing text removed; guidance now part of generationSteps */}
      </Animated.View>

      {/* Content Safety Alert */}
      {contentBlocked && contentBlockedData && (
        <ContentSafetyAlert
          visible={contentBlocked}
          onClose={() => {
            setContentBlocked(false);
            navigation.goBack();
          }}
          onSelectAlternative={(_alternative) => {
            // Navigate back - user can create a new playbook with the suggested alternative
            setContentBlocked(false);
            navigation.goBack();
          }}
          message={contentBlockedData.message}
          alternatives={contentBlockedData.alternatives}
          category={contentBlockedData.category}
        />
      )}
    </SafeAreaView>
    </OnboardingErrorBoundary>
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
    position: 'relative',
    zIndex: 2,
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
  auraWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  auraRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 9999,
  },
  auraRing1: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  auraRing2: {
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  auraRing3: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  progressBarContainer: {
    width: '80%',
    marginBottom: 30,
  },
  progressBarBackground: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  breathingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    zIndex: 5,
  },
  sunContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -100,
    height: 560,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    zIndex: 1,
  },
  sunRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sunRing1: {
    width: 800,
    height: 800,
    borderRadius: 400,
    bottom: -540,
  },
  sunRing2: {
    width: 980,
    height: 980,
    borderRadius: 490,
    bottom: -620,
  },
  sunRing3: {
    width: 1160,
    height: 1160,
    borderRadius: 580,
    bottom: -720,
  },
  stepTextContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotsContainer: {
    marginLeft: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: undefined,
  },
  sunSpacer: {
    height: 56,
  },
  currentStepText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    paddingHorizontal: 8,
    includeFontPadding: false,
  },
  noPaddingHorizontal: {
    paddingHorizontal: 0,
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
    color: Colors.anchorBlue,
  },
  successTitle: {
    fontSize: 24,
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
    color: Colors.white,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
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

export default withErrorBoundary(OnboardingPlaybookGenerationScreen, 'OnboardingPlaybookGenerationScreen');
