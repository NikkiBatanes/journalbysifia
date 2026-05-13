import React, { useState, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Modal, StyleSheet, TouchableOpacity, View, Dimensions, Animated, Easing } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import ThemedText from './common/ThemedText';
import DevotionalLockIcon from './DevotionalLockIcon';
import UsageTooltipModal from './profile/UsageTooltipModal';
import useDevotionalGating from '../hooks/useDevotionalGating';

import { useDevotionalOperations } from '../services/hooks/useDevotionalDataSimplified';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { generateSalesCopy } from '../utils/dynamicSalesCopy';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DurationOption {
  days: number;
  title: string;
  description: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  {
    days: 1,
    title: '1-Day Devotional',
    description: 'A simple moment to pause, pray, and reflect with God.',
  },
  {
    days: 3,
    title: '3-Day Devotional',
    description: 'Space to sit with a season and listen more carefully.',
  },
  {
    days: 5,
    title: '5-Day Devotional',
    description: 'A gentle rhythm for continued reflection and clarity.',
  },
  {
    days: 7,
    title: '7-Day Devotional',
    description: 'A slower walk through this season with Scripture and prayer.',
  },
];

interface DevotionalModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDuration?: (days: number) => void;
  userStruggle?: string;
  playbookInfo?: string;
  playbookId?: string;
  userInput?: string;
  onDevotionalCreated?: (devotionalId: string) => void;
  isOnboarding?: boolean;
}

