// React & React Native
import * as React from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Platform,
  View,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Animated as RNAnimated,
  useWindowDimensions,
  ScrollView,
  UIManager,
  Easing as RNEasing,
  PanResponder,
  Image,
  NativeModules,
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
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

// Components
import DocumentCards from '../components/DocumentCards';
import SwipeUpIndicator from '../components/SwipeUpIndicator';
import PlaybookHeader from '../components/PlaybookHeader';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';
import { usePlaybookStoreReactQuery } from '../store/usePlaybookStoreReactQuery';
import DevotionalModal from '../components/DevotionalModal';
// Individual card components for stacked view
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';

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
import { useUpdateSubTask } from '../services/hooks/usePlaybookData';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { pdfExportService } from '../utils/pdfExportService';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Alert } from 'react-native';

// Navigation types
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';

// Screen dimensions - kept for initial StyleSheet creation (unused but may be needed for future static styles)
// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
interface PlaybookScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'PlaybookDetail'>;
  route: { params: { playbookId?: string; playbook?: { id: string } } };
}

type CardType = 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';

interface CardData {
  id: string;
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
const HeaderLeft = ({ navigation, showUserInput, setShowUserInput, chevronStyle, showCompactHeader, playbookTitle, completedTasksCount, totalTasksCount, progressPercentage, isFromOnboarding, styles }: {
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
    styles={styles}
  />
);

// Inner component to use hooks
const HeaderLeftInner = ({ showUserInput, setShowUserInput, chevronStyle, showCompactHeader, playbookTitle, completedTasksCount, totalTasksCount, progressPercentage, styles }: any) => {
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

const ShareButton = ({ onPress, styles }: { onPress: () => void; styles: any }) => (
  <TouchableOpacity
    onPress={() => {
      triggerLightHaptic();
      onPress();
    }}
    style={styles.shareButton}
    activeOpacity={0.7}
  >
    <Ionicons name="share-outline" size={20} color={Colors.hopeWhite} />
  </TouchableOpacity>
);

const PlaybookDetailScreen: React.FC<PlaybookScreenProps> = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const isTablet = windowWidth >= 768;
  // Always constrain card width, even in landscape - never full screen
  // On iPad, match header width (windowWidth - 44) to align with progress bar and share button row
  const cardPadding = isTablet ? 44 : 64; // 22px padding on each side for iPad header
  const maxCardWidth = Math.min(windowWidth - cardPadding, 660);
  // Status bar: force light icons (white) on dark header background
  useScreenStatusBar('dark', Colors.anchorBlue);
  // Measure header height so we can place the card overlay precisely below it
  const [_headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [playbookHeaderHeight, setPlaybookHeaderHeight] = useState(0);
  const headerSpacingAdjustment = isTablet ? 24 : -40;
  const baseTopInset = Math.max(insets.top, 10);
  const overlayTop = baseTopInset + playbookHeaderHeight + headerSpacingAdjustment;
  const [_expandedTopY, _setExpandedTopY] = useState(0);

  useEffect(() => {
    _setExpandedTopY(0);
  }, [isLandscape, windowWidth, windowHeight, _setExpandedTopY]);

  // Animated collapse progress for smooth header transition (0 = expanded, 1 = collapsed)
  const collapseProgress = useSharedValue(0);

  // ===== ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP =====

  // 1. Route and navigation data
  const playbookId = route.params?.playbook?.id || (route.params as any)?.playbookId;
  const isFromOnboarding = (route.params as any)?.isFromOnboarding || false;

  // Logging for playbookId

  const { user } = useAuth();
  const userId = user?.id;
  const rootNavigation = useNavigation<any>();

  // 2. Data fetching hooks - Use route params first, then fetch from database
  const routePlaybook = route.params?.playbook;
  // Only use route playbook if it has the full playbook structure (not lightweight)
  // Lightweight mode sets truthInLove.text and bibleVerse.text to empty strings
  // So check if these critical fields have content to determine if it's full data
  const isFullPlaybook = routePlaybook &&
    typeof routePlaybook === 'object' &&
    'title' in routePlaybook &&
    'actionSteps' in routePlaybook &&
    'truthInLove' in routePlaybook &&
    routePlaybook.truthInLove &&
    typeof routePlaybook.truthInLove === 'object' &&
    (routePlaybook.truthInLove as any).text && // Has actual text content (not empty)
    (routePlaybook.truthInLove as any).text.length > 0;
  const shouldFetchFromDB = !isFullPlaybook && !!playbookId && !!userId;

  const { data: fetchedPlaybook, isLoading, error, refetch } = useQuery<Playbook | null>({
    queryKey: ['playbook', playbookId, userId],
    queryFn: async () => {

      try {
        const result = await getPlaybook(userId || '', playbookId);

        // Validate that we got complete playbook data
        if (result && (!result.title || !result.actionSteps || !result.bibleVerse)) {
          Logger.warn('⚠️ Incomplete playbook data received, refetching...', {
            component: 'PlaybookDetailScreenNew',
            playbookId,
            hasTitle: !!result.title,
            hasActionSteps: !!result.actionSteps,
            hasBibleVerse: !!result.bibleVerse,
          });
          // Return null to trigger a refetch
          return null;
        }

        return result;
      } catch (err) {
        Logger.error('❌ Database fetch error', err as Error, {
      component: 'PlaybookDetailScreenNew',
    });
        throw err;
      }
    },
    enabled: shouldFetchFromDB,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
  });

  // Use route params playbook if it's a full playbook, otherwise use fetched playbook
  const playbook = isFullPlaybook ? (routePlaybook as Playbook) : fetchedPlaybook;

  // Read Aloud state for Affirmations (stack view)
  const hasRead = usePlaybookStoreReactQuery(state => playbook?.id ? !!state.readAloudMap[playbook.id] : false);
  const setReadAloud = usePlaybookStoreReactQuery(state => state.setReadAloud);

  // 2b. Advanced playbook hooks for prefetching and navigation
  const { prefetchForCurrentPlaybook } = useIntelligentPrefetching(userId || '');

  // 2c. Feature access for PDF export
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });

  // 3. Context hooks
  const { actionSteps, setActionSteps, saveActionSteps } = useActionSteps();

  // 4. Mutation hooks
  const updateSubTaskMutation = useUpdateSubTask();

  // 4. State hooks - UI state
  const [currentCard, setCurrentCard] = useState(0);

  // 5. Callback hooks
  const handleToggleSubTaskMutation = React.useCallback(async (stepId: string, subTaskId: string, completed: boolean) => {
    if (!playbook?.id || !userId) {return;}

    // Persist the new completed state to database
    await updateSubTaskMutation.mutateAsync({
      playbookId: playbook.id,
      stepId,
      subTaskId,
      completed,
      userId,
    });
  }, [playbook?.id, userId, updateSubTaskMutation]);
  const [viewMode, setViewMode] = useState<'stack' | 'document'>('stack');
  const [hasReachedLastCard, setHasReachedLastCard] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [hasCreatedDevotional, setHasCreatedDevotional] = useState(false);
  const [showUserInput, setShowUserInput] = useState(false);
  const [devotionalVisible, setDevotionalVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Devotional FAB animation (match onboarding)
  const devotionalButtonWidth = useRef(new RNAnimated.Value(56)).current;
  const devotionalTextOpacity = useRef(new RNAnimated.Value(0)).current;
  const devotionalTextWidth = devotionalTextOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });
  // Draggable FAB
  const devotionalFabPan = useRef(new RNAnimated.ValueXY({ x: 0, y: 0 })).current;
  const devotionalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devotionalFabPanResponder = useRef(
    PanResponder.create({
      // Do NOT capture on touch start; allow TouchableOpacity to receive taps
      onStartShouldSetPanResponder: () => false,
      // Activate pan only after a small movement threshold
      onMoveShouldSetPanResponder: (_evt, gesture) => (
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5
      ),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        devotionalFabPan.setOffset({ x: (devotionalFabPan as any).x._value || 0, y: (devotionalFabPan as any).y._value || 0 });
        devotionalFabPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        devotionalFabPan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: () => {
        devotionalFabPan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        devotionalFabPan.flattenOffset();
      },
    })
  ).current;

