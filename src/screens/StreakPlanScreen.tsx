/**
 * StreakPlanScreen.tsx
 * Displays a celebration screen after completing a playbook
 * Shows streak animation, messaging, and weekly streak visual
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WeeklyStreakRow, { DayState } from '../components/WeeklyStreakRow';
import { triggerLightHaptic } from '../utils/haptics';
import { streakTrackingService } from '../services/streakTrackingService';

interface RouteParams {
  playbookId?: string;
  userId?: string;
  source?: string;
}

const StreakPlanScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };
  const params = route.params as RouteParams;
  const { user } = useAuth();

  // State for streak data
  const [streakData, setStreakData] = useState<any>(null);
  const [streakCount, setStreakCount] = useState(1);
  const [weekStart, setWeekStart] = useState<'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'>('Sunday');
  const [dayStates, setDayStates] = useState<DayState[]>([]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fetch streak data
    const fetchStreakData = async () => {
      if (user?.id) {
        try {
          const streaks = await streakTrackingService.getUserStreaks(user.id);
          if (streaks) {
            setStreakData(streaks);
            // Calculate highest streak count
            const maxStreak = Math.max(
              streaks.prayer_streak || 0,
              streaks.devotional_streak || 0,
              streaks.journal_streak || 0
            );
            setStreakCount(maxStreak > 0 ? maxStreak : 1);

            // Get week start from user preferences
            const metadata = (user as any)?.user_metadata;
            const userWeekStart = metadata?.preferences?.weekStart || 'Sunday';
            setWeekStart(userWeekStart);

            // Calculate day states for last 7 days
            const calculatedDayStates = calculateDayStates(streaks);
            setDayStates(calculatedDayStates);
          }
        } catch (error) {
          console.error('Failed to fetch streak data:', error);
        }
      }
    };

    fetchStreakData();

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [user?.id]);

  // Calculate day states for the last 7 days based on streak data
  const calculateDayStates = (streaks: any): DayState[] => {
    const dayStates: DayState[] = [];
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Get last dates for each activity type
    const prayerLastDate = streaks?.prayer_last_date || '';
    const devotionalLastDate = streaks?.devotional_last_date || '';
    const journalLastDate = streaks?.journal_last_date || '';

    // Generate last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      if (dateString === todayString) {
        dayStates.push('today');
      } else if (
        dateString === prayerLastDate ||
        dateString === devotionalLastDate ||
        dateString === journalLastDate
      ) {
        dayStates.push('completed');
      } else {
        // Check if this is a future date (shouldn't happen with the loop, but just in case)
        if (date > today) {
          dayStates.push('future');
        } else {
          dayStates.push('missed');
        }
      }
    }

    return dayStates;
  };

  const handleContinue = () => {
    try { triggerLightHaptic(); } catch {}

    // Navigate back to trigger slide down animation, then navigate to DashboardHomeScreen
    (navigation as any).goBack();
    // Small delay to allow slide down animation to complete
    setTimeout(() => {
      (navigation as any).reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: { routes: [{ name: 'Overview' }], index: 0 },
          },
        ],
      });
    }, 300);
  };

  const handleProcessAnotherMoment = () => {
    try { triggerLightHaptic(); } catch {}
    (navigation as any).navigate('UserInput');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.anchorBlue }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak animation / celebration icon */}
        <Animated.View style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="flame" size={48} color={Colors.faithGold} />
          </View>
        </Animated.View>

        {/* Hero text */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <Text style={[styles.heroText, font]}>{streakCount} Day{streakCount > 1 ? 's' : ''} of Faithfulness</Text>
          <Text style={[styles.subText, font]}>
            You took a faithful step today. Keep bringing your moments to God.
          </Text>
        </Animated.View>

        {/* Weekly streak visual */}
        <Animated.View style={[styles.streakContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <WeeklyStreakRow
            weekStart={weekStart}
            dayStates={dayStates.length > 0 ? dayStates : ['completed', 'completed', 'missed', 'completed', 'completed', 'today', 'future']}
          />
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[styles.buttonsContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <TouchableOpacity
            style={[styles.primaryButton]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, font, { fontWeight: '600' }]}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton]}
            onPress={handleProcessAnotherMoment}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, font, { fontWeight: '600' }]}>Process Another Moment</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(250, 190, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.faithGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subText: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  streakContainer: {
    width: '100%',
    marginBottom: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
  },
  buttonsContainer: {
    width: '100%',
    gap: 0,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 'auto',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default StreakPlanScreen;
