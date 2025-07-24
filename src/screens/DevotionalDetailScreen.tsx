import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { runOnJS } from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/types';
import { useDevotional } from '../context/DevotionalContext';
import { useAuth } from '../context/AuthContext';
import { Devotional } from '../interfaces/devotional';
import { Typography as TypographyStyles } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

export default function DevotionalDetailScreen({ route, navigation }: DevotionalDetailScreenProps) {

  const { devotionalId } = route.params;
  const { devotionals, markDayComplete, submitDevotionalRating } = useDevotional();
  const { user } = useAuth();

  // React Query hooks for prayer data
  const { data: allDevotionalPrayers = [] } = useAllDevotionalPrayerData(user?.id || '');
  const createDevotionalPrayerMutation = useCreateDevotionalPrayer();
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  // Store the index of the completed day for modal display
  const [completedDayIndex, setCompletedDayIndex] = useState<number | null>(null);
  const [prayedDays, setPrayedDays] = useState<Record<string, boolean>>({});
  // Reflection modal state
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [selectedReflectionQuestion, setSelectedReflectionQuestion] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showFAB, setShowFAB] = useState(false);
  // Track scroll positions for each day to reset when needed
  const [scrollPositions, setScrollPositions] = useState<{[key: number]: number}>({});

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

  useEffect(() => {
    // Find the devotional by ID
    const foundDevotional = devotionals.find(d => d.id === devotionalId);
    if (foundDevotional) {
      setDevotional(foundDevotional);
    }
    setLoading(false);
  }, [devotionalId, devotionals]);

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
            flatListRef.current.scrollToIndex({
              index: 0,
              animated: false,
            });
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
            flatListRef.current.scrollToIndex({
              index: targetIndex,
              animated: false,
            });
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

      flatListRef.current.scrollToIndex({
        index: safeIndex,
        animated: false,
        viewPosition: 0.5,
      });

      // Force update the scroll position after a short delay to ensure it takes effect
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index: safeIndex,
            animated: false,
            viewPosition: 0.5,
          });
        }
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

    // Get the current day
    const dayToMark = devotional.days[currentDayIndex];
    if (!dayToMark) {
      return;
    }

    try {
      // Mark the day as complete in the database
      const success = await markDayComplete(devotional.id, dayToMark.dayNumber);
      if (success) {
        // Update local state to reflect the completed day
        const updatedDays = [...devotional.days];
        const dayIndex = updatedDays.findIndex(d => d.dayNumber === dayToMark.dayNumber);
        if (dayIndex !== -1) {
          updatedDays[dayIndex] = {
            ...updatedDays[dayIndex],
            completed: true,
            completedAt: new Date().toISOString(),
          };
          // Update the local devotional state
          setDevotional({
            ...devotional,
            days: updatedDays,
          });
          // Store the completed day index for modal display
          setCompletedDayIndex(currentDayIndex);
          setShowCompletionModal(true);
        }
      } else {
        console.error('Failed to mark day as complete');
      }
    } catch (error) {
      console.error('Error marking day as complete:', error);
    }
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

      // Update local state to reflect the completed day if needed
      const completedDay = devotional.days[completedDayIndex];
      if (completedDay && !completedDay.completed) {
        const updatedDays = [...devotional.days];
        updatedDays[completedDayIndex] = {
          ...completedDay,
          completed: true,
          completedAt: completedDay.completedAt || new Date().toISOString(),
        };
        setDevotional({
          ...devotional,
          days: updatedDays,
        });
      }
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
        edges={['right', 'top', 'left']}
        mode="margin"
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
          completedDays={devotional.days.filter(day => day.completed).length}
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
            const newIndex = Math.min(
              Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width),
              devotional.days.length - 1
            );
            // Only update if the index actually changed and is within bounds
            if (newIndex !== currentDayIndex && newIndex >= 0 && newIndex < devotional.days.length) {
              console.log('Momentum scroll ended at day:', newIndex + 1); // Debug log
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
              <Text style={styles.reflectionText}>{day?.reflection || ''}</Text>
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
                      setSelectedReflectionQuestion(question.text);
                      setReflectionModalVisible(true);
                    }}
                  >
                    <View style={styles.questionCardContainer}>
                      <Text style={styles.questionCardNumber}>{idx + 1}</Text>
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
                <TouchableOpacity
                  style={[
                    styles.prayerButton,
                    prayedDays[`${devotional?.id}-${currentDayIndex}`] && styles.prayerButtonActive,
                  ]}
                  onPress={togglePrayed}
                >
                  <Ionicons
                    name="heart"
                    size={20}
                    color={prayedDays[`${devotional?.id}-${currentDayIndex}`] ? Colors.alertCoral : Colors.inactiveIcon}
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
            </DevotionalSectionCard>
            </ScrollView>
          )}
          />
        {/* Visual indicator for swipe down to dismiss */}
        <View style={styles.swipeIndicatorContainer}>
          <View style={styles.swipeIndicator} />
        </View>

        {/* Reflection Modal for Questions to Ponder */}
        <DevotionalDetailReflectionModal
          visible={reflectionModalVisible}
          question={selectedReflectionQuestion || ''}
          devotionalTitle={devotional?.title}
          totalDays={devotional?.totalDays}
          dayNumber={devotional?.currentDay}
          dayTitle={devotional?.days[devotional.currentDay - 1]?.title}
          questionNumber={selectedReflectionQuestion ?
            (devotional?.days[devotional.currentDay - 1]?.reflectionQuestions?.findIndex(q => q.text === selectedReflectionQuestion) || 0) + 1
            : undefined}
          onSave={async (entry) => {
            try {
              // The entry is already saved by the modal
              console.log('Reflection saved:', entry);
              // Note: We don't close the modal here to allow the success modal to show
              // The modal will be closed when the user clicks Done in the success modal
            } catch (error) {
              console.error('Error handling saved reflection:', error);
            }
          }}
          onCancel={() => {
            setReflectionModalVisible(false);
            setSelectedReflectionQuestion(null);
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
    paddingBottom: 64, // Increased space for the prayer button
    padding: CARD_CONTENT_PADDING,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
  },
  prayerButton: {
    position: 'absolute',
    right: 0,
    bottom: -16, // Raised button up from card edge
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  prayerButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  prayerButtonText: {
    marginLeft: 2,
    color: Colors.textDark,
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


});
