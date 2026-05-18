import * as React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../utils/haptics';
import { useTheme } from '../theme/ThemeContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useNewSubscription } from '../hooks/useNewSubscription';
import { checkAndRecordRequest, type SubscriptionTier } from '../utils/rateLimiting';
import { Alert, StatusBar } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedGenerationService } from '../services/unifiedGenerationService';
import { faithPointsService } from '../services/faithPointsService';
import type { Playbook } from '../interfaces/playbook';
import { validatePlaybookInputQuality } from '../utils/playbookInputValidation';

type UserInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'> & {
  navigate: (screen: 'GeneratingPlaybook', params: { userInput: string; userName: string }) => void;
  reset: (state: any) => void; // Add reset method to navigation prop
};

const MAX_USER_INPUT_LENGTH = 2000;

type StepStatus = 'completed' | 'active' | 'inactive';
type GenerationStep = { key: string; title: string; status: StepStatus };

const PHASE_PROGRESS_TARGETS = [20, 50, 80, 95];
const INITIAL_GENERATION_STEPS: GenerationStep[] = [
  { key: 'seeing', title: 'Seeing this moment clearly', status: 'inactive' },
  { key: 'naming', title: 'Naming what matters most', status: 'inactive' },
  { key: 'shaping', title: 'Shaping faithful next steps', status: 'inactive' },
  { key: 'preparing', title: 'Preparing your playbook', status: 'inactive' },
];

