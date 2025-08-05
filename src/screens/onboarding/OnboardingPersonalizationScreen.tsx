/**
 * OnboardingPersonalizationScreen.tsx
 * Phase 6: Personalization Setup
 * Real notification preferences from codebase, goal setting, completion
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

interface NotificationPreference {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  enabled: boolean;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  icon: string;
  selected: boolean;
}

const notificationPreferences: NotificationPreference[] = [
  {
    id: 'dailyDevotional',
    title: 'Daily Devotional',
    subtitle: 'Reminder for daily devotional reading',
    icon: 'book-outline',
    enabled: true,
  },
  {
    id: 'prayerReminders',
    title: 'Prayer Reminders',
    subtitle: 'Reminders for prayer time',
    icon: 'heart-outline',
    enabled: true,
  },
  {
    id: 'journalPrompts',
    title: 'Journal Prompts',
    subtitle: 'Daily journal writing prompts',
    icon: 'journal-outline',
    enabled: false,
  },
  {
    id: 'achievements',
    title: 'Achievements',
    subtitle: 'Notifications for badges and milestones',
    icon: 'trophy-outline',
    enabled: true,
  },
];

const reminderTimes = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM',
];

const spiritualGoals: Goal[] = [
  {
    id: 'daily_prayer',
    title: 'Daily Prayer Life',
    description: 'Establish a consistent prayer routine',
    icon: 'heart',
    selected: false,
  },
  {
    id: 'bible_reading',
    title: 'Regular Bible Study',
    description: 'Read and understand Scripture daily',
    icon: 'book',
    selected: false,
  },
  {
    id: 'spiritual_growth',
    title: 'Personal Growth',
    description: 'Overcome challenges with biblical wisdom',
    icon: 'trending-up',
    selected: true, // Default selected
  },
];

const OnboardingPersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState(notificationPreferences);
  const [selectedReminderTime, setSelectedReminderTime] = useState('8:00 AM');
  const [goals, setGoals] = useState(spiritualGoals);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState<'notifications' | 'goals' | 'complete'>('notifications');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleNotificationToggle = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, enabled: !notif.enabled } : notif
      )
    );
  };

  const handleGoalToggle = (id: string) => {
    setGoals(prev =>
      prev.map(goal =>
        goal.id === id ? { ...goal, selected: !goal.selected } : goal
      )
    );
  };

  const handleNext = () => {
    if (currentSection === 'notifications') {
      setCurrentSection('goals');
    } else if (currentSection === 'goals') {
      setCurrentSection('complete');
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);

    try {
      const enabledNotifications = notifications.filter(n => n.enabled);
      const selectedGoals = goals.filter(g => g.selected);

      console.log('🎯 Onboarding personalization completed:', {
        notifications: enabledNotifications.map(n => n.id),
        reminderTime: selectedReminderTime,
        goals: selectedGoals.map(g => g.id),
      });

      // Simulate saving preferences
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Welcome to siFia!',
        'Your personalized spiritual growth journey starts now. Let\'s create your first playbook!',
        [
          {
            text: 'Get Started',
            onPress: () => {
              // Navigate to main app or complete onboarding
              console.log('🎉 Onboarding completed successfully!');
              // This would typically navigate to the main app
              navigation.navigate('OnboardingComplete' as any);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Unable to save preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const animateSectionChange = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (currentSection !== 'notifications') {
      animateSectionChange();
    }
  }, [currentSection, animateSectionChange]);

  const renderNotificationSection = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>
        <Text style={styles.sectionSubtitle}>
          Choose how you'd like to stay connected to your spiritual growth
        </Text>
      </View>

      <View style={styles.notificationsList}>
        {notifications.map((notification) => (
          <View key={notification.id} style={styles.notificationItem}>
            <View style={styles.notificationIcon}>
              <Ionicons name={notification.icon as any} size={24} color={Colors.lightBlue} />
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationSubtitle}>{notification.subtitle}</Text>
            </View>

            <Switch
              value={notification.enabled}
              onValueChange={() => handleNotificationToggle(notification.id)}
              trackColor={{ false: 'rgba(255, 255, 255, 0.3)', true: Colors.lightBlue }}
              thumbColor={notification.enabled ? Colors.white : Colors.hopeWhite}
            />
          </View>
        ))}
      </View>

      <View style={styles.reminderTimeSection}>
        <Text style={styles.reminderTimeTitle}>Reminder Time</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reminderTimesList}
        >
          {reminderTimes.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.reminderTimeChip,
                selectedReminderTime === time && styles.reminderTimeChipSelected,
              ]}
              onPress={() => setSelectedReminderTime(time)}
            >
              <Text style={[
                styles.reminderTimeText,
                selectedReminderTime === time && styles.reminderTimeTextSelected,
              ]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );

  const renderGoalsSection = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Spiritual Goals</Text>
        <Text style={styles.sectionSubtitle}>
          Select up to 3 areas where you'd like to focus your growth
        </Text>
      </View>

      <View style={styles.goalsList}>
        {goals.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[
              styles.goalCard,
              goal.selected && styles.goalCardSelected,
            ]}
            onPress={() => handleGoalToggle(goal.id)}
          >
            <View style={styles.goalIconContainer}>
              <Ionicons
                name={goal.icon as any}
                size={32}
                color={goal.selected ? Colors.anchorBlue : Colors.lightBlue}
              />
            </View>

            <View style={styles.goalContent}>
              <Text style={[
                styles.goalTitle,
                goal.selected && styles.goalTitleSelected,
              ]}>
                {goal.title}
              </Text>
              <Text style={[
                styles.goalDescription,
                goal.selected && styles.goalDescriptionSelected,
              ]}>
                {goal.description}
              </Text>
            </View>

            {goal.selected && (
              <View style={styles.goalCheckmark}>
                <Ionicons name="checkmark" size={20} color={Colors.anchorBlue} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderCompleteSection = () => (
    <>
      <View style={styles.completeHeader}>
        <Ionicons name="checkmark-circle" size={64} color={Colors.lightBlue} />
        <Text style={styles.completeTitle}>You're All Set!</Text>
        <Text style={styles.completeSubtitle}>
          Your personalized siFia experience is ready. Let's begin your spiritual transformation journey.
        </Text>
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Your Setup Summary:</Text>

        <View style={styles.summaryItem}>
          <Ionicons name="notifications" size={20} color={Colors.lightBlue} />
          <Text style={styles.summaryText}>
            {notifications.filter(n => n.enabled).length} notifications enabled
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Ionicons name="time" size={20} color={Colors.lightBlue} />
          <Text style={styles.summaryText}>
            Daily reminders at {selectedReminderTime}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Ionicons name="target" size={20} color={Colors.lightBlue} />
          <Text style={styles.summaryText}>
            {goals.filter(g => g.selected).length} spiritual goals selected
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {currentSection === 'notifications' && 'Personalize Your Experience'}
              {currentSection === 'goals' && 'Set Your Spiritual Goals'}
              {currentSection === 'complete' && 'Welcome to siFia!'}
            </Text>
          </View>

          {/* Section content */}
          {currentSection === 'notifications' && renderNotificationSection()}
          {currentSection === 'goals' && renderGoalsSection()}
          {currentSection === 'complete' && renderCompleteSection()}

          {/* Continue button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={isLoading}
            >
              <Text style={styles.continueButtonText}>
                {currentSection === 'notifications' && 'Set Goals'}
                {currentSection === 'goals' && 'Complete Setup'}
                {currentSection === 'complete' && (isLoading ? 'Finishing...' : 'Start My Journey')}
              </Text>
              <Ionicons
                name={currentSection === 'complete' ? 'rocket' : 'arrow-forward'}
                size={20}
                color={Colors.anchorBlue}
                style={styles.buttonIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentSection === 'notifications' && 'Step 1 of 3'}
              {currentSection === 'goals' && 'Step 2 of 3'}
              {currentSection === 'complete' && 'Complete!'}
            </Text>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                currentSection === 'notifications' ? styles.progressNotifications :
                currentSection === 'goals' ? styles.progressGoals : styles.progressComplete,
              ]} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationsList: {
    marginBottom: 32,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  reminderTimeSection: {
    marginBottom: 32,
  },
  reminderTimeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 16,
  },
  reminderTimesList: {
    paddingHorizontal: 4,
  },
  reminderTimeChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  reminderTimeChipSelected: {
    backgroundColor: Colors.white,
  },
  reminderTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  reminderTimeTextSelected: {
    color: Colors.anchorBlue,
  },
  goalsList: {
    marginBottom: 32,
  },
  goalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.lightBlue,
  },
  goalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  goalTitleSelected: {
    color: Colors.anchorBlue,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  goalDescriptionSelected: {
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  goalCheckmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 16,
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  summarySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.white,
    marginLeft: 12,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressNotifications: {
    width: '33%',
  },
  progressGoals: {
    width: '66%',
  },
  progressComplete: {
    width: '100%',
  },
});

export default OnboardingPersonalizationScreen;
