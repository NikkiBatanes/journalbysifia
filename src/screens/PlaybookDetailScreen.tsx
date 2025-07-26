// React & React Native
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  StatusBar,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';

// Navigation & Gestures
import { PanGestureHandler } from 'react-native-gesture-handler';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

// Animation
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// Icons
import Ionicons from 'react-native-vector-icons/Ionicons';

// Theme & Styling
import { Colors, Fonts } from '../theme';

// Components
import DocumentCardView from '../components/DocumentCardView';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import PlaybookHeader from '../components/PlaybookHeader';
import DocumentCards from '../components/DocumentCards';
import CompactHeader from '../components/CompactHeader';

// Types & Context
import { Playbook, ActionStep, Affirmation } from '../interfaces/playbook';
import { useActionSteps } from '../context/ActionStepsContext';
import { getCompletedStepsCount as getTaskStats } from '../utils/taskUtils';
import DevotionalButton from '../components/DevotionalButton';
import DevotionalModal from '../components/DevotionalModal';
import { useNavigation } from '@react-navigation/native';

// Data fetching
import { useQuery } from '@tanstack/react-query';
import { getPlaybook } from '../services/supabaseApiNormalized';
import { useUser } from '../context/UserContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Gesture state is now managed with useSharedValue

// Types
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types'; // Adjust path if needed

type PlaybookScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbook: Playbook } };
  params?: { playbook: Playbook }; // Make params optional for type safety
};


// Types
type CardType = 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';

interface CardData {
  type: CardType;
  truth?: string;
  summary?: string;
  steps?: ActionStep[];
  affirmations?: Affirmation[];
  verse?: { text: string; reference: string };
  challenge?: string | { text: string; summary: string };
  challengeCTA?: string;
  tappable: boolean;
}

