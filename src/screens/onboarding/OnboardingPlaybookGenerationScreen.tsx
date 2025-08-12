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
// import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';

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
  // const { updateOnboardingStep } = useUserState(); // Unused for now
  const params = route.params as RouteParams;
  // const isMounted = useRef(true); // Unused, commented out

  const [isGenerating, setIsGenerating] = useState(true);
  const [_generatedPlaybook, setGeneratedPlaybook] = useState<GeneratedPlaybook | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [_isLoading, _setIsLoading] = useState(false);

  // Enhanced animations for better UI
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  // const contentFadeAnim = useRef(new Animated.Value(0)).current; // Unused, commented out
  // const pulseValue = useRef(new Animated.Value(0.8)).current; // Unused, commented out
  const breathingAnim = useRef(new Animated.Value(0.9)).current;
  const textOpacity = useRef(new Animated.Value(0.8)).current;
  const textPulse = useRef(new Animated.Value(1)).current;
  const inWordsOpacity = useRef(new Animated.Value(1)).current;   // starts visible
  const outWordsOpacity = useRef(new Animated.Value(0)).current;  // starts hidden

  // Concentric Aura breathing values (three rings)
  const aura1Scale = useRef(new Animated.Value(0.9)).current;
  const aura2Scale = useRef(new Animated.Value(0.9)).current;
  const aura3Scale = useRef(new Animated.Value(0.9)).current;
  const aura1Opacity = useRef(new Animated.Value(0.35)).current;
  const aura2Opacity = useRef(new Animated.Value(0.28)).current;
  const aura3Opacity = useRef(new Animated.Value(0.20)).current;

  // Scale breathing words subtly with the inner ring
  // const textScale = aura1Scale.interpolate({
  //   inputRange: [0.85, 1.1],
  //   outputRange: [0.97, 1.03],
  //   extrapolate: 'clamp',
  // }); // Unused, commented out

  // Breathing animation text
  const [_breathingText, _setBreathingText] = useState('Breathe in peace');
  const [_breathingPhase, _setBreathingPhase] = useState<'in' | 'hold' | 'out'>('in');
  // Typewriter suffix after the word "Breathe "
  const [breathSuffix, setBreathSuffix] = useState('in peace');
  const suffixIndexRef = useRef(0); // 0: 'in peace', 1: 'out worry'
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

                // Always use getPlaybook function to ensure we get complete data with action steps and affirmations
                if (playbookExists && directPlaybook) {
                  console.log('✅ Found direct playbook from fallback, fetching complete data with getPlaybook...');
                  // Use getPlaybook to get complete data including action steps and affirmations
                  if (user?.id) {
                    const { getPlaybook } = await import('../../services/modernPlaybookApi');
                    const completePlaybook = await getPlaybook(user.id, directPlaybook.id);
                    if (completePlaybook) {
                      playbook = completePlaybook;
                      console.log('✅ Complete playbook data fetched via fallback');
                    } else {
                      error = new Error('Failed to fetch complete playbook data via fallback');
                    }
                  } else {
                    error = new Error('User ID not available for fallback fetch');
                  }
                } else {
                  // Use the proper getPlaybook function to fetch all related data
                  const { getPlaybook } = await import('../../services/modernPlaybookApi');

                  console.log(`🔍 Attempting to fetch playbook with result_id: ${status.resultId}`);

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
                      console.log('✅ Playbook fetched with getPlaybook function');
                    } else {
                      throw new Error('Failed to fetch playbook');
                    }
                  } catch (fetchError) {
                    console.log('🔄 Result ID not found, trying to fetch most recent playbook...');

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
                        console.log('✅ Found recent playbook via fallback, fetching with getPlaybook...');
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
                  console.log('✅ Real playbook fetched from database:', playbook.title);
                  console.log('🔍 Action steps count:', playbook.actionSteps?.length || 0);
                  console.log('🔍 Affirmations count:', playbook.affirmations?.length || 0);

                  // DEBUG: Log what we got from getPlaybook
                  console.log('[DEBUG] OnboardingGeneration: Raw playbook from getPlaybook:', JSON.stringify(playbook, null, 2));
                  console.log('[DEBUG] OnboardingGeneration: Action steps from getPlaybook:', playbook.actionSteps);
                  console.log('[DEBUG] OnboardingGeneration: Affirmations from getPlaybook:', playbook.affirmations);

                  // Convert database playbook to UI format - use any type to avoid TypeScript issues
                  const realGeneratedPlaybook: any = {
                    id: playbook.id,
                    title: playbook.title,
                    truthInLove: playbook.truthInLove || 'God loves you and is with you in this journey.',
                    actionSteps: playbook.actionSteps || [],
                    affirmations: (playbook.affirmations && playbook.affirmations.length > 0)
                      ? playbook.affirmations.map((aff: any) => typeof aff === 'string' ? aff : aff.text || aff)
                      : [
                          'I am loved unconditionally by God',
                          'God gives me strength for each challenge',
                          'I can find peace in God\'s presence',
                        ],
                    bibleVerse: playbook.bibleVerse || {
                      text: 'Cast all your anxiety on him because he cares for you.',
                      reference: '1 Peter 5:7',
                    },
                    directChallenge: playbook.directChallenge || 'Take one step forward in faith this week.',
                  };

                  // DEBUG: Log what we're passing to the ready screen
                  console.log('[DEBUG] OnboardingGeneration: Passing to ready screen:', JSON.stringify(realGeneratedPlaybook, null, 2));

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
  }, [params, user, navigation, progressAnim]);

  // Breathing animation cycle: Inhale (4s) → Hold (1s) → Exhale (4s)
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

    const animateCore = () => {
      const coreCycle = () => {
        if (stopped) { return; }
        // Inhale: update words and fade ellipsis in
        _setBreathingPhase('in');
        Animated.parallel([
          Animated.timing(breathingAnim, { toValue: 1.12, duration: 4000, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 1.0, duration: 4000, useNativeDriver: true }),
          Animated.timing(inWordsOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(outWordsOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          // subtle bounce when switching to inhale words
          Animated.sequence([
            Animated.spring(textPulse, { toValue: 1.06, friction: 6, tension: 90, useNativeDriver: true }),
            Animated.timing(textPulse, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
          ]),
        ]).start(({ finished }) => {
          if (!finished || stopped) { return; }
          _setBreathingPhase('hold');
          // Hold: keep text nearly steady
          Animated.parallel([
            Animated.timing(textOpacity, { toValue: 0.95, duration: 300, useNativeDriver: true }),
            Animated.delay(1000),
          ]).start(() => {
            if (stopped) { return; }
            _setBreathingPhase('out');
            // Exhale: scale down arcs and dim text a bit
            Animated.parallel([
              Animated.timing(breathingAnim, { toValue: 0.88, duration: 4000, useNativeDriver: true }),
              Animated.timing(textOpacity, { toValue: 0.6, duration: 4000, useNativeDriver: true }),
              Animated.timing(inWordsOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
              Animated.timing(outWordsOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
              // gentle inward bounce when switching to exhale words
              Animated.sequence([
                Animated.spring(textPulse, { toValue: 0.94, friction: 6, tension: 90, useNativeDriver: true }),
                Animated.timing(textPulse, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
              ]),
            ]).start(({ finished: f2 }) => {
              if (!f2 || stopped) { return; }
              _setBreathingPhase('in');
              coreCycle();
            });
          });
        });
      };
      coreCycle();
    };

    // Start rings with slight phase offsets and start text sync
    animateRing(aura1Scale, aura1Opacity, 0);
    animateRing(aura2Scale, aura2Opacity, 250);
    animateRing(aura3Scale, aura3Opacity, 500);
    animateCore();

    return () => {
      stopped = true;
      aura1Scale.stopAnimation();
      aura2Scale.stopAnimation();
      aura3Scale.stopAnimation();
      aura1Opacity.stopAnimation();
      aura2Opacity.stopAnimation();
      aura3Opacity.stopAnimation();
      breathingAnim.stopAnimation();
      textOpacity.stopAnimation();
    };
  }, [breathingAnim, aura1Scale, aura2Scale, aura3Scale, aura1Opacity, aura2Opacity, aura3Opacity, textOpacity, inWordsOpacity, outWordsOpacity, textPulse]);

  // Type/erase loop for suffix after "Breathe "
  useEffect(() => {
    let stopped = false;
    const targets = ['in peace...', 'out worry...'];
    const typeSpeed = 110;   // ms per char (slower typing)
    const eraseSpeed = 80;   // ms per char (slower erasing)
    const holdFull = 2200;   // linger longer when fully typed
    const holdEmpty = 600;   // linger longer when erased before next phrase

    let timer: NodeJS.Timeout | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const type = (target: string, from = '') => {
      if (stopped) {return;}
      if (from.length === target.length) {
        timer = setTimeout(() => erase(target), holdFull);
        return;
      }
      const next = target.slice(0, from.length + 1);
      setBreathSuffix(next);
      timer = setTimeout(() => type(target, next), typeSpeed);
    };

    const erase = (current: string) => {
      if (stopped) {return;}
      if (current.length === 0) {
        // switch target
        suffixIndexRef.current = (suffixIndexRef.current + 1) % targets.length;
        const nextTarget = targets[suffixIndexRef.current];
        timer = setTimeout(() => type(nextTarget, ''), holdEmpty);
        return;
      }
      const next = current.slice(0, current.length - 1);
      setBreathSuffix(next);
      timer = setTimeout(() => erase(next), eraseSpeed);
    };

    // Start with current target based on index
    const start = () => {
      const target = targets[suffixIndexRef.current];
      // Ensure we begin from full word on first mount
      setBreathSuffix('');
      type(target, '');
    };

    start();

    return () => {
      stopped = true;
      clearTimer();
    };
  }, []);

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
            // Cap interim progress at 95% so 100% is reserved for actual completion
            toValue: Math.min(
              ((isLastStep ? generationSteps.length : nextStep) / generationSteps.length) * 100,
              95
            ),
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

  // Unused function removed to fix linting issues

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
              {/* Logo (no aura here) */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../assets/images/siFiaAppIcon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

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
        {/* Breathing text; typewriter effect for suffix including ellipsis */}
        <Animated.Text
          style={[
            styles.breathingText,
            { bottom: Math.max(insets.bottom + 8, 16) },
          ]}
          pointerEvents="none"
        >
          {'Breathe '}{breathSuffix}
        </Animated.Text>
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
    width: 88,
    height: 88,
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
    fontWeight: '700',
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
  sunSpacer: {
    height: 56,
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
