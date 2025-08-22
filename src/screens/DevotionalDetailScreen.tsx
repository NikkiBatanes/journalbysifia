import React, { useEffect, useState, useRef, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  ScrollView,
  Vibration,
  Easing,
  Platform,
  Linking,
  Alert,
  NativeModules,
} from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { runOnJS } from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/types';
import {
  useDevotionalByIdReactQuery,
  useDevotionalOperations,
} from '../services/hooks/useDevotionalDataSimplified';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Typography as TypographyStyles } from '../theme/typography';
import { faithPointsService } from '../services/faithPointsService';
import { subscriptionService } from '../services/subscriptionService';

import DevotionalCompletionModal from '../components/DevotionalCompletionModal';
import { Colors, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING } from '../theme';
import { extractCleanTitle } from '../utils/titleUtils';
import DevotionalSectionCard from '../components/DevotionalSectionCard';
import { useAllDevotionalPrayerData, useCreateDevotionalPrayer } from '../services/hooks/usePrayerData';
import { toLocalDateString } from '../utils/date';

type DevotionalDetailScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'DevotionalDetail'>;
  route: RouteProp<RootStackParamList, 'DevotionalDetail'>;
};

import DevotionalDetailReflectionModal from './DevotionalDetailReflectionModal';
import { useJournaledQuestions } from '../hooks/useJournaledQuestions';