const buildInitialGenerationSteps = () => INITIAL_GENERATION_STEPS.map((step) => ({ ...step }));

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const UserInputScreen: React.FC = () => {
  const navigation = useNavigation<UserInputScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'UserInput'>>();
  const inputRef = useRef<TextInput | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const isLandscape = width > height;
  const isPad = Platform.OS === 'ios' && (Platform as any).isPad === true;

  useScreenStatusBar('light', Colors.anchorBlue);

  // Re-enforce light status bar on every focus event (covers Alert dismiss,
  // back navigation, and any native overlay that may reset the bar to dark).
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      // setBackgroundColor is Android-only — skip on iOS
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(Colors.anchorBlue, true);
      }
    }, [])
  );

  // No scrolling needed; content is static and footer is fixed

  const [userInput, setUserInput] = useState('');
  const [inputFeedback, setInputFeedback] = useState<string | null>(null);
  // Dynamic input height — starts at single-line size, grows to MAX then scrolls
  const MIN_INPUT_HEIGHT = 44;
  const MAX_INPUT_HEIGHT = 150;
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  // Typing, cycling placeholder for guided, non-chat input
  const [placeholderText, setPlaceholderText] = useState('What happened?');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Navigation reveal state
  const [showNavigation, setShowNavigation] = useState(false);
  const [pressedNavIcon, setPressedNavIcon] = useState<number | null>(null);
  const navButtonAnim = useRef(new Animated.Value(0)).current;
  const navIconEntranceAnim = useRef(new Animated.Value(0)).current;
  // Individual icon animations for staggered entrance
  const navIconAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  // Check icon animations for generation steps
  const checkIconAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // Generating state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1-4
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>(() => buildInitialGenerationSteps());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const generationAbortRef = useRef(false);
  const isMountedRef = useRef(true);
  const [_generationMessage, setGenerationMessage] = useState<string | null>(null);
  // Tracks which phase the trickle should stay below — raised by updateStepStatus
  const currentPhaseRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      generationAbortRef.current = true;
    };
  }, []);

  const resetGenerationSteps = () => {
    setGenerationSteps(() => buildInitialGenerationSteps());
    setCurrentStep(1);
    progressAnim.setValue(0);
    setGenerationMessage(null);
    generationAbortRef.current = false;
    currentPhaseRef.current = 0;
  };

  // Snap all transition animations back to their pre-submit state so the input
  // screen is fully visible again when generation is cancelled or errors out.
  // Also re-applies the light status bar since iOS Alert dialogs can disturb it.
  const resetToInputState = () => {
    inputCollapseAnim.setValue(0);
    inputScaleAnim.setValue(1);
    headerIntroOpacity.setValue(1);
    askBoxOpacity.setValue(1);
    generatingFadeAnim.setValue(0);
    generatingScaleAnim.setValue(0.92);
    genLogoEntryAnim.setValue(0);
    genCardEntryAnim.setValue(0);
    genHeadingEntryAnim.setValue(0);
    genStepsEntryAnim.setValue(0);
    genProgressEntryAnim.setValue(0);
    setBuildingDots('');
    // Reset step card animations
    stepCardBgAnims.forEach(anim => anim.setValue(0));
    stepCardBorderAnims.forEach(anim => anim.setValue(0));
    stepCardScaleAnims.forEach(anim => anim.setValue(1));
    StatusBar.setBarStyle('light-content', true);
    setIsGenerating(false);
  };

  const animateProgressTo = (target: number, duration = 800) =>
    new Promise<void>((resolve) => {
      Animated.timing(progressAnim, {
        toValue: target,
        duration,
        useNativeDriver: false,
      }).start(() => resolve());
    });

  const completeProgress = async () => {
    // Mark all steps as completed and animate check icons
    setGenerationSteps((prev) =>
      prev.map((step, index) => {
        // Animate check icon for each completed step
        Animated.spring(checkIconAnims[index], {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }).start();
        // Animate step card background, border, and scale for each completed step (springy)
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
        return { ...step, status: 'completed' };
      })
    );
    setCurrentStep(4);
    await animateProgressTo(100, 600);
  };

  const updateStepStatus = (stepIndex: number) => {
    // Raise trickle ceiling so the bar is now allowed to approach this phase's target
    currentPhaseRef.current = stepIndex;

    setGenerationSteps((prev) =>
      prev.map((step, index) => {
        if (index < stepIndex) {
          // Animate check icon for completed steps
          Animated.spring(checkIconAnims[index], {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }).start();
          // Animate step card background, border, and scale for completed steps (springy)
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
          return { ...step, status: 'completed' };
        }
        if (index === stepIndex) {
          // Animate step card for active step (springy scale up + background/border)
          Animated.parallel([
            Animated.spring(stepCardScaleAnims[index], {
              toValue: 1.05,
              useNativeDriver: false,
              tension: 50,
              friction: 6,
            }),
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
          ]).start();
          return { ...step, status: 'active' };
        }
        // Reset inactive step cards
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
        return { ...step, status: 'inactive' };
      })
    );
    setCurrentStep(Math.min(stepIndex + 1, 4));

    // Floor guarantee: when a phase completes, the bar must be at least at the
    // PREVIOUS phase's target so there's no backward drift between label and bar.
    if (stepIndex > 0) {
      const prevTarget = PHASE_PROGRESS_TARGETS[stepIndex - 1];
      const current = (progressAnim as any).__getValue?.() ?? 0;
      if (current < prevTarget) {
        animateProgressTo(prevTarget, 500);
      }
    }
  };

  // ── Continuous trickle: moves 5% of remaining distance each tick, capped at
  //    the current phase ceiling. When updateStepStatus advances the phase,
  //    currentPhaseRef rises and the bar is now allowed to approach the higher target.
  const trickleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startProgressTrickle = () => {
    const TICK_MS = 300;
    let elapsed = 0;
    const tick = () => {
      elapsed += TICK_MS;
      // Hard cap: 1pt below ceiling so the bar never visually enters the next phase
      const phaseCeiling = (PHASE_PROGRESS_TARGETS[currentPhaseRef.current] ?? 95) - 1;
      const current = (progressAnim as any).__getValue?.() ?? 0;
      if (current < phaseCeiling) {
        const remaining = phaseCeiling - current;
        // 5% of remaining distance per tick → fast start, decelerates near ceiling
        const step = Math.max(0.3, remaining * 0.05);
        Animated.timing(progressAnim, {
          toValue: Math.min(current + step, phaseCeiling),
          duration: TICK_MS + 80,
          useNativeDriver: false,
        }).start();
      }
      if (elapsed < 120000) {
        trickleRef.current = setTimeout(tick, TICK_MS);
      }
    };
    trickleRef.current = setTimeout(tick, TICK_MS);
  };
  const stopProgressTrickle = () => {
    if (trickleRef.current) { clearTimeout(trickleRef.current); trickleRef.current = null; }
  };

  // Transition animations
  const inputCollapseAnim       = useRef(new Animated.Value(0)).current;
  const generatingFadeAnim      = useRef(new Animated.Value(0)).current;
  const generatingScaleAnim     = useRef(new Animated.Value(0.92)).current; // container scale spring
  const inputScaleAnim          = useRef(new Animated.Value(1)).current;

  // Per-step pulsing dots — one per step so the native driver never loses the binding
  // on re-mount when the active step changes.
  const pulsingDotAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // Animated background colors for step cards (springy)
  const stepCardBgAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  // Animated border colors for step cards (springy)
  const stepCardBorderAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  // Animated scale for step cards (springy)
  const stepCardScaleAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;

  // Shimmer opacity pulse for "Building your playbook..." text (letters only, no block)
  const buildingTextOpacity = useRef(new Animated.Value(0.55)).current;
  const [buildingDots, setBuildingDots] = useState('');

  // Staggered entrance anims for generating elements (0 = invisible, 1 = fully in)
  const genLogoEntryAnim      = useRef(new Animated.Value(0)).current;
  const genCardEntryAnim      = useRef(new Animated.Value(0)).current;
  const genHeadingEntryAnim   = useRef(new Animated.Value(0)).current;
  const genStepsEntryAnim     = useRef(new Animated.Value(0)).current;
  const genProgressEntryAnim  = useRef(new Animated.Value(0)).current;

  // Auto-save draft to prevent data loss
  const DRAFT_KEY = '@siFia:userInputDraft';

  // ── Per-step pulsing dot loops ───────────────────────────────────────────────
  useEffect(() => {
    if (isGenerating) {
      const loops = pulsingDotAnims.map((anim) => {
        anim.setValue(0);
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: 750, useNativeDriver: true }),
          ])
        );
      });
      loops.forEach((l) => l.start());
      return () => loops.forEach((l) => l.stop());
    } else {
      pulsingDotAnims.forEach((anim) => anim.setValue(0));
    }
  }, [isGenerating, pulsingDotAnims]);

  // ── Animated dots + text-opacity shimmer on "Building your playbook..." ──────
  useEffect(() => {
    if (!isGenerating) {
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
    // useNativeDriver:true works fine since we're only animating opacity
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
  }, [isGenerating, buildingTextOpacity]);

  // Load saved draft or initial text on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        // Check if we have initial text from route params (for editing)
        if (route.params?.initialText) {
          setUserInput(route.params.initialText);
          // Focus input and position cursor at end with multiple attempts for reliability
          const focusWithCursor = () => {
            if (inputRef.current) {
              inputRef.current.focus();
              // Position cursor at the end
              const textLength = route.params?.initialText?.length || 0;
              inputRef.current.setSelection(textLength, textLength);
            }
          };

          // Try immediately
          setTimeout(focusWithCursor, 100);
          // Try again after animation
          setTimeout(focusWithCursor, 500);
          return;
        }

        // Otherwise load saved draft
        const draft = await AsyncStorage.getItem(DRAFT_KEY);
        if (draft && draft.trim()) {
          setUserInput(draft);
        }
      } catch (error) {
        // Silent fail - draft is not critical
      }
    };
    loadDraft();
  }, [route.params?.initialText]);

  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Delay focus to allow screen animation to complete first
    autoFocusTimer.current = setTimeout(focusInput, 1500);

    return () => {
      if (autoFocusTimer.current) {
        clearTimeout(autoFocusTimer.current);
        autoFocusTimer.current = null;
      }
    };
  }, []);

  // Auto-save draft when user types (debounced)
  const saveDraftTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveDraftTimer.current) {
      clearTimeout(saveDraftTimer.current);
    }

    saveDraftTimer.current = setTimeout(async () => {
      try {
        if (userInput.trim()) {
          await AsyncStorage.setItem(DRAFT_KEY, userInput);
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY);
        }
      } catch (error) {
        // Silent fail - draft is not critical
      }
    }, 1000); // Save 1 second after user stops typing

    return () => {
      if (saveDraftTimer.current) {
        clearTimeout(saveDraftTimer.current);
      }
    };
  }, [userInput]);
  useEffect(() => {
    const prompts = [
      'What happened?',
      'What feels heavy or unclear?',
      'What feels hard right now?',
      'What decision are you facing?',
    ];

    const PREFIX = 'What ';
    let isMounted = true;
    let promptIndex = 0;
    let charIndex = prompts[0].length; // start at full first prompt so placeholder is visible initially

    const clearTimer = () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    };

    const typeNext = () => {
      if (!isMounted) {return;}
      const current = prompts[promptIndex];
      if (charIndex <= current.length) {
        setPlaceholderText(current.slice(0, charIndex));
        charIndex += 1;
        typingTimer.current = setTimeout(typeNext, 60);
      } else {
        // Pause, then erase only the part after "What " and move to next prompt
        typingTimer.current = setTimeout(() => {
          const erase = () => {
            if (!isMounted) {return;}
            if (charIndex > PREFIX.length) {
              setPlaceholderText(current.slice(0, charIndex));
              charIndex -= 1;
              typingTimer.current = setTimeout(erase, 35);
            } else {
              promptIndex = (promptIndex + 1) % prompts.length;
              charIndex = PREFIX.length;
              typeNext();
            }
          };
          erase();
        }, 2000);
      }
    };

    typeNext();

    return () => {
      isMounted = false;
      clearTimer();
    };
  }, []);

  const { user } = useAuth();
  const subscriptionData = useNewSubscription(user?.id || '');
  const { hasAccess } = useFeatureAccess({
    feature: 'playbook_generation',
  });

  // Override hasAccess based on actual usage data
  const canGeneratePlaybook = hasAccess && (subscriptionData.isUnlimited || subscriptionData.playbooksRemaining > 0);

  // const userId = user?.id; // Unused, commented out
  const fullName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userName = fullName.split(' ')[0] || 'User';
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(20)).current;
  const tooltipScale = useRef(new Animated.Value(0.9)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current; // No vertical movement
  const headerScale = useRef(new Animated.Value(0.35)).current; // Start smaller for spring scale animation
  const headerIntroOpacity = useRef(new Animated.Value(0)).current; // Start hidden for spring animation
  const askBoxTranslateY = useRef(new Animated.Value(16)).current;
  const askBoxOpacity = useRef(new Animated.Value(0)).current;
  const autoFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardTranslateY = useRef(new Animated.Value(0)).current;

  // Keyboard animation - sync input box with keyboard slide
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
      const liftOffset = isPad && isLandscape ? 80 : (isPad ? 50 : 70);
      Animated.spring(keyboardTranslateY, {
        toValue: -e.endCoordinates.height + liftOffset,
        tension: 50,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });

    const keyboardHideListener = Keyboard.addListener('keyboardWillHide', () => {
      Animated.spring(keyboardTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [isPad, keyboardTranslateY]);

  // Simple chat input - no complex height calculations needed

  // Intro animation when screen first opens
  useEffect(() => {
    // Skip animation if editing existing text - show immediately
    if (route.params?.initialText) {
      headerTranslateY.setValue(0);
      headerIntroOpacity.setValue(1);
      askBoxOpacity.setValue(1);
      askBoxTranslateY.setValue(0);
      navIconEntranceAnim.setValue(1);
      return;
    }

    Animated.sequence([
      Animated.delay(220), // small delay to let modal finish sliding
      Animated.parallel([
        // Spring scale animation for logo
        Animated.spring(
          headerScale,
          { toValue: 0.45, tension: 50, friction: 12, useNativeDriver: true }
        ),
        // Spring fade-in animation
        Animated.spring(headerIntroOpacity, { toValue: 1, tension: 50, friction: 12, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(askBoxOpacity, { toValue: 1, tension: 50, friction: 12, useNativeDriver: true }),
        Animated.spring(askBoxTranslateY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }),
      ]),
      Animated.spring(navIconEntranceAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [askBoxOpacity, askBoxTranslateY, headerIntroOpacity, headerScale, headerTranslateY, route.params?.initialText, navIconEntranceAnim]);
  const handleFocus = () => {
    // Animate logo position when keyboard opens
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: isPad && isLandscape ? -45 : -25,
        useNativeDriver: true,
        stiffness: 180,
        damping: 18,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    if (showTooltip) {
      setShowTooltip(false);
      Animated.parallel([
        Animated.spring(tooltipOpacity, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(tooltipTranslateY, { toValue: 20, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(tooltipScale, { toValue: 0.9, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
    // Collapse navigation when input is focused
    if (showNavigation) {
      setShowNavigation(false);
      const targetValue = 0;

      // Animate container
      Animated.spring(navButtonAnim, {
        toValue: targetValue,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Collapse individual icons immediately
      navIconAnims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: targetValue,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }).start();
      });
    }
  };
  const handleBlur = () => {
    // Return logo to original position when keyboard closes
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: isPad && isLandscape ? 15 : 0,
        useNativeDriver: true,
        stiffness: 200,
        damping: 20,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButton = () => {
    // Simple button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Use the real generatePlaybook from the API service
  // Remove the local mock implementation.

  const handleInputChange = (text: string) => {
    if (text.length > MAX_USER_INPUT_LENGTH) {
      text = text.slice(0, MAX_USER_INPUT_LENGTH);
    }
    if (inputFeedback) {
      setInputFeedback(null);
    }
    setUserInput(text);
    // When text is cleared, reset height immediately — onContentSizeChange
    // doesn't reliably fire on iOS when deleting back to empty.
    if (!text) {
      setInputHeight(MIN_INPUT_HEIGHT);
    }
  };

  const handleContentSizeChange = (event: any) => {
    const contentHeight = event.nativeEvent.contentSize.height;
    // iOS contentSize already includes padding — clamp between min and max.
    // At MAX_INPUT_HEIGHT, scrollEnabled flips to true so text scrolls instead of clipping.
    setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(contentHeight, MAX_INPUT_HEIGHT)));
  };

  const handleGenerationFlow = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    resetGenerationSteps();
    startProgressTrickle();

    // Track current phase so timers and post-playbook advancement stay in sync
    let currentPhase = 0;

    const advanceToPhase = (phase: number) => {
      if (generationAbortRef.current || currentPhase >= phase) { return; }
      currentPhase = phase;
      updateStepStatus(phase);
      try { triggerLightHaptic(); } catch {}
    };

    // Step 0 active immediately — with haptic
    updateStepStatus(0);
    try { triggerLightHaptic(); } catch {}

    // ── Time-based step timers — fully independent of API polling speed ───────
    // Steps advance at fixed wall-clock intervals so the UI always feels alive
    // regardless of whether the AI responds in 8s or 30s.
    // Timing adjusted to better match actual generation: early phases faster, later phases slower
    const phaseTimers = [
      setTimeout(() => advanceToPhase(1), 3500),   // naming   at  3.5s (faster early phase)
      setTimeout(() => advanceToPhase(2), 9000),   // shaping  at  9s  (medium)
      setTimeout(() => advanceToPhase(3), 18000), // preparing at 18s (slower - matches actual AI time)
    ];
    const clearPhaseTimers = () => phaseTimers.forEach(clearTimeout);

    const runGeneration = async () => {
      const response = await unifiedGenerationService.generatePlaybook({
        userId: user.id,
        userInput,
        userName,
        isOnboarding: false,
      });

      if (!response.success) {
        throw Object.assign(new Error(response.message || 'Unable to generate playbook'), response);
      }

      let savedPlaybook: Playbook | null = null;

      const fetchLatestPlaybook = async () => {
        if (!user.id) { return null; }
        const { supabase } = await import('../services/supabaseClient');
        const { data: recentPlaybooks } = await supabase
          .from('playbooks')
          .select('id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!recentPlaybooks || recentPlaybooks.length === 0) {
          return null;
        }

        const { getPlaybook } = await import('../services/modernPlaybookApi');
        const completePlaybook = await getPlaybook(user.id, recentPlaybooks[0].id);
        return completePlaybook as Playbook;
      };

      if (response.queueId) {
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts && !savedPlaybook) {
          if (generationAbortRef.current) {
            return null;
          }

          attempts += 1;
          await wait(1000);

          const status = await unifiedGenerationService.checkGenerationStatus(response.queueId);

          if (status.status === 'failed') {
            throw new Error(status.message || 'Generation failed. Please try again.');
          }

          if (status.status === 'completed' && status.resultId && user.id) {
            const { getPlaybook } = await import('../services/modernPlaybookApi');
            const completePlaybook = await getPlaybook(user.id, status.resultId);
            if (completePlaybook) {
              savedPlaybook = completePlaybook as Playbook;
              break;
            }
          }

          if (status.status === 'processing' && attempts > 15) {
            try {
              const fallback = await fetchLatestPlaybook();
              if (fallback) {
                savedPlaybook = fallback;
                break;
              }
            } catch (fallbackError) {
              Logger.error('[UserInputScreen] Fallback playbook fetch failed', fallbackError as Error);
            }
          }
          // Step advancement is handled entirely by phaseTimers — no attempt-based logic here
        }
      } else {
        savedPlaybook = await fetchLatestPlaybook();
      }

      if (!savedPlaybook) {
        throw new Error('Playbook generation is taking longer than expected. Please try again.');
      }

      return savedPlaybook;
    };

    try {
      const playbook = await runGeneration();

      // Stop timer-based advancement — we'll drive the remaining steps ourselves
      clearPhaseTimers();

      if (!playbook) {
        resetToInputState();
        return;
      }

      // ── Walk through any phases that haven't fired yet, each with a visible gap ──
      // This ensures "shaping" and "preparing" never check simultaneously.
      if (currentPhase < 1) {
        await wait(400);
        advanceToPhase(1);
      }
      if (currentPhase < 2) {
        await wait(1500);
        advanceToPhase(2);
      }
      if (currentPhase < 3) {
        await wait(1500);
        advanceToPhase(3);
      }

      // Let the final step pulse as "active" briefly before the checkmark lands
      await wait(1000);

      stopProgressTrickle();
      await completeProgress();
      try { triggerSuccessHaptic(); } catch {}

      if (user.id) {
        try {
          await faithPointsService.awardPoints(user.id, 'playbook_generated', {
            suppressNotification: true, // hide faith points reward notification
            isOnboarding: false,
          });
        } catch (pointsError) {
          Logger.error('[UserInputScreen] Failed to award faith points', pointsError as Error);
        }

      }

      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch {}

      generationAbortRef.current = true;
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [{ name: 'Overview' }, { name: 'Playbooks' }],
              index: 1,
            },
          },
          { name: 'PlaybookWalkthrough', params: { playbook, source: 'user_input' } },
        ],
      });
    } catch (error) {
      clearPhaseTimers();
      stopProgressTrickle();
      Logger.error('[UserInputScreen] Generation error', error as Error);
      try { triggerErrorHaptic(); } catch {}

      if ((error as any).contentBlocked) {
        Alert.alert(
          'Content Review',
          (error as any).christianMessage || 'Content blocked for review.',
          [
            {
              text: 'OK',
              onPress: () => { resetToInputState(); resetGenerationSteps(); },
            },
          ]
        );
        return;
      }

      const generationInterrupted = (error as any).generationInterrupted;
      Alert.alert(
        generationInterrupted ? 'Try Again' : 'Connection Lost',
        (error as Error)?.message || (
          generationInterrupted
            ? 'I started creating your playbook, but the response stopped before it finished. Please try again.'
            : 'The network connection was lost. Please try again.'
        ),
        [
          {
            text: 'Try Again',
            onPress: async () => {
              // Check if generation already completed while app was backgrounded
              try {
                const { supabase } = await import('../services/supabaseClient');
                const { data: recentPlaybooks } = await supabase
                  .from('playbooks')
                  .select('id, created_at')
                  .eq('user_id', user?.id)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (recentPlaybooks && recentPlaybooks.length > 0) {
                  const ageMs = Date.now() - new Date(recentPlaybooks[0].created_at).getTime();
                  if (ageMs < 3 * 60 * 1000 && user?.id) {
                    const { getPlaybook } = await import('../services/modernPlaybookApi');
                    const existing = await getPlaybook(user.id, recentPlaybooks[0].id);
                    if (existing) {
                      generationAbortRef.current = true;
                      navigation.reset({
                        index: 0,
                        routes: [
                          { name: 'MainTabs', state: { routes: [{ name: 'Overview' }, { name: 'Playbooks' }], index: 1 } },
                          { name: 'PlaybookWalkthrough', params: { playbook: existing, source: 'user_input' } },
                        ],
                      });
                      return;
                    }
                  }
                }
              } catch {}
              generationAbortRef.current = false;
              handleGenerationFlow();
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              resetToInputState();
              resetGenerationSteps();
            },
          },
        ]
      );
    }
  };

  const handleGeneratePlaybook = async () => {
    try { triggerLightHaptic(); } catch {}
    animateButton();
    // Clear any pending auto-focus timer to prevent keyboard from reappearing
    if (autoFocusTimer.current) {
      clearTimeout(autoFocusTimer.current);
      autoFocusTimer.current = null;
    }
    Keyboard.dismiss();

    if (!userInput.trim()) {
      // Show error animation
      Animated.sequence([
        Animated.timing(inputBorderWidth, {
          toValue: 2,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(inputBorderWidth, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
      // Input validation - could show inline error instead of alert
      setInputFeedback('Send what you want siFia to work on.');

      return;
    }

    const inputQuality = validatePlaybookInputQuality(userInput);
    if (!inputQuality.isValid) {
      Animated.sequence([
        Animated.timing(inputBorderWidth, {
          toValue: 2,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(inputBorderWidth, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
      try { triggerErrorHaptic(); } catch {}
      setInputFeedback(inputQuality.message || 'Looks like a mistype. Send what you want siFia to work on.');
      return;
    }

    // Check subscription access before proceeding
    if (!canGeneratePlaybook) {
      const { subscription, playbooksRemaining, isSeeker } = subscriptionData;

      if (isSeeker) {
        // Navigate directly to sales offer screen - no alerts
        (navigation as any).navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: 'seeker',
          skipNotificationPreference: true,
          source: 'user_input_seeker_limit',
          feature: 'playbooks',
        });
      } else if (playbooksRemaining === 0) {
        // Navigate to sales offer for usage limit reached
        // Check if user is on a paid tier (not seeker/trial) and force annual plans
        const actualTier = subscription?.tier || 'seeker';
        const isPaidTier = ['spark', 'growth', 'transformation'].includes(actualTier.replace('_annual', ''));
        (navigation as any).navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: subscription?.tier || 'seeker',
          skipNotificationPreference: true,
          source: 'user_input_usage_limit',
          feature: 'playbooks',
          forceAnnualOnly: isPaidTier,
        });
      }
      return;
    }

    // ENTERPRISE: Check rate limiting before generation
    if (user?.id && subscriptionData?.subscription?.tier) {
      try {
        const tier = subscriptionData.subscription.tier as SubscriptionTier;
        const rateLimitCheck = await checkAndRecordRequest(user.id, tier, 'playbook');

        if (!rateLimitCheck.allowed) {
          // Show user-friendly rate limit message
          Alert.alert(
            'Please Wait',
            rateLimitCheck.message || 'Please wait before generating another playbook.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      } catch (rateLimitError) {
        // If rate limiting fails, log but don't block the user
        Logger.warn('Rate limiting check failed', { errorMessage: String(rateLimitError) });
        // Continue with generation - better UX than crashing
      }
    }

    // Close keyboard
    Keyboard.dismiss();

    // ── Start API call immediately — don't wait for animations ──────────────
    handleGenerationFlow();

    // ── Phase 1: footer shrinks + header content fades (0–260ms) ────────────
    generatingFadeAnim.setValue(0);
    generatingScaleAnim.setValue(0.92);
    genLogoEntryAnim.setValue(0);
    genCardEntryAnim.setValue(0);
    genHeadingEntryAnim.setValue(0);
    genStepsEntryAnim.setValue(0);
    genProgressEntryAnim.setValue(0);

    Animated.parallel([
      Animated.timing(inputCollapseAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(inputScaleAnim, {
        toValue: 0.88,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(headerIntroOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(askBoxOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ── Phase 2: switch to generating mode; each element bounces in ───────
      setIsGenerating(true);

      requestAnimationFrame(() => {
        // Container fades + scales in with spring bounce
        Animated.parallel([
          Animated.timing(generatingFadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(generatingScaleAnim, {
            toValue: 1,
            tension: 45,
            friction: 7,   // friction 7 → slight overshoot/bounce
            useNativeDriver: true,
          }),
        ]).start();

        // Staggered element entrance — each springs up with its own delay
        const springConfig = { tension: 55, friction: 8, useNativeDriver: true as const };
        const entries: [Animated.Value, number][] = [
          [genLogoEntryAnim,     0],
          [genCardEntryAnim,     90],
          [genHeadingEntryAnim,  190],
          [genStepsEntryAnim,    300],
          [genProgressEntryAnim, 430],
        ];
        entries.forEach(([anim, delay]) => {
          setTimeout(() => {
            Animated.spring(anim, { toValue: 1, ...springConfig }).start();
          }, delay);
        });
      });
    });

    // Clear draft after successful navigation is handled post-generation
  };

  const handleInputPress = () => {
    inputRef.current?.focus();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    if (showTooltip) {
      setShowTooltip(false);
      Animated.parallel([
        Animated.spring(tooltipOpacity, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(tooltipTranslateY, { toValue: 20, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(tooltipScale, { toValue: 0.9, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleNavigationToggle = () => {
    try { triggerLightHaptic(); } catch {}
    setShowNavigation(!showNavigation);
    const targetValue = showNavigation ? 0 : 1;

    // Animate container
    Animated.spring(navButtonAnim, {
      toValue: targetValue,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Stagger individual icons
    navIconAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: targetValue,
        tension: 80,
        friction: 8,
        delay: targetValue === 1 ? index * 50 : 0, // Stagger entrance, collapse immediately
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNavigationWithCollapse = (navAction: () => void) => {
    if (!showNavigation) {
      navAction();
      return;
    }

    // Animate collapse
    Animated.spring(navButtonAnim, {
      toValue: 0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();

    navIconAnims.forEach((anim) => {
      Animated.spring(anim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });

    // Navigate after animation completes
    Animated.spring(navButtonAnim, {
      toValue: 0,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      setShowNavigation(false);
      navAction();
    });
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const onPressHint = () => {
    try { triggerLightHaptic(); } catch {}
    setShowTooltip((v) => {
      const next = !v;
      if (next) {
        Animated.parallel([
          Animated.spring(tooltipOpacity, { toValue: 1, tension: 50, friction: 12, useNativeDriver: true }),
          Animated.spring(tooltipTranslateY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }),
          Animated.spring(tooltipScale, { toValue: 1, tension: 50, friction: 12, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(tooltipOpacity, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }),
          Animated.spring(tooltipTranslateY, { toValue: 20, tension: 50, friction: 12, useNativeDriver: true }),
          Animated.spring(tooltipScale, { toValue: 0.9, tension: 50, friction: 12, useNativeDriver: true }),
        ]).start();
      }
      return next;
    });
  };

  // Rely on KeyboardAvoidingView for precise avoidance; no manual listeners

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.select({ ios: -70, android: 0 })}
          style={{ flex: 1 }}
          enabled={false}
        >
        <View style={[styles.content, isPad && isLandscape && styles.contentLandscape]}>
          {/* Expandable navigation bar - hidden during generation */}
          {!isGenerating && (
            <>
              <Animated.View style={[styles.navButtonContainer, { transform: [{ rotate: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }]}>
                <Animated.View
                  style={{
                    opacity: navIconEntranceAnim,
                    transform: [
                      {
                        scale: navIconEntranceAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    onPress={handleNavigationToggle}
                    style={styles.navButton}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="auto-fix-high" size={20} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>

            {/* Navigation icons when expanded */}
            <Animated.View style={[styles.expandedNavContainer, { opacity: navButtonAnim, transform: [{ translateX: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
              <Animated.View style={{ opacity: navIconAnims[0], transform: [{ scale: navIconAnims[0].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
                <TouchableOpacity
                  style={styles.navIconItem}
                  onPress={() => { try { triggerLightHaptic(); } catch {} handleNavigationWithCollapse(() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Overview' }], index: 0 } }] })); }}
                  onPressIn={() => setPressedNavIcon(0)}
                  onPressOut={() => setPressedNavIcon(null)}
                >
                  <MaterialIcons name="space-dashboard" size={20} color={pressedNavIcon === 0 ? Colors.alertCoral : theme.colors.anchorBlueLight} />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ opacity: navIconAnims[1], transform: [{ scale: navIconAnims[1].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
                <TouchableOpacity
                  style={styles.navIconItem}
                  onPress={() => { try { triggerLightHaptic(); } catch {} handleNavigationWithCollapse(() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Overview' }, { name: 'Playbooks' }], index: 1 } }] })); }}
                  onPressIn={() => setPressedNavIcon(1)}
                  onPressOut={() => setPressedNavIcon(null)}
                >
                  <MaterialCommunityIcons name="clipboard-text-play" size={20} color={pressedNavIcon === 1 ? Colors.alertCoral : theme.colors.anchorBlueLight} />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ opacity: navIconAnims[2], transform: [{ scale: navIconAnims[2].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
                <TouchableOpacity
                  style={styles.navIconItem}
                  onPress={() => { try { triggerLightHaptic(); } catch {} handleNavigationWithCollapse(() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Overview' }, { name: 'Devotionals' }], index: 1 } }] })); }}
                  onPressIn={() => setPressedNavIcon(2)}
                  onPressOut={() => setPressedNavIcon(null)}
                >
                  <MaterialCommunityIcons name="book" size={20} color={pressedNavIcon === 2 ? Colors.alertCoral : theme.colors.anchorBlueLight} />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ opacity: navIconAnims[3], transform: [{ scale: navIconAnims[3].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
                <TouchableOpacity
                  style={styles.navIconItem}
                  onPress={() => { try { triggerLightHaptic(); } catch {} handleNavigationWithCollapse(() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Overview' }, { name: 'Journal' }], index: 1 } }] })); }}
                  onPressIn={() => setPressedNavIcon(3)}
                  onPressOut={() => setPressedNavIcon(null)}
                >
                  <MaterialCommunityIcons name="notebook-edit" size={20} color={pressedNavIcon === 3 ? Colors.alertCoral : theme.colors.anchorBlueLight} />
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            {/* Profile button in upper right corner - appears when navigation is expanded */}
            <Animated.View
              style={[
                styles.profileButtonContainer,
                {
                  opacity: navButtonAnim,
                  transform: [
                    { scale: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.1] }) },
                    { translateX: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  handleNavigationWithCollapse(() => {
                    (navigation as any).reset({
                      index: 0,
                      routes: [
                        { name: 'MainTabs', state: { routes: [{ name: 'Overview' }], index: 0 } },
                      ],
                    });
                    setTimeout(() => {
                      (navigation as any).navigate('UserProfileModal');
                    }, 300);
                  });
                }}
                onPressIn={() => {
                  try {
                    triggerLightHaptic();
                  } catch {}
                }}
                onPressOut={() => {
                  try {
                    triggerLightHaptic();
                  } catch {}
                }}
                style={styles.profileButton}
                activeOpacity={0.8}
              >
                {(() => {
                  const avatarUrl = (user as any)?.user_metadata?.avatar_url;
                  const safeAvatarUrl = avatarUrl && avatarUrl.startsWith('file://') ? avatarUrl : null;

                  return safeAvatarUrl && !imageLoadFailed ? (
                    <Image
                      source={{ uri: safeAvatarUrl }}
                      style={styles.profileImage}
                      onError={() => setImageLoadFailed(true)}
                      onLoad={() => setImageLoadFailed(false)}
                    />
                  ) : (
                    <View style={styles.initialAvatar}>
                      <Text style={styles.initialLetter}>
                        {((user as any)?.displayName ||
                          (user as any)?.user_metadata?.full_name ||
                          (user as any)?.user_metadata?.name ||
                          [((user as any)?.user_metadata?.first_name), ((user as any)?.user_metadata?.last_name)]
                            .filter(Boolean).join(' ').trim() ||
                          (user as any)?.email ||
                          'U').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

          <Animated.View style={[styles.header, { transform: [{ translateY: headerTranslateY }] }]}>
            {!isGenerating && (
              <Animated.Image
                source={require('../../assets/icons/siFia-logo-white.png')}
                style={[
                  styles.logo,
                  {
                    opacity: headerIntroOpacity,
                    transform: [{ scale: headerScale }],
                  },
                ]}
                resizeMode="contain"
              />
            )}
            {!isGenerating && (
              <Animated.Text style={[styles.questionText, font, { opacity: askBoxOpacity, transform: [{ translateY: askBoxTranslateY }] }]}>
                {placeholderText}
              </Animated.Text>
            )}
          </Animated.View>

          {/* Logo in generating state — slides in from the left */}
          {isGenerating && (
            <Animated.Image
              source={require('../../assets/icons/siFia-logo-white.png')}
              style={[
                styles.generatingLogo,
                {
                  opacity: genLogoEntryAnim,
                  transform: [{
                    translateX: genLogoEntryAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-24, 0],
                    }),
                  }],
                },
              ]}
              resizeMode="contain"
            />
          )}

          {/* Generating State View — container bounces in via scale spring */}
          {isGenerating && (
            <Animated.View style={[
              styles.generatingContainer,
              {
                opacity: generatingFadeAnim,
                transform: [{ scale: generatingScaleAnim }],
              },
            ]}>

              {/* Situation card */}
              <Animated.View style={{
                opacity: genCardEntryAnim,
                transform: [{
                  translateY: genCardEntryAnim.interpolate({
                    inputRange: [0, 1], outputRange: [22, 0],
                  }),
                }],
              }}>
                <View style={styles.situationCard}>
                  <Text style={[styles.situationLabel, font]}>WHAT YOU'VE SHARED</Text>
                  <Text style={[styles.situationText, font]} numberOfLines={3}>"{userInput.length > 100 ? userInput.slice(0, 100) + '…"' : userInput + '"'}</Text>
                </View>
              </Animated.View>

              {/* "Building your playbook..." — letters pulse via opacity shimmer */}
              <Animated.View style={{
                opacity: genHeadingEntryAnim,
                transform: [{
                  translateY: genHeadingEntryAnim.interpolate({
                    inputRange: [0, 1], outputRange: [20, 0],
                  }),
                }],
              }}>
                <Animated.Text style={[styles.buildingHeading, font, { opacity: buildingTextOpacity }]}>
                  {'Building your playbook' + buildingDots}
                </Animated.Text>
                <Text style={[styles.buildingSubtext, font]}>Grounding this moment in Scripture and faithful next steps.</Text>
              </Animated.View>

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
                  <Animated.View key={index} style={[
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
                      <Text style={[
                        styles.stepText,
                        font,
                        step.status === 'completed' && styles.stepTextCompleted,
                        step.status === 'active' && styles.stepTextActive,
                        step.status === 'inactive' && styles.stepTextInactive,
                      ]}>
                        {step.title}
                      </Text>
                    </View>
                  </Animated.View>
                ))}
              </Animated.View>

              {/* Progress bar */}
              <Animated.View style={[
                styles.progressContainer,
                {
                  opacity: genProgressEntryAnim,
                  transform: [{
                    translateY: genProgressEntryAnim.interpolate({
                      inputRange: [0, 1], outputRange: [14, 0],
                    }),
                  }],
                },
              ]}>
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
                <Text style={[styles.progressLabel, font]}>Phase {currentStep} of 4</Text>
              </Animated.View>
            </Animated.View>
          )}
        </View>

        {/* Fixed footer input anchored to safe area */}
        <Animated.View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 20, opacity: inputCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: Animated.add(keyboardTranslateY, inputCollapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] })) }, { scale: inputScaleAnim }] }]}>
          <View style={styles.inputContainer}>
            <Animated.View style={[{ opacity: askBoxOpacity, transform: [{ translateY: askBoxTranslateY }] }]}>
              <View style={styles.askWrapper}>
                <Animated.View style={[styles.askBox, { borderWidth: inputBorderWidth }]}>
                  <TextInput
                    ref={inputRef}
                    style={[
                      styles.askInput,
                      inputHeight >= MAX_INPUT_HEIGHT
                        ? { height: MAX_INPUT_HEIGHT }   // locked — scroll kicks in
                        : { minHeight: MIN_INPUT_HEIGHT }, // growing — let iOS size it
                      font,
                    ]}
                    placeholder="Share what happened..."
                    placeholderTextColor={'rgba(255,255,255,0.7)'}
                    value={userInput}
                    onChangeText={handleInputChange}
                    onContentSizeChange={handleContentSizeChange}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                    autoCapitalize="sentences"
                    keyboardAppearance="dark"
                    underlineColorAndroid="transparent"
                    autoCorrect={true}
                    autoFocus={false}
                    onTouchStart={handleInputPress}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    blurOnSubmit={false}
                  />
                  {/* Bottom row overlays: buttons on right */}
                  <View style={styles.bottomRow} pointerEvents="box-none">
                    <View style={styles.actionsRight}>
                      <View style={styles.charCounterWrapper}>
                        <Text style={[styles.charCounterText, font]}>
                          {userInput.length}/{MAX_USER_INPUT_LENGTH}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={onPressHint}
                        activeOpacity={0.9}
                        style={[styles.askHintButton, showTooltip && styles.askHintButtonActive, !showTooltip && styles.disabledButton]}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialCommunityIcons
                          name="information"
                          size={20}
                          color={showTooltip ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.5)'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.askSendButton, (!userInput || !userInput.trim()) && styles.disabledButton, userInput.trim() && styles.askSendButtonActive]}
                        onPress={handleGeneratePlaybook}
                        disabled={!userInput || !userInput.trim()}
                      >
                        <Ionicons
                          name="arrow-up"
                          size={20}
                          color={Colors.hopeWhite}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
                {inputFeedback && (
                  <Text style={[styles.inputFeedbackText, font]}>
                    {inputFeedback}
                  </Text>
                )}
                {/* Tooltip anchored above hint icon; placed outside askBox to avoid clipping */}
                {showTooltip && (
                  <Animated.View style={[styles.tooltip, { opacity: tooltipOpacity, transform: [{ translateY: tooltipTranslateY }, { scale: tooltipScale }] }]} pointerEvents="box-none">
                    <Text style={[styles.tooltipKicker, font]}>How siFia can help</Text>
                    <Text style={[styles.tooltipTitle, font]}>You don't need to explain everything perfectly.</Text>
                    <Text style={[styles.tooltipTitleSpaced, font]}>Just share what feels important right now.</Text>
                    <Text style={[styles.tooltipSubtitle, font]}>If it helps, you can mention:</Text>
                    <View style={styles.tooltipList}>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>1</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>What just happened</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>2</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>What feels heavy or unclear</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>3</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A situation you’re sitting with</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>4</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A decision you don’t know how to respond to yet</Text>
                      </View>
                    </View>
                    <Text style={[styles.tooltipFooter, font]}>siFia will help you slow down and shape this into a playbook.</Text>
                    <View style={styles.tooltipCaret} />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingBottom: 0,
  },
  // Inline status inside ask box
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 1,
    maxWidth: '75%',
    overflow: 'hidden',
  },
  statusInlineWithMinWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 1,
    maxWidth: '75%',
    minWidth: 80,
    overflow: 'hidden',
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '100%',
  },
  tierBadgeInline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    textAlign: 'center',
    maxWidth: 120,
  },
  askHintButtonInline: {
    opacity: 1,
  },
  askSendButtonInline: {
    opacity: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  contentLandscape: {
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
    gap: 0,
  },
  logo: {
    width: '70%',
    height: 100,
    alignSelf: 'center',
  },
  questionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -30,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  navButtonContainer: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  profileButtonContainer: {
    position: 'absolute',
    top: 64,
    right: 24,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  initialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialLetter: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedNavContainer: {
    position: 'absolute',
    top: 60,
    left: 80,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 22,
    paddingHorizontal: 12,
    gap: 16,
  },
  navIconItem: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 38,
    height: 38,
  },
  generatingContainer: {
    paddingHorizontal: 24,
    paddingTop: 210,
    paddingBottom: 40,
  },
  generatingLogo: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 60,
    height: 60,
    zIndex: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 24,
  },
  situationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
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
  situationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  situationText: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.white,
    lineHeight: 24,
  },
  buildingHeading: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
  buildingSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
  },
  generationMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 24,
  },
  stepsContainer: {
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
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
    fontWeight: '400',
  },
  stepTextCompleted: {
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  stepTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  stepTextInactive: {
    color: 'rgba(255,255,255,0.5)',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  guidanceSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  spacer: {
    flex: 0,
  },
  footer: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  inputContainer: {
    paddingBottom: 24,
    marginBottom: Platform.OS === 'ios' ? 0 : 20, // Add some bottom margin on Android
    paddingHorizontal: 0,
  },
  usageCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  usageText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  tierBadge: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: 100,
  },
  askWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  askBox: {
    borderRadius: 32,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 0, // Remove padding to allow seamless scrolling
    paddingBottom: 60, // Space for overlay icons
    width: '100%',
    position: 'relative',
    overflow: 'hidden', // Clip content at container edges
  },
  inputFeedbackText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 18,
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12 as any,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  charCounterWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCounterWrapperSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  charCounterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  askInput: {
    width: '100%',
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    padding: 16,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    ...Platform.select({
      ios: {
        paddingTop: 16,
      },
      android: {
        textAlignVertical: 'top',
        paddingTop: 16,
      },
    }),
  },
  askSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askSendButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  askHintButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askHintButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  tooltip: {
    position: 'absolute',
    right: 48, // align above hint icon more closely
    bottom: 62, // above icons
    maxWidth: 280,
    backgroundColor: Colors.alertCoral,
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 20,
    padding: 12,
    zIndex: 20,
  },
  tooltipTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipTitleSpaced: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 2,
  },
  tooltipKicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  tooltipSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  tooltipList: {
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  tooltipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tooltipBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipItemText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },
  tooltipFooter: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  tooltipCaret: {
    position: 'absolute',
    right: 24, // tuned to point towards the hint icon
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.alertCoral,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  tooltipClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Slight background for better visibility
  },
  debugInfo: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  debugText: {
    color: Colors.hopeWhite,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default withErrorBoundary(UserInputScreen, 'UserInputScreen');