  // Burst animation + haptics for stacked Declarations read-aloud button (mirrors dashboard declarations behavior)
  const [affirmationParticles, setAffirmationParticles] = useState<{
    id: number;
    progress: RNAnimated.Value;
    dx: number;
    dy: number;
    size: number;
    rotate: number;
    color: string;
    delay: number;
  }[]>([]);
  const affirmationParticleIdRef = useRef(0);
  const stackReadHapticTimersRef = useRef<number[]>([]);
  const stackReadCooldownRef = useRef(0);

  const startStackReadBurstHaptics = useCallback(() => {
    try {
      // Clear existing timers
      stackReadHapticTimersRef.current.forEach(id => clearTimeout(id));
      stackReadHapticTimersRef.current = [];

      const schedule = [0, 250, 500, 750];
      schedule.forEach(delay => {
        const id = setTimeout(() => {
          try {
            const { RNHapticFeedback } = NativeModules as any;
            if (!RNHapticFeedback) { return; }

            const Haptic = require('react-native-haptic-feedback');
            const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
            if (typeof triggerFn === 'function') {
              triggerFn('impactLight', {
                enableVibrateFallback: false,
                ignoreAndroidSystemSettings: false,
              });
            }
          } catch {
            // Silently ignore haptic errors
          }
        }, delay) as unknown as number;
        stackReadHapticTimersRef.current.push(id);
      });
    } catch {
      // Silently ignore timer setup errors
    }
  }, []);

  const startAffirmationBurst = useCallback(() => {
    const NUM = 10;
    const colors = [Colors.alertCoral, '#ff7a7a', '#ff9aa2', '#ff6b6b'];
    const newParticles = Array.from({ length: NUM }).map((_, i) => {
      const id = affirmationParticleIdRef.current++;
      return {
        id,
        progress: new RNAnimated.Value(0),
        dx: (Math.random() * 80 - 40),
        dy: 70 + Math.random() * 70,
        size: 10 + Math.random() * 10,
        rotate: Math.random() * 60 - 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 35,
      };
    });

    setAffirmationParticles(prev => [...prev, ...newParticles]);
    newParticles.forEach(p => {
      RNAnimated.timing(p.progress, {
        toValue: 1,
        duration: 900,
        delay: p.delay,
        useNativeDriver: true,
      }).start();
    });

    setTimeout(() => {
      setAffirmationParticles(prev => prev.filter(h => !newParticles.find(n => n.id === h.id)));
    }, 1200);
  }, []);

  // Stacked card animation state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const cardAnimationsRef = useRef<Record<string, { translateY: RNAnimated.Value; scale: RNAnimated.Value; opacity: RNAnimated.Value }>>({});

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

  // Collapse stacked cards whenever we leave stack view
  useEffect(() => {
    if (viewMode === 'document' && expandedCardId !== null) {
      setExpandedCardId(null);
    }
  }, [viewMode, expandedCardId]);

  // 6. Shared value hooks - Animation values
  const bounceY = useSharedValue(0);

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
  const [_isPreviousCardVisible, _setIsPreviousCardVisible] = useState(false);

  // 8. Constants
  const SWIPE_THRESHOLD = 120;
  const MIN_SWIPE_DISTANCE = 10;
  const MIN_SWIPE_VELOCITY = 500;