export default function DevotionalDetailScreen({ route, navigation }: DevotionalDetailScreenProps) {

  const { devotionalId } = route.params;
  const { user } = useAuth();
  const userId = user?.id;

  // React Query hooks for devotional data
  const { data: devotional, isLoading: devotionalLoading } = useDevotionalByIdReactQuery(userId || '', devotionalId);
  const { markDayComplete, submitDevotionalRating } = useDevotionalOperations(userId || '');

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
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const loading = devotionalLoading; // Use React Query loading state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  // Store the index of the completed day for modal display
  const [completedDayIndex, setCompletedDayIndex] = useState<number | null>(null);
  const [prayedDays, setPrayedDays] = useState<Record<string, boolean>>({});
  // Reflection modal state
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [selectedReflectionQuestion, setSelectedReflectionQuestion] = useState<string | null>(null);
  const [selectedQuestionMeta, setSelectedQuestionMeta] = useState<{
    dayNumber: number;
    questionNumber: number;
    existingEntry?: any;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showFAB, setShowFAB] = useState(false);
  // Track scroll positions for each day to reset when needed
  const [scrollPositions, setScrollPositions] = useState<{[key: number]: number}>({});
  // Flag to prevent feedback loop between programmatic and user scrolls
  const isScrollingProgrammatically = useRef(false);

  // Heart burst animation state near the Pray button
  type HeartParticle = {
    id: number;
    progress: Animated.Value; // 0 -> 1
    dx: number; // horizontal drift
    dy: number; // vertical height
    size: number; // icon size
    rotate: number; // degrees
    color: string;
    delay: number;
  };

  const triggerSuccessHaptic = () => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return;
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  const prayerHapticTimersRef = useRef<number[]>([]);
  const startPrayerBurstHaptics = () => {
    try {
      // Clear any existing timers first
      prayerHapticTimersRef.current.forEach(id => clearTimeout(id));
      prayerHapticTimersRef.current = [];
      // Mirror the 4-pulse timing used elsewhere
      const schedule = [0, 250, 500, 750];
      schedule.forEach(delay => {
        const id = setTimeout(() => {
          try {
            const { RNHapticFeedback } = NativeModules as any;
            if (!RNHapticFeedback) return;
            const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
            if (hapticsPref === false) { return; }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Haptic = require('react-native-haptic-feedback');
            const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
            if (typeof triggerFn === 'function') {
              triggerFn('impactLight', {
                enableVibrateFallback: false,
                ignoreAndroidSystemSettings: false,
              });
            }
          } catch {}
        }, delay) as unknown as number;
        prayerHapticTimersRef.current.push(id);
      });
    } catch {
      // silent no-op
    }
  };
  const [heartParticles, setHeartParticles] = useState<HeartParticle[]>([]);
  const heartIdRef = useRef(0);

  const triggerLightHaptic = () => {
    // Use subtle OS-like selection haptic if native module is linked
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) return; // no-op if not linked
      // Respect user preference if available (default: enabled)
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  const startHeartBurst = () => {
    const NUM = 10;
    const colors = [Colors.alertCoral, '#ff7a7a', '#ff9aa2', '#ff6b6b'];
    const newParticles: HeartParticle[] = Array.from({ length: NUM }).map((_, i) => {
      const id = heartIdRef.current++;
      return {
        id,
        progress: new Animated.Value(0),
        dx: (Math.random() * 80 - 40), // -40..40
        dy: 70 + Math.random() * 70, // 70..140 upward
        size: 12 + Math.random() * 10, // 12..22
        rotate: Math.random() * 60 - 30, // -30..30 deg
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 35, // stagger
      };
    });

    setHeartParticles(prev => [...prev, ...newParticles]);

    // Kick off animations
    newParticles.forEach((p) => {
      Animated.timing(p.progress, {
        toValue: 1,
        duration: 900,
        delay: p.delay,
        useNativeDriver: true,
      }).start();
    });

    // Cleanup after the longest animation
    setTimeout(() => {
      setHeartParticles(prev => prev.filter(h => !newParticles.find(n => n.id === h.id)));
    }, 1200);
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
      // Match the celebratory pattern: success + 4 light pulses
      triggerSuccessHaptic();
      startPrayerBurstHaptics();
      startHeartBurst();
    } else {
      // Provide a subtle haptic when unmarking
      triggerLightHaptic();
    }
    togglePrayed();
  };

  useEffect(() => {
    // Log for debugging
    console.log('Current day index:', currentDayIndex);

    // Reset FAB visibility when changing days
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

  useEffect(() => {
    // Log for debugging
    console.log('Devotional:', devotional);

    // Debug title extraction
    if (devotional?.title) {
      console.log('Title extraction debug:', {
        originalTitle: devotional.title,
        extractedTitle: extractCleanTitle(devotional.title),
        devotionalId: devotional.id,
      });
    }
  }, [devotional]);

  // No longer needed - devotional comes directly from React Query

  // Sync prayed status with database devotional prayers
  useEffect(() => {
    if (!devotional || !allDevotionalPrayers) {return;}

    const devotionalTitle = extractCleanTitle(devotional.title) || 'Devotional';
    console.log('🔍 Syncing prayed status for:', devotionalTitle);
    console.log('📊 Available devotional prayers:', allDevotionalPrayers.length);

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
          console.log(`✅ Found match for Day ${day.dayNumber}:`, {
            dbTitle: prayer.devotional_title,
            expectedTitle: devotionalTitle,
            dbDayNumber: prayer.day_number,
            expectedDayNumber: day.dayNumber,
            dbDayTitle: prayer.day_title,
            expectedDayTitle: day.title,
          });
        }

        return matches;
      });

      if (existingPrayer) {
        newPrayedDays[prayerKey] = true;
      }
    });

    // Only update if we found any prayed days, preserve existing state otherwise
    if (Object.keys(newPrayedDays).length > 0) {
      console.log('📝 Updating prayed status:', newPrayedDays);
      setPrayedDays(prev => ({ ...prev, ...newPrayedDays }));
    } else {
      console.log('ℹ️ No devotional prayers found in database, preserving current state');
    }
  }, [devotional, allDevotionalPrayers]);

  // Set initial day index from route params or devotional context
  useEffect(() => {
    if (devotional) {
      // Check if this is a newly created devotional (all days are incomplete)
      const isNewDevotional = devotional.days.every(day => !day.completed);

      if (isNewDevotional) {
        // For newly created devotionals, always start with day 1 (index 0)
        setCurrentDayIndex(0);

        // Force scroll to day 1 after a short delay
        setTimeout(() => {
          if (flatListRef.current) {
            isScrollingProgrammatically.current = true;
            flatListRef.current.scrollToIndex({
              index: 0,
              animated: false,
            });
            setTimeout(() => {
              isScrollingProgrammatically.current = false;
            }, 100);
          }
        }, 100);
      } else {
        // For existing devotionals, find the first incomplete day
        const firstIncompleteIndex = devotional.days.findIndex(day => !day.completed);
        const targetIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;

        setCurrentDayIndex(targetIndex);

        // Scroll to the target day
        setTimeout(() => {
          if (flatListRef.current) {
            isScrollingProgrammatically.current = true;
            flatListRef.current.scrollToIndex({
              index: targetIndex,
              animated: false,
            });
            setTimeout(() => {
              isScrollingProgrammatically.current = false;
            }, 100);
          }
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devotional?.id]); // Only run when devotional id changes (first load)

  // Scroll to the correct day when currentDayIndex changes
  const scrollToDay = useCallback((index: number) => {
    if (flatListRef.current && devotional) {
      // Always ensure we're using a valid index
      const safeIndex = Math.min(Math.max(0, index), devotional.days.length - 1);

      console.log('Scrolling to day:', safeIndex + 1); // Debug log

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

  // Ensure currentDay is always defined in render
  const currentDay = devotional?.days?.[currentDayIndex];
  // Debug log for prayer data
  console.log('DevotionalDetailScreen currentDay:', currentDay);
  console.log('DevotionalDetailScreen prayer:', currentDay?.prayer);

  const handleMarkComplete = async () => {
    if (!devotional) {
      return;
    }
    
    // Trigger haptic feedback and open modal immediately for responsiveness
    triggerLightHaptic();

    // Get the current day
    const dayToMark = devotional.days[currentDayIndex];
    if (!dayToMark) {
      return;
    }

    // Show modal right away to reduce perceived delay
    setCompletedDayIndex(currentDayIndex);
    setShowCompletionModal(true);

    // Perform DB update in background
    markDayComplete(devotional.id, dayToMark.dayNumber)
      .then((success) => {
        if (!success) {
          console.error('Failed to mark day as complete');
        }
      })
      .catch((error) => {
        console.error('Error marking day as complete:', error);
      });
  };

  // Toggle prayer status for the current day and add to prayed items
  const togglePrayed = useCallback(async () => {
    if (!devotional || !currentDay) {return;}

    const prayerKey = `${devotional.id}-${currentDayIndex}`;
    const isPrayed = !prayedDays[prayerKey];
    const devotionalTitle = extractCleanTitle(devotional.title) || 'Devotional';

    console.log('🔄 Toggling prayer status:', {
      prayerKey,
      isPrayed,
      devotionalTitle,
      dayNumber: currentDay.dayNumber,
      dayTitle: currentDay.title,
    });

    // Update local prayed state
    setPrayedDays(prev => {
      const newState = {
        ...prev,
        [prayerKey]: isPrayed,
      };
      console.log('📝 Updated prayedDays state:', newState);
      return newState;
    });

    // If marking as prayed, save to database using React Query
    if (isPrayed && currentDay.prayer?.trim() && user) {
      const cleanPrayer = currentDay.prayer.replace(/\*\*/g, '').trim();
      const currentDate = toLocalDateString(new Date());

      console.log('💾 Saving prayer to database:', {
        devotionalTitle,
        dayNumber: currentDay.dayNumber,
        dayTitle: currentDay.title,
        contentLength: cleanPrayer.length,
        date: currentDate,
      });

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
          console.log('✅ Devotional prayer saved successfully');
        },
        onError: (error) => {
          console.error('❌ Error saving devotional prayer:', error);
          // Revert the local state on error
          setPrayedDays(prev => ({
            ...prev,
            [prayerKey]: false,
          }));
        },
      });
    }
  }, [devotional, currentDayIndex, currentDay, prayedDays, user, createDevotionalPrayerMutation]);

  // Handle continuing after completion modal
  const handleCompletionContinue = () => {
    if (!devotional) {return;}

    // If we're on the last day, close the modal and return to the list
    if (currentDayIndex === devotional.days.length - 1) {
      setShowCompletionModal(false);
      setCompletedDayIndex(null);
      return;
    }

    const nextDayIndex = currentDayIndex + 1;
    if (nextDayIndex < devotional.days.length) {
      // Reset the FAB visibility when moving to the next day
      setShowFAB(false);
      setCurrentDayIndex(nextDayIndex);

      // Scroll to the next day after state updates
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: nextDayIndex,
          animated: true,
        });
      }, 100);
    }
    setShowCompletionModal(false);
    setCompletedDayIndex(null);
  };

  // Handle closing the modal by pressing the X button or backdrop
  const handleModalClose = () => {
    setShowCompletionModal(false);
    navigation.goBack();
  };

  // Handle rating submission
  const handleRatingSubmit = async (rating: number) => {
    if (!devotional || completedDayIndex === null) {
      return;
    }

    try {
      // Submit the rating
      await submitDevotionalRating(devotional.id, rating);

      // Award faith points and track usage for completing devotional (delayed to show after modal closes)
      if (user?.id) {
        setTimeout(async () => {
          try {
            // Award faith points
            const pointsResult = await faithPointsService.awardPoints(user.id, 'devotional_generated');
            console.log('[DevotionalDetail] Faith points awarded for devotional completion:', pointsResult);

            // Track usage for subscription
            await subscriptionService.trackUsage(user.id, 'devotional');
            console.log('[DevotionalDetail] Usage tracked for devotional completion');
          } catch (error) {
            console.error('[DevotionalDetail] Failed to award points or track usage:', error);
          }
        }, 1000); // Delay 1 second to let modal close
      }

      // React Query handles optimistic updates automatically
      // No need to update local state
    } catch (error) {
      console.error('Error submitting rating:', error);
      // Don't close the modal on error - let the user try again
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
        <Text style={styles.loadingText}>Loading devotional...</Text>
      </SafeAreaView>
    );
  }

  if (!devotional) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Devotional not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;

    // Show FAB only when scrolled to bottom, regardless of day completion status
    const isAtBottom = offsetY + scrollViewHeight >= contentHeight - 20;
    setShowFAB(isAtBottom);

    // Update scrollY for any animations
    scrollY.setValue(offsetY);
  };

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

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView
        style={styles.container}
        edges={['right', 'left']}
      >
      <StatusBar barStyle="dark-content" />

      {/* Floating Action Button - only show when scrolled to bottom and day is not completed */}
      {currentDay && !currentDay.completed && showFAB && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleMarkComplete}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-sharp" size={32} color={Colors.hopeWhite} />
        </TouchableOpacity>
      )}

      {/* Devotional Completion Modal */}
      {devotional && (
        <DevotionalCompletionModal
          visible={showCompletionModal}
          devotional={devotional}
          currentDayNumber={(completedDayIndex ?? 0) + 1}
          completedDays={
            devotional.days.filter(day => day.completed).length +
            (devotional.days[(completedDayIndex ?? 0)]?.completed ? 0 : 1)
          }
          onContinue={handleCompletionContinue}
          onClose={handleModalClose}
          onRatingSubmit={handleRatingSubmit}
        />
      )}

      {/* Header with gesture detector for swipe-to-dismiss */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {extractCleanTitle(devotional.title, 'Devotional')}
          </Text>
          <View style={styles.dayCounterContainer}>
            <Ionicons name="calendar-clear-outline" size={14} color={Colors.anchorBlue} />
            <Text style={styles.dayCounterText}>
              Day {currentDayIndex + 1} of {devotional.totalDays}
            </Text>
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
      </GestureDetector>

      {/* Main content */}
      <View style={styles.mainContent}>
        <FlatList
          ref={flatListRef}
          data={devotional.days}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, idx) => idx.toString()}
          initialScrollIndex={0}
          initialNumToRender={devotional.days.length}
          maxToRenderPerBatch={devotional.days.length}
          windowSize={devotional.days.length}
          getItemLayout={(_, index) => ({
            length: Dimensions.get('window').width,
            offset: Dimensions.get('window').width * index,
            index,
          })}
          onMomentumScrollEnd={event => {
            // Skip if this is a programmatic scroll to prevent feedback loop
            if (isScrollingProgrammatically.current) {
              console.log('Skipping momentum scroll - programmatic scroll in progress');
              return;
            }

            const newIndex = Math.min(
              Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width),
              devotional.days.length - 1
            );
            // Only update if the index actually changed and is within bounds
            if (newIndex !== currentDayIndex && newIndex >= 0 && newIndex < devotional.days.length) {
              console.log('User scroll ended at day:', newIndex + 1); // Debug log
              setCurrentDayIndex(newIndex);
              // Reset FAB visibility when changing pages
              setShowFAB(false);
            }
          }}
          onScrollBeginDrag={() => {
            // Prevent any potential scroll jank
            return true;
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          renderItem={({ item: day, index }) => (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              onScroll={(event) => {
                // Reset scroll position when changing pages
                if (index === currentDayIndex) {
                  handleScroll(event);
                }
              }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              // Reset scroll position when this item becomes visible
              contentOffset={{x: 0, y: index === currentDayIndex ? 0 : (scrollPositions[index] || 0)}}
              key={`scroll-${index}-${currentDayIndex === index ? 'active' : 'inactive'}`}
            >
            {/* Day Title - Moved below progress bar */}
            <View style={styles.dayTitleContainer}>
              <Text style={styles.dayNumber}>Day {index + 1}</Text>
              <Text style={styles.dayTitle} numberOfLines={2} ellipsizeMode="tail">
                {devotional.totalDays === 1 ? (
                  extractCleanTitle(devotional.title, 'Devotional')
                ) : (
                  day?.title && day.title !== `Day ${index + 1}` ?
                    extractCleanTitle(day.title) :
                    extractCleanTitle(devotional.title, 'Devotional')
                )}
              </Text>
            </View>
            {/* Scripture Card */}
            <DevotionalSectionCard
              icon="book-outline"
              title="Today's Scripture"
              subtitle="God's Word for today"
            >
              <Text style={styles.scriptureText}>
                {day.scripture?.text || ''}
              </Text>
              <Text style={styles.scriptureReference}>
                - {day.scripture?.reference || ''}
              </Text>
            </DevotionalSectionCard>

            {/* Reflection Card */}
            <DevotionalSectionCard
              icon="bookmark-outline"
              title="Daily Reflection"
              subtitle="Meditate on this"
            >
              <Text style={styles.reflectionText}>
                {day?.reflection || ''}
              </Text>
            </DevotionalSectionCard>

            {/* Questions Card */}
            <DevotionalSectionCard
              icon="help-circle-outline"
              title="Questions to Ponder"
              subtitle="Reflect deeply"
            >
              {day?.reflectionQuestions?.length ? (
                day.reflectionQuestions.map((question: any, idx: number) => (
                  <TouchableOpacity
                    key={question.id || idx}
                    style={styles.questionCardWrapper}
                    activeOpacity={0.8}
                    onPress={() => {
                      // Light haptic on question tap
                      triggerLightHaptic();
                      
                      const dayNumber = index + 1;
                      const questionNumber = idx + 1;
                      
                      // Check if this question has already been journaled
                      const existingEntry = getJournaledEntry(dayNumber, questionNumber);
                      
                      console.log('🔍 Question tapped - Debug info:', {
                        dayNumber,
                        questionNumber,
                        devotionalId,
                        existingEntry: existingEntry ? {
                          id: existingEntry.id,
                          title: existingEntry.title,
                          content: existingEntry.content?.substring(0, 50) + '...',
                          devotional_id: existingEntry.devotional_id,
                          day_number: existingEntry.day_number,
                          question_number: existingEntry.question_number,
                        } : null,
                      });
                      
                      setSelectedReflectionQuestion(question.text);
                      setSelectedQuestionMeta({
                        dayNumber,
                        questionNumber,
                        existingEntry,
                      });
                      setReflectionModalVisible(true);
                    }}
                  >
                    <View style={styles.questionCardContainer}>
                      <Text style={[
                        styles.questionCardNumber,
                        isQuestionJournaled(index + 1, idx + 1) && styles.journaledQuestionNumber
                      ]}>{idx + 1}</Text>
                      <Text style={styles.questionCardText}>
                        {question.text || 'Reflection question'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.questionCardText}>No questions for today.</Text>
              )}
            </DevotionalSectionCard>

            {/* Prayer Card */}
            <DevotionalSectionCard
              icon="heart-outline"
              title="Prayer"
              subtitle="Connect with God"
            >
              <View style={styles.prayerContainer}>
                <Text style={styles.prayerText}>
                  {day.prayer && day.prayer.trim().length > 0
                    ? day.prayer.replace(/\*\*/g, '').replace(/\n/g, '\n\n')
                    : 'No prayer for today.'}
                </Text>
                <View pointerEvents="box-none" style={styles.prayerButtonWrapper}>
                  {/* Heart burst layer above the button, anchored near its position */}
                  {heartParticles.length > 0 && (
                    <View pointerEvents="none" style={styles.prayerBurstLayer}>
                      {heartParticles.map((p) => {
                        const translateY = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -p.dy],
                        });
                        const translateX = p.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, p.dx],
                        });
                        const scale = p.progress.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0.4, 1.1, 0.8],
                        });
                        const opacity = p.progress.interpolate({
                          inputRange: [0, 0.7, 1],
                          outputRange: [0, 1, 0],
                        });
                        return (
                          <Animated.View
                            key={p.id}
                            style={[
                              styles.heartParticle,
                              {
                                opacity,
                                transform: [
                                  { translateX },
                                  { translateY },
                                  { scale },
                                  { rotate: `${p.rotate}deg` },
                                ],
                              },
                            ]}
                          >
                            <MaterialCommunityIcons name="hands-pray" size={p.size} color={p.color} />
                          </Animated.View>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                  style={[
                    styles.prayerButton,
                    prayedDays[`${devotional?.id}-${currentDayIndex}`] && styles.prayerButtonActive,
                    createDevotionalPrayerMutation.isPending && { opacity: 0.6 },
                  ]}
                  onPress={onPrayPress}
                  disabled={createDevotionalPrayerMutation.isPending}
                >
                  <MaterialCommunityIcons
                    name="hands-pray"
                    size={20}
                    color={prayedDays[`${devotional?.id}-${currentDayIndex}`] ? Colors.alertCoral : Colors.hopeWhite}
                    style={styles.prayerIcon}
                  />
                  <Text style={[
                    styles.prayerButtonText,
                    prayedDays[`${devotional?.id}-${currentDayIndex}`] && styles.prayerButtonTextActive,
                  ]}>
                    {prayedDays[`${devotional?.id}-${currentDayIndex}`] ? ' Prayed' : ' Pray'}
                  </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </DevotionalSectionCard>
            </ScrollView>
          )}
          />
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
          onSave={(entry) => {
            try {
              console.log('Reflection saved:', entry);
              // Update the journaled questions tracking
              if (selectedQuestionMeta?.existingEntry) {
                updateJournaledQuestion(entry);
              } else {
                addJournaledQuestion(entry);
              }
              // Note: We don't close the modal here to allow the success modal to show
              // The modal will be closed when the user clicks Done in the success modal
            } catch (error) {
              console.error('Error handling saved reflection:', error);
            }
          }}
          onCancel={() => {
            setReflectionModalVisible(false);
            setSelectedReflectionQuestion(null);
            setSelectedQuestionMeta(null);
          }}
        />
      </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.hopeWhite,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
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
    fontWeight: '500',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 4,
  },
  dayCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
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
    fontFamily: 'System',
    fontWeight: '500',
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
    fontWeight: '600',
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
    color: Colors.anchorBlue,
    marginLeft: 4,
    marginRight: 4,
  },
  completedIcon: {
    marginLeft: 4,
  },

  dayTitleContainer: {
    paddingHorizontal: 4,
    paddingTop: 0,
    paddingBottom: 4, // Reduced bottom padding
    marginBottom: 10,  // Reduced margin bottom
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.faithGold,
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.anchorBlue,
    lineHeight: 28,
  },
  scrollView: {
    flex: 1,
    width: Dimensions.get('window').width,
    paddingTop: 0, // No top padding as per design
  },
  contentContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 2, // Further reduced to bring content even closer to progress bar
    paddingBottom: 80,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingBottom: 80, // Add padding to bottom to prevent FAB overlap
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
    fontWeight: '700',
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
    marginBottom: 8,
  },
  questionCardContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  questionCardNumber: {
    ...TypographyStyles.interBold as any,
    color: Colors.hopeWhite,
    marginRight: 12,
    fontSize: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  questionCardText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -30, // Half of the width to center it perfectly
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.growthGreen,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
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
    marginTop: 8,
    position: 'relative',
    paddingBottom: 96, // Reserve more space so content doesn't overlap the button
    padding: CARD_CONTENT_PADDING,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
  },
  prayerButton: {
    position: 'absolute',
    right: 16,
    bottom: 16, // Inside lower-right corner of the card
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    // Match onboarding email button style
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    // Subtle white border like onboarding buttons
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 6,
  },
  prayerButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  prayerButtonText: {
    marginLeft: 2,
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  prayerButtonTextActive: {
    color: Colors.alertCoral,
  },
  prayerIcon: {
    marginRight: 0,
  },
  // Overlay layer anchored near the Pray button to render heart particles
  prayerBurstLayer: {
    position: 'absolute',
    // Anchor to the same corner as the button
    right: 16,
    bottom: 16,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    // Allow particles to overflow outside the layer if needed
    overflow: 'visible',
  },
  prayerButtonWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  heartParticle: {
    position: 'absolute',
    left: 60, // start from center of the layer (half of width)
    top: 60,  // start from center of the layer (half of height)
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
    fontWeight: '600',
  },
  scriptureText: {
    ...TypographyStyles.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    marginTop: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  scriptureReference: {
    ...TypographyStyles.interSemiBold,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: Colors.alertCoral,
    textAlign: 'right',
    marginTop: 8,
    opacity: 0.9,
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
  mainContent: {
    flex: 1,
  },
  journaledQuestionNumber: {
    backgroundColor: Colors.growthGreen,
    color: Colors.hopeWhite,
  },

});
