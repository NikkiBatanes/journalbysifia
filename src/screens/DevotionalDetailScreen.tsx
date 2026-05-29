import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  View,
  Animated,
  NativeModules,
  StatusBar,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { runOnJS } from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/types';
import {
  useDevotionalByIdReactQuery,
  useDevotionalOperations,
} from '../services/hooks/useDevotionalDataSimplified';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
// Removed direct TypographyStyles import to ensure fonts are fully themed via ThemedText
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';
import { BibleCopyrightModal } from '../components/BibleCopyrightModal';

import DevotionalCompletionModal from '../components/DevotionalCompletionModal';
import { Colors, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING } from '../theme';
import { extractCleanTitle } from '../utils/titleUtils';
import DevotionalSectionCard from '../components/DevotionalSectionCard';
import { useAllDevotionalPrayerData, useCreateDevotionalPrayer } from '../services/hooks/usePrayerData';
import { toLocalDateString } from '../utils/date';
import { updateDevotionalPrayerPrayed } from '../services/supabaseApiNormalized';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';

type DevotionalDetailScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'DevotionalDetail'>;
  route: RouteProp<RootStackParamList, 'DevotionalDetail'>;
};

import DevotionalDetailReflectionModal from './DevotionalDetailReflectionModal';
import { useJournaledQuestions } from '../hooks/useJournaledQuestions';
import DevotionalDetailSkeleton from '../components/SkeletonLoader/DevotionalDetailSkeleton';
import { pdfExportService } from '../utils/pdfExportService';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Alert } from 'react-native';
import { PDF_EXPORT_UPGRADE_PROMPT } from '../services/tierRestrictionService';
import ShareDropdownModal from '../components/ShareDropdownModal';