const DevotionalModal: React.FC<DevotionalModalProps> = ({
  visible,
  onClose,
  playbookInfo,
  playbookId,
  userInput,
  onDevotionalCreated,
  isOnboarding = false,
}) => {
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);

  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isOnboardingCreating, setIsOnboardingCreating] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation();
  const { createDevotional, isCreating } = useDevotionalOperations(user?.id || '');
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // Refs so the slide-animation effect can read current values without re-triggering
  const isCreatingRef = React.useRef(isCreating);
  const isOnboardingCreatingRef = React.useRef(isOnboardingCreating);
  const isSuccessRef = React.useRef(false); // updated below
  const onboardingAutoStartedRef = React.useRef(false);
  const generationInFlightRef = React.useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showPlaybookInfo, setShowPlaybookInfo] = useState(false);
  const [_contentHeight, setContentHeight] = useState(0);
  const [_ellipsis, setEllipsis] = useState('');
  const contentRef = React.useRef<View>(null);
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitModalData, setUsageLimitModalData] = useState<{
    isOnTrial: boolean;
    tier: string;
    trialChosenTier: string;
    devotionalsLimit: number;
    trialEndDate: string | null;
  } | null>(null);
  const [creationError, setCreationError] = useState<Error | null>(null);
  // Treat shorter devices (e.g., SE-class phones) as small so modal can use a bit more height
  const isSmallPhone = SCREEN_HEIGHT <= 850;

  // Feature gating
  const devotionalGating = useDevotionalGating();

  // Refresh gating data when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      devotionalGating.refreshSubscription();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh gating data when usage limit modal is shown
  React.useEffect(() => {
    if (showUsageLimitModal) {

      devotionalGating.refreshSubscription();
    }
  }, [showUsageLimitModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Haptics
  const hapticOptions = React.useMemo(() => ({
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  }), []);
  const triggerLightHaptic = React.useCallback(() => {
    try { ReactNativeHapticFeedback.trigger('impactLight', hapticOptions); } catch {}
  }, [hapticOptions]);

  // Success state and checkmark animation
  const [isSuccess, setIsSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // Keep refs in sync with state so slide effect never re-fires on these changes
  React.useEffect(() => { isCreatingRef.current = isCreating; }, [isCreating]);
  React.useEffect(() => { isOnboardingCreatingRef.current = isOnboardingCreating; }, [isOnboardingCreating]);
  React.useEffect(() => { isSuccessRef.current = isSuccess; }, [isSuccess]);

  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Generating UI state (progress bar, shimmering step text, animated dots)
  const progressAnim = React.useRef(new Animated.Value(0)).current; // 0..100
  const shimmerOpacity = React.useRef(new Animated.Value(0.85)).current;
  const [currentStep, setCurrentStep] = useState(0);

  // Step status tracking for step cards
  type StepStatus = 'completed' | 'active' | 'inactive';
  type GenerationStep = { key: string; title: string; status: StepStatus };
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([
    { key: 'seeing', title: 'Seeing what this season needs', status: 'inactive' },
    { key: 'choosing', title: 'Choosing Scripture for this moment', status: 'inactive' },
    { key: 'shaping', title: 'Shaping your reflection', status: 'inactive' },
    { key: 'preparing', title: 'Preparing your devotional', status: 'inactive' },
  ]);

  // Animated background colors for step cards
  const stepCardBgAnims = React.useRef(generationSteps.map(() => new Animated.Value(0))).current;
  const stepCardBorderAnims = React.useRef(generationSteps.map(() => new Animated.Value(0))).current;
  // Animated scale for step cards
  const stepCardScaleAnims = React.useRef(generationSteps.map(() => new Animated.Value(1))).current;

  // Check icon animations for each step
  const checkIconAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  // Pulsing dot animations for each step
  const pulsingDotAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  // Logo entry animation during generation
  const genLogoEntryAnim = useRef(new Animated.Value(0)).current;
  // Shimmer animation for building text
  const buildingTextOpacity = useRef(new Animated.Value(0.55)).current;
  const [buildingDots, setBuildingDots] = useState('');
  // Staggered entrance animations for generation elements
  const genCardEntryAnim = useRef(new Animated.Value(0)).current;
  const genHeadingEntryAnim = useRef(new Animated.Value(0)).current;
  const genStepsEntryAnim = useRef(new Animated.Value(0)).current;
  const genProgressEntryAnim = useRef(new Animated.Value(0)).current;
  // Container bounce animation
  const generatingScaleAnim = useRef(new Animated.Value(0.92)).current;
  const generatingFadeAnim = useRef(new Animated.Value(0)).current;

  // Ensure 'WHAT YOU SHARED' is collapsed initially each time the modal opens
  React.useEffect(() => {
    if (visible) {
      setShowPlaybookInfo(false);
      // Reset chevron rotation to collapsed state
      try { rotateAnim.setValue(0); } catch {}
      // Only reset selected duration when modal opens if no creation is in progress
      if (!isCreating && !isSuccess && !justCompleted) {
        setSelectedDuration(null);
        // Reset step card animation values
        stepCardBgAnims.forEach(anim => anim.setValue(0));
        stepCardBorderAnims.forEach(anim => anim.setValue(0));
        stepCardScaleAnims.forEach(anim => anim.setValue(1));
      }
      // Reset justCompleted flag after modal opens
      setJustCompleted(false);

      // Auto-select 3-day duration during onboarding and trigger generation (immediate, no delay)
      if (isOnboarding && !isCreating && !isSuccess && !onboardingAutoStartedRef.current) {
        onboardingAutoStartedRef.current = true;
        setIsOnboardingCreating(true); // Immediately show building UI
        // Trigger building entry animations
        Animated.parallel([
          Animated.timing(genLogoEntryAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(genCardEntryAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(genStepsEntryAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(genProgressEntryAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]).start();
        handleSelectDuration(3);
      }
    } else {
      onboardingAutoStartedRef.current = false;
      generationInFlightRef.current = false;
    }
  }, [visible, rotateAnim, isCreating, isSuccess, justCompleted, isOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {

  }, [isCreating, creationError, isSuccess, selectedDuration]);
  // Animation for the overlay (fade in/out)
  // Fade animation for backdrop dim
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Shimmer loop while creating
  React.useEffect(() => {
    let mounted = true;
    const loop = () => {
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && mounted && (isCreating || isOnboardingCreating) && !isSuccess) {
          loop();
        }
      });
    };
    if ((isCreating || isOnboardingCreating) && !isSuccess) {
      loop();
    }
    return () => {
      mounted = false;
      shimmerOpacity.stopAnimation();
    };
  }, [isCreating, isOnboardingCreating, isSuccess, shimmerOpacity]);

  // Shimmer animation for building text
  React.useEffect(() => {
    if (!(isCreating || isOnboardingCreating) || isSuccess) {
      setBuildingDots('');
      buildingTextOpacity.setValue(0.55);
      return;
    }

    // Cycling dots: '' → '.' → '..' → '...'
    const dotStates = ['', '.', '..', '...'];
    let di = 0;
    const dotInterval = setInterval(() => {
      di = (di + 1) % dotStates.length;
      setBuildingDots(dotStates[di]);
    }, 420);

    // Shimmer = the letters themselves breathing bright → dim → bright
    buildingTextOpacity.setValue(0.55);
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildingTextOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(buildingTextOpacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();

    return () => {
      clearInterval(dotInterval);
      shimmerLoop.stop();
    };
  }, [isCreating, isOnboardingCreating, isSuccess, buildingTextOpacity]);

  // Logo entry animation when generation starts
  React.useEffect(() => {
    if (((isCreating || isOnboardingCreating) && !isSuccess) || isClosing) {
      Animated.spring(genLogoEntryAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      genLogoEntryAnim.setValue(0);
    }
  }, [isCreating, isOnboardingCreating, isSuccess, isClosing, genLogoEntryAnim]);

  // Staggered entrance animations for generation elements
  React.useEffect(() => {
    if (((isCreating || isOnboardingCreating) && !isSuccess) || isClosing) {
      const staggerSequence = Animated.sequence([
        Animated.timing(genCardEntryAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(genHeadingEntryAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(genStepsEntryAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(genProgressEntryAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);
      staggerSequence.start();
    } else {
      genCardEntryAnim.setValue(0);
      genHeadingEntryAnim.setValue(0);
      genStepsEntryAnim.setValue(0);
      genProgressEntryAnim.setValue(0);
    }
  }, [isCreating, isOnboardingCreating, isSuccess, isClosing, genCardEntryAnim, genHeadingEntryAnim, genStepsEntryAnim, genProgressEntryAnim]);

  // Container bounce animation when generation starts
  React.useEffect(() => {
    if (((isCreating || isOnboardingCreating) && !isSuccess) || isClosing) {
      Animated.parallel([
        Animated.spring(generatingScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(generatingFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      generatingScaleAnim.setValue(0.92);
      generatingFadeAnim.setValue(0);
    }
  }, [isCreating, isOnboardingCreating, isSuccess, isClosing, generatingScaleAnim, generatingFadeAnim]);

  // Step advancement and progress bar animation while creating (cap at 95%)
  React.useEffect(() => {
    if (!(isCreating || isOnboardingCreating) || isSuccess) { return; }
    // Calculate total expected time based on duration and distribute evenly across steps
    // This ensures progress bar moves smoothly without getting stuck at phase 4
    const getTotalDuration = () => {
      if (!selectedDuration) {return 12000;} // Default 12s
      // Scale total time proportionally to number of days
      // 1-day: 8s, 3-day: 12s, 5-day: 20s, 7-day: 28s
      if (selectedDuration === 1) {return 8000;}
      if (selectedDuration === 3) {return 12000;}
      if (selectedDuration === 5) {return 20000;}
      if (selectedDuration === 7) {return 28000;}
      return 12000;
    };

    const totalDuration = getTotalDuration();
    const stepDuration = totalDuration / generationSteps.length;

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        const isLast = nextStep >= generationSteps.length;

        // Update step statuses
        setGenerationSteps(steps => steps.map((step, index) => {
          if (index < nextStep) {return { ...step, status: 'completed' as StepStatus };}
          if (index === nextStep) {return { ...step, status: 'active' as StepStatus };}
          return { ...step, status: 'inactive' as StepStatus };
        }));

        // Animate background, border, and scale for step cards with bouncy spring
        generationSteps.forEach((step, index) => {
          if (index < nextStep) {
            // Completed: animate to coral background and scale
            Animated.parallel([
              Animated.spring(stepCardBgAnims[index], {
                toValue: 1,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardBorderAnims[index], {
                toValue: 1,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardScaleAnims[index], {
                toValue: 1,
                useNativeDriver: false,
                tension: 50,
                friction: 6,
              }),
            ]).start();
          } else if (index === nextStep) {
            // Active: animate to white background and scale up
            Animated.parallel([
              Animated.spring(stepCardBgAnims[index], {
                toValue: 0.5,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardBorderAnims[index], {
                toValue: 0.5,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardScaleAnims[index], {
                toValue: 1.05,
                useNativeDriver: false,
                tension: 50,
                friction: 6,
              }),
            ]).start();
          } else {
            // Inactive: animate to transparent and scale down
            Animated.parallel([
              Animated.spring(stepCardBgAnims[index], {
                toValue: 0,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardBorderAnims[index], {
                toValue: 0,
                useNativeDriver: false,
                tension: 40,
                friction: 7,
              }),
              Animated.spring(stepCardScaleAnims[index], {
                toValue: 1,
                useNativeDriver: false,
                tension: 50,
                friction: 6,
              }),
            ]).start();
          }
        });

        // Animate checkmark for completed step
        if (nextStep > 0 && nextStep <= generationSteps.length) {
          Animated.timing(checkIconAnims[nextStep - 1], {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }).start();
        }

        // Start pulsing dot for active step
        if (nextStep < generationSteps.length) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulsingDotAnims[nextStep], {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
              Animated.timing(pulsingDotAnims[nextStep], {
                toValue: 0.4,
                duration: 1000,
                useNativeDriver: true,
              }),
            ])
          ).start();
        }

        Animated.timing(progressAnim, {
          toValue: Math.min(((isLast ? generationSteps.length : nextStep) / generationSteps.length) * 100, 95),
          duration: 1000,
          useNativeDriver: false,
        }).start();
        // Subtle haptic feedback on each visible step advancement
        if (!isLast && !isOnboarding) {
          try {
            triggerLightHaptic();
          } catch {}
        }
        return isLast ? prev : nextStep;
      });
    }, stepDuration);
    return () => clearInterval(stepInterval);
  }, [isCreating, isOnboardingCreating, isSuccess, generationSteps.length, progressAnim, triggerLightHaptic, selectedDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureContent = () => {
    if (contentRef.current) {
      contentRef.current.measureInWindow((_x, _y, _width, height) => {
        setContentHeight(height);
      });
    }
  };

  // Animate the ellipsis
  React.useEffect(() => {
    if (!(isCreating || isOnboardingCreating)) {return;}

    const timer = setInterval(() => {
      setEllipsis((prev: string) => {
        if (prev.length >= 3) {return '';}
        return prev + '.';
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isCreating, isOnboardingCreating]);

  React.useEffect(() => {
    let isMounted = true;
    let animation: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      setIsVisible(true);
      // Only reset progress animation when modal first opens with no active generation
      if (!isCreatingRef.current && !isOnboardingCreatingRef.current && !isSuccessRef.current) {
        progressAnim.setValue(0);
        setCurrentStep(0);
      }
      // Small delay to ensure content is measured
      timer = setTimeout(() => {
        measureContent();
      }, 10);

      // Fade in backdrop and slide up modal
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
        }),
      ]);
      animation.start();
    } else {
      // Calculate the distance to slide down (full screen height + modal height + some extra)
      const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

      // Fade out backdrop quickly while sliding down
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100, // Very fast fade out
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: slideDownDistance,
          duration: 300, // Slide down duration
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]);

      animation.start(({ finished }) => {
        if (finished && isMounted) {
          setIsVisible(false);
          // Reset translateY for next open
          translateY.setValue(SCREEN_HEIGHT);
        }
      });
    }

    return () => {
      isMounted = false;
      if (animation) {
        animation.stop();
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [visible, fadeAnim, translateY, progressAnim]);

  const togglePlaybookInfo = () => {
    setShowPlaybookInfo((prev) => {
      const next = !prev;
      Animated.spring(rotateAnim, {
        toValue: next ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
      return next;
    });
  };

  const handleSelectDuration = async (days: number) => {
    if (generationInFlightRef.current) {
      return;
    }

    const userId = user?.id;

    // Use subscriptionService.canGenerate with onboarding exception
    if (userId) {
      const { subscriptionService } = await import('../services/subscriptionService');
      const canGenerateCheck = await subscriptionService.canGenerate(userId, 'devotional', isOnboarding);

      if (!canGenerateCheck.allowed) {
        // Seeker users can use their 1 monthly devotional during onboarding.
        const isSeeker = devotionalGating.tier === 'seeker';
        if (isSeeker && isOnboarding) {
          // Onboarding exception should allow this, so log and continue
          Logger.info('[DevotionalModal] Onboarding exception allowing seeker devotional', {
            component: 'DevotionalModal',
            context: 'onboarding_seeker_exception',
            userId,
            requestedDuration: days,
          });
        } else {
          // Not allowed - show upgrade
          Logger.info('[DevotionalModal] Devotional generation not allowed', {
            component: 'DevotionalModal',
            context: 'not_allowed',
            userId,
            reason: canGenerateCheck.message,
          });

          onClose();
          navigation.navigate('OnboardingSalesOffer' as any, {
            upgradeMode: true,
            currentTier: devotionalGating.tier,
            requestedDuration: days,
            skipNotificationPreference: true,
            featureType: 'devotionals',
            source: 'devotional_limit',
            feature: 'devotionals',
          });
          return;
        }
      }
    }

    // Check if user has no remaining devotionals - check directly from subscription
    const devotionalsUsed = devotionalGating.subscription?.devotionals_used || 0;
    const baseLimit = devotionalGating.subscription?.devotionals_limit || 0;
    // During onboarding, seekers use the same 1-devotional monthly quota.
    const devotionalsLimit = (isOnboarding && devotionalGating.tier === 'seeker') ? 1 : baseLimit;
    const hasNoRemaining = devotionalsLimit !== -1 && devotionalsUsed >= devotionalsLimit;
    const isSeeker = devotionalGating.tier === 'seeker';

    // For Seeker users, skip popup and go directly to sales offer (unless onboarding)
    if (isSeeker && hasNoRemaining && !isOnboarding) {

      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from seeker/no-remaining gating', {
        component: 'DevotionalModal',
        context: 'seeker_no_remaining',
        requestedDuration: days,
      });

      onClose(); // Close the devotional modal
      navigation.navigate('OnboardingSalesOffer' as any, {
        upgradeMode: true,
        currentTier: 'seeker',
        requestedDuration: days,
        skipNotificationPreference: true,
        featureType: 'devotionals',
        source: 'devotional_seeker_limit',
        feature: 'devotionals',
      });
      return;
    }

    if (hasNoRemaining && !isOnboarding) {

      // Force refresh before showing modal
      await devotionalGating.refreshSubscription();
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the current state to use in modal (prevents reactivity issues)
      // IMPORTANT: Check the ACTUAL tier from subscription, not the effectiveTier
      // because useDevotionalGating returns trial_chosen_tier as the tier for feature gating
      const actualTier = devotionalGating.subscription?.tier || devotionalGating.tier;
      const isOnTrial = actualTier === 'free_trial';

      setUsageLimitModalData({
        isOnTrial,
        tier: actualTier,
        trialChosenTier: devotionalGating.subscription?.trial_chosen_tier || 'spark',
        devotionalsLimit: devotionalGating.subscription?.devotionals_limit || 0,
        trialEndDate: devotionalGating.subscription?.trial_end_date || null,
      });

      setShowUsageLimitModal(true);
      return;
    }

    // Check if this duration is locked for current tier
    // Use 'onboarding' context only if explicitly in onboarding flow, otherwise use 'inApp'
    const accessCheck = devotionalGating.checkAccess(days, isOnboarding ? 'onboarding' : 'inApp', isOnboarding);

    if (accessCheck.isLocked) {

      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from locked-duration gating', {
        component: 'DevotionalModal',
        context: 'duration_locked',
        tier: devotionalGating.tier,
        requestedDuration: days,
        isOnboarding,
      });

      onClose(); // Close the devotional modal first
      navigation.navigate('OnboardingSalesOffer' as any, {
        upgradeMode: true,
        currentTier: devotionalGating.tier,
        requestedDuration: days,
        skipNotificationPreference: true,
        featureType: 'devotionals',
        source: 'devotional_duration_lock',
        feature: 'devotionals',
      });
      return;
    }

    setSelectedDuration(days);
    // Reset generation steps when selecting a new duration
    setGenerationSteps([
      { key: 'seeing', title: 'Seeing what this season needs', status: 'inactive' },
      { key: 'choosing', title: 'Choosing Scripture for this moment', status: 'inactive' },
      { key: 'shaping', title: 'Shaping your reflection', status: 'inactive' },
      { key: 'preparing', title: 'Preparing your devotional', status: 'inactive' },
    ]);
    setCurrentStep(0);
    progressAnim.setValue(0);
    setIsSuccess(false);
    setIsClosing(false);
    setJustCompleted(false);
    // Reset step card animation values
    stepCardBgAnims.forEach(anim => anim.setValue(0));
    stepCardBorderAnims.forEach(anim => anim.setValue(0));
    stepCardScaleAnims.forEach(anim => anim.setValue(1));

    // If no onSelectDuration provided, handle devotional creation here
    if (playbookId) {
      generationInFlightRef.current = true;

      // Haptic feedback when generation starts (parity with playbook generation)
      try { triggerLightHaptic(); } catch {}
      // Show progress message for longer generations
      let progressTimeout: ReturnType<typeof setTimeout> | null = null;
      if (days >= 5) {
        progressTimeout = setTimeout(() => {

        }, 10000);
      }

      try {
        const devotional = await createDevotional({
          duration: days,
          playbookId,
          userInput: userInput || '', // Pass empty string if undefined
          isOnboarding: isOnboarding, // Pass onboarding flag to API
        });

        if (progressTimeout) {
          clearTimeout(progressTimeout);
        }

        if (devotional) {
          setIsClosing(true);
          setJustCompleted(true);
          setCurrentStep(generationSteps.length - 1);
          setGenerationSteps(steps => steps.map(step => ({ ...step, status: 'completed' as StepStatus })));
          checkIconAnims.forEach(anim => anim.setValue(1));
          pulsingDotAnims.forEach(anim => anim.stopAnimation());
          stepCardBgAnims.forEach(anim => anim.setValue(1));
          stepCardBorderAnims.forEach(anim => anim.setValue(1));
          stepCardScaleAnims.forEach(anim => anim.setValue(1));
          try { triggerLightHaptic(); } catch {}
          Animated.timing(progressAnim, {
            toValue: 100,
            duration: 500,
            useNativeDriver: false,
          }).start();
          setTimeout(async () => {
            handleClose(() => {
              setTimeout(() => {
                if (onDevotionalCreated) {
                  onDevotionalCreated(devotional.id);
                }
                setIsClosing(false);
                checkmarkAnim.setValue(0);
                generationInFlightRef.current = false;
              }, 300);
            });
          }, 800);
        } else {
          generationInFlightRef.current = false;
        }
      } catch (error) {
        if (progressTimeout) {
          clearTimeout(progressTimeout);
        }
        generationInFlightRef.current = false;
        setIsOnboardingCreating(false);
        setCreationError(error instanceof Error ? error : new Error('Failed to create devotional'));
      }
    }
  };

  const handleClose = (afterClose?: () => void) => {
    // Calculate the distance to slide down (full screen height + modal height + some extra)
    const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

    // Fade out backdrop quickly while sliding down
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200, // Fade aligned with slide
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: slideDownDistance,
        duration: 300, // Clear, perceivable slide down
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        // Reset animations for next open
        translateY.setValue(SCREEN_HEIGHT);
        progressAnim.setValue(0); // Reset progress bar to 0
        setCurrentStep(0); // Reset step counter
        // Invoke optional callback after close completes
        if (afterClose) { afterClose(); }
      }
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (!isVisible && !visible) {return null;}

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { triggerLightHaptic(); handleClose(); }}
          />
        </Animated.View>
        <Animated.View
          ref={contentRef}
          style={[
            styles.modalContainer,
            // On small phones, allow the modal to occupy slightly more vertical space so the footer stays visible
            isSmallPhone && styles.modalContainerSmallPhone,
            { transform: [{ translateY }] },
          ]}
          onLayout={measureContent}
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { triggerLightHaptic(); handleClose(); }}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>

          <View style={styles.contentWrapper}>
            {/* Logo at very top of modal during generation */}
            {(isCreating || isOnboardingCreating || isClosing) && (
              <Animated.Image
                source={require('../../assets/icons/siFia-logo-white.png')}
                style={[
                  styles.generatingLogoTop,
                  {
                    opacity: genLogoEntryAnim,
                    transform: [{
                      translateY: genLogoEntryAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    }],
                  },
                ]}
                resizeMode="contain"
              />
            )}

            {!isCreating && !isOnboardingCreating && !isSuccess && !isClosing && (
              <View style={styles.fixedContent}>
                <ThemedText weight="semiBold" style={styles.title}>Turn this into a devotional</ThemedText>
                <View style={styles.subtitleContainer}>
                  <ThemedText weight="regular" style={styles.subtitle}>
                    Based on what you've shared, this devotional helps you reflect, pray, and listen with God as you continue your journey.
                  </ThemedText>
                </View>
              </View>
            )}

            <View style={styles.scrollableContent}>

              {(playbookInfo || userInput) && (
                <Animated.View style={[
                  styles.playbookInfoContainer,
                  (isCreating || isOnboardingCreating || isClosing) ? {
                    opacity: genCardEntryAnim,
                    transform: [{
                      translateY: genCardEntryAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    }],
                  } : {},
                ]}>
                  <TouchableOpacity
                    style={styles.playbookInfoHeader}
                    onPress={() => { triggerLightHaptic(); togglePlaybookInfo(); }}
                    activeOpacity={0.8}
                  >
                    <ThemedText weight="semiBold" style={styles.playbookInfoLabel}>WHAT YOU'VE SHARED</ThemedText>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <Ionicons
                        name="chevron-down"
                        size={17}
                        color="rgba(255,255,255,0.65)"
                      />
                    </Animated.View>
                  </TouchableOpacity>

                  <View style={[
                    styles.playbookInfoContent,
                    showPlaybookInfo ? styles.playbookInfoContentExpanded : styles.playbookInfoContentCollapsed,
                  ]}>
                    <ThemedText weight="regular" style={styles.playbookInfoText}>{userInput || playbookInfo}</ThemedText>
                  </View>
                </Animated.View>
              )}

              <View style={styles.optionsContainer}>
                {!(isCreating || isOnboardingCreating || isSuccess || isClosing) && (
                  <ThemedText weight="semiBold" style={styles.durationPrompt}>Select a devotional duration:</ThemedText>
                )}
                {(isCreating || isOnboardingCreating || isClosing) ? (
    <Animated.View style={[
      styles.generatingContainer,
      {
        opacity: isClosing ? 1 : generatingFadeAnim,
        transform: isClosing ? [{ scale: 1 }] : [{ scale: generatingScaleAnim }],
      },
    ]}>
      {!isSuccess || isClosing ? (
        <>
          <View style={styles.generationTitleRow}>
            <Animated.Text style={[styles.buildingHeading, font, { opacity: buildingTextOpacity }]}>
              {`Building your ${selectedDuration ? `${selectedDuration}-day` : ''}${selectedDuration ? ' ' : ''}devotional${buildingDots}`}
            </Animated.Text>
          </View>
          <ThemedText weight="regular" style={styles.buildingSubtext}>Grounding this season in Scripture, reflection, and prayer.</ThemedText>

          {/* Step cards */}
          <Animated.View style={[
            styles.stepsContainer,
            {
              opacity: genStepsEntryAnim,
              transform: [{
                translateY: genStepsEntryAnim.interpolate({
                  inputRange: [0, 1], outputRange: [18, 0],
                }),
              }],
            },
          ]}>
            {generationSteps.map((step, index) => (
              <Animated.View key={step.key} style={[
                styles.stepCard,
                step.status === 'completed' && styles.stepCardCompleted,
                step.status === 'active' && styles.stepCardActive,
                step.status === 'inactive' && styles.stepCardDefault,
                (step.status === 'active' || step.status === 'completed') && {
                  backgroundColor: stepCardBgAnims[index].interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ['transparent', 'rgba(255,255,255,0.05)', 'rgba(255, 107, 107, 0.1)'],
                  }),
                  borderColor: stepCardBorderAnims[index].interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ['transparent', 'rgba(255,255,255,0.1)', 'rgba(255, 107, 107, 0.2)'],
                  }),
                  borderWidth: 1,
                },
                {
                  transform: [{ scale: stepCardScaleAnims[index] }],
                },
              ]}>
                <View style={styles.stepRow}>
                  <View style={[
                    styles.stepCircle,
                    step.status === 'completed' && styles.stepCompleted,
                    step.status === 'active' && styles.stepActive,
                    step.status === 'inactive' && styles.stepInactive,
                  ]}>
                    {step.status === 'completed' && (
                      <Animated.View style={{ transform: [{ scale: checkIconAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
                        <MaterialIcons name="check" size={16} color={Colors.hopeWhite} />
                      </Animated.View>
                    )}
                    {step.status === 'active' && (
                      <Animated.View style={[styles.pulsingDot, { opacity: pulsingDotAnims[index] }]} />
                    )}
                    {step.status === 'inactive' && (
                      <View style={styles.staticDot} />
                    )}
                  </View>
                  <ThemedText weight="regular" style={[
                    styles.stepText,
                    step.status === 'completed' && styles.stepTextCompleted,
                    step.status === 'active' && styles.stepTextActive,
                    step.status === 'inactive' && styles.stepTextInactive,
                  ]}>
                    {step.title}
                  </ThemedText>
                </View>
              </Animated.View>
            ))}
          </Animated.View>

          <Animated.View style={{
            opacity: genProgressEntryAnim,
            transform: [{
              translateY: genProgressEntryAnim.interpolate({
                inputRange: [0, 1], outputRange: [14, 0],
              }),
            }],
          }}>
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
            <ThemedText weight="regular" style={styles.progressLabel}>Phase {Math.min(currentStep + 1, generationSteps.length)} of 4</ThemedText>
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                opacity: checkmarkAnim,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={64} color={Colors.growthGreen}/>
          </Animated.View>
          <ThemedText weight="semiBold" style={styles.loadingText}>Devotional Created!</ThemedText>
        </>
      )}
    </Animated.View>
  ) : creationError ? (
    <View style={styles.errorContainer}>
      <ThemedText weight="semiBold" style={styles.errorText}>{creationError?.message || 'An error occurred'}</ThemedText>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={async () => {
          // Check if devotional already completed while app was backgrounded
          if (playbookId) {
            try {
              const { supabase } = await import('../services/supabaseClient');
              const { data: existing } = await supabase
                .from('devotionals')
                .select('id, created_at')
                .eq('playbook_id', playbookId)
                .order('created_at', { ascending: false })
                .limit(1);

              if (existing && existing.length > 0) {
                const ageMs = Date.now() - new Date(existing[0].created_at).getTime();
                if (ageMs < 3 * 60 * 1000) {
                  setCreationError(null);
                  handleClose(() => {
                    if (onDevotionalCreated) {
                      onDevotionalCreated(existing[0].id);
                    }
                  });
                  return;
                }
              }
            } catch {}
          }
          setCreationError(null);
          handleClose();
        }}
      >
        <ThemedText weight="semiBold" style={styles.retryButtonText}>Try Again</ThemedText>
      </TouchableOpacity>
    </View>
  ) : (
    !isOnboarding && (
    <View style={styles.optionsContainer}>
                {DURATION_OPTIONS.map((option) => {
                  const accessCheck = devotionalGating.checkAccess(option.days, isOnboarding ? 'onboarding' : 'inApp');
                  const isLocked = accessCheck.isLocked;

                  return (
                    <TouchableOpacity
                      key={option.days}
                      style={[
                        styles.optionButton,
                        isLocked && styles.optionButtonLocked,
                      ]}
                      onPress={() => {
                        if (isOnboarding && isLocked) {
                          // In onboarding, locked durations should not be tappable
                          return;
                        }
                        triggerLightHaptic();
                        handleSelectDuration(option.days);
                      }}
                      disabled={isCreating || isOnboardingCreating || generationInFlightRef.current || (isOnboarding && isLocked)}
                      activeOpacity={isLocked ? 0.6 : 0.8}
                    >
                      <View style={styles.optionHeader}>
                        <View style={styles.optionLeftContent}>
                          <ThemedText weight="semiBold" style={[
                            styles.optionDays,
                            isLocked && styles.optionTextLocked,
                          ]}>
                            {option.days} DAY
                          </ThemedText>
                          <ThemedText weight="semiBold" style={[
                            styles.optionTitle,
                            isLocked && styles.optionTextLocked,
                          ]}>
                            {option.title}
                          </ThemedText>
                        </View>

                        {/* Lock Icon */}
                        <DevotionalLockIcon
                          tier={devotionalGating.tier}
                          duration={option.days}
                          context={isOnboarding ? 'onboarding' : 'inApp'}
                          isOnboarding={isOnboarding}
                          onLockTap={() => {
                            if (isOnboarding) {
                              // In onboarding, lock icon should not trigger sales offer
                              return;
                            }
                            Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from lock icon tap', {
                              component: 'DevotionalModal',
                              context: 'lock_icon',
                              tier: devotionalGating.tier,
                              requestedDuration: option.days,
                              isOnboarding,
                            });

                            onClose();
                            navigation.navigate('OnboardingSalesOffer' as any, {
                              upgradeMode: true,
                              currentTier: devotionalGating.tier,
                              requestedDuration: option.days,
                              featureType: 'devotionals',
                              source: 'devotional_lock',
                              feature: 'devotionals',
                              skipNotificationPreference: true,
                            });
                          }}
                          size={20}
                        />
                      </View>

                      <ThemedText weight="regular" style={[
                        styles.optionDescription,
                        isLocked && styles.optionTextLocked,
                      ]}>
                        {option.description}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
    )
  )}
  {/* Continue My Journey button for onboarding */}
  {isOnboarding && !(isCreating || isSuccess) && devotionalGating.tier !== 'seeker' && (
    <TouchableOpacity
      style={styles.continueJourneyButton}
      onPress={() => {
        try { triggerLightHaptic(); } catch {}
        Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from Continue My Journey (onboarding)', {
          component: 'DevotionalModal',
          context: 'continue_journey',
        });
        handleClose(() => {
          navigation.navigate('OnboardingSalesOffer' as any, {
            onboardingFlow: true,
            featureType: 'devotionals',
          });
        });
      }}
      activeOpacity={0.85}
    >
      <ThemedText weight="semiBold" style={styles.continueJourneyButtonText}>Continue with siFia</ThemedText>
    </TouchableOpacity>
  )}
  <ThemedText weight="regular" style={styles.footerText}>
    God’s Word is a lamp to your feet and a light to your path.{'\n'}May this devotional be a quiet space to listen and walk with Him.
  </ThemedText>
</View>
            </View>
          </View>
        </Animated.View>

        {/* Usage Tooltip Modal */}
        <UsageTooltipModal
          visible={tooltipVisible}
          onClose={() => setTooltipVisible(false)}
          type="devotionals"
          subscription={devotionalGating.subscription}
          usage={{
            playbooks: { used: 0, limit: 0 },
            devotionals: {
              used: devotionalGating.subscription?.devotionals_used || 0,
              limit: devotionalGating.subscription?.devotionals_limit || 0,
            },
            refinements: { used: 0, limit: 0 },
            wisdom: { used: 0, limit: 0 },
          }}
          stats={null}
        />

        {/* Usage Limit Modal */}
        {showUsageLimitModal && usageLimitModalData && (
          <Modal
            visible={showUsageLimitModal}
            transparent
            animationType="none"
            onRequestClose={() => {
              setShowUsageLimitModal(false);
              setUsageLimitModalData(null);
            }}
          >
            <View style={styles.usageLimitOverlay}>
              <View style={styles.usageLimitContainer}>
                <View style={styles.usageLimitHeader}>
                  <MaterialCommunityIcons name="book" size={32} color={Colors.alertCoral} />
                  <ThemedText weight="bold" style={styles.usageLimitTitle}>
                    {(() => {
                      const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData;
                      const salesCopy = generateSalesCopy({
                        featureType: 'devotionals',
                        currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                        remaining: 0,
                        limit: devotionalsLimit,
                        isOnTrial,
                        trialChosenTier: trialChosenTier as any,
                        trialEndDate,
                        subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                      });
                      return salesCopy.title;
                    })()}
                  </ThemedText>
                </View>

                <ThemedText weight="regular" style={styles.usageLimitMessage}>
                  {(() => {
                    const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData;
                    const salesCopy = generateSalesCopy({
                      featureType: 'devotionals',
                      currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                      remaining: 0,
                      limit: devotionalsLimit,
                      isOnTrial,
                      trialChosenTier: trialChosenTier as any,
                      trialEndDate,
                      subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                    });
                    return salesCopy.message;
                  })()}
                </ThemedText>

                {(() => {
                  const { isOnTrial, tier, trialChosenTier, devotionalsLimit, trialEndDate } = usageLimitModalData || {
                    isOnTrial: false,
                    tier: 'spark',
                    trialChosenTier: 'spark',
                    devotionalsLimit: 0,
                    trialEndDate: null,
                  };

                  const salesCopy = generateSalesCopy({
                    featureType: 'devotionals',
                    currentTier: (isOnTrial ? trialChosenTier : tier) as any,
                    remaining: 0,
                    limit: devotionalsLimit,
                    isOnTrial,
                    trialChosenTier: trialChosenTier as any,
                    trialEndDate,
                    subscriptionStartDate: devotionalGating.subscription?.subscription_start_date,
                  });

                  const isTopTrialPlan = isOnTrial && (trialChosenTier === 'transformation');
                  if (isTopTrialPlan) {
                    // Show a single dismiss button so the user can close the popup
                    return (
                      <View style={styles.usageLimitButtons}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => {
                            setShowUsageLimitModal(false);
                            setUsageLimitModalData(null);
                          }}
                        >
                          <ThemedText weight="semiBold" style={styles.cancelButtonText}>
                            {salesCopy.primaryCta}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                <View style={styles.usageLimitButtons}>
                  <TouchableOpacity
                    style={styles.upgradeButtonFull}
                    onPress={() => {
                      Logger.info('[DevotionalModal] Navigating to OnboardingSalesOffer from usage limit modal primary CTA', {
                        component: 'DevotionalModal',
                        context: 'usage_limit_modal_primary',
                        tier,
                        isOnTrial,
                        recommendedTier: salesCopy.recommendedTier,
                      });

                      setShowUsageLimitModal(false);
                      setUsageLimitModalData(null);
                      onClose();
                      navigation.navigate('OnboardingSalesOffer' as any, {
                        upgradeMode: true,
                        currentTier: tier || 'spark',
                        selectedTier: salesCopy.recommendedTier,
                        skipNotificationPreference: true,
                        featureType: 'devotionals', // Explicitly mark this as devotional upgrade
                        source: 'devotional_usage_limit',
                        feature: 'devotionals',
                      });
                    }}
                  >
                    <ThemedText weight="semiBold" style={styles.upgradeButtonText}>
                      {salesCopy.primaryCta}
                    </ThemedText>
                  </TouchableOpacity>
                  {salesCopy.secondaryCta && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowUsageLimitModal(false);
                        setUsageLimitModalData(null);
                      }}
                    >
                      <ThemedText weight="semiBold" style={styles.cancelButtonText}>
                        {salesCopy.secondaryCta}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                  );
                })()}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  checkmarkContainer: {
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40, // Increased bottom padding for better spacing
    maxHeight: '95%',
    minHeight: 300, // Ensure minimum height for smooth animation
    borderWidth: 0, // Remove modal border
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    left: 0,
    right: 0,
  },
  modalContainerSmallPhone: {
    maxHeight: '92%',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
  title: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 8,
    marginTop: 0,
    textAlign: 'left',
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingHorizontal: 4,
    width: '100%',
    flexShrink: 1,
    includeFontPadding: false,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    lineHeight: 28,
  },
  subtitleContainer: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'left',
    marginBottom: 0,
    lineHeight: 18,
  },
  durationPrompt: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'left',
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 12,
    width: '100%',
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  optionButtonLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.7,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionLeftContent: {
    flex: 1,
  },
  optionTextLocked: {
    opacity: 0.6,
  },
  // New: split usage badges row (left-aligned)
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  tierBadgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tierBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    includeFontPadding: false,
  },
  countBadgeContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  countBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    includeFontPadding: false,
  },
  usageCounterContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  usageCounterText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    textAlign: 'center',
    includeFontPadding: false,
  },
  optionDays: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  optionTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  optionDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  playbookInfoContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  playbookInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  playbookInfoLabel: {
    color: Colors.hopeWhite,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1,
    opacity: 1,
    textTransform: 'uppercase',
  },
  fixedContent: {
    width: '100%',
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scrollableContent: {
    flex: 1,
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  playbookInfoContent: {
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  playbookInfoContentExpanded: {
    height: 'auto',
    paddingBottom: 12,
  },
  playbookInfoContentCollapsed: {
    height: 0,
    overflow: 'hidden',
  },
  playbookInfoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 18,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  generatingContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderRadius: 30, // increased to 30px per design request
    borderWidth: 0, // No border
    borderColor: 'transparent',
    marginVertical: 10,
    width: '100%',
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  generationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  generationTitleRow: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  generationTitleIcon: {
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
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
    width: undefined as unknown as number,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
    marginVertical: 10,
  },
  errorText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  retryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  stepTextNoPadding: {
    paddingHorizontal: 0,
  },
  // Usage Limit Modal Styles
  usageLimitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  usageLimitContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  usageLimitHeader: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  usageLimitTitle: {
    fontSize: 22,
    color: Colors.hopeWhite,
    marginTop: 12,
    textAlign: 'center',
  },
  usageLimitMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 24,
  },
  usageLimitButtons: {
    gap: 12,
  },
  continueJourneyButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  continueJourneyButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  upgradeButtonFull: {
    backgroundColor: Colors.alertCoral,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  stepsContainer: {
    marginBottom: 32,
    width: '100%',
  },
  stepCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    width: '100%',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepCardCompleted: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  stepCardActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepCardDefault: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepCompleted: {
    backgroundColor: Colors.alertCoral,
  },
  stepActive: {
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stepInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
  },
  staticDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stepText: {
    fontSize: 16,
    textAlign: 'left',
    flex: 1,
  },
  stepTextCompleted: {
    color: Colors.alertCoral,
    flex: 1,
  },
  stepTextActive: {
    color: Colors.white,
    flex: 1,
  },
  stepTextInactive: {
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  situationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  situationLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  situationText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  generatingLogo: {
    width: 120,
    height: 40,
    alignSelf: 'center',
    marginBottom: 24,
  },
  generatingLogoTop: {
    width: 120,
    height: 40,
    alignSelf: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  buildingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
    textAlign: 'left',
  },
  buildingHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
});

export default DevotionalModal;