export default function PlaybookDetailScreen({ route, navigation }: PlaybookScreenProps) {
  // Get playbook ID from route params (we only need the ID, not the full data)
  const playbookId = route.params?.playbook?.id || (route.params as any)?.playbookId;
  const { id: userId } = useUser();

  // Fetch fresh playbook data from database
  const { data: playbook, isLoading, error } = useQuery<Playbook | null>({
    queryKey: ['playbook', playbookId],
    queryFn: () => getPlaybook(userId || '', playbookId),
    enabled: !!playbookId && !!userId,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache to ensure fresh data (replaces cacheTime)
  });

  // Debug: Log fresh playbook data
  console.log('[PlaybookDetailScreen] DETAILED DEBUG:', {
    playbookId,
    userId,
    hasPlaybook: !!playbook,
    title: playbook?.title,
    userInput: playbook?.userInput,
    hasUserInput: !!(playbook?.userInput),
    actionStepsCount: playbook?.actionSteps?.length || 0,
    firstActionStep: playbook?.actionSteps?.[0],
    isLoading,
    error: error?.message || error,
    queryEnabled: !!playbookId && !!userId,
    routeParams: route.params,
  });

  // Debug: Log which condition will be triggered
  if (!playbookId) {
    console.log('[PlaybookDetailScreen] ❌ NO PLAYBOOK ID - showing error');
  } else if (isLoading) {
    console.log('[PlaybookDetailScreen] ⏳ LOADING - showing loading screen');
  } else if (error || !playbook) {
    console.log('[PlaybookDetailScreen] ❌ ERROR OR NO PLAYBOOK - showing error screen', { error: error?.message, hasPlaybook: !!playbook });
  } else {
    console.log('[PlaybookDetailScreen] ✅ SUCCESS - showing playbook content');
  }

  // NO EARLY RETURNS - ALL HOOKS MUST BE CALLED FIRST
  // Conditional rendering will be handled in JSX return

  // Card state
  const [currentCard, setCurrentCard] = useState(0);
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [hasReachedLastCard, setHasReachedLastCard] = useState(false);

  // Devotional state
  const rootNavigation = useNavigation<any>();

  // UI state
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [hasCreatedDevotional, setHasCreatedDevotional] = useState(false);

  // Animation refs - must be at the top level
  const animationRefs = useRef<{
    headerOpacityAnimation?: any;
    rafId?: number;
  }>({});

  const gestureAnimationRefs = useRef({
    headerFadeAnimation: null as any,
    headerShowAnimation: null as any,
    translateYAnimation: null as any,
    springAnimation: null as any,
  });

  // Handle view mode changes separately to ensure proper state reset
  useEffect(() => {
    // When switching to document view, reset hasReachedLastCard
    if (viewMode === 'document') {
      setHasReachedLastCard(false);
    }
  }, [viewMode]);

  // Cleanup effect for animations
  useEffect(() => {
    // Store current ref values in variables to ensure they're captured in the closure
    const currentAnimationRefs = animationRefs.current;
    const currentGestureRefs = gestureAnimationRefs.current;

    return () => {
      // Clean up any running animations when component unmounts
      if (currentAnimationRefs.rafId) {
        cancelAnimationFrame(currentAnimationRefs.rafId);
      }
      // Cancel any running timing animations
      if (currentAnimationRefs.headerOpacityAnimation?.cancel) {
        currentAnimationRefs.headerOpacityAnimation.cancel();
      }

      // Clean up gesture animations
      Object.values(currentGestureRefs).forEach(anim => {
        if (anim?.cancel) {
          anim.cancel();
        }
      });
    };
  }, [animationRefs, gestureAnimationRefs]); // Add refs to dependency array
  const [showUserInput, setShowUserInput] = useState(false);
  const [showDevotionalButton, setShowDevotionalButton] = useState(false);

  // Move useActionSteps to the top level to avoid conditional hook calls
  const { actionSteps, setActionSteps, saveActionSteps } = useActionSteps();
  const getCompletedStepsCount = useCallback(() => getTaskStats(actionSteps), [actionSteps]);

  // State management

  // Animation values - all hooks must be called unconditionally at the top level
  const nudgeY = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const shadowElevation = useSharedValue(4);
  const shadowOpacity = useSharedValue(0.15);
  const scrollY = useSharedValue(0);
  const gestureHandlerRef = useRef<PanGestureHandler>(null);
  const SWIPE_THRESHOLD = 120; // px, for iOS-like swipe
  const translateY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);
  const cardCount = useSharedValue(0);
  const currentCardShared = useSharedValue(currentCard);
  const headerFaded = useSharedValue(false);
  const headerOpacity = useSharedValue(1);
  const headerHeight = useSharedValue(1);
  const isInitialRender = useRef(true);
  const chevronAnim = useSharedValue(0);

  // Gesture state values - moved to top level
  const gestureState = useSharedValue({ isSwiping: false });
  const gestureStartY = useSharedValue(0);
  const gestureVelocityY = useSharedValue(0);
  const gestureTranslationY = useSharedValue(0);
  const gestureStartTime = useSharedValue(0);

  // Swipe configuration
  const MIN_SWIPE_DISTANCE = 10; // Minimum distance to start a swipe (in pixels)
  const MIN_SWIPE_VELOCITY = 500; // Minimum velocity to consider it a swipe (pixels/second)

  // Animated styles
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
  transform: [
    {
      translateY: translateY.value + nudgeY.value + bounceY.value,
    },
    { scale: cardScale.value },
  ],
  shadowOpacity: shadowOpacity.value,
  elevation: shadowElevation.value,
}));

  // React Query handles loading state automatically - no need for manual setIsLoading

  // Effect to handle chevron animation
  useEffect(() => {
    const animation = withTiming(showUserInput ? 1 : 0, { duration: 200 });
    chevronAnim.value = animation;

    return () => {
      // Cancel any running animations when component unmounts
      // or when dependencies change
      if (animation && typeof animation === 'object' && 'cancel' in animation) {
        // @ts-ignore - cancel exists on the animation object
        animation.cancel();
      }
    };
  }, [showUserInput, chevronAnim]);

  // Initialize cardData with useMemo for performance
  const cardData: CardData[] = useMemo(() => playbook ? [
    {
      type: 'truth' as const,
      truth: playbook.truthInLove?.text ?? '',
      summary: playbook.truthInLove?.summary ?? '',
      tappable: false,
    },
    {
      type: 'action' as const,
      steps: Array.isArray(actionSteps) && actionSteps.length > 0 ? actionSteps :
            (Array.isArray(playbook?.actionSteps) ? playbook.actionSteps : []),
      tappable: false,
    },
    {
      type: 'affirmation' as const,
      affirmations: Array.isArray(playbook?.affirmations)
        ? playbook.affirmations.filter((a): a is Required<Affirmation> =>
            a?.id !== undefined &&
            a?.text !== undefined &&
            a?.completed !== undefined
          )
        : [],
      tappable: false,
    },
    {
      type: 'bible' as const,
      verse: {
        text: playbook.bibleVerse?.text ?? 'No verse text available',
        reference: playbook.bibleVerse?.reference ?? 'Unknown',
      },
      tappable: false,
    },
    {
      type: 'challenge' as const,
      challenge: typeof playbook.directChallenge === 'string'
        ? playbook.directChallenge
        : playbook.directChallenge?.text ?? '',
      challengeCTA: playbook.challengeCTA ?? '',
      tappable: false,
    },
  ] : [], [playbook, actionSteps]);

  // Track if we've ever reached the last card
  const hasEverReachedLastCard = useRef(false);

  // Update hasReachedLastCard when currentCard changes or when view mode changes
  useEffect(() => {
    if (viewMode === 'stack') {
      const isLastCard = cardData.length > 0 && currentCard === cardData.length - 1;
      if (isLastCard) {
        hasEverReachedLastCard.current = true;
      }
      // Only update hasReachedLastCard if we're on the last card or if we've never reached it
      if (isLastCard || !hasEverReachedLastCard.current) {
        setHasReachedLastCard(isLastCard);
      }
    }
    // For document view, we rely on the onLastCardVisible callback from DocumentCards
  }, [currentCard, cardData.length, viewMode]);

  // Reset hasEverReachedLastCard when unmounting (when navigating away)
  useEffect(() => {
    return () => {
      hasEverReachedLastCard.current = false;
    };
  }, []);

  const handleLastCardVisible = useCallback((visible: boolean) => {
    // Only update if we're in document view and the value has changed
    if (viewMode === 'document') {
      setHasReachedLastCard(prev => {
        // Only update if the value has changed
        return prev !== visible ? visible : prev;
      });
    }
  }, [viewMode]);

  // Update card count when cardData changes
  useEffect(() => {
    if (!isLoading && !isInitialRender.current) {
      cardCount.value = cardData.length;
    }
  }, [cardData.length, cardCount, isLoading]);

  // React Query handles loading state automatically - no need for manual setIsLoading

  // Handle initial render and loading state
  useEffect(() => {
    if (isLoading) {
      isInitialRender.current = true;
    } else if (isInitialRender.current) {
      isInitialRender.current = false;
      // Initialize values after first render when not loading
      if (cardData) {
        cardCount.value = cardData.length;
        currentCardShared.value = currentCard;
      }
    }
  }, [isLoading, cardData, currentCard, cardCount, currentCardShared]);

  // Update current card shared value when currentCard changes
  useEffect(() => {
    if (!isLoading && !isInitialRender.current) {
      currentCardShared.value = currentCard;
    }
  }, [currentCard, currentCardShared, isLoading]);

  // Header left component
  const headerLeft = React.useCallback(() => (
    <View style={styles.headerLeftContainer}>
      <TouchableOpacity
        onPress={() => {
          try {
            navigation.goBack();
          } catch (error) {
            console.log('Navigation error:', error);
          }
        }}
        style={styles.backButtonContainer}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
      </TouchableOpacity>
      {showCompactHeader && (
        <Text
          style={styles.compactHeaderTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {playbook?.title}
        </Text>
      )}
    </View>
  ), [navigation, showCompactHeader, playbook?.title]);

  // Set navigation options based on scroll state
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerLeft,
    });
  }, [navigation, headerLeft]);

  const lastScrollY = useRef(0);
  const scrollThreshold = 100; // Pixels to scroll before showing compact header

  // Show devotional button with delay when last card is reached in stack view
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (hasReachedLastCard && !hasCreatedDevotional && viewMode === 'stack') {
      timeoutId = setTimeout(() => {
        setShowDevotionalButton(true);
      }, 300); // 1 second delay
    } else {
      setShowDevotionalButton(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasReachedLastCard, hasCreatedDevotional, viewMode]);

  // Debug: Log the playbook data when it's received
  useEffect(() => {
    console.log('[DEBUG] Playbook data received in PlaybookDetailScreen:', JSON.stringify({
      id: playbook?.id,
      title: playbook?.title,
      affirmations: playbook?.affirmations,
      affirmationsCount: playbook?.affirmations?.length,
      hasAffirmations: Array.isArray(playbook?.affirmations) && playbook?.affirmations.length > 0,
      playbookKeys: playbook ? Object.keys(playbook) : [],
    }, null, 2));
  }, [playbook]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Save action steps when they change or when navigating away
  useEffect(() => {
    // Don't save if we haven't initialized yet or if we're currently saving
    if (!isInitialized || isSaving) {
      return;
    }

    const saveProgress = async () => {
      try {
        if (!playbook?.id) {
          console.warn('Cannot save progress: No playbook ID available');
          return;
        }
        setIsSaving(true);
        console.log('Saving progress for playbook ID:', playbook.id);
        await saveActionSteps(playbook.id);
      } catch (error) {
        console.error('Error saving progress:', error);
        // Consider showing an error message to the user
      } finally {
        setIsSaving(false);
      }
    };

    // Save when the component unmounts
    return () => {
      saveProgress().catch(console.error);
    };
  }, [actionSteps, playbook?.id, playbook?.user_id, isInitialized, isSaving, saveActionSteps, setIsSaving]);

  // Initialize action steps when playbook loads
  useEffect(() => {
    console.log('[DEBUG] PlaybookDetailScreen - Playbook data structure:', JSON.stringify(playbook, null, 2));
    console.log('[DEBUG] PlaybookDetailScreen - Playbook actionSteps:', JSON.stringify(playbook?.actionSteps, null, 2));

    // Log detailed structure of action steps
    if (playbook?.actionSteps) {
      console.log('[DEBUG] PlaybookDetailScreen - Action steps structure:', {
        count: playbook.actionSteps.length,
        hasSubTasks: playbook.actionSteps.some(step => step.subTasks && step.subTasks.length > 0),
        stepsWithSubTasks: playbook.actionSteps
          .filter(step => step.subTasks && step.subTasks.length > 0)
          .map(step => ({
            id: step.id,
            title: step.title,
            subTasksCount: step.subTasks?.length || 0,
            subTasksSample: step.subTasks?.slice(0, 2), // Show first 2 subtasks for inspection
          })),
      });
    }

    if (playbook?.actionSteps && !isInitialized) {
      console.log('[DEBUG] Initializing action steps from playbook');
      console.log('[DEBUG] Playbook action steps:', playbook.actionSteps.slice(0, 2));
      console.log('[DEBUG] First action step examples:', playbook.actionSteps[0]?.examples);
      setActionSteps(playbook.actionSteps);
      setIsInitialized(true);
    }
  }, [playbook, setActionSteps, isInitialized]);

  // Log action steps changes
  useEffect(() => {
    console.log('[DEBUG] PlaybookDetailScreen - Context actionSteps updated:', JSON.stringify(actionSteps, null, 2));
  }, [actionSteps]);

  console.log('[DEBUG] PlaybookDetailScreen - Current context actionSteps:', actionSteps);
  console.log('[DEBUG] PlaybookDetailScreen - Playbook actionSteps:', playbook?.actionSteps);

  // Calculate progress
  const { completed, total } = useMemo(() => getTaskStats(actionSteps), [actionSteps]);

  // Ensure we don't show more than 100% progress
  const safeCompleted = Math.min(completed, total);
  const progress = total > 0 ? (safeCompleted / total) * 100 : 0;

  // Calculate completed tasks count for display
  const completedTasksCount = safeCompleted;
  const totalTasksCount = total;

  // Debug log the progress calculation
  console.log('[DEBUG] Progress calculation:', {
    completed: safeCompleted,
    total,
    progress,
    actionStepsCount: actionSteps.length,
    playbookStepsCount: playbook?.actionSteps?.length || 0,
    completedTasksCount,
    totalTasksCount,
  });

  // Handle scroll events for compact header
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Show/hide compact header based on scroll direction and position
    if (currentScrollY > scrollThreshold && currentScrollY > lastScrollY.current) {
      setShowCompactHeader(true);
    } else if (currentScrollY < lastScrollY.current - 10 || currentScrollY <= 0) {
      setShowCompactHeader(false);
    }

    lastScrollY.current = currentScrollY;

    // Update the shared value for any other animations
    scrollY.value = currentScrollY;
  };

  if (isLoading) {
    return (
      <>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text>Loading playbook...</Text>
        </View>
      </>
    );
  }



  // Card data is now defined at the top of the component

  const onSwipeComplete = (direction: 'up' | 'down') => {
    // Update card index
    if (direction === 'up') {
      goToNextCard();
    } else {
      goToPrevCard();
    }

    // Trigger bounce animation for the new top card
    bounceY.value = withSpring(-10, { damping: 10, stiffness: 200 }, (finished) => {
      if (finished) {
        bounceY.value = withSpring(5, { damping: 10, stiffness: 200 }, (finished2) => {
          if (finished2) {
            bounceY.value = withSpring(0, { damping: 10, stiffness: 200 });
          }
        });
      }
    });

    // Reset header animations
    animationRefs.current.headerOpacityAnimation = withTiming(1, { duration: 200 }, (finished) => {
      if (finished) {
        headerOpacity.value = 1;
        headerHeight.value = 1;
        headerFaded.value = false;
      }
    });

    // Reset translateY and transition state
    animationRefs.current.rafId = requestAnimationFrame(() => {
      translateY.value = 0;
      isTransitioning.value = false;
    });
  };



  // These declarations have been moved to the top of the component
  // to ensure all hooks are called unconditionally at the top level

  // TEMPORARILY DISABLED - RULES OF HOOKS VIOLATION
  // TODO: Fix this by moving all hooks to top of component
  const gestureHandler = null;

  /*
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_event) => {
      // Cancel any running animations when a new gesture starts
      Object.values(gestureAnimationRefs.current).forEach(anim => {
        if (anim?.cancel) {anim.cancel();}
      });

      gestureStartY.value = translateY.value;
      gestureState.value = { isSwiping: false };
      gestureStartTime.value = Date.now();
      gestureTranslationY.value = 0;
      gestureVelocityY.value = 0;
    },
    onActive: (event) => {
      if (isTransitioning.value) {return;}

      gestureTranslationY.value = event.translationY;
      gestureVelocityY.value = event.velocityY;

      const distanceY = Math.abs(gestureTranslationY.value);
      const distanceX = Math.abs(event.translationX);
      const isVerticalSwipe = distanceY > distanceX * 1.5;

      // Only start swiping after minimum distance is reached
      if (!gestureState.value.isSwiping && distanceY < MIN_SWIPE_DISTANCE) {return;}

      gestureState.value = { isSwiping: true };

      if (isVerticalSwipe) {
        translateY.value = gestureStartY.value + gestureTranslationY.value;

        // Calculate fade and collapse based on scroll position
        const fadeThreshold = -SWIPE_THRESHOLD / 2;
        const collapseThreshold = -SWIPE_THRESHOLD * 0.8;

        if (translateY.value < fadeThreshold) {
          const fadeProgress = Math.min(1, Math.abs(translateY.value - fadeThreshold) / (SWIPE_THRESHOLD - fadeThreshold));
          headerOpacity.value = 1 - fadeProgress * 0.8;
          headerHeight.value = 1 - fadeProgress * 0.8;

          if (translateY.value < collapseThreshold && !headerFaded.value) {
            headerFaded.value = true;
          }
        } else if (translateY.value >= fadeThreshold && headerFaded.value) {
          headerFaded.value = false;
          headerOpacity.value = 1;
          headerHeight.value = 1;
        }
      }
    },
    onEnd: (event) => {
      if (isTransitioning.value || !gestureState.value.isSwiping) {return;}

      // Calculate velocity without storing unused elapsedTime
      const velocityY = (gestureVelocityY.value || 0) * 1000;
      const isFastSwipe = Math.abs(velocityY) > MIN_SWIPE_VELOCITY;
      const isVerticalSwipe = Math.abs(gestureTranslationY.value) > Math.abs(event.translationX) * 1.5;

      if (isVerticalSwipe) {
        const isSwipeUp = gestureTranslationY.value < 0;
        const isSwipeDown = gestureTranslationY.value > 0;
        const isPastThreshold = Math.abs(gestureTranslationY.value) > SWIPE_THRESHOLD;

        const handleSwipe = (direction: 'up' | 'down') => {
          isTransitioning.value = true;
          const targetY = direction === 'up' ? -SCREEN_HEIGHT : SCREEN_HEIGHT;

          if (gestureAnimationRefs.current.translateYAnimation?.cancel) {
            gestureAnimationRefs.current.translateYAnimation.cancel();
          }

          gestureAnimationRefs.current.translateYAnimation = withTiming(
            targetY,
            { duration: isFastSwipe ? 200 : 250 },
            (finished) => {
              if (finished) {
                runOnJS(onSwipeComplete)(direction);
              }
            }
          );
          translateY.value = gestureAnimationRefs.current.translateYAnimation;
        };

        if (isSwipeUp && (isPastThreshold || isFastSwipe) && currentCardShared.value < cardCount.value - 1) {
          handleSwipe('up');
        } else if (isSwipeDown && (isPastThreshold || isFastSwipe) && currentCardShared.value > 0) {
          handleSwipe('down');
        } else {
          // Snap back if not enough movement
          if (gestureAnimationRefs.current.springAnimation?.cancel) {
            gestureAnimationRefs.current.springAnimation.cancel();
          }

          gestureAnimationRefs.current.springAnimation = withSpring(0, {
            damping: 20,
            stiffness: 300,
            velocity: gestureVelocityY.value,
          }, (finished) => {
            if (finished) {translateY.value = 0;}
          });
          translateY.value = gestureAnimationRefs.current.springAnimation;
        }
      } else {
        // Reset position for horizontal movement
        if (gestureAnimationRefs.current.springAnimation?.cancel) {
          gestureAnimationRefs.current.springAnimation.cancel();
        }

        gestureAnimationRefs.current.springAnimation = withSpring(0, {
          damping: 20,
          stiffness: 300,
          velocity: gestureVelocityY.value,
        }, (finished) => {
          if (finished) {translateY.value = 0;}
        });
        translateY.value = gestureAnimationRefs.current.springAnimation;
      }

      gestureState.value = { isSwiping: false };
    },
  });
  */

  // Animation values are now defined at the top of the component

  const goToNextCard = () => {
    if (currentCard < cardData.length - 1) {
      setCurrentCard(prevCard => prevCard + 1);
    }
  };

  const goToPrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prevCard => prevCard - 1);
    }
  };

  const handleCardPress = (cardType: CardType, cardItem: CardData) => {
    // Remove tappable property as it's not needed for serialization
    // Using _ prefix to indicate this is intentionally unused
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tappable: _, ...serializableCardData } = cardItem;
    const { completed: completedTasks, total: totalTasks } = getCompletedStepsCount();
    navigation.navigate('CardDetail', {
      cardType,
      cardData: serializableCardData,
      playbook,
      progress,
      completedTasks,
      totalTasks,
      viewMode,
    });
  };

  // chevronStyle is now defined at the top with other animation values

  const renderContent = () => {
    // Safety check - should not be called if playbook is null
    if (!playbook) {
      console.error('[PlaybookDetailScreen] renderContent called with null playbook!');
      return null;
    }

    return (
      <View style={styles.contentContainer}>
        {/* Main Header - Only show when not scrolled or in stack view */}
        {(!showCompactHeader || viewMode === 'stack') && (
          <PlaybookHeader
            title={playbook.title}
            subtitle={
              playbook.createdAt
                ? new Date(playbook.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''
            }
            progress={progress}
            completedTasks={completedTasksCount}
            totalTasks={totalTasksCount}
            showToggle={true}
            viewMode={viewMode}
            onToggleView={(mode: 'stack' | 'document') => {
              // Reset last card state when switching views
              setHasReachedLastCard(false);
              setViewMode(mode);
            }}
            onPlaybookLabelPress={() => setShowUserInput(!showUserInput)}
            showUserInput={showUserInput}
            userInput={playbook.userInput}
            chevronAnimatedStyle={chevronStyle}
            showTitle={false}
          />
        )}

        {/* Compact Header - Only show when scrolled in document view */}
        {showCompactHeader && viewMode === 'document' && (
          <View style={styles.compactHeaderContainer}>
            <CompactHeader
              title={playbook.title}
              progress={progress}
              completedTasks={completedTasksCount}
              totalTasks={totalTasksCount}
            />
          </View>
        )}

        <View style={styles.mainContainer}>
          {viewMode === 'stack' ? (
            renderStackCards()
          ) : (
            <DocumentCards
              playbook={playbook}
              actionSteps={actionSteps}
              styles={styles}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onLastCardVisible={handleLastCardVisible}
            />
          )}
        </View>
      </View>
    );
  };

  const renderStackCards = () => {
    if (cardData.length === 0) {
      return null;
    }

    const visibleCardCount = Math.min(5, cardData.length - currentCard);

    const getCardColor = (_index: number) => {
      // Return the same color for all cards to remove the gradient effect
      return Colors.anchorBlue;
    };

    const renderCard = (cardIndex: number, stackIndex: number, _onToggleView: (mode: 'stack' | 'document') => void) => {
      const card = cardData[cardIndex];
      if (!card) {
        return null;
      }

      const scaleY = 1 - stackIndex * 0.01;
      const scaleX = 1 - stackIndex * 0.05;
      const cardTranslateY = stackIndex * 12;
      const zIndex = 100 - stackIndex;
      const isLastCard = cardIndex === cardData.length - 1;
      const isCurrentCard = cardIndex === currentCard;
      const opacity = isLastCard && !isCurrentCard ? 1 : 1;
      const isTopCard = stackIndex === 0;
      const extraStyle = isTopCard ? animatedCardStyle : {};

      return (
        <TouchableOpacity
          key={`${cardIndex}-${stackIndex}`}
          activeOpacity={1}
          onPress={() => isTopCard && handleCardPress(card.type, card)}
          onPressIn={() => {
            if (isTopCard) {
              cardScale.value = withTiming(0.98, { duration: 100 });
              shadowElevation.value = withTiming(8, { duration: 100 });
              shadowOpacity.value = withTiming(0.25, { duration: 100 });
            }
          }}
          onPressOut={() => {
            if (isTopCard) {
              cardScale.value = withTiming(1, { duration: 100 });
              shadowElevation.value = withTiming(4, { duration: 100 });
              shadowOpacity.value = withTiming(0.15, { duration: 100 });
            }
          }}
          style={[
            styles.stackCard,
            card.type === 'affirmation'
              ? [
                  styles.affirmationCardStyle,
                  {
                    transform: !isTopCard ? [{ scaleX }, { scaleY }, { translateY: cardTranslateY }] : undefined,
                    zIndex,
                    opacity: !isTopCard ? opacity : 1,
                    position: stackIndex === 0 ? 'relative' : 'absolute',
                  },
                ]
              : [
                  styles.nonAffirmationCardStyle,
                  {
                    backgroundColor: getCardColor(stackIndex),
                    transform: !isTopCard ? [{ scaleX }, { scaleY }, { translateY: cardTranslateY }] : undefined,
                    zIndex,
                    opacity: !isTopCard ? opacity : 1,
                    position: stackIndex === 0 ? 'relative' : 'absolute',
                    elevation: 5 - stackIndex,
                  },
                ],
            extraStyle,
          ]}
        >
          <DocumentCardView card={card} styles={styles} />
        </TouchableOpacity>
      );
    };

    const backCards = Array.from({ length: visibleCardCount - 1 }).map((_item, i, arr) => {
      const stackIndex = arr.length - 1 - i + 1;
      const cardIndex = currentCard + stackIndex;
      return renderCard(cardIndex, stackIndex, (mode: 'stack' | 'document') => setViewMode(mode));
    });

    return (
      <View style={styles.cardStackContainer}>
        {backCards}
        {/* <PanGestureHandler ref={gestureHandlerRef} onGestureEvent={gestureHandler}> */}
          <Animated.View style={[animatedCardStyle, styles.cardWrapperStyle]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.cardContentStyle}
              onPress={() => {
                const card = cardData[currentCard];
                handleCardPress(card.type, card);
              }}
            >
              {renderCard(currentCard, 0, (mode: 'stack' | 'document') => setViewMode(mode))}
            </TouchableOpacity>
          </Animated.View>
        {/* </PanGestureHandler> */}
      </View>
    );
  };

  // Handle conditional rendering in JSX instead of early returns
  return (
    <View style={styles.container}>
      {!playbookId ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.progressText}>No playbook ID provided</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.progressText}>Loading fresh playbook data...</Text>
        </View>
      ) : error || !playbook ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.progressText}>Failed to load playbook data</Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              try {
                navigation.goBack();
              } catch (error) {
                console.log('Navigation error:', error);
              }
            }}
          >
            <Text style={styles.navButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {renderContent()}
      {viewMode === 'stack' && currentCard === 0 && !showUserInput && !hasReachedLastCard && (
        <View style={styles.swipeUpIndicatorContainer}>
          <SwipeUpIndicator />
        </View>
      )}

      <View style={[styles.bottomButtonContainer, showUserInput && styles.bottomButtonExpanded]}>
        {/* Devotional Button - Show if last card reached in either view and not already created */}
        {/* Show button if we've ever reached the last card (in stack view) or if we're at the last card (in document view) */}
        {((viewMode === 'document' && hasReachedLastCard) ||
          (viewMode === 'stack' && showDevotionalButton))
          && !hasCreatedDevotional && (
          <View style={styles.devotionalButtonWrapper}>
            <DevotionalButton
              onPress={() => setShowDevotionalModal(true)}
              visible={true}
            />
          </View>
        )}
      </View>

      {/* Devotional Creation Modal */}
      <DevotionalModal
        visible={showDevotionalModal}
        onClose={() => setShowDevotionalModal(false)}
        playbookId={playbook.id}
        playbookInfo={playbook.title}
        userInput={playbook.userInput}
        onDevotionalCreated={(devotionalId) => {
          setHasCreatedDevotional(true);
          setShowDevotionalModal(false);
          setTimeout(() => {
            rootNavigation.navigate('DevotionalDetail', { devotionalId });
          }, 500);
        }}
      />
        </>
      )}
    </View>
  );
}

