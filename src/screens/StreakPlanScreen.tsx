/**
 * StreakPlanScreen.tsx
 * Displays a celebration screen after completing a playbook
 * Shows streak animation, messaging, and weekly streak visual
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated, Share, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WeeklyStreakRow, { DayState } from '../components/WeeklyStreakRow';
import { triggerLightHaptic } from '../utils/haptics';
import { streakTrackingService } from '../services/streakTrackingService';
import { supabase } from '../services/supabaseClient';

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
  const insets = useSafeAreaInsets();

  // State for streak data
  const [streakData, setStreakData] = useState<any>(null);
  const [streakCount, setStreakCount] = useState(1);
  const [weekStart, setWeekStart] = useState<'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'>('Sunday');
  const [dayStates, setDayStates] = useState<DayState[]>([]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const shareButtonAnim = useRef(new Animated.Value(0)).current;
  const iconBgAnim = useRef(new Animated.Value(0)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate share button with spring animation
    shareButtonAnim.setValue(0);
    Animated.spring(shareButtonAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      delay: 350,
      useNativeDriver: true,
    }).start();

    // Animate icon background first, then icon
    Animated.sequence([
      Animated.timing(iconBgAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(iconAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

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
            setStreakCount(maxStreak);

            // Get week start from user preferences
            const metadata = (user as any)?.user_metadata;
            const userWeekStartRaw = metadata?.preferences?.weekStart || 'sunday';
            // Convert from lowercase (stored in DB) to capitalized (expected by WeeklyStreakRow)
            const userWeekStart = userWeekStartRaw.charAt(0).toUpperCase() + userWeekStartRaw.slice(1) as 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
            setWeekStart(userWeekStart);

            // Calculate day states for the weekly streak
            const calculatedDayStates = await calculateDayStates(streaks);
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

  // Calculate day states for the last 7 days based on actual activity data
  const calculateDayStates = async (streaks: any): Promise<DayState[]> => {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Collect all activity dates from the last 7 days
    const activityDates = new Set<string>();

    // Query prayer entries (extend window to 8 days to cover full week from any weekStart)
    const { data: prayerData } = await supabase
      .from('prayers')
      .select('created_at')
      .eq('user_id', user?.id)
      .gte('created_at', new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString());

    if (prayerData) {
      prayerData.forEach((entry: any) => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        activityDates.add(date);
      });
    }

    // Query devotional entries
    const { data: devotionalData } = await supabase
      .from('devotional_progress')
      .select('created_at')
      .eq('user_id', user?.id)
      .gte('created_at', new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString());

    if (devotionalData) {
      devotionalData.forEach((entry: any) => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        activityDates.add(date);
      });
    }

    // Query journal entries
    const { data: journalData } = await supabase
      .from('journal_entries')
      .select('created_at')
      .eq('user_id', user?.id)
      .gte('created_at', new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString());

    if (journalData) {
      journalData.forEach((entry: any) => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        activityDates.add(date);
      });
    }

    // Query playbook completions
    const { data: playbookData } = await supabase
      .from('playbooks')
      .select('completed_at')
      .eq('user_id', user?.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString());

    if (playbookData) {
      playbookData.forEach((entry: any) => {
        const date = new Date(entry.completed_at).toISOString().split('T')[0];
        activityDates.add(date);
      });
    }

    // Get week start from user preferences
    const metadata = (user as any)?.user_metadata;
    const userWeekStartRaw = metadata?.preferences?.weekStart || 'sunday';
    const userWeekStart = (userWeekStartRaw.charAt(0).toUpperCase() + userWeekStartRaw.slice(1)) as
      'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

    const DAY_NUMBERS: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    // Find the start date of the current week
    const weekStartDayNum = DAY_NUMBERS[userWeekStart];
    const todayDayNum = today.getDay();
    const daysSinceWeekStart = (todayDayNum - weekStartDayNum + 7) % 7;
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysSinceWeekStart);
    weekStartDate.setHours(0, 0, 0, 0);

    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);

    console.log('🔍 Activity Dates:', Array.from(activityDates));
    console.log('📅 Week start:', weekStartDate.toISOString().split('T')[0], '| Today:', todayString, '| UserWeekStart:', userWeekStart);

    // Generate state for each day in the current week (weekStart + 0..6)
    const dayStates: DayState[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      const dateString = date.toISOString().split('T')[0];

      let state: DayState;
      if (dateString === todayString) {
        state = 'today';
      } else if (date > todayMidnight) {
        state = 'future';
      } else if (activityDates.has(dateString)) {
        state = 'completed';
      } else {
        state = 'missed';
      }

      dayStates.push(state);
      console.log(`  Day ${i} (${dateString}): ${state}`);
    }

    return dayStates;
  };

  // Get streak message based on milestone or rotation
  const getStreakMessage = (streak: number): string => {
    // Milestone messages
    const milestoneMessages: Record<number, string> = {
      1: 'You took a faithful step today.\nKeep bringing your moments to God.',
      3: 'You\'re beginning to build a rhythm of returning.\nOne small step still matters.',
      7: 'One week of returning to God in real moments.\nKeep coming back, one day at a time.',
      14: 'Two weeks of coming back, one day at a time.\nThis steady return matters.',
      30: 'One month of making space for God in real life.\nStay with what God is showing you.',
      60: 'Two months of returning and staying with the journey.\nGod meets you in real moments too.',
      90: 'Three months of bringing your moments to God.\nStay with what God is showing you.',
      100: 'One hundred days of bringing real moments before God.\nKeep walking, one day at a time.',
    };

    // Check if it's a milestone day
    if (milestoneMessages[streak]) {
      return milestoneMessages[streak];
    }

    // Non-milestone rotating messages
    const rotationMessages = [
      'You took a faithful step today.\nKeep bringing your moments to God.',
      'You came back for this moment today.\nOne small step still matters.',
      'You made space to reflect today.\nGod meets you in real moments too.',
      'You\'ve kept coming back, one day at a time.\nThis steady return matters.',
      'You showed up for this moment today.\nStay with what God is showing you.',
      'A steady rhythm is taking shape.\nKeep coming back, one day at a time.',
    ];

    // Use streak count to determine rotation (cycles through 6 options)
    const rotationIndex = (streak - 1) % rotationMessages.length;
    return rotationMessages[rotationIndex];
  };

  const handleContinue = () => {
    try { triggerLightHaptic(); } catch {}

    // Navigate directly to DashboardHomeScreen
    (navigation as any).reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: { routes: [{ name: 'Overview' }], index: 0 },
        },
      ],
    });
  };

  const handleProcessAnotherMoment = () => {
    try { triggerLightHaptic(); } catch {}
    (navigation as any).navigate('UserInput');
  };

  const handleShare = async () => {
    try {
      triggerLightHaptic();
      await Share.share({
        message: `I'm on a ${streakCount}-day streak of bringing real moments to God on siFia. 🙏`,
      });
    } catch (_error) {
      // User cancelled share — silent
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.anchorBlue }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      {/* Share button */}
      <Animated.View
        style={[
          styles.closeButton,
          { top: insets.top + 8 },
          {
            opacity: shareButtonAnim,
            transform: [
              {
                scale: shareButtonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="share-outline" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak animation / celebration icon */}
        <Animated.View style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={[styles.iconCircle, { opacity: iconBgAnim, transform: [{ scale: iconBgAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
            <Animated.View style={{ opacity: iconAnim, transform: [{ scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
              <Ionicons name="sparkles" size={48} color={Colors.faithGold} />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* Hero text */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <Text style={[styles.heroText, font]}>{streakCount}-day of Faith in Action</Text>
          <Text style={[styles.subText, font]}>
            {getStreakMessage(streakCount)}
          </Text>

          {/* Weekly streak visual */}
          <View style={styles.streakRowWrapper}>
            <WeeklyStreakRow
              weekStart={weekStart}
              dayStates={dayStates}
            />
          </View>
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
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  streakRowWrapper: {
    width: '100%',
  },
  streakContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
    padding: 0,
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
