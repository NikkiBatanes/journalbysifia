import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotional } from '../context/DevotionalContext';
import { Devotional, Scripture } from '../interfaces/devotional';
import { Typography as TypographyStyles } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING, Fonts } from '../theme';

import DevotionalSectionCard from '../components/DevotionalSectionCard';

type DevotionalDetailScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'DevotionalDetail'>;
  route: RouteProp<RootStackParamList, 'DevotionalDetail'>;
};

export default function DevotionalDetailScreen({ route, navigation }: DevotionalDetailScreenProps) {
  const { devotionalId } = route.params;
  const { devotionals, markDayComplete } = useDevotional();
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const handleMarkComplete = async () => {
    if (!devotional) {return;}

    // Get the actual day number (1-based) from the current day index
    const dayToMark = devotional.days[currentDayIndex];
    if (!dayToMark) {return;}

    // Mark the current day as complete
    const success = await markDayComplete(devotional.id, dayToMark.dayNumber);

    if (success) {
      // Find the next incomplete day
      const nextIncompleteIndex = devotional.days.findIndex(
        (day, index) => index > currentDayIndex && !day.completed
      );

      if (nextIncompleteIndex !== -1) {
        // Move to the next incomplete day
        setCurrentDayIndex(nextIncompleteIndex);
      } else if (currentDayIndex < devotional.days.length - 1) {
        // If no more incomplete days but not at the end, just move to next day
        setCurrentDayIndex(currentDayIndex + 1);
      }
      // If we're at the last day, stay there
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

  return (
    <SafeAreaView style={styles.container} edges={['right', 'top', 'left']} mode="margin">
      <StatusBar barStyle="dark-content" />

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
              {devotional.title.replace(/^(?:DEVOTIONAL|SERIES)?\s*TITLE:\s*/i, '')}
            </Text>
            <View style={styles.dayCounterContainer}>
              <Ionicons name="calendar-clear-outline" size={16} color={Colors.anchorBlue} style={styles.calendarIcon} />
              <Text style={styles.dayCounterText}>
                Day {currentDayIndex + 1} of {devotional.totalDays}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressWrapper}>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${devotional.progress}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressText}>
                {currentDayIndex + 1}/{devotional.totalDays} days
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Day Title - Moved below progress bar */}
        <View style={styles.dayTitleContainer}>
          <Text style={styles.dayNumber}>Day {currentDayIndex + 1}</Text>
          <Text style={styles.dayTitle} numberOfLines={2} ellipsizeMode="tail">
            {currentDay?.title || ''}
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

        {/* Complete Button */}
        {currentDay && !currentDay.completed && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleMarkComplete}
          >
            <Text style={styles.completeButtonText}>Mark Day Complete</Text>
          </TouchableOpacity>
        )}

        {currentDay?.completed && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.faithGold} />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
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
    marginRight: 12,
    minWidth: 250, // Match Playbook minWidth
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
    width: 60, // Match Playbook width
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  progressText: {
    fontSize: 12,
    fontFamily: Fonts.medium, // Match Playbook font
    color: 'rgba(26, 60, 109, 0.9)', // Match Playbook text color
    textAlign: 'right',
    minWidth: 60, // Match Playbook minWidth
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
    color: Colors.textGray,
    textAlign: 'center',
  },
  progressPercentage: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.anchorBlue,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  progressContainer: {
    flex: 1,
  },
  progressPercentageText: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 8,
    textAlign: 'center',
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
  sectionSubtitleCard: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  completeButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  completeButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
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
    color: Colors.faithGold,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scriptureText: {
    ...TypographyStyles.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    marginTop: 12,
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
});