// Define proper types for styles
interface PlaybookDetailStyles {
  stackCard: ViewStyle;
  noAffirmationsText: TextStyle;
  headerSafeArea: ViewStyle;
  headerContainer: ViewStyle;
  backButton: ViewStyle;
  headerRight: ViewStyle;
  docContainer: ViewStyle;
  docContentContainer: ViewStyle;
  docCard: ViewStyle;
  container: ViewStyle;
  contentContainer: ViewStyle;
  loadingContainer: ViewStyle;
  playbookInfoContainer: ViewStyle;
  playbookHeader: ViewStyle;
  headerTitleContainer: ViewStyle;
  headerTitle: TextStyle;
  playbookLabelRow: ViewStyle;
  playbookLabel: TextStyle;
  cardStackContainer: ViewStyle;
  swipeUpIndicatorContainer: ViewStyle;
  playbookTitle: TextStyle;
  creationDate: TextStyle;
  progressAndViewRow: ViewStyle;
  progressContainer: ViewStyle;
  progressRow: ViewStyle;
  progressBarBg: ViewStyle;
  progressBarFill: ViewStyle;
  progressText: TextStyle;
  userInputCard: ViewStyle;
  userInputText: TextStyle;
  viewToggleContainer: ViewStyle;
  viewToggle: ViewStyle;
  iconContainer: ViewStyle;
  iconContainerActive: ViewStyle;
  viewToggleDivider: ViewStyle;
  mainContainer: ViewStyle;
  truthCard: ViewStyle;
  actionCard: ViewStyle;
  affirmationsCard: ViewStyle;
  bibleCard: ViewStyle;
  challengeCard: ViewStyle;
  cardNavigation: ViewStyle;
  navButton: ViewStyle;
  navButtonDisabled: ViewStyle;
  navButtonText: TextStyle;
  cardIndicator: ViewStyle;
  cardIndicatorText: TextStyle;
  affirmationsHeader: ViewStyle;
  icon: ImageStyle;
  affirmationsList: ViewStyle;
  affirmationsTitle: TextStyle;
  compactHeaderContainer: ViewStyle;
  bottomButtonContainer: ViewStyle;
  bottomButtonExpanded: ViewStyle;
  devotionalButtonWrapper: ViewStyle;
  affirmationCardStyle: ViewStyle;
  nonAffirmationCardStyle: ViewStyle;
  cardWrapperStyle: ViewStyle;
  cardContentStyle: ViewStyle;
  headerLeftContainer: ViewStyle;
  backButtonContainer: ViewStyle;
  compactHeaderTitle: TextStyle;
}

