// React & React Native
import * as React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated as RNAnimated,
  Easing as RNEasing,
} from 'react-native';

// Navigation & Gestures
import { GestureDetector } from 'react-native-gesture-handler';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
// import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Animation
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

// Icons

// Theme & Styling
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../theme/ThemeContext';
import { Typography } from '../theme/typography';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { triggerLightHaptic } from '../utils/haptics';

// Components
import DocumentCardView from '../components/DocumentCardView';
import DocumentCards from '../components/DocumentCards';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import PlaybookHeader from '../components/PlaybookHeader';
import ThemedText from '../components/common/ThemedText';
import DevotionalButton from '../components/DevotionalButton';
import DevotionalModal from '../components/DevotionalModal';

// Types & Context
import { Playbook, ActionStep, Affirmation } from '../interfaces/playbook';
import { useActionSteps } from '../context/ActionStepsContext';
import { getCompletedStepsCount as getTaskStats } from '../utils/taskUtils';
import { useNavigation } from '@react-navigation/native';
import PlaybookSkeletonLoader from '../components/PlaybookSkeletonLoader';

// Data & API
import { useQuery } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useIntelligentPrefetching } from '../services/hooks/useAdvancedPlaybookData';

// Navigation types
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';

// Screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface PlaybookScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbookId?: string; playbook?: { id: string } } };
}

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

// Header left component extracted to fix linter warning
const HeaderLeft = ({ navigation, showUserInput, setShowUserInput, chevronStyle, showCompactHeader, playbookTitle, completedTasksCount, totalTasksCount, progressPercentage, isFromOnboarding, onboardingNextStep, styles }: {
  navigation: any;
  showUserInput: boolean;
  setShowUserInput: (show: boolean) => void;
  chevronStyle: any;
  showCompactHeader?: boolean;
  playbookTitle?: string;
  completedTasksCount: number;
  totalTasksCount: number;
  progressPercentage: number;
  isFromOnboarding?: boolean;
  onboardingNextStep?: string;
  styles: any;
}) => (
  <HeaderLeftInner
    navigation={navigation}
    showUserInput={showUserInput}
    setShowUserInput={setShowUserInput}
    chevronStyle={chevronStyle}
    showCompactHeader={showCompactHeader}
    playbookTitle={playbookTitle}
    completedTasksCount={completedTasksCount}
    totalTasksCount={totalTasksCount}
    progressPercentage={progressPercentage}
    isFromOnboarding={isFromOnboarding}
    onboardingNextStep={onboardingNextStep}
    styles={styles}
  />
);

