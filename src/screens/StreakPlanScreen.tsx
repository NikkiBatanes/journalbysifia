/**
 * StreakPlanScreen.tsx
 * Displays a quiet celebration after completing a Journal rhythm.
 * Legacy callers without a rhythm remain supported during migration.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated, Easing, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WeeklyStreakRow, { DayState } from '../components/WeeklyStreakRow';
import { triggerLightHaptic } from '../utils/haptics';
import { visibleStreakService } from '../services/visibleStreakService';
import {
  getFaithfulRhythmsSnapshot,
  type FaithfulRhythmId,
  type RoutineRhythmSnapshot,
} from '../services/faithfulRhythmService';
import { requestReview } from '../services/reviewPromptService';
import ShareComposer from '../components/TruthToCarryShareComposer';

interface RouteParams {
  playbookId?: string;
  userId?: string;
  source?: string;
  onboarding?: boolean;
  dismissRouteCount?: number;
  rhythm?: FaithfulRhythmId;
  returnTo?: 'moments' | 'prayer';
}

const StreakPlanScreen: React.FC = () => {
  const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;
  const route = useRoute();
  const navigation = useNavigation();
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };
  const params = (route.params || {}) as RouteParams;
  const { user, preferences: appPreferences } = useAuth();
  const insets = useSafeAreaInsets();
  const androidScrollInsets = Platform.OS === 'android'
    ? {
        paddingTop: 40 + insets.top,
        paddingBottom: 40 + Math.max(insets.bottom, 16),
      }
    : null;

  const [streakCount, setStreakCount] = useState(1);
  const [activeRhythm, setActiveRhythm] = useState<RoutineRhythmSnapshot | null>(null);
  const [weekStart, setWeekStart] = useState<'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'>('Monday');
  const [dayStates, setDayStates] = useState<DayState[]>([]);
  const [showShareComposer, setShowShareComposer] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const iconMotionAnim = useRef(new Animated.Value(0)).current;
  const shareButtonAnim = useRef(new Animated.Value(0)).current;
  const entranceStartedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let entranceFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    entranceStartedRef.current = false;
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    iconMotionAnim.setValue(0);

    const startEntranceAnimation = () => {
      if (!isMounted || entranceStartedRef.current) {
        return;
      }

      entranceStartedRef.current = true;
      if (entranceFallbackTimer) {
        clearTimeout(entranceFallbackTimer);
        entranceFallbackTimer = null;
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    };

    // Share button and icon animations start immediately (decorative)
    shareButtonAnim.setValue(0);
    Animated.spring(shareButtonAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      delay: 200,
      useNativeDriver: true,
    }).start();

    const iconMotionAnimation = Animated.loop(Animated.sequence([
      Animated.timing(iconMotionAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(iconMotionAnim, {
        toValue: 0,
        duration: 1800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]));
    iconMotionAnimation.start();

    // Mark streak as shown today (called here so it only fires when the screen actually renders)
    if (user?.id && !params.rhythm) {
      visibleStreakService.markShownToday(user.id).catch(() => {});
    }

    // Fetch data first, then animate content in — prevents snapping/popping
    const initialize = async () => {
      const userWeekStartRaw = String(appPreferences?.weekStart || 'monday');
      const userWeekStart = (userWeekStartRaw.charAt(0).toUpperCase() + userWeekStartRaw.slice(1).toLowerCase()) as typeof weekStart;
      setWeekStart(userWeekStart);

      if (params.rhythm) {
        try {
          const rhythms = await getFaithfulRhythmsSnapshot(userWeekStartRaw, new Date());
          const rhythmSnapshot = rhythms[params.rhythm];
          setActiveRhythm(rhythmSnapshot);
          const today = toLocalDate(new Date());
          setStreakCount(Math.max(rhythmSnapshot.currentStreak, 1));
          setDayStates(rhythmSnapshot.days.map(day => {
            if (day.status === 'complete') {return 'completed';}
            if (day.status === 'future') {return 'future';}
            return day.date === today ? 'today' : 'missed';
          }));
        } catch (error) {
          console.error('Failed to fetch routine streak data:', error);
        }
        startEntranceAnimation();
        return;
      }

      if (!user?.id) {
        startEntranceAnimation();
        return;
      }
      try {
        const { dayStates: calculatedDayStates, activityDates } = await calculateDayStates();
        setDayStates(calculatedDayStates);

        const today = new Date();
        let streak = 0;
        const checkDate = new Date(today);
        while (true) {
          const dateStr = toLocalDate(checkDate);
          if (activityDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else { break; }
        }
        setStreakCount(Math.max(streak, 1));

      } catch (error) {
        console.error('Failed to fetch streak data:', error);
      }

      startEntranceAnimation();
    };

    entranceFallbackTimer = setTimeout(startEntranceAnimation, Platform.OS === 'android' ? 650 : 1000);
    initialize();

    return () => {
      isMounted = false;
      if (entranceFallbackTimer) {
        clearTimeout(entranceFallbackTimer);
      }
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      iconMotionAnimation.stop();
      iconMotionAnim.stopAnimation();
      shareButtonAnim.stopAnimation();
    };
  }, [user?.id, appPreferences?.weekStart, params.rhythm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: get local date string (YYYY-MM-DD) from any Date — avoids UTC offset issues
  const toLocalDate = (d: Date): string => {
    return visibleStreakService.toLocalDate(d);
  };

  // Calculate day states for the current week based on actual activity data
  const calculateDayStates = async (): Promise<{ dayStates: DayState[]; activityDates: Set<string> }> => {
    const today = new Date();
    const todayString = toLocalDate(today); // LOCAL date to match user's timezone

    // 100-day lookback for accurate streak calculation; 8 days covers any week layout
    const activityDates = user?.id ? await visibleStreakService.getActivityDates(user.id) : new Set<string>();

    // Get week start from user preferences
    const userWeekStartRaw = appPreferences?.weekStart || 'monday';
    const userWeekStart = (userWeekStartRaw.charAt(0).toUpperCase() + userWeekStartRaw.slice(1)) as
      'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

    const DAY_NUMBERS: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    // Find the LOCAL start date of the current week
    const weekStartDayNum = DAY_NUMBERS[userWeekStart];
    const todayDayNum = today.getDay(); // local day-of-week
    const daysSinceWeekStart = (todayDayNum - weekStartDayNum + 7) % 7;
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysSinceWeekStart);
    weekStartDate.setHours(0, 0, 0, 0);

    // Generate state for each day in the current week (weekStart + 0..6)
    const currentWeekDayStates: DayState[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      const dateString = toLocalDate(date); // LOCAL date

      let state: DayState;
      if (dateString > todayString) {
        state = 'future';
      } else if (activityDates.has(dateString)) {
        state = 'completed'; // includes today if user has activity
      } else if (dateString === todayString) {
        state = 'today'; // today but no activity yet
      } else {
        state = 'missed';
      }

      currentWeekDayStates.push(state);
    }

    return { dayStates: currentWeekDayStates, activityDates };
  };

  const getStreakMessage = (streak: number, rhythm?: FaithfulRhythmId): string => {
    if (rhythm && rhythm !== 'morning' && rhythm !== 'evening') {
      const rhythmCopy: Record<Exclude<FaithfulRhythmId, 'morning' | 'evening'>, {first: string; ongoing: string}> = {
        heart_journal: {
          first: 'Your Heart Journal entry is saved.\nYou made room to notice what is within you.',
          ongoing: 'You returned to your Heart Journal.\nNotice what is becoming clearer over time.',
        },
        prayer: {
          first: 'Your prayer is saved.\nThis moment now has a place in your journey.',
          ongoing: 'You made space for prayer again.\nLet this rhythm remain honest and unhurried.',
        },
        bible_study: {
          first: 'Your Bible Study is complete.\nYour observations are saved for you to revisit.',
          ongoing: 'Another week of studying Scripture is complete.\nYour understanding is taking shape over time.',
        },
        session_notes: {
          first: 'You completed Sermon Notes for every Sunday this month.\nYour monthly rhythm is taking shape.',
          ongoing: 'Another month of Sunday Sermon Notes is complete.\nKeep making room for what you are hearing.',
        },
        reviews: {
          first: 'Your Review is complete.\nYou made space to look back with attention.',
          ongoing: 'Another Review is complete.\nNotice what is changing across the seasons.',
        },
      };
      return streak === 1 ? rhythmCopy[rhythm].first : rhythmCopy[rhythm].ongoing;
    }

    const milestoneMessages: Record<'morning' | 'evening' | 'general', Record<number, string>> = {
      morning: {
        1: 'Your morning reflection is complete.\nYou made space to begin with intention.',
        3: 'Three mornings of pausing with intention.\nYour rhythm is beginning to take shape.',
        7: 'One week of intentional mornings.\nNotice what this rhythm is opening in you.',
        14: 'Two weeks of beginning with reflection.\nLet this rhythm keep supporting your days.',
        30: 'One month of intentional mornings.\nNotice what has been helping you.',
        60: 'Two months of making space each morning.\nYour reflections are becoming a lived rhythm.',
        90: 'Three months of thoughtful mornings.\nNotice how your focus has grown and changed.',
        100: 'One hundred mornings of reflection.\nTake a moment to honor the rhythm you built.',
      },
      evening: {
        1: 'Your evening reflection is complete.\nRest with what mattered today.',
        3: 'Three evenings of noticing your day.\nYour rhythm is beginning to take shape.',
        7: 'One week of closing the day with reflection.\nLet what matters stay with you.',
        14: 'Two weeks of thoughtful evenings.\nNotice what keeps returning to your attention.',
        30: 'One month of reflective evenings.\nYour days are leaving a story worth noticing.',
        60: 'Two months of making space each evening.\nYour reflections are becoming a lived rhythm.',
        90: 'Three months of closing the day with care.\nNotice how your perspective has grown.',
        100: 'One hundred evenings of reflection.\nTake a moment to honor the rhythm you built.',
      },
      general: {
        1: 'Your reflection is complete.\nLet what you noticed stay with you.',
        3: 'Three days of making space to reflect.\nYour rhythm is beginning to take shape.',
        7: 'One week of reflection.\nNotice what this rhythm is opening in you.',
        14: 'Two weeks of reflection.\nLet this rhythm keep supporting you.',
        30: 'One month of reflection.\nNotice what has been helping you.',
        60: 'Two months of making space to reflect.\nYour reflections are becoming a lived rhythm.',
        90: 'Three months of reflection.\nNotice how your perspective has grown.',
        100: 'One hundred days of reflection.\nTake a moment to honor the rhythm you built.',
      },
    };
    const messageSet = milestoneMessages[rhythm === 'morning' || rhythm === 'evening' ? rhythm : 'general'];
    if (messageSet[streak]) {return messageSet[streak];}

    const rotationMessages = rhythm === 'morning'
      ? [
          'You paused before stepping into the day.\nLet the morning unfold from here.',
          'Your morning reflection is complete.\nLet one clear intention guide today.',
          'You made room to begin with awareness.\nTake the next part of the day as it comes.',
        ]
      : rhythm === 'evening'
        ? [
            'You made space to notice the day.\nLet what matters stay with you.',
            'Your evening reflection is complete.\nRelease what can wait until tomorrow.',
            'You paused before closing the day.\nRest with what you learned and felt.',
          ]
        : [
            'You made space to reflect.\nLet what you noticed stay with you.',
            'Another reflection is part of your story.\nNotice what matters.',
            'Your rhythm is taking shape.\nKeep it gentle and honest.',
          ];

    return rotationMessages[(streak - 1) % rotationMessages.length];
  };

  const handleContinue = () => {
    try { triggerLightHaptic(); } catch {}

    const shouldRequestStoreReview = (
      params.rhythm === 'morning' || params.rhythm === 'evening'
    ) && [7, 30, 100].includes(streakCount);

    const dismissToMainTabs = (destination: {screen: string; params?: {screen: string}}) => {
      let rootNavigation: any = navigation;

      while (!rootNavigation.getState().routeNames.includes('MainTabs')) {
        const parent = rootNavigation.getParent();
        if (!parent) {
          (navigation as any).navigate('MainTabs', destination);
          return;
        }
        rootNavigation = parent;
      }

      rootNavigation.dispatch({
        ...StackActions.popTo('MainTabs', destination),
        target: rootNavigation.getState().key,
      });
    };

    // Continue to the existing notification preferences when onboarding.
    if (params.onboarding) {
      (navigation as any).navigate('OnboardingNotificationSetup');
    } else if (params.returnTo === 'moments') {
      dismissToMainTabs({
        screen: 'Journal',
        params: { screen: 'JournalMoments' },
      });
    } else if (params.returnTo === 'prayer') {
      dismissToMainTabs({screen: 'Prayer'});
    } else {
      const fallbackDismissCount = params.source === 'playbook_walkthrough' ? 2 : 1;
      const dismissRouteCount = Math.max(
        1,
        Math.floor(params.dismissRouteCount || fallbackDismissCount)
      );

      if (dismissRouteCount > 1) {
        navigation.dispatch(StackActions.pop(dismissRouteCount));
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('MainTabs');
      }
    }

    if (shouldRequestStoreReview) {
      setTimeout(() => {
        requestReview({triggerSource: `${params.rhythm}_rhythm_${streakCount}`}).catch(() => {});
      }, 650);
    }
  };

  const handleShare = () => {
    triggerLightHaptic();
    setShowShareComposer(true);
  };

  const rhythmName = activeRhythm?.label || params.rhythm?.replace(/_/g, ' ') || 'faithful';
  const streakUnit = activeRhythm?.cadence === 'weekly'
    ? 'week'
    : activeRhythm?.cadence === 'monthly'
      ? 'month'
    : activeRhythm?.cadence === 'periodic'
      ? 'review'
      : 'day';
  const streakTitle = params.rhythm === 'reviews'
    ? `${streakCount}-review rhythm`
    : params.rhythm
      ? `${streakCount}-${streakUnit} ${rhythmName.toLowerCase()} streak`
    : `${streakCount}-day faithful rhythm`;
  const rhythmIcon: Record<FaithfulRhythmId, string> = {
    morning: 'sunny-outline',
    evening: 'moon-outline',
    heart_journal: 'heart-outline',
    prayer: 'heart-circle-outline',
    bible_study: 'library-outline',
    session_notes: 'document-text-outline',
    reviews: 'refresh-circle-outline',
  };
  const celebrationIcon = params.rhythm ? rhythmIcon[params.rhythm] : 'checkmark-outline';
  const rhythmEyebrow = params.rhythm
    ? `${rhythmName.toUpperCase()} ${params.rhythm === 'reviews' ? 'UPDATED' : 'COMPLETE'}`
    : null;
  const streakMessage = params.rhythm === 'heart_journal' && params.source === 'scripture_note_complete'
    ? 'Your Scripture Note is saved.\nIt also counts toward your Heart Journal rhythm.'
    : params.rhythm === 'heart_journal' && params.source === 'session_notes_complete'
      ? 'Your Session Notes are complete.\nThey also count toward your Heart Journal rhythm.'
      : getStreakMessage(streakCount, params.rhythm);
  const iconMotionTransform = params.rhythm === 'morning'
    ? [{ rotate: iconMotionAnim.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) }]
    : [{ translateY: iconMotionAnim.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) }];
  const streakShareText = `${streakTitle}\n\n${streakMessage}\n\nJournal by siFia`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors.lightBackground }]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Platform.OS === 'android' ? 'transparent' : Colors.lightBackground}
        translucent={Platform.OS === 'android'}
      />
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
          accessibilityRole="button"
          accessibilityLabel="Share streak"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="paper-plane-outline" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, androidScrollInsets]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quiet routine marker */}
        <Animated.View
          style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.iconCircle}>
            <Animated.View style={{ transform: iconMotionTransform }}>
              <Ionicons name={celebrationIcon} size={44} color={Colors.sage} />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Hero text */}
        <Animated.View
          style={[styles.textContainer, { opacity: fadeAnim }]}
        >
          {rhythmEyebrow ? (
            <Text style={[styles.rhythmLabel, font]}>
              {rhythmEyebrow}
            </Text>
          ) : null}
          <Text style={[styles.heroText, font]}>{streakTitle}</Text>
          <Text style={[styles.subText, font]}>
            {streakMessage}
          </Text>

          {/* Weekly streak visual */}
          <View style={styles.streakRowWrapper}>
            <WeeklyStreakRow
              weekStart={weekStart}
              dayStates={dayStates}
              dayLabels={activeRhythm?.days.map(day => day.label)}
              appearance="light"
            />
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View
          style={[styles.buttonsContainer, IS_IPAD && styles.buttonsContainerPad, { opacity: fadeAnim }]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, font, { fontWeight: '600' }]}>
              {params.onboarding ? 'Continue My Journey' : 'Done'}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>

      <ShareComposer
        visible={showShareComposer}
        variant="streak"
        text={streakShareText}
        streakSummary={{
          routine: params.rhythm,
          rhythmLabel: rhythmEyebrow || 'FAITHFUL RHYTHM',
          iconName: celebrationIcon,
          title: streakTitle,
          message: streakMessage,
          weekStart,
          dayStates,
          dayLabels: activeRhythm?.days.map(day => day.label),
        }}
        onClose={() => setShowShareComposer(false)}
      />
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
    backgroundColor: Colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    ...(Platform.OS === 'android'
      ? {
          width: 116,
          height: 116,
          justifyContent: 'center',
          alignItems: 'center',
        }
      : {}),
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.anchorBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  rhythmLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.sageMuted,
    textAlign: 'center',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  subText: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
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
  buttonsContainerPad: {
    paddingHorizontal: 48,
    maxWidth: 800,
    alignSelf: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 'auto',
  },
  primaryButtonPad: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
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
  secondaryButtonPad: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default StreakPlanScreen;
