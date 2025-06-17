import React, { useEffect, useState, useRef } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotional } from '../context/DevotionalContext';
import { Devotional, Scripture } from '../interfaces/devotional';
import { Typography as TypographyStyles } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DevotionalCompletionModal from '../components/DevotionalCompletionModal';
import { Colors, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING } from '../theme';
import { extractCleanTitle } from '../utils/titleUtils';

import DevotionalSectionCard from '../components/DevotionalSectionCard';

type DevotionalDetailScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'DevotionalDetail'>;
  route: RouteProp<RootStackParamList, 'DevotionalDetail'>;
};

export default function DevotionalDetailScreen({ route, navigation }: DevotionalDetailScreenProps) {
  const { devotionalId } = route.params;
  const { devotionals, markDayComplete, submitDevotionalRating } = useDevotional();
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFAB, setShowFAB] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [dayCompleted, setDayCompleted] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [scripture, setScripture] = useState<Scripture>({
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    reference: 'JOHN 3:16',
  });

  // Update scripture when currentDay changes
  useEffect(() => {
    const currentDay = devotional?.days?.[currentDayIndex];
    if (currentDay?.scripture) {
      // Use the scripture data directly from the backend
      setScripture({
        text: currentDay.scripture.text || "God's word brings light and life to our hearts.",
        reference: currentDay.scripture.reference || 'PSALM 119:105',
      });
    }
  }, [devotional, currentDayIndex]);

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

      // Set current day index to the first incomplete day or the last day
      const incompleteIndex = foundDevotional.days.findIndex(day => !day.completed);
      const newIndex = incompleteIndex >= 0 ? incompleteIndex : foundDevotional.days.length - 1;
      setCurrentDayIndex(newIndex);
    }
    setLoading(false);
  }, [devotionalId, devotionals]);

  // Ensure currentDay is always defined in render
  const currentDay = devotional?.days?.[currentDayIndex];
  // Debug log for prayer data
  console.log('DevotionalDetailScreen currentDay:', currentDay);
  console.log('DevotionalDetailScreen prayer:', currentDay?.prayer);

  const handleMarkComplete = () => {
    if (!devotional) {return;}

    // Get the current day
    const dayToMark = devotional.days[currentDayIndex];
    if (!dayToMark) {return;}

    // Set the day that will be marked as complete (but don't mark it yet)
    setDayCompleted(dayToMark.dayNumber);

    // Show the completion modal first
    setShowCompletionModal(true);
  };

  // Handle continuing after completion modal
  const handleCompletionContinue = async () => {
    if (!devotional || dayCompleted === null) {
      setShowCompletionModal(false);
      return;
    }

    try {
      // Mark the day as complete when continuing
      await markDayComplete(devotional.id, dayCompleted);

      // Find the next day
      const nextDayIndex = currentDayIndex + 1;

      // If there's a next day, go to it and scroll to top
      if (nextDayIndex < devotional.days.length) {
        setCurrentDayIndex(nextDayIndex);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 50);
      }

      // Close the modal
      setShowCompletionModal(false);

    } catch (error) {
      console.error('Error marking day as complete:', error);
      setShowCompletionModal(false);
    }
  };

  // Handle closing the modal by pressing the X button or backdrop
  const handleModalClose = () => {
    setShowCompletionModal(false);
    navigation.goBack();
  };

  // Handle rating submission
  const handleRatingSubmit = async (rating: number) => {
    if (!devotional || dayCompleted === null) {
      setShowCompletionModal(false);
      return;
    }

    try {
      // Submit the rating
      await submitDevotionalRating(devotional.id, rating);

      // Mark the day as complete
      await markDayComplete(devotional.id, dayCompleted);

      // Find the next day
      const nextDayIndex = currentDayIndex + 1;

      // If there's a next day, go to it and scroll to top
      if (nextDayIndex < devotional.days.length) {
        setCurrentDayIndex(nextDayIndex);
        // Scroll to top after state update
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 50);
      }

      // Close the modal
      setShowCompletionModal(false);

    } catch (error) {
      console.error('Error submitting rating or marking day as complete:', error);
      // Still close the modal even if there was an error
      setShowCompletionModal(false);
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

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const contentHeight = event.nativeEvent.contentSize.height;
        const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;

        // Show FAB when scrolled to bottom
        const isAtBottom = offsetY + scrollViewHeight >= contentHeight - 50;
        setShowFAB(isAtBottom);
      },
    }
  );


  return (
    <SafeAreaView style={styles.container} edges={['right', 'top', 'left']} mode="margin">
      <StatusBar barStyle="dark-content" />

      {/* Floating Action Button */}
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
          currentDayNumber={dayCompleted || 0}
          completedDays={devotional.days.filter(day => day.completed).length + (dayCompleted ? 1 : 0)}
          onContinue={handleCompletionContinue}
          onClose={handleModalClose}
          onRatingSubmit={handleRatingSubmit}
        />
      )}

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
              {extractCleanTitle(devotional.title, 'Devotional')}
            </Text>
            <View style={styles.dayCounterContainer}>
              <Ionicons name="calendar-clear-outline" size={16} color={Colors.anchorBlue} style={styles.calendarIcon} />
              <Text style={styles.dayCounterText}>
                Day {currentDayIndex + 1} of {devotional.totalDays}
              </Text>
              {currentDay?.completed && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.growthGreen}
                  style={styles.completedIcon}
                />
              )}
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, styles.scrollViewContent]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Day Title - Moved below progress bar */}
        <View style={styles.dayTitleContainer}>
          <Text style={styles.dayNumber}>Day {currentDayIndex + 1}</Text>
          <Text style={styles.dayTitle} numberOfLines={2} ellipsizeMode="tail">
            {devotional.totalDays === 1 ? (
              // For single-day devotionals, use the main title
              extractCleanTitle(devotional.title, 'Devotional')
            ) : (
              // For multi-day devotionals, use the day title if it exists and is meaningful
              currentDay?.title && currentDay.title !== `Day ${currentDayIndex + 1}` ?
                extractCleanTitle(currentDay.title) :
                // Fall back to series title if day title is generic
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
            {scripture.text}
          </Text>
          <Text style={styles.scriptureReference}>
            - {scripture.reference}
          </Text>
        </DevotionalSectionCard>

        {/* Reflection Card */}
        <DevotionalSectionCard
          icon="bookmark-outline"
          title="Daily Reflection"
          subtitle="Meditate on this"
        >
          <Text style={styles.reflectionText}>{currentDay?.reflection || ''}</Text>
        </DevotionalSectionCard>

        {/* Questions Card */}
        <DevotionalSectionCard
          icon="help-circle-outline"
          title="Questions to Ponder"
          subtitle="Reflect deeply"
        >
          {currentDay?.reflectionQuestions?.length ? (
            currentDay.reflectionQuestions.map((question, idx) => (
              <View key={question.id || idx} style={styles.questionCardWrapper}>
                <View style={styles.questionCardContainer}>
                  <Text style={styles.questionCardNumber}>{idx + 1}</Text>
                  <Text style={styles.questionCardText}>
                    {question.text || 'Reflection question'}
                  </Text>
                </View>
              </View>
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
              {currentDay && currentDay.prayer && currentDay.prayer.trim().length > 0
                ? currentDay.prayer.replace(/\*\*/g, '').replace(/\n/g, '\n\n')
                : 'No prayer for today.'}
            </Text>
          </View>
        </DevotionalSectionCard>

        {/* Removed the bottom complete button in favor of FAB */}

        {/* Completion indicator moved to header */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  fixedHeader: {
    backgroundColor: Colors.hopeWhite,
    paddingBottom: 0, // Reduced padding bottom to bring progress bar closer to content
    zIndex: 10,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: Colors.hopeWhite,
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.anchorBlue,
    textAlign: 'center',
    flexShrink: 1,
    paddingHorizontal: 8,
    flexWrap: 'wrap',
    flex: 1,
    textAlignVertical: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginRight: 4,
    minHeight: 40,
    flexDirection: 'column',
  },
  dayCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
    marginTop: 0,
  },
  contentContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 2, // Further reduced to bring content even closer to progress bar
    paddingBottom: 80,
  },
  scrollViewContent: {
    flexGrow: 1,
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

  prayerContainer: {
    marginBottom: 24,
    padding: CARD_CONTENT_PADDING,
    backgroundColor: 'rgba(26,60,109,0.08)',
    borderRadius: 12,
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
    fontSize: 14,
    color: Colors.faithGold,
    textAlign: 'right',
    marginTop: 8,
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
  fab: {
    position: 'absolute',
    bottom: 28,
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
});