const DevotionalDetailScreen: React.FC<DevotionalDetailScreenProps> = ({ route, navigation }) => {

  const { devotionalId, scrollToPrayer, openReflection, reflectionQuestion, reflectionQuestionNumber } = route.params;
  const { user } = useAuth();
  const userId = user?.id;
  // Measured viewport width of the list (works inside modal and with insets)
  const [pageWidth, setPageWidth] = useState<number>(0);

  // Feature access for PDF export
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });

  // Log subscription and export access for Growth trial users
  useEffect(() => {
    if (user?.id) {
      import('../services/NewSubscriptionService').then(({ NewSubscriptionService }) => {
        NewSubscriptionService.getUserSubscription(user.id).then(sub => {
          Logger.info('DevotionalDetail: Subscription Info:', {
            tier: sub.tier,
            trial_chosen_tier: (sub as any).trial_chosen_tier,
            hasExportAccess: pdfExportAccess.hasAccess,
            accessResult: pdfExportAccess.accessResult,
          });
        });
      });
    }
  }, [user?.id, pdfExportAccess.hasAccess, pdfExportAccess.accessResult]);

  // React Query hooks for devotional data
  // Clean and validate devotional ID from route params to avoid simulator-only issues
  const cleanDevotionalId = (devotionalId || '').toString().replace(/\s+/g, '').trim();
  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  useEffect(() => {

  }, [devotionalId, cleanDevotionalId, userId]);

  const { data: devotional, isLoading: devotionalLoading, isFetching: devotionalFetching, error: devotionalError, isError } = useDevotionalByIdReactQuery(userId || '', cleanDevotionalId);
  const { markDayComplete, submitDevotionalRating } = useDevotionalOperations(userId || '');

  useEffect(() => {
    if (!userId || !devotional?.id) {
      return;
    }

    const activity = devotional.completed ? 'devotional_revisited_completed' : 'devotional_opened';

    faithPointsService.hasActivityToday(userId, activity)
      .then(alreadyAwarded => {
        if (alreadyAwarded) {
          return;
        }

        return faithPointsService.awardPoints(userId, activity as any, {
          suppressNotification: true,
          source: 'devotional_open',
          devotionalId: devotional.id,
          devotionalTitle: devotional.title,
          completed: devotional.completed,
        });
      })
      .catch(error => {
        Logger.warn('Failed to award devotional open faith points', {
          component: 'DevotionalDetailScreen',
          error: error as Error,
        });
      });
  }, [userId, devotional?.id, devotional?.completed, devotional?.title]);

  // Cancel queries on unmount to prevent refetch during navigation
  const queryClient = useQueryClient();
  useEffect(() => {
    return () => {
      // Cancel all ongoing queries for this devotional when unmounting
      queryClient.cancelQueries({ queryKey: ['devotionals', 'detail', userId, cleanDevotionalId] });
    };
  }, [queryClient, userId, cleanDevotionalId]);

  // Logging for React Query state - only on mount and error changes
  useEffect(() => {
    if (isError) {

    }
  }, [isError, devotionalError]);

  // React Query hooks for prayer data
  const { data: allDevotionalPrayers = [] } = useAllDevotionalPrayerData(user?.id || '');
  const createDevotionalPrayerMutation = useCreateDevotionalPrayer();

  // Journaled questions tracking
  const {
    isQuestionJournaled,
    getJournaledEntry,
    addJournaledQuestion,
    updateJournaledQuestion,
  } = useJournaledQuestions(userId || '', devotionalId);

  // Calculate initial day index based on first incomplete day
  const getInitialDayIndex = useCallback(() => {
    if (!devotional) {return 0;}
    const firstIncompleteIndex = devotional.days.findIndex(day => !day.completed);
    // If all days are complete, show the last day. Otherwise, show the first incomplete day.
    return firstIncompleteIndex >= 0 ? firstIncompleteIndex : devotional.days.length - 1;
  }, [devotional]);

  const [currentDayIndex, setCurrentDayIndex] = useState(() => getInitialDayIndex());
  const hasInitializedDayIndex = useRef(false); // Track if we've set initial position
  const loading = devotionalLoading || devotionalFetching; // Use React Query loading state
  // State for completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedDayIndex, setCompletedDayIndex] = useState<number | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const modalOpenedRef = useRef(false);
  const lastMarkCompleteRef = useRef<number>(0);
  const [prayedDays, setPrayedDays] = useState<Record<string, boolean>>({});
  // Guard to prevent multiple mark complete executions
  // Reflection modal state
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [selectedReflectionQuestion, setSelectedReflectionQuestion] = useState<string | null>(null);
  const [selectedQuestionMeta, setSelectedQuestionMeta] = useState<{
    dayNumber: number;
    questionNumber: number;
    existingEntry?: any;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRefs = useRef<{[key: number]: ScrollView | null}>({});
  const hasScrolledToPrayerRef = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  // Track last known viewport height for accurate comparisons
  const lastViewportHeightRef = useRef<number>(0);
  const [showFAB, setShowFAB] = useState(false);
  // FAB spring animation
  const fabScaleAnim = useRef(new Animated.Value(0)).current;
  const fabPressScaleAnim = useRef(new Animated.Value(1)).current;
  // Track scroll positions for each day to reset when needed
  const [scrollPositions, setScrollPositions] = useState<{[key: number]: number}>({});
  // Flag to prevent feedback loop between programmatic and user scrolls
  const isScrollingProgrammatically = useRef(false);
  // Track content and viewport heights per day to handle short content cases
  // dayHeights state removed - was defined but never used

  // Bible copyright modal state
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  // Share dropdown modal state
  const [showShareDropdown, setShowShareDropdown] = useState(false);

  const triggerSuccessHaptic = () => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;}
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }

      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('notificationSuccess', {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {
      // silent no-op
    }
  };

  const triggerLightHaptic = () => {
    // Use subtle OS-like selection haptic if native module is linked
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;} // no-op if not linked
      // Respect user preference if available (default: enabled)
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }

      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        // Slightly stronger than 'selection' but still subtle
        triggerFn('impactLight', {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {
      // silent no-op
    }
  };

  const prayCooldownRef = useRef<number>(0);
  const onPrayPress = () => {
    // Block if mutation in-flight or within cooldown window
    const now = Date.now();
    if (createDevotionalPrayerMutation.isPending) {return;}
    if (now - prayCooldownRef.current < 800) {return;}
    prayCooldownRef.current = now;

    // Determine next state to decide if we should animate
    const prayerKey = `${devotional?.id}-${currentDayIndex}`;
    const nextIsPrayed = !prayedDays[prayerKey];

    if (nextIsPrayed) {
      triggerSuccessHaptic();
    } else {
      // Provide a subtle haptic when unmarking
      triggerLightHaptic();
    }
    togglePrayed();
  };

  useEffect(() => {
    // Log for debugging

    // Reset FAB visibility when changing days (will be set by scroll handler)
    setShowFAB(false);

    // Force a re-render of the ScrollView with a reset position
    // This ensures content starts at the top when changing days
    const timer = setTimeout(() => {
      // Update scroll positions to ensure we start at the top for the current day
      setScrollPositions(prev => ({
        ...prev,
        [currentDayIndex]: 0,
      }));
    }, 50);

    return () => clearTimeout(timer);
  }, [currentDayIndex]);

  // Animate FAB entrance with spring when showFAB changes
  useEffect(() => {
    if (showFAB) {
      Animated.spring(fabScaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(fabScaleAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [showFAB, fabScaleAnim]);

  useEffect(() => {
    // Log for debugging

    // Title extraction
    if (devotional?.title) {

    }
  }, [devotional]);

  // No longer needed - devotional comes directly from React Query

  // Sync prayed status with database devotional prayers
  useEffect(() => {
    if (!devotional || !allDevotionalPrayers) {return;}

    const devotionalTitle = extractCleanTitle(devotional.title) || 'Devotional';

    const newPrayedDays: Record<string, boolean> = {};

    // Check each day of the devotional against the database
    devotional.days.forEach((day, index) => {
      const prayerKey = `${devotional.id}-${index}`;

      // Look for this specific day's prayer in the database
      const existingPrayer = allDevotionalPrayers.find((prayer) => {
        const matches = prayer.devotional_title === devotionalTitle &&
                       prayer.day_number === day.dayNumber &&
                       prayer.day_title === day.title;

        if (matches) {

        }

        return matches;
      });

      if (existingPrayer && existingPrayer.prayed === true) {
        newPrayedDays[prayerKey] = true;
      }
    });

    // Only update if we found any prayed days, preserve existing state otherwise
    if (Object.keys(newPrayedDays).length > 0) {

      setPrayedDays(prev => ({ ...prev, ...newPrayedDays }));
    } else {

    }
  }, [devotional, allDevotionalPrayers]);

  // Update day index ONLY on initial mount, preserve user's position on subsequent visits
  useEffect(() => {
    if (devotional && !hasInitializedDayIndex.current) {
      const targetIndex = getInitialDayIndex();
      setCurrentDayIndex(targetIndex);
      hasInitializedDayIndex.current = true; // Mark as initialized
    }
  }, [devotional, getInitialDayIndex]);

  // Scroll to the correct day when currentDayIndex changes
  const scrollToDay = useCallback((index: number) => {
    if (flatListRef.current && devotional) {
      // Always ensure we're using a valid index
      const safeIndex = Math.min(
        Math.max(0, index),
        devotional.days.length - 1
      );

      // Set flag to indicate programmatic scroll
      isScrollingProgrammatically.current = true;

      // Single scroll operation to prevent momentum conflicts
      flatListRef.current.scrollToIndex({
        index: safeIndex,
        animated: false,
        viewPosition: 0.5,
      });

      // Reset flag after scroll completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 100);
    }
  }, [devotional, flatListRef]);

  // Use the callback in the effect, but only when currentDayIndex changes after initial load
  useEffect(() => {
    // Skip the initial render to avoid conflicts with the initial day index setting
    const isInitialRender = currentDayIndex === 0 && devotional?.id;
    if (!isInitialRender) {
      scrollToDay(currentDayIndex);
    }
  }, [currentDayIndex, scrollToDay, devotional?.id]);

  // Scroll to bottom (prayer section) when scrollToPrayer parameter is true
  const handleScrollViewLayout = useCallback((index: number) => {
    if (scrollToPrayer && index === currentDayIndex && !hasScrolledToPrayerRef.current) {
      hasScrolledToPrayerRef.current = true;
      const targetScrollView = scrollViewRefs.current[index];
      if (targetScrollView) {
        // Much longer delay to ensure content is fully rendered and measured
        setTimeout(() => {
          targetScrollView.scrollToEnd({ animated: true });
        }, 1000);
      }
    }
  }, [scrollToPrayer, currentDayIndex]);

  // Auto-open reflection modal when openReflection parameter is true
  useEffect(() => {
    if (openReflection && reflectionQuestion && devotional) {
      const dayNumber = currentDayIndex + 1;
      const questionNumber = reflectionQuestionNumber || 1;
      const existingEntry = getJournaledEntry(dayNumber, questionNumber);

      setSelectedReflectionQuestion(reflectionQuestion);
      setSelectedQuestionMeta({
        dayNumber,
        questionNumber,
        existingEntry,
      });
      setReflectionModalVisible(true);
    }
  }, [openReflection, reflectionQuestion, reflectionQuestionNumber, devotional, currentDayIndex, getJournaledEntry]);

  // Ensure currentDay is always defined in render - memoized to prevent re-renders
  const currentDay = useMemo(() => {
    return devotional?.days?.[currentDayIndex];
  }, [devotional?.days, currentDayIndex]);

  // Memoized scroll handler to prevent unnecessary re-renders
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;

    // Store the latest viewport height for use in other callbacks
    lastViewportHeightRef.current = scrollViewHeight;

    // Early return if current day is completed to avoid unnecessary calculations
    if (!currentDay || currentDay.completed) {
      setShowFAB(false);
      // Update scrollY for any animations (but less frequently)
      scrollY.setValue(offsetY);
      return;
    }

    // Show FAB only when scrolled to bottom for incomplete days
    // If content is shorter than viewport, always show FAB
    if (contentHeight <= scrollViewHeight + 8) {
      setShowFAB(true);
    } else {
      // Otherwise show FAB when near bottom (relaxed threshold to account for padding/bounce)
      const bottomThreshold = 120; // px
      const isAtBottom = offsetY + scrollViewHeight >= contentHeight - bottomThreshold;
      setShowFAB(isAtBottom);
    }

    // Update scrollY for any animations
    scrollY.setValue(offsetY);
  }, [currentDay, scrollY]);

  // Memoized content size change handler
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    // Use the last measured viewport height when available
    const viewportHeight = lastViewportHeightRef.current || Dimensions.get('window').height;

    // If content is shorter than (or nearly equal to) viewport, show FAB immediately
    if (currentDay && !currentDay.completed && contentHeight <= viewportHeight + 16) {
      setShowFAB(true);
    }
  }, [currentDay]);

  // Prepare and debug-format the prayer text for current day
  const rawPrayer = currentDay?.prayer ?? '';
  const formattedPrayer = useMemo(() =>
    rawPrayer
      .replace(/Heavenly Father,\s*/i, 'Heavenly Father,\n\n')
      .replace(/(\n?)(In Jesus'? Name,)\s*(Amen)/i, '\n\n$2\n$3')
  , [rawPrayer]);
  useEffect(() => {
    if (rawPrayer) {
      // Prayer formatting handled by normalizePrayer function

    }
  }, [rawPrayer, formattedPrayer]);

  // Log for prayer data only when currentDay actually changes
  useEffect(() => {
    if (currentDay) {

    }
  }, [currentDay]);

  const handleMarkComplete = async () => {
    const now = Date.now();
    const timeSinceLastMark = now - lastMarkCompleteRef.current;

    if (!devotional || isMarkingComplete || showCompletionModal || modalOpenedRef.current || timeSinceLastMark < 3000) {

      return;
    }

    lastMarkCompleteRef.current = now;

    // Get the current day
    const dayToMark = devotional.days[currentDayIndex];
    if (!dayToMark || dayToMark.completed) {

      return;
    }

    // Set guards to prevent multiple executions
    setIsMarkingComplete(true);
    modalOpenedRef.current = true;

    // Trigger press animation
    Animated.sequence([
      Animated.spring(fabPressScaleAnim, {
        toValue: 0.9,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(fabPressScaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Trigger haptic feedback immediately
    triggerSuccessHaptic();

    // Show modal immediately with animation - this is the ONLY place modal should open
    setCompletedDayIndex(currentDayIndex);
    setShowCompletionModal(true);

    // Perform DB update in background WITHOUT awaiting to prevent blocking
    markDayComplete(devotional.id, dayToMark.dayNumber)
      .then(() => {

      })
      .catch((error) => {
        Logger.error('❌ Error marking day as complete', error as Error, {
      component: 'DevotionalDetailScreen',
    });
        // Reset guards on error
        setIsMarkingComplete(false);
        modalOpenedRef.current = false;
        setShowCompletionModal(false);
      });

    // Reset isMarkingComplete guard after modal is shown, but keep modalOpenedRef
    setTimeout(() => {
      setIsMarkingComplete(false);
    }, 1000);
  };

  // Toggle prayer status for the current day and add to prayed items
  const togglePrayed = useCallback(async () => {
    if (!devotional || !currentDay) {return;}

    const prayerKey = `${devotional.id}-${currentDayIndex}`;
    const isPrayed = !prayedDays[prayerKey];
    const devotionalTitle = extractCleanTitle(devotional.title) || 'Devotional';

    // Update local prayed state
    setPrayedDays(prev => {
      const newState = {
        ...prev,
        [prayerKey]: isPrayed,
      };

      return newState;
    });

    // If marking as prayed, save to database using React Query
    if (isPrayed && currentDay.prayer?.trim() && user) {
      const cleanPrayer = currentDay.prayer.replace(/\*\*/g, '').trim();
      const currentDate = toLocalDateString(new Date());

      // Update prayer_prayed field in user_devotionals table
      if (devotional.id) {
        updateDevotionalPrayerPrayed(devotional.id, true).catch(error => {
          console.warn('Failed to update prayer_prayed in user_devotionals table', error);
        });
      }

      // Save using React Query mutation with optimistic updates
      createDevotionalPrayerMutation.mutate({
        content: cleanPrayer,
        userId: user.id,
        dateStr: currentDate,
        devotionalTitle,
        dayNumber: currentDay.dayNumber,
        dayTitle: currentDay.title,
        totalDays: devotional.totalDays,
      }, {
        onSuccess: () => {

        },
        onError: (error) => {
          Logger.error('❌ Error saving devotional prayer', error as Error, {
      component: 'DevotionalDetailScreen',
    });
          // Revert the local state on error
          setPrayedDays(prev => ({
            ...prev,
            [prayerKey]: false,
          }));
        },
      });

      faithPointsService
        .awardPoints(user.id, 'prayer_devotional_prayed', {
          suppressNotification: true,
          source: 'devotional_prayer',
          devotional_id: devotional.id,
          day_number: currentDay.dayNumber,
          day_title: currentDay.title,
          selected_date: currentDate,
        })
        .catch(error => {
          Logger.warn('[DevotionalDetailScreen] Failed to award devotional prayer faith points', { component: 'DevotionalDetailScreen', data: error });
        });
    }
  }, [devotional, currentDayIndex, currentDay, prayedDays, user, createDevotionalPrayerMutation]);

  const isNavigatingRef = useRef(false);
  const navigationTimersRef = useRef<{
    watchdog?: NodeJS.Timeout;
    delay?: NodeJS.Timeout;
    raf?: number;
  }>({});

  // Cleanup navigation timers on unmount
  useEffect(() => {
    return () => {
      if (navigationTimersRef.current.watchdog) {
        clearTimeout(navigationTimersRef.current.watchdog);
      }
      if (navigationTimersRef.current.delay) {
        clearTimeout(navigationTimersRef.current.delay);
      }
      if (navigationTimersRef.current.raf) {
        cancelAnimationFrame(navigationTimersRef.current.raf);
      }
    };
  }, []);

  const navigateBackSafely = useCallback((reason: string, extraDelay = 0) => {
    if (isNavigatingRef.current) {
      Logger.warn('[DevotionalDetail] Navigation already in progress, skipping duplicate request', {
        component: 'DevotionalDetailScreen',
        reason,
      });
      return;
    }

    // Clear any existing timers first
    if (navigationTimersRef.current.watchdog) {
      clearTimeout(navigationTimersRef.current.watchdog);
    }
    if (navigationTimersRef.current.delay) {
      clearTimeout(navigationTimersRef.current.delay);
    }
    if (navigationTimersRef.current.raf) {
      cancelAnimationFrame(navigationTimersRef.current.raf);
    }

    isNavigatingRef.current = true;
    Logger.debug('[DevotionalDetail] navigateBackSafely scheduled', {
      component: 'DevotionalDetailScreen',
      reason,
      extraDelay,
    });

    const forceNavigate = () => {
      if (!isNavigatingRef.current) {return;} // Already navigated
      const navStartTime = Date.now();
      Logger.debug('[DevotionalDetail] navigateBackSafely executing navigation', {
        component: 'DevotionalDetailScreen',
        reason,
      });
      Logger.debug('[DevotionalDetail] Starting navigation.goBack()', { component: 'DevotionalDetailScreen', navStartTime });
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('Devotionals');
      }
      const navEndTime = Date.now();
      Logger.debug('[DevotionalDetail] navigation.goBack() completed', { component: 'DevotionalDetailScreen', duration: navEndTime - navStartTime });
      isNavigatingRef.current = false;

      // Clear timer refs after navigation
      navigationTimersRef.current = {};
    };

    navigationTimersRef.current.watchdog = setTimeout(() => {
      Logger.warn('[DevotionalDetail] Watchdog forcing navigation to prevent freeze', {
        component: 'DevotionalDetailScreen',
        reason,
      });
      forceNavigate();
    }, 2500);

    navigationTimersRef.current.delay = setTimeout(() => {
      const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: (time?: number) => void) => setTimeout(() => cb(), 16);
      navigationTimersRef.current.raf = raf(() => {
        if (navigationTimersRef.current.watchdog) {
          clearTimeout(navigationTimersRef.current.watchdog);
        }
        forceNavigate();
      }) as any;
    }, extraDelay);
  }, [navigation]);

  // Handle continuing after completion modal
  const handleCompletionContinue = async () => {
    if (!devotional) {
      return;
    }

    // Determine if this is full completion
    const isFullCompletion = currentDayIndex === devotional.days.length - 1;
    const activityType = isFullCompletion ? 'devotional_full_completed' : 'devotional_completed';

    // Check if streak celebration should show
    const shouldShowStreak = userId
      ? await visibleStreakService.shouldShowCelebration(userId, activityType)
      : false;

    if (shouldShowStreak && userId) {
      await visibleStreakService.markShownToday(userId);
      (navigation as any).navigate('StreakPlan', {
        userId,
        source: activityType,
      });
    }

    // Close modal first
    setShowCompletionModal(false);
    setCompletedDayIndex(null);

    // Reset ALL guards
    setIsMarkingComplete(false);
    modalOpenedRef.current = false;
    // Keep timing guard to prevent rapid re-completion

    // If streak celebration should show, navigate to StreakPlan
    if (shouldShowStreak) {
      (navigation as any).navigate('StreakPlan', {
        userId,
        source: activityType,
      });
      return;
    }

    // If we're on the last day, navigate back to previous screen
    if (currentDayIndex === devotional.days.length - 1) {
      // Use simple immediate navigation for all devotionals (including 1-day)
      // The complex navigateBackSafely was causing hangs for 1-day devotionals
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          (navigation as any).navigate('Devotionals');
        }
      }, 300); // Minimal delay for modal animation
      return;
    }

    // Move to next day after a brief delay to allow modal to close
    const nextDayIndex = currentDayIndex + 1;
    setTimeout(() => {
      setCurrentDayIndex(nextDayIndex);

      // Scroll to the next day after another brief delay to allow state to update
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: nextDayIndex,
            animated: true,
          });
        }, 50);
      }
    }, 150);
  };

  // Handle closing the modal by pressing the X button or backdrop
  const handleModalClose = () => {
    // ENTERPRISE-GRADE FIX: Immediately close modal and navigate without waiting for any async operations
    // All background sync operations (DB writes, faith points, invalidations) will complete independently
    setShowCompletionModal(false);
    setCompletedDayIndex(null);
    setIsMarkingComplete(false);
    modalOpenedRef.current = false;
    // Reset timing guard to allow immediate re-marking if needed
    lastMarkCompleteRef.current = 0;

    // Navigate immediately - no delays, no awaits, no blocking operations
    Logger.debug('[DevotionalDetail] Closing modal and requesting immediate navigation', {
      component: 'DevotionalDetailScreen',
    });

    // Use minimal delay to allow modal animation to start, then navigate
    // Don't use InteractionManager as it waits for ALL interactions including React Query
    setTimeout(() => {
      navigateBackSafely('modal-close', 0);
    }, 100);
  };

  // handleModalContinue removed - was defined but never called

  // Handle rating submission
  const handleRatingSubmit = (rating: number) => {
    if (!devotional || completedDayIndex === null) {
      return Promise.resolve();
    }

    // CRITICAL FIX: Don't await anything - pure fire-and-forget
    // Submit rating in background without blocking modal close
    submitDevotionalRating(devotional.id, rating)
      .catch((error) => {
        Logger.error('Error submitting rating', error as Error, {
          component: 'DevotionalDetailScreen',
        });
      });

    // Return immediately resolved promise so modal can close
    return Promise.resolve();
  };

  // Guard: if query is not enabled yet due to missing user or invalid ID, avoid showing Not Found
  const queryEnabled = !!userId && isValidUUID(cleanDevotionalId);

  // Logging only for critical state changes
  useEffect(() => {
    if (devotional) {

    }
  }, [devotional]);

  const renderAndroidRouteSheet = (content: React.ReactElement): React.ReactElement => {
    if (Platform.OS !== 'android') {
      return content;
    }

    return (
      <View style={styles.androidModalRoot}>
        <Pressable style={styles.androidBackdrop} onPress={() => navigation.goBack()} />
        <View style={styles.androidRouteSheet}>
          {content}
        </View>
      </View>
    );
  };

  // Show loading while user or ID validation is pending, or while fetching data
  if (!userId || loading || (queryEnabled && !devotional && !isError)) {
    return renderAndroidRouteSheet(<DevotionalDetailSkeleton />);
  }

  // Only show invalid ID error if we're certain the ID format is wrong
  if (!isValidUUID(cleanDevotionalId)) {
    return renderAndroidRouteSheet(
      <SafeAreaView style={styles.errorContainer}>
        <ThemedText weight="bold" style={styles.errorText}>Invalid devotional link</ThemedText>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Only show "not found" if query is enabled, completed (not loading/fetching), returned no data, AND has actually attempted to fetch
  // Check isError to ensure we've actually tried to fetch and failed, not just returning cached null
  if (queryEnabled && !loading && !devotional && !devotionalFetching && isError) {

    return renderAndroidRouteSheet(
      <SafeAreaView style={styles.errorContainer}>
        <ThemedText weight="bold" style={styles.errorText}>Devotional not found</ThemedText>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // At this point, we know devotional exists (TypeScript guard)
  if (!devotional) {
    return renderAndroidRouteSheet(<DevotionalDetailSkeleton />);
  }

  // Handle swipe down to dismiss
  const panGesture = Gesture.Pan()
    .onStart(() => {
      // Reset any existing animations or states
      'worklet';
    })
    .onUpdate((e) => {
      'worklet';
      // Only track vertical movement with minimal horizontal movement
      if (Math.abs(e.translationX) < 10 && e.translationY > 0) {
        // You could add visual feedback here (e.g., slight background dimming)
      }
    })
    .onEnd((e) => {
      'worklet';
      // Only trigger dismiss if:
      // 1. User swiped down more than 100px
      // 2. OR swiped down more than 50px quickly (velocity > 1000)
      if (e.translationY > 100 || (e.translationY > 50 && e.velocityY > 1000)) {
        runOnJS(navigation.goBack)();
      }
    })
    .minDistance(5) // Small distance to start detecting
    .activeOffsetY([0, 0]); // Allow vertical movement

  const screenContent = (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView
        style={styles.container}
        edges={['top']}
      >
      <StatusBar
        barStyle={Platform.OS === 'android' ? 'light-content' : 'dark-content'}
        backgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
        translucent={Platform.OS === 'android'}
      />

      {/* Floating Action Button - only show when scrolled to bottom and day is not completed */}
      {currentDay && !currentDay.completed && showFAB && (
        <Animated.View
          style={[
            styles.fab,
            {
              transform: [
                { scale: Animated.multiply(fabScaleAnim, fabPressScaleAnim) },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.fabInner}
            onPress={handleMarkComplete}
            activeOpacity={1}
          >
            <Ionicons name="checkmark-sharp" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Devotional Completion Modal */}
      {devotional && (
        <DevotionalCompletionModal
          visible={showCompletionModal}
          devotional={devotional}
          currentDayNumber={(completedDayIndex ?? 0) + 1}
          dayData={currentDay}
          completedDays={(() => {
            // Calculate completed days at the time of marking complete to prevent re-calculations
            const currentCompletedCount = devotional.days.filter(day => day.completed).length;
            const currentDayAlreadyCompleted = devotional.days[(completedDayIndex ?? 0)]?.completed;
            return currentCompletedCount + (currentDayAlreadyCompleted ? 0 : 1);
          })()}
          userId={userId}
          onContinue={handleCompletionContinue}
          onClose={handleModalClose}
          onRatingSubmit={handleRatingSubmit}
          onCheckReveal={() => {
            // Local notification is now shown inside DevotionalCompletionModal for guaranteed layering

          }}
        />
      )}

      {/* Header with gesture detector for swipe-to-dismiss */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <ThemedText
              weight="semiBold"
              style={styles.headerTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {extractCleanTitle(devotional.title, 'Devotional')}
            </ThemedText>
            <View style={styles.dayCounterContainer}>
              <Ionicons name="calendar-clear-outline" size={14} color="rgba(255,255,255,0.65)" />
              <ThemedText weight="medium" style={styles.dayCounterText}>
                Day {currentDayIndex + 1} of {devotional.totalDays}
              </ThemedText>
              {currentDay?.completed && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={Colors.growthGreen}
                  style={styles.completedIcon}
                />
              )}
            </View>
          </View>
          {currentDay && (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}

                setShowShareDropdown(true);
              }}

            >
              <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          )}
        </View>
      </GestureDetector>

      <ShareDropdownModal
        visible={showShareDropdown}
        onClose={() => setShowShareDropdown(false)}
        onExportPDF={() => {
          // Check feature access
          if (!pdfExportAccess.hasAccess) {
            const upgradePrompt = pdfExportAccess.accessResult?.upgradePrompt;
            Alert.alert(
              upgradePrompt?.title || PDF_EXPORT_UPGRADE_PROMPT.title,
              upgradePrompt?.message || PDF_EXPORT_UPGRADE_PROMPT.message,
              [
                { text: 'Maybe Later', style: 'cancel' },
                {
                  text: upgradePrompt?.cta || 'Upgrade Now',
                  onPress: () => {
                    // Navigate to subscription screen with export restriction context
                    navigation.navigate('OnboardingSalesOffer', {
                      source: 'pdf_export_restriction',
                      feature: 'export_pdf',
                      skipNotificationPreference: true,
                    });
                  },
                },
              ]
            );
            return;
          }

          if (currentDay) {
            pdfExportService.exportDevotionalPDF({
              title: devotional.title,
              duration: `${devotional.totalDays}-Day Devotional`,
              dayTitle: currentDay.title,
              dayLabel: `Day ${currentDayIndex + 1} of ${devotional.totalDays}`,
              bibleVerse: currentDay.scripture,
              reflection: currentDay.reflection,
              questionsToPonder: currentDay.reflectionQuestions?.map(q => q.text || '').filter(text => text.trim() !== ''),
              prayer: currentDay.prayer,
              createdAt: devotional.createdAt,
            });
          }
        }}
        playbookTitle={devotional.title}
        shareContext="devotional"
        devotionalShareData={{
          totalDays: devotional.totalDays,
          dayNumber: currentDayIndex + 1,
          title: currentDay?.title || devotional.title,
        }}
      />

      {/* Main content */}
      <View
        style={styles.mainContent}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== pageWidth) {
            setPageWidth(w);
          }
        }}
      >
        {/* Wait for layout to measure exact width */}
        {pageWidth === 0 ? (
          <DevotionalDetailSkeleton />
        ) : (
        <FlatList
          ref={flatListRef}
          data={devotional.days}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, idx) => idx.toString()}
          initialScrollIndex={currentDayIndex}
          key={`devotional-list-${pageWidth}`}
          style={styles.flatListContainer}
          decelerationRate="fast"
          snapToInterval={pageWidth}
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentInset={{ left: 0, right: 0 }}
          // Performance optimizations
          removeClippedSubviews={false}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={50}
          initialNumToRender={1}
          windowSize={3}
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && w !== pageWidth) {setPageWidth(w);}
          }}
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          snapToOffsets={Array.from({ length: devotional.days.length }, (_, i) => i * pageWidth)}
          // Optimized scroll handling
          scrollEventThrottle={32} // Reduced from 16 for better performance
          onMomentumScrollEnd={event => {
            // Skip if this is a programmatic scroll to prevent feedback loop
            if (isScrollingProgrammatically.current) {

              return;
            }

            const newIndex = Math.min(
              Math.round(event.nativeEvent.contentOffset.x / Math.max(1, pageWidth)),
              devotional.days.length - 1
            );
            // Only update if the index actually changed and is within bounds
            if (newIndex !== currentDayIndex && newIndex >= 0 && newIndex < devotional.days.length) {
              setCurrentDayIndex(newIndex);
              // Reset FAB visibility when changing pages
              setShowFAB(false);
            }
          }}
          onScrollBeginDrag={() => {
            // Prevent any potential scroll jank
            return true;
          }}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          renderItem={({ item: day, index }) => (
            <View style={[styles.pageContainer, { width: pageWidth }]}>
              <ScrollView
                ref={(ref) => { scrollViewRefs.current[index] = ref; }}
                onLayout={() => handleScrollViewLayout(index)}
                style={styles.scrollViewContainer}
                contentContainerStyle={styles.scrollViewContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                bounces={false}
                scrollEventThrottle={32}
                onScroll={(event) => {
                  // Only handle scroll for current day to reduce unnecessary calculations
                  if (index === currentDayIndex) {
                    handleScroll(event);
                  }
                }}
                onContentSizeChange={(contentWidth, contentHeight) => {
                  // Only handle content size changes for the current day
                  if (index === currentDayIndex) {
                    handleContentSizeChange(contentWidth, contentHeight);
                  }
                }}
                keyboardShouldPersistTaps="handled"
                // Reset scroll position when this item becomes visible
                contentOffset={{x: 0, y: index === currentDayIndex ? 0 : (scrollPositions[index] || 0)}}
                key={`scroll-${index}-${currentDayIndex === index ? 'active' : 'inactive'}`}
              >
            {/* Day Title - Moved below progress bar */}
            <View style={styles.dayTitleContainer}>
              <ThemedText weight="semiBold" style={styles.dayNumber}>Day {index + 1}</ThemedText>
              <ThemedText
                weight="bold"
                style={styles.dayTitle}
                numberOfLines={0}
              >
                {devotional.totalDays === 1 ? (
                  extractCleanTitle(devotional.title, 'Devotional')
                ) : (
                  day?.title && day.title !== `Day ${index + 1}` ?
                    extractCleanTitle(day.title) :
                    extractCleanTitle(devotional.title, 'Devotional')
                )}
              </ThemedText>
            </View>
            {/* Scripture Card */}
            <DevotionalSectionCard
              icon="book-outline"
              title="Today's Scripture"
              subtitle="Read God's Word"
              variant="tintOnBlue"
            >
              {Platform.OS === 'ios' ? (
                <ThemedTextInput
                  value={day.scripture?.text || ''}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={styles.scriptureText}
                />
              ) : (
                <ThemedText style={styles.scriptureText} selectable={true}>
                  {day.scripture?.text || ''}
                </ThemedText>
              )}
              <View style={styles.scriptureReferenceContainer}>
                <ThemedText weight="bold" style={styles.scriptureReference} selectable={true}>
                  {(day.scripture?.reference || '').toUpperCase()}{day.scripture?.version ? ` ${day.scripture.version}` : ''}
                </ThemedText>
                {day.scripture?.version && (
                  <TouchableOpacity
                    style={styles.infoIcon}
                    onPress={() => {
                      triggerLightHaptic();
                      setShowCopyrightModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={Colors.alertCoral}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </DevotionalSectionCard>

            {/* Reflection Card */}
            <DevotionalSectionCard
              icon="bookmark-outline"
              title="Daily Reflection"
              subtitle="Reflect on this"
              variant="tintOnBlue"
            >
              {Platform.OS === 'ios' ? (
                <ThemedTextInput
                  value={day?.reflection || ''}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={styles.reflectionText}
                />
              ) : (
                <ThemedText style={styles.reflectionText} selectable={true}>
                  {day?.reflection || ''}
                </ThemedText>
              )}
            </DevotionalSectionCard>

            {/* Questions Card */}
            <DevotionalSectionCard
              icon="help-circle-outline"
              title="Questions to Ponder"
              subtitle="Tap a question to journal your thoughts"
              variant="tintOnBlue"
            >
              {day?.reflectionQuestions?.length ? (
                day.reflectionQuestions.map((question: any, idx: number) => {
                  return (
                  <Pressable
                    key={question.id || idx}
                    style={styles.questionCardWrapper}
                    onPress={() => {
                      // Light haptic on question tap
                      triggerLightHaptic();

                      const dayNumber = index + 1;
                      const questionNumber = idx + 1;

                      // Check if this question has already been journaled
                      const existingEntry = getJournaledEntry(dayNumber, questionNumber);

                      setSelectedReflectionQuestion(question.text);
                      setSelectedQuestionMeta({
                        dayNumber,
                        questionNumber,
                        existingEntry,
                      });
                      setReflectionModalVisible(true);
                    }}
                    delayLongPress={300}
                  >
                    <View style={styles.questionCardContainer} collapsable={false}>
                      <View style={[
                        styles.questionCardNumberCircle,
                        isQuestionJournaled(index + 1, idx + 1) && styles.journaledNumberCircle,
                      ]}>
                        <ThemedText weight="bold" style={styles.questionCardNumberText}>
                          {idx + 1}
                        </ThemedText>
                      </View>
                      <View style={styles.questionTextWrapper}>
                        {Platform.OS === 'ios' ? (
                          <ThemedTextInput
                            value={question.text || 'Reflection question'}
                            editable={false}
                            multiline={true}
                            scrollEnabled={false}
                            pointerEvents="none"
                            contextMenuHidden={true}
                            caretHidden={true}
                            style={styles.questionCardTextInput}
                          />
                        ) : (
                          <ThemedText style={styles.questionCardText}>
                            {question.text || 'Reflection question'}
                          </ThemedText>
                        )}
                      </View>
                    </View>
              </Pressable>
                  );
                })
              ) : (
                <ThemedText style={styles.questionCardText}>No questions for today.</ThemedText>
              )}
            </DevotionalSectionCard>

            {/* Prayer Card */}
            <DevotionalSectionCard
              icon="heart-outline"
              title="Prayer"
              subtitle="Connect with God"
              subtitleStyle={{ marginBottom: 0 }}
              variant="tintOnBlue"
            >
              <View style={styles.prayerContainer}>
                {Platform.OS === 'ios' ? (
                  <ThemedTextInput
                    value={rawPrayer && rawPrayer.trim().length > 0
                      ? formattedPrayer
                      : 'No prayer for today.'}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={styles.prayerText}
                  />
                ) : (
                  <ThemedText style={styles.prayerText} selectable={true}>
                    {rawPrayer && rawPrayer.trim().length > 0
                      ? formattedPrayer
                      : 'No prayer for today.'}
                  </ThemedText>
                )}
                <View pointerEvents="box-none" style={styles.prayerButtonWrapper}>
                  <TouchableOpacity
                  style={[
                    styles.prayerButton,
                    prayedDays[`${devotional?.id}-${currentDayIndex}`] && styles.prayerButtonActive,
                  ]}
                  onPress={onPrayPress}
                >
                  <MaterialCommunityIcons
                    name="hands-pray"
                    size={18}
                    color={prayedDays[`${devotional?.id}-${currentDayIndex}`] ? Colors.alertCoral : Colors.hopeWhite}
                  />
                  <ThemedText weight="medium" style={[
                    styles.prayerButtonText,
                    prayedDays[`${devotional?.id}-${currentDayIndex}`] && styles.prayerButtonTextActive,
                  ]}>
                    {prayedDays[`${devotional?.id}-${currentDayIndex}`] ? 'Prayed' : 'I prayed this'}
                  </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </DevotionalSectionCard>
              </ScrollView>
            </View>
          )}
          />
        )}
        {/* Visual indicator for swipe down to dismiss */}
        <View style={styles.swipeIndicatorContainer}>
          <View style={styles.swipeIndicator} />
        </View>

        {/* Devotional Detail Reflection Modal */}
        <DevotionalDetailReflectionModal
          visible={reflectionModalVisible}
          question={selectedReflectionQuestion || ''}
          devotionalId={devotionalId}
          dayNumber={selectedQuestionMeta?.dayNumber || currentDayIndex + 1}
          dayTitle={currentDay?.title}
          devotionalTitle={devotional.title}
          totalDays={devotional.totalDays}
          questionNumber={selectedQuestionMeta?.questionNumber || 1}
          existingEntry={selectedQuestionMeta?.existingEntry}
          devotionalDayCompleted={prayedDays[`${devotionalId}-${currentDayIndex}`] === true}
          onSave={(entry) => {
            try {

              // Update the journaled questions tracking
              if (selectedQuestionMeta?.existingEntry) {
                updateJournaledQuestion(entry);
              } else {
                addJournaledQuestion(entry);
              }
              // Note: We don't close the modal here to allow the success modal to show
              // The modal will be closed when the user clicks Done in the success modal
            } catch (error) {
              Logger.error('Error handling saved reflection', error as Error, {
      component: 'DevotionalDetailScreen',
    });
            }
          }}
          onCancel={() => {
            setReflectionModalVisible(false);
            setSelectedReflectionQuestion(null);
            setSelectedQuestionMeta(null);
          }}
        />

        {/* Bible Copyright Modal */}
        <BibleCopyrightModal
          visible={showCopyrightModal}
          onClose={() => setShowCopyrightModal(false)}
          bibleVersion={currentDay?.scripture?.version || 'NASB'}
        />
      </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );

  return renderAndroidRouteSheet(screenContent);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  androidModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  androidBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  androidRouteSheet: {
    flex: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    height: '92%',
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 50, // Add padding to prevent overlap with share button
  },
  exportButton: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.anchorBlue,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.alertCoral,
    marginBottom: 20,
    textAlign: 'center',
  },

  headerTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  dayCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16, // Increased to provide more space before day title
    backgroundColor: Colors.hopeWhite,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  progressWrapper: {
    flex: 1,
    marginRight: 8, // Reduced from 12 to bring text closer
    minWidth: 250,
  },
  barBg: {
    width: '100%',
    height: 8, // Match Playbook height
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  progressTextContainer: {
    width: 60,
    alignItems: 'flex-end',
    marginLeft: 0, // Changed from 'auto' to remove extra space
  },
  progressText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.anchorBlue,
    marginRight: 4,
    textAlign: 'right',
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },
  backButtonText: {
    color: Colors.anchorBlue,
    fontSize: 16,
  },

  headerSpacer: {
    width: 40,
    zIndex: 1,
  },
  calendarIcon: {
    marginRight: 4,
  },
  dayCounterText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginLeft: 4,
    marginRight: 4,
  },
  completedIcon: {
    marginLeft: 4,
  },

  dayTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 10,
    alignItems: 'flex-start',
    width: '100%', // Ensure full width for proper wrapping
  },
  dayNumber: {
    fontSize: 14,
    color: Colors.faithGold,
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 22,
    color: Colors.hopeWhite,
    lineHeight: 28,
    flexWrap: 'wrap',
    flexShrink: 1,
    width: '100%', // Ensure full width for proper wrapping
  },
  scrollView: {
    flex: 1,
    paddingTop: 60, // Add top padding to account for absolute header
  },
  contentContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 16, // Further increased to prevent day title from being cut off
    paddingBottom: 80,
  },
  scrollViewContent: {
    paddingBottom: 70, // Add padding to bottom to prevent FAB overlap
    paddingTop: 80, // Set scrollable padding to 60px
  },
  reflectionContainer: {
    marginBottom: 24,
    padding: CARD_CONTENT_PADDING,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.anchorBlue,
    marginBottom: 12,
  },
  reflectionText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  questionsContainer: {
    marginBottom: 24,
    // No background or padding here so QuestionCard stands out
  },
  questionCardWrapper: {
    width: '100%',
    marginBottom: 12,        // space between questions
  },
  questionCardContainer: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    overflow: 'visible',
    paddingLeft: 52, // Space for the number circle
    paddingRight: 20,
  },
  questionTextWrapper: {
    flex: 1,
    minHeight: 24,
  },
  questionCardNumberCircle: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journaledNumberCircle: {
    backgroundColor: Colors.growthGreen,
  },
  questionCardNumberText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    lineHeight: 18,
  },
  questionCardText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    flexShrink: 1,
    flexGrow: 1,
  },
  questionCardTextInput: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    padding: 0,
    margin: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -25, // Half of the width to center it perfectly
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.growthGreen,
    justifyContent: 'center',
    alignItems: 'center',
    // Remove shadows and elevation for flat, modern appearance
    elevation: 0,
    zIndex: 100,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeIndicatorContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 10,
  },
  prayerContainer: {
    marginTop: 0,
    position: 'relative',
    paddingBottom: 96, // Reserve more space so content doesn't overlap the button
    padding: CARD_CONTENT_PADDING,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
  },
  prayerButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  prayerButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  prayerButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  prayerButtonTextActive: {
    color: Colors.alertCoral,
  },
  prayerIcon: {
    marginRight: 0,
  },
  prayerButtonWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  prayerText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(0, 128, 0, 0.1)',
    borderRadius: 12,
  },
  completedText: {
    marginLeft: 8,
    color: Colors.growthGreen,
  },
  scriptureText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
  },
  scriptureReference: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    textAlign: 'right',
    opacity: 0.9,
  },
  scriptureReferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingBottom: 10,
  },
  bibleVersion: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    fontWeight: '700',
    opacity: 1,
  },
  infoIcon: {
    marginLeft: 6,
    padding: 2,
  },
  dayNavigation: {
    position: 'absolute',
    marginHorizontal: 8,
  },
  dayIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingVertical: 4,
  },
  dayIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  gestureRoot: {
    flex: 1,
  },
  flatListContainer: {
    width: '100%',
  },
  pageContainer: {
    height: '100%',
  },
  scrollViewContainer: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    // Remove overflow: 'hidden' to prevent text clipping in question cards
  },
  journaledQuestionNumber: {
    backgroundColor: Colors.growthGreen,
    color: Colors.hopeWhite,
  },
  dayContent: {
    flex: 1,
  },
  dayContentInactive: {
    opacity: 0.6,
  },
});

export default withErrorBoundary(DevotionalDetailScreen, 'DevotionalDetailScreen');