// Inner component to use hooks
const HeaderLeftInner = ({ navigation, showUserInput, setShowUserInput, chevronStyle, showCompactHeader, playbookTitle, completedTasksCount, totalTasksCount, progressPercentage, isFromOnboarding, onboardingNextStep, styles }: any) => {
  const progressAnim = React.useRef(new RNAnimated.Value(progressPercentage || 0)).current;

  React.useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: Math.max(0, Math.min(100, progressPercentage || 0)),
      duration: 450,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false, // width animation
    }).start();
  }, [progressPercentage, progressAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.headerLeftContainer}>
      <TouchableOpacity
        onPress={() => {
          // Light haptic on back
          triggerLightHaptic();
          try {
            if (isFromOnboarding && onboardingNextStep) {
              // Continue onboarding flow to next step
              console.log('🎯 Continuing onboarding flow to:', onboardingNextStep);
              navigation.navigate(onboardingNextStep);
            } else {
              navigation.goBack();
            }
          } catch (err) {
            console.log('Navigation error:', err);
          }
        }}
        style={styles.backButtonContainer}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
      {!showCompactHeader && (
        <TouchableOpacity
          style={styles.playbookLabelContainer}
          onPress={() => {
            // Light haptic on PLAYBOOK + chevron toggle
            triggerLightHaptic();
            setShowUserInput(!showUserInput);
          }}
          activeOpacity={0.7}
        >
          <ThemedText weight="semiBold" style={styles.playbookLabelText}>PLAYBOOK</ThemedText>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-down"
              size={15}
              color={Colors.hopeWhite}
            />
          </Animated.View>
        </TouchableOpacity>
      )}
      {showCompactHeader && (
        <View style={styles.headerProgressContainer}>
          <ThemedText
            weight="bold"
            style={styles.compactHeaderTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {playbookTitle}
          </ThemedText>
          <View style={styles.headerProgressRow}>
            <View style={styles.headerProgressBarBg}>
              <RNAnimated.View
                style={[
                  styles.headerProgressBarFill,
                  { width: animatedWidth },
                ]}
              />
            </View>
            <ThemedText weight="medium" style={styles.headerTasksText}>
              {completedTasksCount}/{totalTasksCount} Steps
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
};

const ProfileButton = ({ user, navigation, styles }: { user: any; navigation: any; styles: any }) => (
  <TouchableOpacity
    onPress={() => {
      console.log('Profile image pressed from PlaybookDetail');
      // Light haptic on avatar tap
      triggerLightHaptic();
      try {
        navigation.navigate('UserProfileModal');
      } catch (navigationError) {
        console.log('Navigation error:', navigationError);
      }
    }}
    style={styles.profileButton}
    activeOpacity={0.7}
  >
    {/* Always show initial avatar like dashboard - alert coral with letter */}
    <View style={styles.initialAvatar}>
      <ThemedText weight="semiBold" style={styles.initialLetter}>{(() => {
        const meta: any = (user as any)?.user_metadata || {};
        const displayName =
          (user as any)?.displayName ||
          meta.full_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
          (user as any)?.email ||
          'User';
        return (displayName || 'U').trim().charAt(0).toUpperCase();
      })()}</ThemedText>
    </View>
  </TouchableOpacity>
);

const PlaybookDetailScreen: React.FC<PlaybookScreenProps> = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  // Status bar: force light icons (white) on dark header background
  useScreenStatusBar('light', Colors.anchorBlue);
  // Measure header height so we can place the card overlay precisely below it
  const [_headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [playbookHeaderHeight, setPlaybookHeaderHeight] = useState(0);
  const overlayTop = Math.max(insets.top, 10) + playbookHeaderHeight - 40;
  // Reduce top adjust to allow more natural safe area padding; we'll also add a small extra pad
  const HEADER_TOP_ADJUST = 0;

  // Animated collapse progress for smooth header transition (0 = expanded, 1 = collapsed)
  const collapseProgress = useSharedValue(0);

  // ===== ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP =====

  // 1. Route and navigation data
  const playbookId = route.params?.playbook?.id || (route.params as any)?.playbookId;
  const isFromOnboarding = (route.params as any)?.isFromOnboarding || false;
  const onboardingNextStep = (route.params as any)?.onboardingNextStep;

  // Debug logging for playbookId
  console.log('📖 PlaybookDetailScreen - Route params debug:', {
    'route.params?.playbook?.id': route.params?.playbook?.id,
    'route.params?.playbookId': (route.params as any)?.playbookId,
    'final playbookId': playbookId,
    'playbookId type': typeof playbookId,
    'full route.params': route.params,
  });
  const { user } = useAuth();
  const userId = user?.id;
  const rootNavigation = useNavigation<any>();

  // 2. Data fetching hooks - Use route params first, then fetch from database
  const routePlaybook = route.params?.playbook;
  // Only use route playbook if it has the full playbook structure (not just id)
  const isFullPlaybook = routePlaybook && typeof routePlaybook === 'object' && 'title' in routePlaybook && 'actionSteps' in routePlaybook;
  const shouldFetchFromDB = !isFullPlaybook && !!playbookId && !!userId;

  console.log('📖 PlaybookDetailScreen - Data source decision:', {
    hasRoutePlaybook: !!routePlaybook,
    shouldFetchFromDB,
    routePlaybookId: routePlaybook?.id,
    playbookId,
  });

  const { data: fetchedPlaybook, isLoading, error } = useQuery<Playbook | null>({
    queryKey: ['playbook', playbookId],
    queryFn: async () => {
      console.log('🔍 Fetching playbook from database with:', { userId, playbookId });
      try {
        const result = await getPlaybook(userId || '', playbookId);
        console.log('✅ Database fetch result:', result ? 'Found playbook' : 'Playbook is null');
        return result;
      } catch (err) {
        console.error('❌ Database fetch error:', err);
        throw err;
      }
    },
    enabled: shouldFetchFromDB,
    staleTime: 0,
    gcTime: 0,
  });

  // Use route params playbook if it's a full playbook, otherwise use fetched playbook
  const playbook = isFullPlaybook ? (routePlaybook as Playbook) : fetchedPlaybook;

  console.log('📖 PlaybookDetailScreen - Final playbook source:', {
    hasRoutePlaybook: !!routePlaybook,
    isFullPlaybook,
    usingRouteParams: isFullPlaybook,
    usingDatabase: !!fetchedPlaybook && !isFullPlaybook,
    hasPlaybook: !!playbook,
    playbookTitle: playbook?.title,
  });

  // 2b. Advanced playbook hooks for prefetching and navigation
  const { prefetchForCurrentPlaybook } = useIntelligentPrefetching(userId || '');

  // 3. Context hooks
  const { actionSteps, setActionSteps, saveActionSteps } = useActionSteps();

  // 4. State hooks - UI state
  const [currentCard, setCurrentCard] = useState(0);
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [hasReachedLastCard, setHasReachedLastCard] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [hasCreatedDevotional, setHasCreatedDevotional] = useState(false);
  const [showUserInput, setShowUserInput] = useState(false);
  const [showDevotionalButton, setShowDevotionalButton] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 5. Ref hooks
  const isInitialRender = useRef(true);
  // Track that we're navigating to DevotionalDetail so we only hide the CTA once the detail screen appears
  const pendingDevotionalNavigation = useRef(false);
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
  const hasEverReachedLastCard = useRef(false);

  // 6. Shared value hooks - Animation values
  const nudgeY = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const translateY = useSharedValue(0);
  const isTransitioning = useSharedValue(false);
  const cardCount = useSharedValue(0);
  const currentCardShared = useSharedValue(currentCard);
  const headerFaded = useSharedValue(false);
  const headerOpacity = useSharedValue(1);
  const headerHeight = useSharedValue(1);
  const chevronAnim = useSharedValue(0);

  // 7. Gesture state shared values
  const gestureState = useSharedValue({ isSwiping: false });
  const gestureStartY = useSharedValue(0);
  const gestureVelocityY = useSharedValue(0);
  const gestureTranslationY = useSharedValue(0);
  const gestureStartTime = useSharedValue(0);

  // Previous card animation values
  const previousCardTranslateY = useSharedValue(0); // No additional offset, follows current card
  const previousCardOpacity = useSharedValue(0);
  const showPreviousCard = useSharedValue(false);

  // React state to track if previous card should be shown (for conditional rendering)
  const [isPreviousCardVisible, setIsPreviousCardVisible] = useState(false);

  // 8. Constants
  const SWIPE_THRESHOLD = 120;
  const MIN_SWIPE_DISTANCE = 10;
  const MIN_SWIPE_VELOCITY = 500;

  // 9. Animated style hooks
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: translateY.value + nudgeY.value + bounceY.value,
      },
      { scale: cardScale.value },
    ],
  }));

  // Previous card animated style
  const previousCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: previousCardTranslateY.value + translateY.value + nudgeY.value + bounceY.value,
      },
    ],
    opacity: previousCardOpacity.value,
    position: 'absolute',
    top: -470, // Position directly above current card (card height + margin)
    left: 0,
    right: 0,
    zIndex: showPreviousCard.value ? 150 : -1, // Lower z-index to appear behind current card
  }));

  // Back cards animated style (removed unused variable)

  // Header collapse and overlay animated styles
  const headerCollapseStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapseProgress.value,
    transform: [{ translateY: -16 * collapseProgress.value }],
  }));

  const overlayTopAnimatedStyle = useAnimatedStyle(() => ({
    top: viewMode === 'document'
      ? interpolate(collapseProgress.value, [0, 1], [overlayTop, 10])
      : overlayTop,
  }));

  // 10. Callback hooks
  const getCompletedStepsCount = useCallback(() => getTaskStats(actionSteps), [actionSteps]);

  // 11. Gesture handler will be defined after navigation functions

  // 12. Memoized values
  const cardData: CardData[] = useMemo(() => {
    if (!playbook) {return [];}

    console.log('[DEBUG] cardData: Creating card data from playbook:', {
      playbookId: playbook.id,
      actionStepsFromContext: actionSteps?.length || 0,
      actionStepsFromPlaybook: playbook?.actionSteps?.length || 0,
      affirmationsFromPlaybook: playbook?.affirmations?.length || 0,
      actionStepsType: typeof actionSteps,
      playbookActionStepsType: typeof playbook?.actionSteps,
      affirmationsType: typeof playbook?.affirmations,
    });

    // Debug action steps data
    const finalActionSteps = Array.isArray(actionSteps) && actionSteps.length > 0 ? actionSteps :
          (Array.isArray(playbook?.actionSteps) ? playbook.actionSteps : []);
    console.log('[DEBUG] cardData: Final action steps:', finalActionSteps);

    // Debug affirmations data
    const finalAffirmations = Array.isArray(playbook?.affirmations)
      ? playbook.affirmations.filter((a): a is Required<Affirmation> =>
          a?.id !== undefined &&
          a?.text !== undefined &&
          a?.completed !== undefined
        )
      : [];
    console.log('[DEBUG] cardData: Final affirmations:', finalAffirmations);

    return [
    {
      type: 'truth' as const,
      truth: playbook.truthInLove?.text ?? '',
      summary: playbook.truthInLove?.summary ?? '',
      tappable: false,
    },
    {
      type: 'action' as const,
      steps: finalActionSteps,
      tappable: false,
    },
    {
      type: 'affirmation' as const,
      affirmations: finalAffirmations,
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
      challengeCTA: playbook.challengeCTA,
      tappable: false,
    },
  ];
  }, [playbook, actionSteps]);

  // Navigation callbacks that depend on cardData
  const goToNextCard = useCallback(() => {
    if (currentCard < cardData.length - 1) {
      const newIndex = currentCard + 1;
      setCurrentCard(newIndex);
      currentCardShared.value = newIndex;
    }
  }, [currentCard, cardData.length, currentCardShared]);

  const goToPrevCard = useCallback(() => {
    if (currentCard > 0) {
      const newIndex = currentCard - 1;
      setCurrentCard(newIndex);
      currentCardShared.value = newIndex;
    }
  }, [currentCard, currentCardShared]);

  // Keep shared value in sync with state
  useEffect(() => {
    currentCardShared.value = currentCard;
  }, [currentCard, currentCardShared]);

  const { completed: completedTasksCount, total: totalTasksCount } = useMemo(() =>
    getCompletedStepsCount(), [getCompletedStepsCount]
  );

  // Gesture handler hook (using modern Gesture API) - defined after navigation functions
  const panGesture = Gesture.Pan()
    .onStart(() => {
      Object.values(gestureAnimationRefs.current).forEach(anim => {
        if (anim?.cancel) {anim.cancel();}
      });

      gestureStartY.value = translateY.value;
      gestureState.value = { isSwiping: false };
      gestureStartTime.value = Date.now();
      gestureTranslationY.value = 0;
      gestureVelocityY.value = 0;
    })
    .onUpdate((event) => {
      if (isTransitioning.value) {return;}

      gestureTranslationY.value = event.translationY;
      gestureVelocityY.value = event.velocityY;

      const distanceY = Math.abs(gestureTranslationY.value);
      const distanceX = Math.abs(event.translationX);
      const isVerticalSwipe = distanceY > distanceX * 1.5;

      if (!gestureState.value.isSwiping && distanceY < MIN_SWIPE_DISTANCE) {return;}

      if (!gestureState.value.isSwiping && isVerticalSwipe) {
        gestureState.value = { isSwiping: true };
      }

      if (gestureState.value.isSwiping) {
        translateY.value = gestureStartY.value + gestureTranslationY.value;

        // Handle swipe down to show previous card (only if previous card exists)
        if (gestureTranslationY.value > 0 && currentCardShared.value > 0) {
          // Swiping down - show previous card that moves with current card
          const progress = Math.min(1, gestureTranslationY.value / SWIPE_THRESHOLD);

          if (progress > 0.1) {
            showPreviousCard.value = true;
            // Previous card stays in position relative to current card (no additional translateY)
            previousCardTranslateY.value = 0; // No additional offset, follows current card
            previousCardOpacity.value = Math.min(1, progress * 2);
            runOnJS(setIsPreviousCardVisible)(true);
          } else {
            showPreviousCard.value = false;
            previousCardOpacity.value = 0;
            runOnJS(setIsPreviousCardVisible)(false);
          }
        } else {
          // Swiping up or no previous card available - hide previous card
          showPreviousCard.value = false;
          previousCardOpacity.value = 0;
          previousCardTranslateY.value = 0;
          runOnJS(setIsPreviousCardVisible)(false);
        }

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
    })
    .onEnd((event) => {
      if (isTransitioning.value || !gestureState.value.isSwiping) {return;}

      const velocityY = (gestureVelocityY.value || 0) * 1000;
      const isFastSwipe = Math.abs(velocityY) > MIN_SWIPE_VELOCITY;
      const isVerticalSwipe = Math.abs(gestureTranslationY.value) > Math.abs(event.translationX) * 1.5;

      if (isVerticalSwipe) {
        const isSwipeUp = gestureTranslationY.value < 0;
        const isSwipeDown = gestureTranslationY.value > 0;
        const isPastThreshold = Math.abs(gestureTranslationY.value) > SWIPE_THRESHOLD;

        const handleSwipe = (direction: 'up' | 'down') => {
          isTransitioning.value = true;

          if (direction === 'up') {
            runOnJS(goToNextCard)();
          } else {
            // Allow swipe down even on first card (bounce back)
            // Hide previous card immediately before navigation
            showPreviousCard.value = false;
            previousCardOpacity.value = 0;
            runOnJS(setIsPreviousCardVisible)(false);

            // Navigate to previous card if not on first card
            if (currentCardShared.value > 0) {
              runOnJS(goToPrevCard)();
            }
          }

          translateY.value = withSpring(0, { damping: 15, stiffness: 300 }, () => {
            isTransitioning.value = false;
            // Clean up previous card state after transition
            if (direction === 'down') {
              previousCardTranslateY.value = 0;
              previousCardOpacity.value = 0;
              showPreviousCard.value = false;
              runOnJS(setIsPreviousCardVisible)(false);
            }
          });

          bounceY.value = withSpring(0, { damping: 10, stiffness: 200 });
        };

        if (isFastSwipe || isPastThreshold) {
          if (isSwipeUp) {
            handleSwipe('up');
          } else if (isSwipeDown) {
            handleSwipe('down');
          }
        } else {
          // Reset animations when gesture doesn't complete
          translateY.value = withSpring(gestureStartY.value, { damping: 15, stiffness: 300 }, () => {
            isTransitioning.value = false;
          });
          previousCardTranslateY.value = withSpring(0, { damping: 15, stiffness: 300 });
          previousCardOpacity.value = withSpring(0, { damping: 15, stiffness: 300 });
          showPreviousCard.value = false;
          runOnJS(setIsPreviousCardVisible)(false);
        }
      } else {
        translateY.value = withSpring(gestureStartY.value, { damping: 15, stiffness: 300 }, () => {
          isTransitioning.value = false;
        });
        previousCardTranslateY.value = withSpring(0, { damping: 15, stiffness: 300 });
        previousCardOpacity.value = withSpring(0, { damping: 15, stiffness: 300 });
        showPreviousCard.value = false;
        runOnJS(setIsPreviousCardVisible)(false);
      }

      gestureState.value = { isSwiping: false };
    });

  const progress = useMemo(() =>
    totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0,
    [completedTasksCount, totalTasksCount]
  );

  // Header left component
  const headerLeft = React.useCallback(() => (
    <HeaderLeft
      navigation={navigation}
      showUserInput={showUserInput}
      setShowUserInput={setShowUserInput}
      chevronStyle={chevronStyle}
      showCompactHeader={showCompactHeader}
      playbookTitle={playbook?.title}
      completedTasksCount={completedTasksCount}
      totalTasksCount={totalTasksCount}
      progressPercentage={progress}
      isFromOnboarding={isFromOnboarding}
      onboardingNextStep={onboardingNextStep}
      styles={styles}
    />
  ), [navigation, showUserInput, chevronStyle, showCompactHeader, playbook?.title, completedTasksCount, totalTasksCount, progress, isFromOnboarding, onboardingNextStep, styles]);

  // Header right component
  const headerRight = React.useCallback(() => (
    <ProfileButton user={user} navigation={navigation} styles={styles} />
  ), [user, navigation]);

  // ===== EFFECT HOOKS =====

  // Debug logging effect
  useEffect(() => {
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

    if (!playbookId) {
      console.log('[PlaybookDetailScreen] ❌ NO PLAYBOOK ID - showing error');
    } else if (isLoading) {
      console.log('[PlaybookDetailScreen] ⏳ LOADING - showing loading screen');
    } else if (error || !playbook) {
      console.log('[PlaybookDetailScreen] ❌ ERROR OR NO PLAYBOOK - showing error screen', { error: error?.message, hasPlaybook: !!playbook });
    } else {
      console.log('[PlaybookDetailScreen] ✅ SUCCESS - showing playbook content');
    }
  }, [playbookId, userId, playbook, isLoading, error, route.params]);

  // Intelligent prefetching effect for adjacent playbooks and cross-component relationships
  useEffect(() => {
    if (playbookId && userId && playbook) {
      console.log('[PlaybookDetailScreen] Starting intelligent prefetching for:', playbook.title);

      // Prefetch adjacent playbooks and related data
      prefetchForCurrentPlaybook(playbookId).catch(prefetchError => {
        console.warn('[PlaybookDetailScreen] Prefetching failed:', prefetchError);
      });
    }
  }, [playbookId, userId, playbook, prefetchForCurrentPlaybook]);

  // Playbook data debug effect
  useEffect(() => {
    console.log('[DEBUG] Playbook data received in PlaybookDetailScreen:', JSON.stringify({
      id: playbook?.id,
      title: playbook?.title,
      affirmations: playbook?.affirmations,
      affirmationsCount: playbook?.affirmations?.length,
      hasAffirmations: Array.isArray(playbook?.affirmations) && (playbook?.affirmations?.length || 0) > 0,
      playbookKeys: playbook ? Object.keys(playbook) : [],
    }, null, 2));
  }, [playbook]);

  // View mode change effect
  useEffect(() => {
    if (viewMode === 'document') {
      setHasReachedLastCard(false);
    }
  }, [viewMode]);

  // Cleanup effect for animations
  useEffect(() => {
    const currentAnimationRefs = animationRefs.current;
    const currentGestureRefs = gestureAnimationRefs.current;

    return () => {
      if (currentAnimationRefs.rafId) {
        cancelAnimationFrame(currentAnimationRefs.rafId);
      }
      if (currentAnimationRefs.headerOpacityAnimation?.cancel) {
        currentAnimationRefs.headerOpacityAnimation.cancel();
      }
      Object.values(currentGestureRefs).forEach(anim => {
        if (anim?.cancel) {
          anim.cancel();
        }
      });
    };
  }, []);

  // Hide the Devotional CTA only after this screen blurs (i.e., after navigating to DevotionalDetail)
  useEffect(() => {
    const unsubscribe = rootNavigation.addListener('blur', () => {
      if (pendingDevotionalNavigation.current) {
        setHasCreatedDevotional(true);
        pendingDevotionalNavigation.current = false;
      }
    });
    return unsubscribe;
  }, [rootNavigation]);

  // Chevron animation effect
  useEffect(() => {
    const animation = withTiming(showUserInput ? 1 : 0, { duration: 200 });
    chevronAnim.value = animation;

    return () => {
      if (animation && typeof animation === 'object' && 'cancel' in animation) {
        // @ts-ignore - cancel exists on the animation object
        animation.cancel();
      }
    };
  }, [showUserInput, chevronAnim]);

  // Action steps initialization effect
  useEffect(() => {
    if (playbook?.actionSteps) {
      console.log('[DEBUG] Syncing action steps from database:', playbook.actionSteps.length, 'steps');
      setActionSteps(playbook.actionSteps);
      if (!isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [playbook?.actionSteps, setActionSteps, isInitialized]);

  // Current card shared value sync effect
  useEffect(() => {
    currentCardShared.value = currentCard;
  }, [currentCard, currentCardShared]);

  // Update card count when cardData changes
  useEffect(() => {
    if (!isLoading && !isInitialRender.current) {
      cardCount.value = cardData.length;
    }
  }, [cardData.length, cardCount, isLoading]);

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
      setIsInitialized(true);
    }
  }, [isLoading, cardData, cardCount, currentCard, currentCardShared]);

  // Sync current card with shared value
  useEffect(() => {
    if (!isLoading && !isInitialRender.current) {
      currentCardShared.value = currentCard;
    }
  }, [currentCard, currentCardShared, isLoading]);

  // Track when we reach the last card in stack view
  useEffect(() => {
    if (viewMode === 'stack') {
      const isLastCard = cardData.length > 0 && currentCard === cardData.length - 1;
      console.log('[DEBUG] Stack view card tracking:', {
        currentCard,
        cardDataLength: cardData.length,
        isLastCard,
        hasEverReachedLastCard: hasEverReachedLastCard.current,
      });
      if (isLastCard) {
        hasEverReachedLastCard.current = true;
        console.log('[DEBUG] Set hasEverReachedLastCard to true');
      }
      // Only update hasReachedLastCard if we're on the last card or if we've never reached it
      if (isLastCard || !hasEverReachedLastCard.current) {
        console.log('[DEBUG] Setting hasReachedLastCard to:', isLastCard);
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

  // Show devotional button with delay when last card is reached in stack view
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    console.log('[DEBUG] Devotional button useEffect:', {
      hasReachedLastCard,
      hasCreatedDevotional,
      viewMode,
      shouldShow: hasReachedLastCard && !hasCreatedDevotional && viewMode === 'stack',
    });

    if (hasReachedLastCard && !hasCreatedDevotional && viewMode === 'stack') {
      console.log('[DEBUG] Setting devotional button timeout');
      timeoutId = setTimeout(() => {
        console.log('[DEBUG] Showing devotional button');
        setShowDevotionalButton(true);
      }, 300); // 300ms delay
    } else {
      console.log('[DEBUG] Hiding devotional button');
      setShowDevotionalButton(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasReachedLastCard, hasCreatedDevotional, viewMode]);

  // Set navigation options based on scroll state
  React.useLayoutEffect(() => {
    console.log('[DEBUG] Setting navigation options with headerLeft');
    navigation.setOptions({
      headerTitle: '',
      // Hide navigation elements during onboarding
      headerLeft: isFromOnboarding ? () => null : headerLeft,
      headerRight: isFromOnboarding ? () => null : headerRight,
      headerShown: false, // hide native header; screen will control its own header/z-order
      headerTransparent: false,
      headerStyle: {
        backgroundColor: Colors.anchorBlue,
        height: 50, // Reduced from default ~60
      },
      headerTitleStyle: {
        paddingTop: 0, // Reduced bottom padding for title
      },
    });
  }, [navigation, headerLeft, headerRight, user, isFromOnboarding]);

  // Debounced save function to prevent excessive calls
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSaveProgress = useCallback(() => {
    if (!playbook?.id) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSaving) {
        console.log('[DEBUG] Save already in progress, skipping');
        return;
      }

      try {
        setIsSaving(true);
        console.log('[DEBUG] Debounced save triggered for playbook ID:', playbook.id);
        await saveActionSteps(playbook.id);
        console.log('[DEBUG] Debounced save completed successfully');
      } catch (err) {
        console.error('Error in debounced save:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500); // 500ms delay - reduced to prevent toggle overwrites
  }, [playbook?.id, isSaving, saveActionSteps]);

  // Call debounced save when actionSteps change
  useEffect(() => {
    console.log('[DEBUG] ActionSteps effect triggered:', {
      isInitialized,
      actionStepsLength: actionSteps.length,
      actionSteps: actionSteps.map(step => ({ id: step.id, completed: step.completed, subTasksCount: step.subTasks?.length || 0 })),
    });

    if (isInitialized && actionSteps.length > 0) {
      console.log('[DEBUG] ActionSteps changed, triggering debounced save');
      debouncedSaveProgress();
    } else {
      console.log('[DEBUG] Skipping save - not initialized or no actionSteps');
    }
  }, [actionSteps, isInitialized, debouncedSaveProgress]);

  // DISABLED - Old automatic save logic
  /*
  useEffect(() => {
    console.log('[DEBUG] Save effect triggered - isSaving:', isSaving, 'isInitialized:', isInitialized, 'playbookId:', playbook?.id);

    if (!isInitialized || isSaving || !playbook?.id) {
      console.log('[DEBUG] Skipping save - conditions not met');
      return;
    }

    // Convert actionSteps to string for comparison
    const currentActionStepsStr = JSON.stringify(actionSteps);

    // Skip if actionSteps haven't actually changed
    if (currentActionStepsStr === lastSavedActionSteps.current) {
      console.log('[DEBUG] ActionSteps unchanged, skipping save');
      return;
    }

    console.log('[DEBUG] ActionSteps changed, saving progress');
    console.log('[DEBUG] Previous actionSteps length:', lastSavedActionSteps.current.length);
    console.log('[DEBUG] Current actionSteps length:', currentActionStepsStr.length);

    const saveProgress = async () => {
      try {
        setIsSaving(true);
        console.log('[DEBUG] Saving progress for playbook ID:', playbook.id);
        await saveActionSteps(playbook.id);

        // Update the last saved state to prevent loops
        lastSavedActionSteps.current = currentActionStepsStr;
        console.log('[DEBUG] Progress saved successfully');
      } catch (error) {
        console.error('Error saving progress:', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Debounce the save to avoid too frequent calls
    const timeoutId = setTimeout(() => {
      saveProgress().catch(console.error);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [actionSteps, playbook?.id, isInitialized, isSaving, saveActionSteps]);
  */

  // Save when component unmounts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (playbook?.id && actionSteps.length > 0) {
        console.log('[DEBUG] Component unmounting, saving progress immediately');
        saveActionSteps(playbook.id).catch(console.error);
      }
    };
  }, [playbook?.id, actionSteps, saveActionSteps]);

  // ===== EXPANSION STATE =====

  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
  const [contentHeights, setContentHeights] = useState<Record<number, number>>({});
  const [isScrolling, setIsScrolling] = useState(false);

  // Enable LayoutAnimation on Android
  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Collapse expanded state when changing view mode or navigating to another card
  useEffect(() => {
    setExpandedCardIndex(null);
  }, [currentCard, viewMode]);

  // ===== HANDLER FUNCTIONS =====

  const handleCardPress = (index: number) => {
    console.log('[PlaybookDetail] handleCardPress toggle expand for index:', index, 'viewMode:', viewMode, 'isScrolling:', isScrolling);
    console.log('[PlaybookDetail] Current expandedCardIndex:', expandedCardIndex);
    console.log('[PlaybookDetail] Content heights:', contentHeights);
    // Block expansion for Affirmations and Bible Verse cards
    const tappedType = cardData[index]?.type as CardType | undefined;
    if (tappedType === 'affirmation' || tappedType === 'bible') {
      console.log('[PlaybookDetail] Expansion disabled for card type:', tappedType);
      return;
    }

    // In stack view, toggle expand/collapse of the tapped card in-place
    if (viewMode === 'stack' && !isScrolling) {
      // Light haptic on expand/collapse
      triggerLightHaptic();
      console.log('[PlaybookDetail] Conditions met, toggling expansion');
      // Smooth expand/collapse animation
      LayoutAnimation.configureNext({
        duration: 400,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
      setExpandedCardIndex(prev => {
        const newValue = prev === index ? null : index;
        console.log('[PlaybookDetail] Setting expandedCardIndex from', prev, 'to', newValue);
        return newValue;
      });
      return;
    }
    console.log('[PlaybookDetail] Conditions not met for expansion');
    // In document view, do nothing on tap (no navigation to CardDetail)
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollYValue = event.nativeEvent.contentOffset.y;
    const shouldShowCompactHeader = scrollYValue > 100;

    // Smoothly map scrollY to collapse progress (approx threshold ~120px)
    const t = Math.max(0, Math.min(scrollYValue / 120, 1));
    collapseProgress.value = withTiming(t, { duration: 120 });

    if (shouldShowCompactHeader !== showCompactHeader) {
      setShowCompactHeader(shouldShowCompactHeader);
    }
  };

  const handleLastCardVisible = useCallback((visible: boolean) => {
    // Only update if we're in document view and the value has changed
    if (viewMode === 'document') {
      setHasReachedLastCard(prev => {
        // Only update if the value has changed
        return prev !== visible ? visible : prev;
      });
    }
  }, [viewMode]);

  // ===== RENDER FUNCTIONS =====

  const renderContent = () => {
    // At this point playbook is guaranteed to exist due to JSX conditional check
    const currentPlaybook = playbook!;

    return (
      <View style={styles.contentContainer}>
        {/* Main Header - Only show when not scrolled or in stack view */}
        {viewMode === 'stack' ? (
          <View onLayout={(e) => setPlaybookHeaderHeight(e.nativeEvent.layout.height)}>
            <PlaybookHeader
              title={currentPlaybook.title}
              subtitle={
                currentPlaybook.createdAt
                  ? new Date(currentPlaybook.createdAt).toLocaleDateString('en-US', {
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
                // Light haptic on view toggle (stack/document)
                triggerLightHaptic();
                setHasReachedLastCard(false);
                setViewMode(mode);
              }}
              showUserInput={showUserInput}
              userInput={currentPlaybook.userInput}
              showTitle={false}
            />
          </View>
        ) : (
          <Animated.View style={headerCollapseStyle} pointerEvents={showCompactHeader ? 'none' : 'auto'}>
            <View onLayout={(e) => setPlaybookHeaderHeight(e.nativeEvent.layout.height)}>
              <PlaybookHeader
                title={currentPlaybook.title}
                subtitle={
                  currentPlaybook.createdAt
                    ? new Date(currentPlaybook.createdAt).toLocaleDateString('en-US', {
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
                  // Light haptic on view toggle (stack/document)
                  triggerLightHaptic();
                  setHasReachedLastCard(false);
                  setViewMode(mode);
                }}
                showUserInput={showUserInput}
                userInput={currentPlaybook.userInput}
                showTitle={false}
              />
            </View>
          </Animated.View>
        )}

        {/* Absolute overlay for the interactive card stack so it can pass over header and status bar */}
        <Animated.View pointerEvents="box-none" style={[styles.cardOverlay, overlayTopAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.mainContainer}>
              {viewMode === 'stack' ? (
                renderStackCards()
              ) : (
                <DocumentCards
                  playbook={currentPlaybook}
                  actionSteps={actionSteps}
                  styles={styles}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onLastCardVisible={handleLastCardVisible}
                  currentUser={user ? {
                    displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
                    firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
                    lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
                  } : undefined}
                />
              )}
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    );
  };

  const renderStackCards = () => {
    console.log(`[DEBUG] renderStackCards: Called with ${cardData.length} cards`);
    console.log(`[DEBUG] renderStackCards: Current card index: ${currentCard}`);
    console.log('[DEBUG] renderStackCards: Card data:', cardData.map(c => ({ type: c.type, hasContent: !!c.truth || !!c.steps || !!c.affirmations })));

    if (cardData.length === 0) {
      console.log('[DEBUG] renderStackCards: No cards to render');
      return null;
    }

    const visibleCardCount = Math.min(5, cardData.length - currentCard);

    const renderCard = (cardIndex: number, stackIndex: number, _onToggleView: (mode: 'stack' | 'document') => void) => {
      const card = cardData[cardIndex];
      if (!card) {
        console.log(`[DEBUG] renderCard: No card at index ${cardIndex}`);
        return null;
      }

      console.log(`[DEBUG] renderCard: Rendering card ${cardIndex}, stackIndex ${stackIndex}, type: ${card.type}`);
      console.log('[DEBUG] renderCard: Card data:', { type: card.type, hasContent: !!card.truth || !!card.steps || !!card.affirmations });

      const scaleY = 1 - stackIndex * 0.01;
      const scaleX = 1 - stackIndex * 0.05;
      const cardTranslateY = stackIndex * 12;
      const zIndex = 100 - stackIndex;
      const isLastCard = cardIndex === cardData.length - 1;
      const isCurrentCard = cardIndex === currentCard;
      const opacity = isLastCard && !isCurrentCard ? 1 : 1;
      const isTopCard = stackIndex === 0;
      const extraStyle = isTopCard ? animatedCardStyle : {};
      const disableExpansionForType = card.type === 'affirmation' || card.type === 'bible';
      const isExpanded = isTopCard && expandedCardIndex === cardIndex && !disableExpansionForType;
      const measuredHeight = contentHeights[cardIndex] || 0;
      const COLLAPSED_HEIGHT = 450;
      // For now, allow all cards to expand for testing
      const needsExpansion = !disableExpansionForType && true; // measuredHeight > COLLAPSED_HEIGHT + 50;

      console.log(`[DEBUG] Card ${cardIndex} - measuredHeight: ${measuredHeight}, needsExpansion: ${needsExpansion}, isExpanded: ${isExpanded}, isTopCard: ${isTopCard}`);

      const cardContent = (
        <DocumentCardView
          card={card}
          styles={styles}
          currentUser={user ? {
            displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
            firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
            lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
          } : undefined}
          navigation={rootNavigation}
          playbookTitle={playbook?.title}
          playbookId={playbook?.id}
          userInput={playbook?.userInput}
          expanded={isExpanded}
        />
      );

      return (
        <View key={`${cardIndex}-${stackIndex}`}>
          {/* Hidden measurement view to capture content height */}
          {measuredHeight === 0 && (
            <View
              style={styles.hiddenMeasurement}
              onLayout={({ nativeEvent }) => {
                const h = nativeEvent.layout.height;
                console.log(`[DEBUG] Measuring card ${cardIndex} height: ${h}`);
                if (h > 0 && h !== measuredHeight) {
                  setContentHeights(prev => {
                    const newHeights = { ...prev, [cardIndex]: h };
                    console.log('[DEBUG] Updated content heights:', newHeights);
                    return newHeights;
                  });
                }
              }}
            >
              <View style={{ width: SCREEN_WIDTH - 80 }}>{cardContent}</View>
            </View>
          )}

          {isExpanded ? (
            <ScrollView
              style={[
                styles.stackCardScrollContainer,
                {
                  width: SCREEN_WIDTH - 80,
                  alignSelf: 'center',
                  borderRadius: 28,
                  backgroundColor: cardIndex === cardData.length - 1 ? Colors.alertCoral : 'transparent',
                },
              ]}
              showsVerticalScrollIndicator={true}
              bounces={true}
              onScrollBeginDrag={() => setIsScrolling(true)}
              onScrollEndDrag={() => setIsScrolling(false)}
              onMomentumScrollBegin={() => setIsScrolling(true)}
              onMomentumScrollEnd={() => setIsScrolling(false)}
              scrollEventThrottle={16}
              contentContainerStyle={{
                flexGrow: 1,
                backgroundColor: cardIndex === cardData.length - 1 ? Colors.alertCoral : Colors.anchorBlue,
                borderRadius: 28,
                overflow: 'hidden',
                minHeight: 450,
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  console.log(`[DEBUG] Card ${cardIndex} tapped - isTopCard: ${isTopCard}, needsExpansion: ${needsExpansion}`);
                  if (isTopCard) {
                    console.log('[DEBUG] Top card tapped, calling handleCardPress');
                    handleCardPress(cardIndex);
                  } else {
                    console.log('[DEBUG] Non-top card tapped, ignoring');
                  }
                }}
                onPressIn={() => {
                  if (isTopCard) {
                    cardScale.value = withTiming(0.98, { duration: 100 });
                  }
                }}
                onPressOut={() => {
                  if (isTopCard) {
                    cardScale.value = withTiming(1, { duration: 100 });
                  }
                }}
                style={[
                  {
                    borderRadius: 28,
                    overflow: 'hidden',
                    minHeight: 450,
                    backgroundColor: 'transparent',
                  },
                ]}
              >
                {cardContent}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                console.log(`[DEBUG] Card ${cardIndex} tapped - isTopCard: ${isTopCard}, needsExpansion: ${needsExpansion}`);
                if (isTopCard) {
                  console.log('[DEBUG] Top card tapped, calling handleCardPress');
                  handleCardPress(cardIndex);
                } else {
                  console.log('[DEBUG] Non-top card tapped, ignoring');
                }
              }}
              onPressIn={() => {
                if (isTopCard) {
                  cardScale.value = withTiming(0.98, { duration: 100 });
                }
              }}
              onPressOut={() => {
                if (isTopCard) {
                  cardScale.value = withTiming(1, { duration: 100 });
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
                        transform: !isTopCard ? [{ scaleX }, { scaleY }, { translateY: cardTranslateY }] : undefined,
                        zIndex,
                        opacity: !isTopCard ? opacity : 1,
                        position: stackIndex === 0 ? 'relative' : 'absolute',
                      },
                    ],
                extraStyle,
              ]}
            >
              {cardContent}
            </TouchableOpacity>
          )}
        </View>
      );
    };

    // Render previous card if available and swiping down
    const previousCard = currentCard > 0 ? cardData[currentCard - 1] : null;

    // Restore original fanning effect - render multiple back cards when not showing previous card
    const backCards = !isPreviousCardVisible ? Array.from({ length: visibleCardCount - 1 }).map((_item, i, arr) => {
      const stackIndex = arr.length - 1 - i + 1;
      const cardIndex = currentCard + stackIndex;
      return renderCard(cardIndex, stackIndex, (mode: 'stack' | 'document') => setViewMode(mode));
    }) : [];

    return (
      <View style={styles.cardStackContainer}>
        {/* Previous card - appears behind current card when swiping down */}
        {previousCard && (
          <Animated.View style={[previousCardAnimatedStyle, styles.cardWrapperStyle]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.cardContentStyle}
              onPress={() => {
                // Optional: bring previous card to top by updating currentCard externally if supported.
                // For now, ignore tap to avoid navigating to CardDetail.
              }}
            >
              <View
                style={[
                  styles.stackCard,
                  previousCard.type === 'affirmation'
                    ? styles.affirmationCardStyle
                    : styles.nonAffirmationCardStyle,
                ]}
              >
                <DocumentCardView
                  card={previousCard}
                  styles={styles}
                  currentUser={user ? {
                    displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
                    firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
                    lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
                  } : undefined}
                  navigation={rootNavigation}
                  playbookTitle={playbook?.title}
                  playbookId={playbook?.id}
                  userInput={playbook?.userInput}
                />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Back cards - only render when previous card is not visible */}
        {backCards.length > 0 && (
          <View>
            {backCards}
          </View>
        )}

        {/* Current card - appears on top */}
        <Animated.View style={[animatedCardStyle, styles.cardWrapperStyle, styles.currentCardZIndex]}>
          {renderCard(currentCard, 0, (mode: 'stack' | 'document') => setViewMode(mode))}
        </Animated.View>
      </View>
    );
  };

  // ===== MAIN RENDER =====

  return (
    <View style={styles.container}>
      {/* Status bar handled by useScreenStatusBar */}

      {/* In-screen header (replaces native header). Cards overlay will pass over this. */}
      <View style={[styles.headerSafeArea, { paddingTop: Math.max(insets.top - HEADER_TOP_ADJUST + 6, 0) }]}>
        <View
          style={[styles.headerContainer, showCompactHeader && styles.headerContainerCompact]}
          onLayout={(e) => setHeaderMeasuredHeight(e.nativeEvent.layout.height)}
        >
          <HeaderLeft
            navigation={navigation}
            showUserInput={showUserInput}
            setShowUserInput={setShowUserInput}
            chevronStyle={chevronStyle}
            showCompactHeader={showCompactHeader}
            playbookTitle={playbook?.title}
            completedTasksCount={completedTasksCount}
            totalTasksCount={totalTasksCount}
            progressPercentage={progress}
            isFromOnboarding={isFromOnboarding}
            onboardingNextStep={onboardingNextStep}
            styles={styles}
          />
          <View style={styles.headerRight}>
            <ProfileButton user={user} navigation={navigation} styles={styles} />
          </View>
        </View>
      </View>
      {!playbookId ? (
        <View style={styles.loadingContainer}>
          <ThemedText weight="medium" style={styles.progressText}>No playbook ID provided</ThemedText>
        </View>
      ) : isLoading ? (
        <PlaybookSkeletonLoader />
      ) : error || !playbook ? (
        <View style={styles.loadingContainer}>
          <ThemedText weight="medium" style={styles.progressText}>Failed to load playbook data</ThemedText>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              try {
                navigation.goBack();
              } catch (err) {
                console.log('Navigation error:', err);
              }
            }}
          >
            <ThemedText weight="medium" style={styles.navButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {playbook && renderContent()}
          {playbook && viewMode === 'stack' && currentCard === 0 && !showUserInput && !hasReachedLastCard && (
            <View style={styles.swipeUpIndicatorContainer}>
              <SwipeUpIndicator />
            </View>
          )}

          <View style={[styles.bottomButtonContainer, showUserInput && styles.bottomButtonExpanded]}>
            {isFromOnboarding ? (
              <TouchableOpacity
                style={styles.onboardingContinueButton}
                onPress={() => {
                  navigation.navigate('MainTabs' as any);
                }}
              >
                <ThemedText weight="semiBold" style={styles.onboardingContinueButtonText}>
                  Start Your Journey
                </ThemedText>
                <Ionicons name="arrow-forward" size={20} color={Colors.hopeWhite} style={styles.arrowIcon} />
              </TouchableOpacity>
            ) : (
              ((viewMode === 'document' && hasReachedLastCard) ||
                (viewMode === 'stack' && showDevotionalButton))
                && !hasCreatedDevotional && (
                <View style={styles.devotionalButtonWrapper}>
                  <DevotionalButton
                    onPress={() => {
                      // Light haptic on create devotional
                      triggerLightHaptic();
                      setShowDevotionalModal(true);
                    }}
                    visible={true}
                  />
                </View>
              )
            )}
          </View>

          <DevotionalModal
            visible={showDevotionalModal}
            onClose={() => setShowDevotionalModal(false)}
            playbookId={playbookId}
            userInput={playbook?.userInput}
            onDevotionalCreated={(devotionalId: string) => {
              // Close modal and navigate. Keep the CTA visible until the detail screen actually appears.
              setShowDevotionalModal(false);
              pendingDevotionalNavigation.current = true;
              rootNavigation.navigate('DevotionalDetail', { devotionalId });
            }}
          />
        </>
      )}
    </View>
  );
};

// ===== STYLES =====

interface PlaybookDetailStyles {
  arrowIcon: TextStyle;
  container: ViewStyle;
  contentContainer: ViewStyle;
  loadingContainer: ViewStyle;
  cardStackContainer: ViewStyle;
  swipeUpIndicatorContainer: ViewStyle;
  progressText: TextStyle;
  navButton: ViewStyle;
  navButtonText: TextStyle;
  compactHeaderContainer: ViewStyle;
  mainContainer: ViewStyle;
  bottomButtonContainer: ViewStyle;
  bottomButtonExpanded: ViewStyle;
  onboardingContinueButton: ViewStyle;
  onboardingContinueButtonText: TextStyle;
  devotionalButtonWrapper: ViewStyle;
  cardWrapperStyle: ViewStyle;
  cardContentStyle: ViewStyle;
  stackCard: ViewStyle;
  stackCardExpanded: ViewStyle;
  stackCardScrollContainer: ViewStyle;
  hiddenMeasurement: ViewStyle;
  noAffirmationsText: TextStyle;
  headerSafeArea: ViewStyle;
  headerContainer: ViewStyle;
  headerContainerCompact: ViewStyle;
  backButton: ViewStyle;
  headerRight: ViewStyle;
  docContainer: ViewStyle;
  docContentContainer: ViewStyle;
  docCard: ViewStyle;
  playbookInfoContainer: ViewStyle;
  playbookHeader: ViewStyle;
  headerTitleContainer: ViewStyle;
  headerTitle: TextStyle;
  playbookLabelRow: ViewStyle;
  playbookLabel: TextStyle;
  playbookTitle: TextStyle;
  creationDate: TextStyle;
  progressAndViewRow: ViewStyle;
  progressContainer: ViewStyle;
  progressRow: ViewStyle;
  progressBarBg: ViewStyle;
  progressBarFill: ViewStyle;
  userInputCard: ViewStyle;
  userInputText: TextStyle;
  viewToggleContainer: ViewStyle;
  viewToggle: ViewStyle;
  iconContainer: ViewStyle;
  iconContainerActive: ViewStyle;
  viewToggleDivider: ViewStyle;
  truthCard: ViewStyle;
  actionCard: ViewStyle;
  affirmationsCard: ViewStyle;
  bibleCard: ViewStyle;
  challengeCard: ViewStyle;
  cardNavigation: ViewStyle;
  navButtonDisabled: ViewStyle;
  cardIndicator: ViewStyle;
  cardIndicatorText: TextStyle;
  affirmationsHeader: ViewStyle;
  icon: ImageStyle;
  affirmationsList: ViewStyle;
  affirmationsTitle: TextStyle;
  affirmationCardStyle: ViewStyle;
  nonAffirmationCardStyle: ViewStyle;
  headerLeftContainer: ViewStyle;
  backButtonContainer: ViewStyle;
  compactHeaderTitle: TextStyle;
  playbookLabelContainer: ViewStyle;
  playbookLabelText: TextStyle;
  chevronIcon: ViewStyle;
  profileButton: ViewStyle;
  profileImage: ImageStyle;
  initialAvatar: ViewStyle;
  initialLetter: TextStyle;
  headerProgressContainer: ViewStyle;
  headerProgressRow: ViewStyle;
  headerProgressBarBg: ViewStyle;
  headerProgressBarFill: ViewStyle;
  headerTasksText: TextStyle;
  currentCardZIndex: ViewStyle;
  cardOverlay: ViewStyle;
}

const createStyles = (theme: any) => StyleSheet.create<PlaybookDetailStyles>({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    position: 'relative',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  loadingContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStackContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 8,
  },
  swipeUpIndicatorContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  progressText: {
    fontFamily: theme.fonts?.medium || 'System',
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  navButton: {
    backgroundColor: Colors.modalBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  navButtonText: {
    color: Colors.hopeWhite,
    fontFamily: theme.fonts?.medium || 'System',
    fontSize: 16,
  },
  arrowIcon: {
    marginLeft: 8,
  },
  currentCardZIndex: {
    zIndex: 200,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999, // ensure above any in-screen header
    // Allow touches to pass through when outside children
    // pointerEvents is set on the View usage; style kept purely for layout
  },
  compactHeaderContainer: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 0,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    // Ensure this sits above the full-screen card overlay (which uses zIndex 9999)
    zIndex: 10000,
  },
  bottomButtonExpanded: {
    marginTop: 20,
  },
  onboardingContinueButton: {
    backgroundColor: Colors.growthGreen,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingContinueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    // fontFamily handled by ThemedText weight="semiBold"
  },
  devotionalButtonWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrapperStyle: {
    width: '100%',
    position: 'relative',
    zIndex: 200,
  },
  cardContentStyle: {
    flex: 1,
  },
  // Additional required styles
  stackCard: {
    width: SCREEN_WIDTH - 80,
    height: 450,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: '#264674',
    padding: 0,
    overflow: 'hidden',
  },
  stackCardExpanded: {
    height: 'auto',
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  stackCardScrollContainer: {
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  hiddenMeasurement: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    left: -10000,
    right: 0,
  },
  noAffirmationsText: {
    fontFamily: theme.fonts?.regular || 'System',
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.7,
  },
  headerSafeArea: {
    backgroundColor: Colors.anchorBlue,
    // Ensure children can visually overflow without being clipped
    overflow: 'visible',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 2,
    backgroundColor: Colors.anchorBlue,
    marginBottom: -6,
    // Allow profile to render above any overlapping elements
    overflow: 'visible',
  },
  headerContainerCompact: {
    paddingTop: 6,
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    // Make header right content (profile) stack above other header elements
    zIndex: 3000,
  },
  docContainer: {
    flex: 1,
  },
  docContentContainer: {
    paddingTop: 0,
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  docCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 28,
    backgroundColor: '#264674',
    overflow: 'hidden',
  },
  playbookInfoContainer: {
    marginBottom: 20,
  },
  playbookHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
    paddingHorizontal: 12,
  },
  headerTitleContainer: {
    width: '100%',
    marginTop: -14,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.fonts?.bold || 'System',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 6,
  },
  playbookLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  playbookLabel: {
    fontFamily: theme.fonts?.medium || 'System',
    fontSize: 16,
    color: Colors.hopeWhite,
    marginRight: 8,
  },
  playbookTitle: {
    fontSize: 20,
    fontFamily: theme.fonts?.bold || 'System',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  creationDate: {
    fontSize: 14,
    fontFamily: theme.fonts?.regular || 'System',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressAndViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 0,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    flex: 1,
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
  },
  userInputCard: {
    backgroundColor: '#264674',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userInputText: {
    fontFamily: theme.fonts?.regular || 'System',
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 4,
  },
  viewToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  iconContainer: {
    backgroundColor: 'transparent',
    marginRight: 6,
  },
  iconContainerActive: {
    backgroundColor: Colors.hopeWhite,
  },
  viewToggleDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  truthCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    padding: 32,
    marginBottom: 16,
    width: SCREEN_WIDTH - 64,
    alignSelf: 'center',
  },
  actionCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    width: SCREEN_WIDTH - 64,
    alignSelf: 'center',
  },
  affirmationsCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    width: SCREEN_WIDTH - 64,
    alignSelf: 'center',
  },
  bibleCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    width: SCREEN_WIDTH - 64,
    alignSelf: 'center',
  },
  challengeCard: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
    padding: 2,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'center',
  },
  cardNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.5,
  },
  cardIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardIndicatorText: {
    fontFamily: theme.fonts?.medium || 'System',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  affirmationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
    opacity: 1,
  },
  nonAffirmationCardStyle: {
    opacity: 1,
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
  },
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
    fontFamily: theme.fonts?.bold || 'System',
    color: Colors.hopeWhite,
    marginLeft: 4,
    maxWidth: 260,
  },
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  playbookLabelText: {
    fontSize: 14,
    fontFamily: theme.fonts?.semiBold || 'System',
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  profileButton: {
    marginRight: 16,
    borderWidth: 0,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    // Ensure the avatar stays on top during header fade/overlap
    zIndex: 4000,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: 4001,
    borderWidth: 0,
  },
  initialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4001,
  },
  initialLetter: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: theme.fonts?.semiBold || 'System',
  },
  headerProgressContainer: {
    marginLeft: 12,
    maxWidth: 260,
  },
  headerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    flex: 1,
    marginRight: 8,
  },
  headerProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
  },
  headerTasksText: {
    fontSize: 12,
    fontFamily: theme.fonts?.medium || 'System',
    color: Colors.hopeWhite,
  },
  affirmationsList: {
    marginTop: 8,
    gap: 8,
  },
  affirmationsTitle: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none',
  },
  affirmationCardStyle: {
    backgroundColor: '#264674',
  },
});

export default withErrorBoundary(PlaybookDetailScreen, 'PlaybookDetailScreen');
