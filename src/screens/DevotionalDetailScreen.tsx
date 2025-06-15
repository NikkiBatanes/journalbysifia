import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotional } from '../context/DevotionalContext';
import { Devotional } from '../interfaces/devotional';
import { Typography } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING } from '../theme';

import ProgressBar from '../components/ProgressBar';
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

  const navigateToDay = (index: number) => {
    if (devotional && index >= 0 && index < devotional.days.length) {
      setCurrentDayIndex(index);
    }
  };


  const renderDayNavigation = () => {
    if (!devotional) {return null;}

    return (
      <View style={styles.dayNavigation}>
        <TouchableOpacity
          style={[styles.navButton, currentDayIndex === 0 && styles.navButtonDisabled]}
          onPress={() => navigateToDay(currentDayIndex - 1)}
          disabled={currentDayIndex === 0}
        >
          <Ionicons name="chevron-back" size={18} color="white" />
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.dayIndicator}>
          <Text style={styles.dayIndicatorText}>
            Day {currentDayIndex + 1} of {devotional.days.length}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentDayIndex === devotional.days.length - 1 && styles.navButtonDisabled,
          ]}
          onPress={() => navigateToDay(currentDayIndex + 1)}
          disabled={currentDayIndex === devotional.days.length - 1}
        >
          <Text style={styles.navButtonText}>Next</Text>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </TouchableOpacity>
      </View>
    );
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{devotional.title}</Text>
            <View style={styles.dayCounterContainer}>
              <Ionicons name="calendar-outline" size={16} color={Colors.anchorBlue} style={styles.calendarIcon} />
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
            <ProgressBar
              progress={devotional.progress}
              width={null}
              color={Colors.faithGold}
            />
            <Text style={styles.progressPercentage}>
              {Math.round(devotional.progress)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Day Title */}
      <View style={styles.dayTitleContainer}>
        <Text style={styles.dayNumber}>Day {currentDayIndex + 1}</Text>
        <Text style={styles.dayTitle}>{currentDay?.title || ''}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Scripture Card */}
        <DevotionalSectionCard
          icon="book-outline"
          title="Today's Scripture"
          subtitle="God's Word for today"
        >
          <View>
            <Text style={styles.scriptureText}>{currentDay?.scripture?.text || ''}</Text>
{currentDay?.scripture?.reference ? (
  <Text style={styles.scriptureReference}>
    {'– ' + currentDay.scripture.reference}
  </Text>
) : null}
          </View>
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

      {/* Day Navigation */}
      {renderDayNavigation()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.hopeWhite,
  },
  progressSection: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: Colors.hopeWhite,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: Colors.anchorBlue,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    textAlign: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  dayCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerSpacer: {
    width: 40,
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
  progressText: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 8,
    textAlign: 'center',
  },
  dayTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.anchorBlue,
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
    color: Colors.hopeWhite,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: CARD_CONTENT_PADDING,
    paddingBottom: 80,
  },
  scriptureContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: CARD_CONTENT_PADDING,
    marginBottom: 24,
  },
  scriptureLabel: {
    fontSize: 14,
    color: Colors.faithGold,
    fontWeight: '600',
    marginBottom: 8,
  },

  scriptureText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  scriptureReference: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
    fontStyle: 'normal',
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
    ...Typography.interBold,
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
  dayNavigation: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  dayIndicator: {
    backgroundColor: 'rgba(25, 57, 104, 0.7)',
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  dayIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});
