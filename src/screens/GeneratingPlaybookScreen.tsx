import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Image, Text, Alert, StatusBar, ScrollView, NativeModules } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { generatePlaybook, savePlaybook } from '../services/apiIntegration';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { faithPointsService } from '../services/faithPointsService';
import { subscriptionService } from '../services/subscriptionService';



type Props = NativeStackScreenProps<RootStackParamList, 'GeneratingPlaybook'>;

const GeneratingPlaybookScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userInput, userName, isFromOnboarding } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGenerated = useRef(false);
  // Haptics preference-gated triggers
  const triggerLightHaptic = React.useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return;
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) return;
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  const triggerSuccessHaptic = React.useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return;
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) return;
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Progress and step visuals (aligned with onboarding screen)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [currentStep, setCurrentStep] = useState(0);
  const generationSteps = [
    { title: 'Listening to your heart…', description: '' },
    { title: 'Finding God\'s Word for your season…', description: '' },
    { title: 'Preparing your steps…', description: '' },
    { title: 'Equipping you for the journey…', description: '' },
    { title: 'Breathe in peace...', description: '' },
    { title: 'Breathe out worry...', description: '' },
    { title: 'Finalizing Your Playbook', description: '' },
  ];
  const currentTitle = generationSteps[Math.min(currentStep, generationSteps.length - 1)]?.title || '';
  const baseTitle = currentTitle.replace(/(…|\.{1,3})\s*$/, '').trimEnd();

  // Bottom sun concentric rings animation
  const aura1Scale = useRef(new Animated.Value(0.9)).current;
  const aura2Scale = useRef(new Animated.Value(0.9)).current;
  const aura3Scale = useRef(new Animated.Value(0.9)).current;
  const aura1Opacity = useRef(new Animated.Value(0.35)).current;
  const aura2Opacity = useRef(new Animated.Value(0.28)).current;
  const aura3Opacity = useRef(new Animated.Value(0.20)).current;

  // Shimmer for step text and animated dots
  const shimmerOpacity = useRef(new Animated.Value(0.85)).current;
  const [dotCount, setDotCount] = useState(0);
  const [dotsWidth, setDotsWidth] = useState<number | null>(null);

  // No fade-in; show UI instantly

  // Generate playbook when component mounts
  useEffect(() => {
    console.log('[GeneratingPlaybook] Effect triggered with params:', {
      userInput: userInput?.substring(0, 50) + '...',
      userName,
      isFromOnboarding,
      hasGenerated: hasGenerated.current,
      isGenerating,
    });
    const generatePlaybookContent = async () => {
      if (hasGenerated.current) {return;}

      hasGenerated.current = true;
      setIsGenerating(true);
      try {
        console.log('[GeneratingPlaybook] Starting playbook generation...');

        // Generate playbook content via AI
        const aiResponse = await generatePlaybook(userInput, userName, {
          showUserFeedback: true,
          onAuthRequired: () => {
            console.log('🔐 Authentication required for playbook generation');
          },
        });

        if (!aiResponse) {
          throw new Error('Playbook generation failed. Please try again.');
        }

        console.log('[GeneratingPlaybook] AI Response received:', aiResponse);

        // Save to database if user is authenticated
        let savedPlaybook = aiResponse;
        if (user?.id) {
          console.log('[GeneratingPlaybook] Saving playbook to database...');
          const saveResult = await savePlaybook(savedPlaybook, user.id);
          if (!saveResult.success) {
            throw new Error(saveResult.error || 'Failed to save playbook to database');
          }
          console.log('[GeneratingPlaybook] Playbook saved successfully:', savedPlaybook.id);

          // Award faith points for playbook generation
          try {
            const pointsResult = await faithPointsService.awardPoints(
              user.id,
              'playbook_generated',
              { 
                suppressNotification: !!isFromOnboarding,
                isOnboarding: !!isFromOnboarding
              }
            );
            console.log('[GeneratingPlaybook] Faith points awarded:', pointsResult);
          } catch (pointsError) {
            console.error('[GeneratingPlaybook] Failed to award faith points:', pointsError);
            // Don't fail the whole generation if points awarding fails
          }

          // Track usage for subscription service
          try {
            await subscriptionService.trackUsage(
              user.id,
              'playbook',
              0, // tokens used - will be updated by generation service
              !!isFromOnboarding
            );
            console.log('[GeneratingPlaybook] Usage tracked for user:', user.id, 'isOnboarding:', !!isFromOnboarding);
          } catch (usageError) {
            console.error('[GeneratingPlaybook] Failed to track usage:', usageError);
            // Don't fail the whole generation if usage tracking fails
          }
        }

        // Smoothly complete progress bar, then navigate
        await new Promise<void>((resolve) => {
          Animated.timing(progressAnim, {
            toValue: 100,
            duration: 800,
            useNativeDriver: false,
          }).start(() => resolve());
        });

        // Success haptic when progress completes
        triggerSuccessHaptic();

        // Navigate based on whether this is from onboarding or main flow
        if (isFromOnboarding) {
          navigation.navigate('PlaybookDetail' as any, {
            playbook: savedPlaybook,
            isFromOnboarding: true,
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [
              { name: 'MainTabs', state: {
                routes: [
                  { name: 'Home' },
                  { name: 'PlaybookList' },
                ],
                index: 1,
              }},
              { name: 'PlaybookDetail', params: { playbook: savedPlaybook } },
            ],
          });
        }
      } catch (error) {
        console.error('[GeneratingPlaybook] Error:', error);
        Alert.alert('Error', 'Failed to generate playbook. Please try again.');
        navigation.goBack();
      } finally {
        setIsGenerating(false);
      }
    };

    // Start showing UI immediately; delay the actual generation slightly
    setIsGenerating(true);
    const timer = setTimeout(generatePlaybookContent, 3000);
    return () => clearTimeout(timer);
  }, [userInput, userName, isFromOnboarding, isGenerating, navigation, user?.id, progressAnim]);


  // Bottom sun ring animation loop
  useEffect(() => {
    let stopped = false;
    const animateRing = (
      scaleVal: Animated.Value,
      opacityVal: Animated.Value,
      startDelay: number
    ) => {
      const cycle = () => {
        if (stopped) {return;}
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.parallel([
            Animated.timing(scaleVal, { toValue: 1.1, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacityVal, { toValue: 0.55, duration: 4000, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.delay(1000),
          ]),
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

  // Shimmer effect for step text
  useEffect(() => {
    let mounted = true;
    const loop = () => {
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && mounted && isGenerating) loop();
      });
    };
    if (isGenerating) loop();
    return () => {
      mounted = false;
      shimmerOpacity.stopAnimation();
    };
  }, [isGenerating, shimmerOpacity]);

  // Animated dots for step text
  useEffect(() => {
    if (!isGenerating) { return; }
    const id = setInterval(() => setDotCount(prev => (prev + 1) % 4), 500);
    return () => clearInterval(id);
  }, [isGenerating]);

  // Step advancement and progress bar animation (cap at 95%)
  useEffect(() => {
    if (!isGenerating) { return; }
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        const isLastStep = nextStep >= generationSteps.length;
        Animated.timing(progressAnim, {
          toValue: Math.min(((isLastStep ? generationSteps.length : nextStep) / generationSteps.length) * 100, 95),
          duration: 1000,
          useNativeDriver: false,
        }).start();
        // Light haptic on step advance (only when actually advancing)
        if (!isLastStep) {
          triggerLightHaptic();
        }
        return isLastStep ? prev : nextStep;
      });
    }, 3000);
    return () => clearInterval(stepInterval);
  }, [isGenerating, generationSteps.length, progressAnim, triggerLightHaptic]);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      <View style={styles.content}>
        {isGenerating ? (
          <View style={styles.centerBlockContainer}>
            <View style={styles.centerBlock}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/siFiaAppIcon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.generationTitle}>Creating Your Playbook</Text>

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

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stepTextContainer}
              >
                <View style={styles.stepTextRow}>
                  <Animated.Text style={[styles.currentStepText, { opacity: shimmerOpacity, paddingHorizontal: 0 }]}>
                    {baseTitle}
                  </Animated.Text>
                  <View style={[styles.dotsContainer, dotsWidth ? { width: dotsWidth } : null]}>
                    <Text style={[styles.currentStepText, { paddingHorizontal: 0 }]}>
                      {'.'.repeat(dotCount)}
                    </Text>
                  </View>
                  {dotsWidth == null && (
                    <Text
                      style={[styles.currentStepText, styles.hiddenMeasure]}
                      onLayout={(e) => setDotsWidth(e.nativeEvent.layout.width)}
                    >
                      ...
                    </Text>
                  )}
                </View>
              </ScrollView>
              <View style={styles.sunSpacer} />
            </View>
          </View>
        ) : null}

        <View style={[styles.sunContainer, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="none">
          <Animated.View
            style={[styles.sunRing, styles.sunRing1, { transform: [{ scale: aura1Scale }], opacity: aura1Opacity }]}
          />
          <Animated.View
            style={[styles.sunRing, styles.sunRing2, { transform: [{ scale: aura2Scale }], opacity: aura2Opacity }]}
          />
          <Animated.View
            style={[styles.sunRing, styles.sunRing3, { transform: [{ scale: aura3Scale }], opacity: aura3Opacity }]}
          />
        </View>
      </View>
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
  centerBlock: {
    alignItems: 'center',
    width: '100%',
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
  generationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 24,
    width: '100%',
    paddingHorizontal: 20,
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
  stepTextContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentStepText: {
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
    includeFontPadding: false,
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
});

export default GeneratingPlaybookScreen;