const styles = StyleSheet.create<PlaybookDetailStyles>({
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonContainer: {
    padding: 8,
    paddingLeft: 0,
  },
  compactHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.anchorBlue,
    marginLeft: 4,
    maxWidth: 260,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    position: 'relative',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  headerSafeArea: {
    backgroundColor: Colors.hopeWhite,
    width: '100%',
    marginBottom: -10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.trustGrey,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerRight: {
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    textAlign: 'center',
  },
  playbookInfoContainer: {
    backgroundColor: '#f2f5f7',
    paddingHorizontal: 20,
    paddingTop: 8,  // Reduced from 12
    paddingBottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  playbookHeader: {
    marginBottom: 8,
  },
  playbookLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  playbookLabel: {
    fontSize: 14,
    color: Colors.trustGrey,
    marginRight: 8,
  },
  playbookTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 2,
    lineHeight: 34,
    textAlign: 'center',
  },
  playbookTitleSecondLine: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginTop: -8,
    marginBottom: 2,
    lineHeight: 34,
    textAlign: 'center',
  },
  creationDate: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.trustGrey,
    marginTop: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    opacity: 0.8,
    textAlign: 'center',
  },
  progressAndViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    marginRight: 4,
  },
  userInputCard: {
    backgroundColor: 'rgba(26, 60, 109, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  userInputText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.anchorBlue,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 36,
    alignItems: 'center',
  },
  viewToggle: {
    padding: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: Colors.faithGold,
  },
  viewToggleDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 0, // Reduced from 6 to decrease space between header and cards
  },
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 20,
  },
  swipeUpIndicatorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  bottomButtonExpanded: {
    bottom: 'auto',
    top: '100%',
    marginTop: -24, // Adjust this value to position the button relative to the expanded content
  },
  devotionalButtonWrapper: {
    marginTop: 20, // Add some space between the expanded content and the button
  },
  stackCard: {
    width: SCREEN_WIDTH - 80,
    height: 450,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    padding: 0,
    overflow: 'hidden',
  },
  truthCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 32,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  actionCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  affirmationsCard: {
    backgroundColor: Colors.anchorBlue,
    padding: 24,
    marginBottom: 0,
    borderRadius: 28,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  bibleCard: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    padding: 24,
    marginTop: 16,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  challengeCard: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
    padding: 2,
    marginBottom: 16,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    width: '100%',
    alignSelf: 'center',
  },
  cardNavigation: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 57, 104, 0.7)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(25, 57, 104, 0.3)',
    opacity: 0.5,
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  cardIndicator: {
    backgroundColor: 'rgba(25, 57, 104, 0.7)',
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cardIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  affirmationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 8,
  },
  affirmationsList: {
    gap: 12,
  },
  affirmationsTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  noAffirmationsText: {
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  docContainer: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  docContentContainer: {
    paddingTop: 0, // Reduced from 60 to decrease space between header and cards
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  compactHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  docCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  affirmationCardStyle: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    elevation: 0,
    shadowColor: 'transparent',
    opacity: 1,
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
  },
  nonAffirmationCardStyle: {
    backgroundColor: 'transparent',
    opacity: 1,
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardWrapperStyle: {
    width: '100%',
    position: 'relative',
    zIndex: 200,
  },
  cardContentStyle: {
    flex: 1,
  },
});

