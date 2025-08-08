import * as React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Image, Text, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { generatePlaybook, savePlaybook } from '../services/apiIntegration';
import { subscriptionService } from '../services/subscriptionService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { faithPointsService } from '../services/faithPointsService';



type Props = NativeStackScreenProps<RootStackParamList, 'GeneratingPlaybook'>;

const GeneratingPlaybookScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userInput, userName, isFromOnboarding, onboardingData } = route.params;
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationKey, setAnimationKey] = useState(0);
  const animations = useRef<Animated.Value[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGenerated = useRef(false);
  const isMounted = useRef(true);

  // Pulse animation values
  const pulseValue = useRef(new Animated.Value(0.8)).current;

  // Fade in and pulse animation when component mounts
  useEffect(() => {
    // Start fade in animation
    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });

    // Create pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.9,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Start both animations with mount check
    fadeIn.start((finished) => {
      if (!isMounted.current || !finished) return;
    });
    pulseAnimation.start((finished) => {
      if (!isMounted.current || !finished) return;
    });

    // Cleanup function
    return () => {
      fadeIn.stop();
      pulseAnimation.stop();
      pulseValue.setValue(0.8); // Reset to initial scale
    };
  }, [fadeAnim, pulseValue]);

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
      if (isGenerating || hasGenerated.current) {return;}

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
            const pointsResult = await faithPointsService.awardPoints(user.id, 'playbook_generated');
            console.log('[GeneratingPlaybook] Faith points awarded:', pointsResult);
          } catch (pointsError) {
            console.error('[GeneratingPlaybook] Failed to award faith points:', pointsError);
            // Don't fail the whole generation if points awarding fails
          }

          // Track usage for subscription service
          try {
            await subscriptionService.trackUsage(user.id, 'playbook');
            console.log('[GeneratingPlaybook] Usage tracked successfully');
          } catch (usageError) {
            console.error('[GeneratingPlaybook] Failed to track usage:', usageError);
            // Don't fail the whole generation if usage tracking fails
          }
        }

        // Show success notification
        Alert.alert(
          '🎉 Success!',
          'Your personalized playbook has been created successfully!',
          [{ text: 'Continue', style: 'default' }],
          { cancelable: false }
        );

        // Navigate based on whether this is from onboarding or main flow
        if (isFromOnboarding) {
          // For onboarding, go to actual playbook first
          navigation.navigate('PlaybookDetail' as any, {
            playbook: savedPlaybook,
            isFromOnboarding: true,
          });
        } else {
          // For main flow, go to playbook detail
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

    // Start generation after a short delay to show animation
    const timer = setTimeout(generatePlaybookContent, 3000);
    return () => clearTimeout(timer);
  }, [userInput, userName, isFromOnboarding]);



  // Scale transform for pulse effect
  const scale = pulseValue;

  // Progress steps
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([false, false, false, false, false]);

  const steps = [
    { id: 1, title: 'Analyzing Your Challenge', description: 'Understanding your specific needs...' },
    { id: 2, title: 'Finding Truth in Love', description: 'Discovering biblical wisdom...' },
    { id: 3, title: 'Creating Action Steps', description: 'Building practical solutions...' },
    { id: 4, title: 'Crafting Affirmations', description: 'Preparing encouraging words...' },
    { id: 5, title: 'Finalizing Your Playbook', description: 'Putting it all together...' },
  ];

  // Progress animation
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Breathing animation text
  const [breathingText, setBreathingText] = useState('Breathe in peace...');
  const [breathingPhase, setBreathingPhase] = useState<'in' | 'out'>('in');
  const breathingAnim = useRef(new Animated.Value(0.8)).current;

  // Breathing animation cycle
  useEffect(() => {
    const breathingCycle = () => {
      // Breathe in phase
      Animated.timing(breathingAnim, {
        toValue: 1.1,
        duration: 3000,
        useNativeDriver: true,
      }).start((finished) => {
        if (!isMounted.current || !finished) {return;}
        setBreathingText('Breathe out worry...');
        setBreathingPhase('out');

        // Breathe out phase
        Animated.timing(breathingAnim, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: true,
        }).start((finished) => {
          if (!isMounted.current || !finished) {return;}
          setBreathingText('Breathe in peace...');
          setBreathingPhase('in');
        });
      });
    };

    const interval = setInterval(breathingCycle, 6000);
    breathingCycle(); // Start immediately

    return () => clearInterval(interval);
  }, [breathingAnim]);

  // Progress step animation
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!isMounted.current) {return;}
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        if (nextStep < steps.length) {
          // Mark current step as completed
          setCompletedSteps(prevCompleted => {
            const newCompleted = [...prevCompleted];
            newCompleted[prev] = true;
            return newCompleted;
          });
          return nextStep;
        }
        return prev;
      });
    }, 600); // Progress every 600ms to complete in 3 seconds

    return () => clearInterval(stepInterval);
  }, [steps.length]);

  // Animate progress bar based on current step
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: ((currentStep + 1) / steps.length) * 100,
      duration: 500,
      useNativeDriver: false,
    }).start((finished) => {
      if (!isMounted.current || !finished) return;
    });
  }, [currentStep, steps.length]);

  // Start line animations
  useEffect(() => {
    // Line animations
    const lineAnimations = animations.current.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(anim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      )
    );

    // Start line animations
    const lineAnimation = Animated.stagger(100, lineAnimations);
    lineAnimation.start();

    // Cleanup function
    return () => {
      lineAnimation.stop();
      animations.current.forEach(anim => anim.setValue(0.3));
    };
  }, [animationKey]);

  // Reset animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isMounted.current) {return;}
      setAnimationKey(prev => prev + 1);
      return () => {};
    }, [])
  );

  // Cleanup effect - stop all animations on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Stop all animations to prevent memory leaks
      fadeAnim.stopAnimation();
      breathingAnim.stopAnimation();
      pulseValue.stopAnimation();
      animations.current.forEach(anim => anim.stopAnimation());
    };
  }, [fadeAnim, breathingAnim, pulseValue]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.background} />
      </View>

      {/* Centered Content Container */}
      <View style={styles.centeredContent}>
        {/* Logo */}
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
            source={require('../../assets/images/siFiaAppIcon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Creating Your Playbook</Text>

        {/* Simple Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnimation.interpolate({
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
        <Text style={styles.stepText}>
          {steps[currentStep]?.description || 'Preparing your personalized playbook...'}
        </Text>

        {/* Breathing Text */}
        <Text style={styles.breathingText}>
          {breathingText}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.anchorBlue,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  breathingContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 40,
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 40,
    paddingHorizontal: 0,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
    shadowColor: Colors.growthGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  stepText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
  },
  breathingText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  progressContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 40,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  connectionLine: {
    height: 3,
    width: 30,
    marginHorizontal: 8,
    borderRadius: 1.5,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.lightGray,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});

export default GeneratingPlaybookScreen;