  // 9. Animated style hooks
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  // Header collapse and overlay animated styles
  const headerCollapseStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapseProgress.value,
    transform: [{ translateY: -16 * collapseProgress.value }],
  }));

  const overlayTopAnimatedStyle = useAnimatedStyle(() => ({
    top: viewMode === 'document'
      ? interpolate(collapseProgress.value, [0, 1], [overlayTop, isTablet ? 24 : 10])
      : overlayTop,
  }));

  // 10. Callback hooks
  const getCompletedStepsCount = useCallback(() => getTaskStats(actionSteps), [actionSteps]);

  // 11. Gesture handler will be defined after navigation functions

  // 12. Memoized values
  // Get user metadata at component level for access throughout the component
  const userMeta: any = (user as any)?.user_metadata || {};
  // Get user's preferred Bible translation
  const preferredBibleTranslation = userMeta?.preferences?.content?.bibleVersion;

  const cardData: CardData[] = useMemo(() => {
    if (!playbook) {return [];}

    // Get user metadata for name replacement
    const metaUser: any = (user as any)?.user_metadata || {};
    const metaFirstName = metaUser.first_name || (user as any)?.displayName?.split(' ')[0] || '';
    const metaDisplayName = (user as any)?.displayName ||
                          metaUser.full_name ||
                          [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ').trim() ||
                          '';

    // Log action steps data
    const finalActionSteps = Array.isArray(actionSteps) && actionSteps.length > 0 ? actionSteps :
          (Array.isArray(playbook?.actionSteps) ? playbook.actionSteps : []);

    // Log affirmations data - apply name replacement
    const finalAffirmations = Array.isArray(playbook?.affirmations)
      ? playbook.affirmations
          .filter((a): a is Required<Affirmation> =>
            a?.id !== undefined &&
            a?.text !== undefined &&
            a?.completed !== undefined
          )
          .map(a => ({
            ...a,
            text: replaceAllNamePlaceholders(
              a.text,
              { firstName: metaFirstName, displayName: metaDisplayName },
              { replaceHardcodedNames: true } // Enable replacement of old hardcoded names
            ),
          }))
      : [];

    return [
    {
      id: 'truth',
      type: 'truth' as const,
      truth: replaceAllNamePlaceholders(
        playbook.truthInLove?.text ?? '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true } // Enable replacement of old hardcoded names
      ),
      summary: replaceAllNamePlaceholders(
        playbook.truthInLove?.summary ?? '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true } // Enable replacement of old hardcoded names
      ),
      tappable: false,
    },
    {
      id: 'action',
      type: 'action' as const,
      steps: finalActionSteps,
      tappable: false,
    },
    {
      id: 'affirmation',
      type: 'affirmation' as const,
      affirmations: finalAffirmations,
      tappable: false,
    },
    {
      id: 'bible',
      type: 'bible' as const,
      verse: {
        text: playbook.bibleVerse?.text ?? 'No verse text available',
        reference: playbook.bibleVerse?.reference ?? 'Unknown',
      },
      tappable: false,
    },
    {
      id: 'challenge',
      type: 'challenge' as const,
      challenge: replaceAllNamePlaceholders(
        typeof playbook.directChallenge === 'string'
          ? playbook.directChallenge
          : playbook.directChallenge?.text ?? '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true } // Enable replacement of old hardcoded names
      ),
      challengeCTA: playbook.challengeCTA,
      tappable: false,
    },
  ];
  }, [playbook, actionSteps, user]);

  // Vertical separation between stacked cards (document vs stack)
  const STACK_OFFSET = 56;

  // Initialize animated values for each card with entrance animation
  useEffect(() => {
    const cardAnimations = cardAnimationsRef.current;

    // Clean up animations for cards that no longer exist
    const currentCardIds = new Set(cardData.map(card => card.id));
    Object.keys(cardAnimationsRef.current).forEach(id => {
      if (!currentCardIds.has(id)) {
        // Stop and clean up animations for removed cards
        const anim = cardAnimations[id];
        try {
          anim.translateY.stopAnimation();
          anim.scale.stopAnimation();
          anim.opacity.stopAnimation();
        } catch {
          // Ignore animation stop errors
        }
        delete cardAnimationsRef.current[id];
      }
    });

    // Initialize animations for new cards with entrance animation
    cardData.forEach((card, index) => {
      if (!cardAnimations[card.id]) {
        const initialOffset = (cardData.length - index - 1) * STACK_OFFSET;

        // Start from below and fade in
        cardAnimations[card.id] = {
          translateY: new RNAnimated.Value(initialOffset + 100), // Start 100px below
          scale: new RNAnimated.Value(0.9), // Start slightly smaller
          opacity: new RNAnimated.Value(0), // Start invisible
        };

        // Animate to final position with staggered delay
        const delay = index * 80; // 80ms delay between each card

        setTimeout(() => {
          RNAnimated.parallel([
            RNAnimated.spring(cardAnimations[card.id].translateY, {
              toValue: initialOffset,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }),
            RNAnimated.spring(cardAnimations[card.id].scale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
            RNAnimated.timing(cardAnimations[card.id].opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
              easing: RNEasing.out(RNEasing.ease),
            }),
          ]).start();
        }, delay);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardData.length]);

  // Reset animations when collapsing all cards
  useEffect(() => {
    const cardAnimations = cardAnimationsRef.current;
    if (expandedCardId === null) {
      cardData.forEach((card, index) => {
        const initialOffset = (cardData.length - index - 1) * STACK_OFFSET;
        if (cardAnimations[card.id]) {
          RNAnimated.parallel([
            RNAnimated.spring(cardAnimations[card.id].translateY, {
              toValue: initialOffset,
              useNativeDriver: true,
              friction: 8,
              tension: 40,
            }),
            RNAnimated.timing(cardAnimations[card.id].opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            RNAnimated.spring(cardAnimations[card.id].scale, {
              toValue: 1,
              useNativeDriver: true,
              friction: 8,
            }),
          ]).start();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedCardId]);

  // Smooth animation handler for card transitions with improved physics
  const animateCardTransition = useCallback((cardId: string, isExpanding: boolean) => {
    const cardAnimations = cardAnimationsRef.current;
    const cardIndex = cardData.findIndex(c => c.id === cardId);

    if (isExpanding) {
      // Haptic feedback for expansion
      try { triggerLightHaptic(); } catch {}

      // Animate selected card to expanded position (top) with smooth spring
      RNAnimated.parallel([
        RNAnimated.spring(cardAnimations[cardId].translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 10,
          tension: 50,
          velocity: 2,
        }),
        RNAnimated.spring(cardAnimations[cardId].scale, {
          toValue: 1, // Keep scale at 1.0 (no bounce)
          useNativeDriver: true,
          friction: 10,
          tension: 50,
        }),
      ]).start();

      // Animate other cards based on their position relative to tapped card
      cardData.forEach((card, index) => {
        if (card.id !== cardId) {
          // Cards are stacked with LOWER index = HIGHER z-index (visually on top)
          // Cards with lower index (visually above) should slide UP (positive Y)
          // Cards with higher index (visually below) should slide DOWN (negative Y)
          const isVisuallyAbove = index < cardIndex;
          const targetY = isVisuallyAbove ? 600 : -600;
          const delay = Math.abs(index - cardIndex) * 30; // Stagger based on distance

          setTimeout(() => {
            RNAnimated.parallel([
              RNAnimated.spring(cardAnimations[card.id].translateY, {
                toValue: targetY,
                useNativeDriver: true,
                friction: 10,
                tension: 45,
              }),
              RNAnimated.timing(cardAnimations[card.id].opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
                easing: RNEasing.out(RNEasing.ease),
              }),
              RNAnimated.spring(cardAnimations[card.id].scale, {
                toValue: 0.85,
                useNativeDriver: true,
                friction: 10,
              }),
            ]).start();
          }, delay);
        }
      });
    } else {
      // Collapse - return all cards to original stacked position with staggered animation
      cardData.forEach((card, index) => {
        const initialOffset = (cardData.length - index - 1) * STACK_OFFSET;
        const delay = index * 40; // Stagger collapse animation

        setTimeout(() => {

        RNAnimated.parallel([
          RNAnimated.spring(cardAnimations[card.id].translateY, {
            toValue: initialOffset,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }),
          RNAnimated.timing(cardAnimations[card.id].opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          RNAnimated.spring(cardAnimations[card.id].scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
          }),
        ]).start();
        }, delay);
      });
    }
  }, [cardData, STACK_OFFSET]);

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

  // ===== EXPANSION STATE (moved up so gestures can reference it) =====
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
  const [_contentHeights, _setContentHeights] = useState<Record<number, number>>({});
  const [isScrolling, setIsScrolling] = useState(false);

  // Gesture handler hook (using modern Gesture API) - defined after navigation functions
  const panGesture = Gesture.Pan()
    .enabled(expandedCardIndex === null)
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
            runOnJS(_setIsPreviousCardVisible)(true);
          } else {
            showPreviousCard.value = false;
            previousCardOpacity.value = 0;
            runOnJS(_setIsPreviousCardVisible)(false);
          }
        } else {
          // Swiping up or no previous card available - hide previous card
          showPreviousCard.value = false;
          previousCardOpacity.value = 0;
          previousCardTranslateY.value = 0;
          runOnJS(_setIsPreviousCardVisible)(false);
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
            runOnJS(_setIsPreviousCardVisible)(false);

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
              runOnJS(_setIsPreviousCardVisible)(false);
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
          runOnJS(_setIsPreviousCardVisible)(false);
        }
      } else {
        translateY.value = withSpring(gestureStartY.value, { damping: 15, stiffness: 300 }, () => {
          isTransitioning.value = false;
        });
        previousCardTranslateY.value = withSpring(0, { damping: 15, stiffness: 300 });
        previousCardOpacity.value = withSpring(0, { damping: 15, stiffness: 300 });
        showPreviousCard.value = false;
        runOnJS(_setIsPreviousCardVisible)(false);
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
      styles={styles}
    />
  ), [navigation, showUserInput, chevronStyle, showCompactHeader, playbook?.title, completedTasksCount, totalTasksCount, progress, isFromOnboarding, styles]);

  // ===== EFFECT HOOKS =====

  // Logging effect
  useEffect(() => {
    if (!playbookId) {
      Logger.warn('No playbookId provided', { component: 'PlaybookDetailScreenNew' });
      return;
    } else if (isLoading) {
      Logger.debug('Loading playbook data', { component: 'PlaybookDetailScreenNew', playbookId });
      return;
    } else if (error || !playbook) {
      Logger.error('Error loading playbook or no playbook data', error as Error, {
        component: 'PlaybookDetailScreenNew',
        playbookId,
        hasPlaybook: !!playbook,
      });
      return;
    } else {
      Logger.debug('Playbook loaded successfully', {
        component: 'PlaybookDetailScreenNew',
        playbookId,
        title: playbook?.title,
      });
      return;
    }
  }, [playbookId, userId, playbook, isLoading, error, route.params]);

  // Intelligent prefetching effect for adjacent playbooks and cross-component relationships
  useEffect(() => {
    if (playbookId && userId && playbook) {

      // Prefetch adjacent playbooks and related data
      prefetchForCurrentPlaybook(playbookId).catch(prefetchError => {
        Logger.warn('[PlaybookDetailScreen] Prefetching failed', {
          component: 'PlaybookDetailScreenNew',
          data: prefetchError,
        });
      });
    }
  }, [playbookId, userId, playbook, prefetchForCurrentPlaybook]);

  // Playbook data debug effect
  useEffect(() => {
    Logger.debug('Playbook data updated', {
      component: 'PlaybookDetailScreenNew',
      playbookId: playbook?.id,
      title: playbook?.title,
      hasActionSteps: !!playbook?.actionSteps?.length,
    });
  }, [playbook]);

  // Auto-refetch if playbook data is incomplete
  useEffect(() => {
    if (playbook && shouldFetchFromDB && !isLoading) {
      const isIncomplete = !playbook.title ||
                          !playbook.actionSteps ||
                          !playbook.bibleVerse ||
                          !playbook.truthInLove?.text ||
                          !playbook.directChallenge;

      if (isIncomplete) {
        Logger.warn('⚠️ Detected incomplete playbook data, triggering refetch', {
          component: 'PlaybookDetailScreenNew',
          playbookId,
          hasTitle: !!playbook.title,
          hasActionSteps: !!playbook.actionSteps,
          hasBibleVerse: !!playbook.bibleVerse,
          hasTruthInLove: !!playbook.truthInLove?.text,
          hasChallenge: !!playbook.directChallenge,
        });

        // Trigger refetch after a short delay
        const timeoutId = setTimeout(() => {
          refetch();
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [playbook, shouldFetchFromDB, isLoading, playbookId, refetch]);

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
    const currentCardAnimations = cardAnimationsRef.current;

    return () => {
      // Clean up requestAnimationFrame
      if (currentAnimationRefs.rafId) {
        try {
          cancelAnimationFrame(currentAnimationRefs.rafId);
        } catch {
          // Ignore invalid frame ID errors
        }
      }
      // Clean up header opacity animation
      if (currentAnimationRefs.headerOpacityAnimation?.cancel) {
        try {
          currentAnimationRefs.headerOpacityAnimation.cancel();
        } catch {
          // Ignore animation cancel errors
        }
      }
      // Clean up gesture animations
      Object.values(currentGestureRefs).forEach(anim => {
        if (anim?.cancel) {
          try {
            anim.cancel();
          } catch {
            // Ignore animation cancel errors
          }
        }
      });
      // Clean up card animations - CRITICAL for memory leak prevention
      Object.values(currentCardAnimations).forEach(anim => {
        try {
          anim.translateY.stopAnimation();
          anim.scale.stopAnimation();
          anim.opacity.stopAnimation();
        } catch {
          // Ignore animation stop errors
        }
      });
      // Clear the card animations object
      Object.keys(currentCardAnimations).forEach(key => {
        delete currentCardAnimations[key];
      });
      // Clean up haptic timers
      stackReadHapticTimersRef.current.forEach(id => {
        try {
          clearTimeout(id);
        } catch {
          // Ignore timer cleanup errors
        }
      });
      stackReadHapticTimersRef.current = [];
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

  // Show devotional FAB after 3 seconds delay (both stack and document view)
  useEffect(() => {
    if (!devotionalTimerRef.current && !hasCreatedDevotional) {
      devotionalTimerRef.current = setTimeout(() => {
        setDevotionalVisible(true);
        devotionalTimerRef.current = null;
        // Start expand/collapse animation
        const expandTimer = setTimeout(() => {
          RNAnimated.parallel([
            RNAnimated.timing(devotionalButtonWidth, { toValue: 220, duration: 400, useNativeDriver: false }),
            RNAnimated.timing(devotionalTextOpacity, { toValue: 1, duration: 300, delay: 150, useNativeDriver: false }),
          ]).start(() => {
            const collapseTimer = setTimeout(() => {
              RNAnimated.parallel([
                RNAnimated.timing(devotionalTextOpacity, { toValue: 0, duration: 250, useNativeDriver: false }),
                RNAnimated.timing(devotionalButtonWidth, { toValue: 56, duration: 350, useNativeDriver: false }),
              ]).start();
            }, 2500);
            // Store collapse timer for cleanup
            (devotionalTimerRef as any).collapseTimer = collapseTimer;
          });
        }, 100);
        // Store expand timer for cleanup
        (devotionalTimerRef as any).expandTimer = expandTimer;
      }, 3000); // 3 second delay
    }
    return () => {
      if (devotionalTimerRef.current) {
        clearTimeout(devotionalTimerRef.current);
        clearTimeout((devotionalTimerRef as any).expandTimer);
        clearTimeout((devotionalTimerRef as any).collapseTimer);
        devotionalTimerRef.current = null;
      }
    };
  }, [devotionalButtonWidth, devotionalTextOpacity, hasCreatedDevotional]);

  // Handle devotional creation
  const handleCreateDevotional = useCallback(() => {
    if (showDevotionalModal) return; // Prevent multiple taps
    triggerLightHaptic();
    setShowDevotionalModal(true);
  }, [showDevotionalModal]);

  // Hide FAB in document view until scrolled to bottom, and when modal is open
  const shouldShowFAB = devotionalVisible && !hasCreatedDevotional && !showDevotionalModal && (
    viewMode === 'stack' || (viewMode === 'document' && hasReachedLastCard)
  );

  // PDF Export handler
  const handleExportPDF = useCallback(() => {
    if (!playbook) {return;}

    // Check feature access
    if (!pdfExportAccess.hasAccess) {
      const upgradePrompt = pdfExportAccess.accessResult?.upgradePrompt;
      Alert.alert(
        upgradePrompt?.title || 'Upgrade Required',
        upgradePrompt?.message || 'PDF export is available with Growth and Transformation plans.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          {
            text: upgradePrompt?.cta || 'Upgrade Now',
            onPress: () => {
              // Navigate to subscription screen with export restriction context
              rootNavigation.navigate('OnboardingSalesOffer', {
                source: 'pdf_export_restriction',
                feature: 'export_pdf',
                dismissBothModalsOnClose: true, // Ensure both modals dismiss after upgrade
                skipNotificationPreference: true,
              });
            },
          },
        ]
      );
      return;
    }

    // Get user name for dynamic replacement (same as cardData)
    const metaUser: any = (user as any)?.user_metadata || {};
    const metaFirstName = metaUser.first_name || (user as any)?.displayName?.split(' ')[0] || '';
    const metaDisplayName = (user as any)?.displayName ||
                          metaUser.full_name ||
                          [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ').trim() ||
                       '';

    // Get bible version from user preferences or default to NASB
    const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

    pdfExportService.exportPlaybookPDF({
      title: playbook.title,
      truthInLove: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? playbook.truthInLove : playbook.truthInLove?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true }
      ),
      truthInLoveSummary: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? '' : playbook.truthInLove?.summary || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true }
      ),
      bibleVerse: {
        ...playbook.bibleVerse,
        version: bibleVersion,
      },
      actionSteps: playbook.actionSteps?.map(step => {
        // Derive examples similar to ActionStepsCard
        let examples: string[] = [];

        const rawExamples: any = (step as any).examples;
        if (rawExamples && typeof rawExamples === 'string') {
          const exampleMatches = rawExamples
            .split(/Example:\s*/i)
            .filter((text: string) => text.trim().length > 0);
          examples = exampleMatches.map((ex: string) => ex.trim());
        } else if (Array.isArray(rawExamples)) {
          examples = rawExamples.map((ex: string) => ex.replace(/^"+|"+$/g, '').trim());
        } else if (step.subTasks && step.subTasks.length > 0) {
          examples = step.subTasks
            .filter((st: any) => typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:'))
            .map((st: any) => st.text.replace(/^Example:/i, '').trim());
        }

        return {
          title: step.title,
          description: step.description || '',
          subtasks: step.subTasks?.map((st: any) => st.text || st.title || st) || [],
          examples,
        };
      }),
      affirmations: playbook.affirmations?.map(a =>
        replaceAllNamePlaceholders(
          a.text,
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        )
      ) || [],
      directChallenge: replaceAllNamePlaceholders(
        typeof playbook.directChallenge === 'string' ? playbook.directChallenge : playbook.directChallenge?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true }
      ),
      createdAt: playbook.createdAt,
    });
  }, [playbook, user, pdfExportAccess, rootNavigation]);

  // Header right component
  const headerRight = React.useCallback(() => (
    <ShareButton onPress={handleExportPDF} styles={styles} />
  ), [handleExportPDF, styles]);

  // Set navigation options based on scroll state
  React.useLayoutEffect(() => {

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
  const pendingSaveRef = useRef(false);

  // Immediate save function (no debounce) for critical saves
  // Currently unused but kept for future use
  // const immediateSave = useCallback(async () => {
  //   if (!playbook?.id || isSaving) {
  //     return;
  //   }

  //   try {
  //     setIsSaving(true);
  //     await saveActionSteps(playbook.id);
  //     pendingSaveRef.current = false;
  //   } catch (err) {
  //     Logger.error('Error in immediate save', err as Error, {
  //       component: 'PlaybookDetailScreenNew',
  //     });
  //   } finally {
  //     setIsSaving(false);
  //   }
  // }, [playbook?.id, isSaving, saveActionSteps]);

  const debouncedSaveProgress = useCallback(() => {
    if (!playbook?.id) {
      return;
    }

    // Mark that we have a pending save
    pendingSaveRef.current = true;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSaving) {
        return;
      }

      try {
        setIsSaving(true);
        await saveActionSteps(playbook.id);
        pendingSaveRef.current = false;
      } catch (err) {
        Logger.error('Error in debounced save', err as Error, {
          component: 'PlaybookDetailScreenNew',
        });
      } finally {
        setIsSaving(false);
      }
    }, 500); // 500ms delay - reduced to prevent toggle overwrites
  }, [playbook?.id, isSaving, saveActionSteps]);

  // Call debounced save when actionSteps change
  useEffect(() => {
    if (isInitialized && actionSteps.length > 0) {
      debouncedSaveProgress();
    }

    // CRITICAL: Force immediate save on unmount if there's a pending save
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // If there's a pending save, execute it immediately before unmount
      if (pendingSaveRef.current && playbook?.id) {
        // Use synchronous approach to ensure save happens
        saveActionSteps(playbook.id).catch((err) => {
          Logger.error('Error in unmount save', err as Error, {
            component: 'PlaybookDetailScreenNew',
          });
        });
      }
    };
  }, [actionSteps, isInitialized, debouncedSaveProgress, playbook?.id, saveActionSteps]);

  // DISABLED - Old automatic save logic
  /*
  useEffect(() => {

    if (!isInitialized || isSaving || !playbook?.id) {

      return;
    }

    // Convert actionSteps to string for comparison
    const currentActionStepsStr = JSON.stringify(actionSteps);

    // Skip if actionSteps haven't actually changed
    if (currentActionStepsStr === lastSavedActionSteps.current) {

      return;
    }

    const saveProgress = async () => {
      try {
        setIsSaving(true);

        await saveActionSteps(playbook.id);

        // Update the last saved state to prevent loops
        lastSavedActionSteps.current = currentActionStepsStr;

      } catch (error) {
        Logger.error('Error saving progress', error as Error, {
      component: 'PlaybookDetailScreenNew',
    });
      } finally {
        setIsSaving(false);
      }
    };

    // Debounce the save to avoid too frequent calls
    const timeoutId = setTimeout(() => {
      saveProgress().catch((e) => Logger.error('Async error', e as Error, { component: 'PlaybookDetailScreenNew' }));
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

        saveActionSteps(playbook.id).catch((e) => Logger.error('Async error', e as Error, { component: 'PlaybookDetailScreenNew' }));
      }
    };
  }, [playbook?.id, actionSteps, saveActionSteps]);

  // ===== EXPANSION STATE =====

  // state moved above to allow gesture .enabled()

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
              onExportPress={handleExportPDF}
              onEditUserInput={() => {
                navigation.navigate('UserInput', { initialText: currentPlaybook.userInput });
              }}
            />
          </View>
        ) : (
          <Animated.View style={headerCollapseStyle} pointerEvents={showCompactHeader ? 'none' : 'auto'}>
            <View onLayout={(e) => setPlaybookHeaderHeight(e.nativeEvent.layout.height)}>
              <PlaybookHeader
                title={currentPlaybook.title}
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
                onExportPress={handleExportPDF}
                onEditUserInput={() => {
                  navigation.navigate('UserInput', { initialText: currentPlaybook.userInput });
                }}
              />
            </View>
          </Animated.View>
        )}

        {/* Absolute overlay for the interactive card stack so it can pass over header and status bar */}
        <Animated.View pointerEvents="box-none" style={[styles.cardOverlay, overlayTopAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={[styles.mainContainer, viewMode === 'document' && styles.documentViewContainer]}>
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
                  maxCardWidth={maxCardWidth}
                />
              )}
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    );
  };

  const renderStackCards = () => {
    if (cardData.length === 0) {
      return null;
    }

    // Standard dimensions for stacked cards
    const STACKED_CARD_HEIGHT = 450;
    const STACKED_CARD_WIDTH = maxCardWidth;

    // Z-index mapping for cards (truth on top, challenge on bottom)
    const zIndexMap = {
      truth: 5,
      action: 4,
      affirmation: 3,
      bible: 2,
      challenge: 1,
    };

    return (
      <View style={[styles.cardStackContainer, isTablet && styles.tabletCardStackContainer]}>
        {cardData.map((card, index) => {
          const isExpanded = expandedCardId === card.id;

          // Get z-index for this card
          const baseZIndex = zIndexMap[card.type as keyof typeof zIndexMap] || index;
          const cardZIndex = isExpanded ? 9999 : baseZIndex;

          // Get animation values for this card
          const animValues = cardAnimationsRef.current[card.id] || {
            translateY: new RNAnimated.Value((cardData.length - index - 1) * STACK_OFFSET),
            scale: new RNAnimated.Value(1),
            opacity: new RNAnimated.Value(1),
          };

          // Render card content based on type - matching onboarding screen exactly
          const renderCardContent = () => {
            const currentUser = user ? {
              displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
              firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
              lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
            } : undefined;

            switch (card.type) {
              case 'truth':
                return (
                  <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                    <TruthInLoveCard
                      truth={card.truth || ''}
                      summary={card.summary || ''}
                      expanded={isExpanded}
                      style={styles.transparentBackground}
                      currentUser={currentUser}
                      showCloseButton={false}
                    />
                  </View>
                );

              case 'action':
                return (
                  <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                    <ActionStepsCard
                      steps={card.steps || []}
                      style={styles.transparentBackground}
                      playbookTitle={playbook?.title}
                      playbookId={playbook?.id}
                      navigation={rootNavigation}
                      showExampleSubtasksInline={false}
                      preferPropSteps={false}
                      expanded={isExpanded}
                      showCloseButton={false}
                      onCollapse={() => {
                        setExpandedCardId(null);
                        animateCardTransition(card.id, false);
                      }}
                      onToggleSubTaskMutation={handleToggleSubTaskMutation}
                    />
                  </View>
                );

              case 'affirmation':
                return (
                  <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                    <View style={styles.affirmationsHeaderStack}>
                      <View style={styles.rowCenter}>
                        <MaterialCommunityIcons
                          name="format-quote-close"
                          size={24}
                          color={Colors.alertCoral}
                          style={styles.quoteIconStack}
                        />
                        <ThemedText weight="semiBold" style={styles.affirmationsTitleStack}>Declarations</ThemedText>
                      </View>
                    </View>
                    <View style={styles.affirmationsListStack}>
                      {(card.affirmations || []).map((affirmation, idx) => (
                        <View
                          key={affirmation.id || idx}
                          style={[
                            styles.affirmationCardStack,
                            idx === (card.affirmations || []).length - 1 && styles.lastAffirmationCardStack,
                          ]}
                        >
                          <View style={styles.affirmationContent}>
                            {Platform.OS === 'ios' ? (
                              <ThemedTextInput
                                weight="medium"
                                value={affirmation.text}
                                editable={false}
                                multiline={true}
                                scrollEnabled={false}
                                style={styles.affirmationText}
                              />
                            ) : (
                              <ThemedText weight="medium" style={styles.affirmationText}>
                                {affirmation.text}
                              </ThemedText>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                    {/* Read Aloud button (stack view) */}
                    {Array.isArray(card.affirmations) && card.affirmations.length > 0 && (
                      <View style={styles.readButtonWrapper}>
                        {affirmationParticles.length > 0 && (
                          <View pointerEvents="none" style={styles.stackReadBurstLayer}>
                            {affirmationParticles.map(p => {
                              const particleTranslateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.dy] });
                              const particleTranslateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
                              const particleScale = p.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] });
                              const particleOpacity = p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });
                              return (
                                <RNAnimated.View
                                  key={p.id}
                                  style={[styles.stackReadParticle, { opacity: particleOpacity, transform: [{ translateX: particleTranslateX }, { translateY: particleTranslateY }, { scale: particleScale }, { rotate: `${p.rotate}deg` }] }]}
                                >
                                  <Ionicons name="book" size={p.size} color={p.color} />
                                </RNAnimated.View>
                              );
                            })}
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            const now = Date.now();
                            if (now - stackReadCooldownRef.current < 800) { return; }
                            stackReadCooldownRef.current = now;

                            if (!playbook?.id) { return; }

                            const nextIsRead = !hasRead;
                            if (nextIsRead) {
                              // celebratory haptics + burst when marking as read (match dashboard declarations)
                              try { triggerSuccessHaptic(); } catch {}
                              startStackReadBurstHaptics();
                              startAffirmationBurst();
                            } else {
                              // subtle haptic when unmarking
                              try { triggerLightHaptic(); } catch {}
                            }

                            setReadAloud(playbook.id, nextIsRead);
                          }}
                          activeOpacity={0.8}
                          style={[styles.readButton, hasRead && styles.readButtonActive]}
                          accessibilityRole="button"
                          accessibilityLabel="I've read this aloud"
                        >
                          <Ionicons name="book-outline" size={16} color={hasRead ? Colors.alertCoral : Colors.hopeWhite} style={styles.readIcon} />
                          <ThemedText weight="semiBold" style={[styles.readButtonText, hasRead && styles.readButtonTextActive]}>I've read this aloud</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );

              case 'bible':
                return (
                  <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                    <BibleVerseCard
                      verse={card.verse || { text: '', reference: '' }}
                      expanded={isExpanded}
                      showCloseButton={false}
                      preferredBibleTranslation={preferredBibleTranslation}
                    />
                  </View>
                );

              case 'challenge':
                return (
                  <View style={[styles.carouselCard, styles.cardContainerLarge]}>
                    <DirectChallengeCard
                      challenge={typeof card.challenge === 'string' ? card.challenge : card.challenge?.text || ''}
                      challengeCTA={card.challengeCTA}
                      style={styles.transparentBackground}
                      expanded={isExpanded}
                      showCloseButton={false}
                    />
                  </View>
                );

              default:
                return null;
            }
          };

          const cardContent = renderCardContent();

          return (
            <RNAnimated.View
              key={card.id}
              style={[
                styles.stackCard,
                styles.stackCardVisible,
                {
                  zIndex: cardZIndex,
                  // Only set height constraints when collapsed, let expanded cards use natural height
                  height: isExpanded ? undefined : STACKED_CARD_HEIGHT,
                  maxHeight: isExpanded ? undefined : STACKED_CARD_HEIGHT,
                  width: STACKED_CARD_WIDTH,
                  transform: [
                    { translateY: animValues.translateY },
                    { scale: animValues.scale },
                  ],
                  opacity: animValues.opacity,
                },
                isExpanded && styles.stackCardExpanded,
              ]}
            >
              {isExpanded ? (
                <>
                  {/* Sticky close button - only visible when expanded */}
                  <View style={styles.stickyCloseButtonContainer}>
                    <TouchableOpacity
                      style={styles.stickyCloseButton}
                      onPress={() => {
                        triggerLightHaptic();
                        setExpandedCardId(null);
                        animateCardTransition(card.id, false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={Colors.hopeWhite}
                        style={styles.closeButtonIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={[
                      styles.expandedScrollView,
                      {
                        width: STACKED_CARD_WIDTH,
                        // Use fixed height for expanded cards to prevent scrolling issues
                        maxHeight: Math.max(600, windowHeight * 1.1),
                      },
                    ]}
                  contentContainerStyle={[
                    styles.expandedScrollContent,
                    // Dynamic padding based on orientation for better scrollability
                    // eslint-disable-next-line react-native/no-inline-styles
                    { paddingBottom: isLandscape ? 400 : 850 },
                  ]}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={false}
                  scrollEnabled={true}
                  onScrollBeginDrag={() => setIsScrolling(true)}
                  onScrollEndDrag={() => {
                    // Add delay to prevent conflicts with tap gestures
                    setTimeout(() => setIsScrolling(false), 50);
                  }}
                >
                  {card.type === 'action' ? (
                    // For action cards, don't wrap in TouchableOpacity - let the card handle collapse via header/close button
                    <View style={styles.flex1}>
                      {cardContent}
                    </View>
                  ) : (
                    // For other cards, keep tap-anywhere-to-collapse behavior
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => {
                        if (!isScrolling) {
                          triggerLightHaptic();
                          setExpandedCardId(null);
                          animateCardTransition(card.id, false);
                        }
                      }}
                      style={styles.flex1}
                    >
                      <View style={styles.flex1}>
                        {cardContent}
                      </View>
                    </TouchableOpacity>
                  )}
                </ScrollView>
                </>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPressIn={() => {
                    // Subtle scale down on press
                    RNAnimated.spring(animValues.scale, {
                      toValue: 0.98,
                      useNativeDriver: true,
                      friction: 10,
                      tension: 100,
                    }).start();
                  }}
                  onPressOut={() => {
                    // Return to normal scale
                    RNAnimated.spring(animValues.scale, {
                      toValue: 1,
                      useNativeDriver: true,
                      friction: 10,
                      tension: 100,
                    }).start();
                  }}
                  onPress={() => {
                    setExpandedCardId(card.id);
                    animateCardTransition(card.id, true);
                  }}
                  style={[
                    styles.collapsedCardTouchable,
                    {
                      width: STACKED_CARD_WIDTH,
                      height: STACKED_CARD_HEIGHT,
                    },
                  ]}
                >
                  {cardContent}
                </TouchableOpacity>
              )}
            </RNAnimated.View>
          );
        })}
      </View>
    );
  };

  // ===== MAIN RENDER =====

  const headerSafeAreaPaddingStyle = useMemo(() => ({
    paddingTop: 8,
  }), []);

  return (
    <View style={styles.container}>
      {/* Status bar handled by useScreenStatusBar */}

      {/* In-screen header (replaces native header). Cards overlay will pass over this. */}
      <View style={[styles.headerSafeArea, headerSafeAreaPaddingStyle]}>
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
            styles={styles}
          />
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
                triggerLightHaptic();
                navigation.goBack();
              } catch (err) {
                Logger.error('Error navigating back', err as Error, { component: 'PlaybookDetailScreenNew' });
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

          {isFromOnboarding && (
            <View style={[styles.bottomButtonContainer, showUserInput && styles.bottomButtonExpanded]}>
              <TouchableOpacity
                style={styles.onboardingContinueButton}
                onPress={() => {
                  triggerLightHaptic();
                  navigation.navigate('MainTabs' as any);
                }}
              >
                <ThemedText weight="semiBold" style={styles.onboardingContinueButtonText}>
                  Start Your Journey
                </ThemedText>
                <Ionicons name="arrow-forward" size={20} color={Colors.hopeWhite} style={styles.arrowIcon} />
              </TouchableOpacity>
            </View>
          )}

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

      {/* Draggable Devotional FAB - positioned at root level outside all scrollable content */}
      {shouldShowFAB && (
        <RNAnimated.View
          style={[
            styles.floatingDevotionalContainer,
            {
              bottom: insets.bottom + 24,
              right: Math.max(20, insets.right + 20),
              transform: [{ translateX: devotionalFabPan.x }, { translateY: devotionalFabPan.y }],
            },
          ]}
          {...devotionalFabPanResponder.panHandlers}
        >
          <RNAnimated.View style={[styles.expandableDevotionalButton, { width: devotionalButtonWidth }]}>
            <TouchableOpacity
              style={styles.expandableDevotionalTouchable}
              onPress={handleCreateDevotional}
              activeOpacity={0.8}
            >
              <View style={styles.devotionalIconContainer}>
                <Image
                  source={require('../../assets/icons/siFiaHeartWhiteTransparent.png')}
                  style={styles.devotionalButtonIcon}
                  resizeMode="contain"
                  accessibilityLabel="siFia"
                />
              </View>
              <RNAnimated.View style={{ opacity: devotionalTextOpacity, width: devotionalTextWidth }}>
                <ThemedText weight="semiBold" style={styles.devotionalExpandText} numberOfLines={1}>
                  Create a Devotional
                </ThemedText>
              </RNAnimated.View>
            </TouchableOpacity>
          </RNAnimated.View>
        </RNAnimated.View>
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
  tabletCardStackContainer: ViewStyle;
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
  // Additional styles used but missing from interface
  cardOverlay: ViewStyle;
  carouselCard: ViewStyle;
  cardContainerLarge: ViewStyle;
  cardContainerMedium: ViewStyle;
  cardContainerMinimal: ViewStyle;
  transparentBackground: ViewStyle;
  affirmationsHeaderStack: ViewStyle;
  quoteIconStack: TextStyle;
  affirmationsTitleStack: TextStyle;
  affirmationsListStack: ViewStyle;
  affirmationCardStack: ViewStyle;
  lastAffirmationCardStack: ViewStyle;
  affirmationContent: ViewStyle;
  affirmationText: TextStyle;
  readButtonWrapper: ViewStyle;
  readButton: ViewStyle;
  readButtonActive: ViewStyle;
  readIcon: TextStyle;
  readButtonText: TextStyle;
  readButtonTextActive: TextStyle;
  stackReadBurstLayer: ViewStyle;
  stackReadParticle: ViewStyle;
  bibleVerseCard: ViewStyle;
  docContentContainerInner: ViewStyle;
  stackedCardsContainer: ViewStyle;
  // Devotional FAB
  floatingDevotionalContainer: ViewStyle;
  expandableDevotionalButton: ViewStyle;
  expandableDevotionalTouchable: ViewStyle;
  devotionalIconContainer: ViewStyle;
  devotionalButtonIcon: ImageStyle;
  devotionalExpandText: TextStyle;
  documentViewContainer: ViewStyle;
  stackCardVisible: ViewStyle;
  expandedScrollView: ViewStyle;
  expandedScrollContent: ViewStyle;
  collapsedCardTouchable: ViewStyle;
  // Inline style replacements
  rowCenter: ViewStyle;
  absoluteTopRight: ViewStyle;
  // Sticky close button styles
  stickyCloseButtonContainer: ViewStyle;
  stickyCloseButton: ViewStyle;
  closeButtonIcon: TextStyle;
  opacity90: ViewStyle;
  flex1: ViewStyle;
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
    maxWidth: 720,
    alignSelf: 'center',
  },
  loadingContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStackContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 20,
    alignItems: 'center',
    minHeight: 600,
  },
  tabletCardStackContainer: {
    paddingHorizontal: 22,
    justifyContent: 'flex-start',
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
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    // Ensure this sits above the full-screen card overlay (which uses zIndex 9999)
    zIndex: 10000,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    position: 'absolute',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  stackCardExpanded: {
    // Let the card expand naturally without fixed height constraints
    height: undefined,
    minHeight: 200, // Ensure minimum visible height
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  stackCardScrollContainer: {
    // maxHeight applied inline
  },
  stackCardScrollBase: {
    alignSelf: 'center',
  },
  stackCardBgCoral: {
    backgroundColor: Colors.alertCoral,
  },
  stackCardBgTransparent: {
    backgroundColor: 'transparent',
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
    justifyContent: 'center',
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
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  docContentContainerInner: {
    maxWidth: 784,
    alignSelf: 'center',
  },
  docCard: {
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 28,
    backgroundColor: '#264674',
    overflow: 'hidden',
    padding: 24,
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
  cardContentContainer: {
    flexGrow: 1,
    // borderRadius and minHeight applied inline
  },
  cardTouchableContainer: {
    backgroundColor: 'transparent',
    // borderRadius, overflow, minHeight applied inline
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
    position: 'relative',
  },
  userInputText: {
    fontFamily: theme.fonts?.regular || 'System',
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    paddingRight: 32,
  },
  editIconButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
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
    marginBottom: 16,
    padding: 24,
  },
  actionCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    marginBottom: 16,
    padding: 24,
  },
  affirmationsCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    marginBottom: 16,
    padding: 24,
  },
  bibleCard: {
    backgroundColor: '#264674',
    borderRadius: 28,
    marginBottom: 16,
    padding: 24,
  },
  challengeCard: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    marginBottom: 0,
    padding: 24,
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
    fontSize: 16,
    fontFamily: theme.fonts?.bold || 'System',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
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
  shareButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 4000,
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
    marginLeft: 0,
    flex: 1,
    paddingHorizontal: 16,
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
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none',
    textAlign: 'left',
  },
  affirmationCardStyle: {
    backgroundColor: '#264674',
  },
  expandedCardPadding: {
    // paddingBottom applied inline based on orientation
  },
  // Styles for individual card components (matching onboarding screen)
  carouselCard: {
    borderRadius: 30,
    minHeight: 400,
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  cardContainerLarge: {
    backgroundColor: '#274674',
    padding: 24,
  },
  cardContainerMedium: {
    backgroundColor: '#274674',
    padding: 24,
  },
  cardContainerMinimal: {
    backgroundColor: '#274674',
    padding: 24,
  },
  // Affirmations styles (stack view)
  affirmationsHeaderStack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  quoteIconStack: {
    marginRight: 8,
    transform: [{ scaleX: -1 }],
    alignSelf: 'center',
  },
  affirmationsTitleStack: {
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 24,
  },
  affirmationsListStack: {
    marginTop: 0,
  },
  affirmationCardStack: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  lastAffirmationCardStack: {
    marginBottom: 4,
  },
  affirmationContent: {
    padding: 14,
  },
  affirmationText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  // Read Aloud button (stack view Affirmations)
  readButtonWrapper: {
    marginTop: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  stackReadBurstLayer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 140,
    height: 120,
  },
  stackReadParticle: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  readIcon: {
    marginRight: 8,
  },
  readButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  readButtonTextActive: {
    color: Colors.alertCoral,
  },
  bibleVerseCard: {
    // No extra styles needed - docCard provides base styling
  },
  // Stacked cards container
  stackedCardsContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    minHeight: 600,
    justifyContent: 'flex-start',
  },
  stackedCardExpanded: {
    position: 'relative',
    width: '100%',
  },
  stickyCloseButtonContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10000,
    elevation: 10000,
  },
  stickyCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonIcon: {
    opacity: 0.9,
  },
  // Devotional FAB styles
  floatingDevotionalContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 10001,
    elevation: 10001,
  },
  expandableDevotionalButton: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'flex-end',
  },
  expandableDevotionalTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    minWidth: 56,
  },
  devotionalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devotionalButtonIcon: {
    width: 40,
    height: 40,
    alignSelf: 'center' as const,
    tintColor: Colors.alertCoral,
  },
  devotionalExpandText: {
    color: Colors.anchorBlue,
    fontSize: 14,
    marginLeft: 8,
    overflow: 'hidden',
  },
  documentViewContainer: {
    paddingHorizontal: 0,
  },
  stackCardVisible: {
    overflow: 'visible',
    borderRadius: 28,
  },
  expandedScrollView: {
    borderRadius: 28,
  },
  expandedScrollContent: {
    flexGrow: 1,
    paddingBottom: 400,
  },
  collapsedCardTouchable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  // Inline style replacements
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absoluteTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    elevation: 10000,
  },
  opacity90: {
    opacity: 0.9,
  },
  flex1: {
    flex: 1,
  },
});

export default withErrorBoundary(PlaybookDetailScreen, 'PlaybookDetailScreen');
