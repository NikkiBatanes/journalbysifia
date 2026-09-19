import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BookOpen, CalendarDays, Heart, Leaf, List, Moon, Pencil, Sparkles, Sun, Target } from 'lucide-react-native';
import { differenceInCalendarDays, endOfWeek, format, isAfter, isSameDay, isYesterday, startOfDay, startOfWeek } from 'date-fns';

import WeeklyQuickLook from '../components/dashboard/WeeklyQuickLook';
import WeeklyReviewCard from '../components/dashboard/WeeklyReviewCard';
import ReviewOverviewCard from '../components/dashboard/ReviewOverviewCard';
import PrayerToRevisit from '../components/dashboard/PrayerToRevisit';
import JournalCalendarStrip from '../components/dashboard/JournalCalendarStrip';
import DashboardHeaderScripture from '../components/dashboard/DashboardHeaderScripture';
import ForMeDayCard from '../components/dashboard/ForMeDayCard';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useScroll } from '../context/ScrollContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { compareLocalDate, toLocalDateString } from '../utils/date';
import { getReviewEligibility, type ReviewEligibilityResult } from '../services/reviewEligibilityService';
import { getLocalReviewsByType, type LocalReviewEntry, type ReviewType } from '../storage/reviewStorage';
import { getRoutineState, type RoutineState } from '../storage/routineStateStorage';
import { getLocalJournalEntries, getLocalJournalSingleton } from '../storage/journalStorage';
import { getDailyRhythmCardState, getDailyRhythmContentState, type DailyRhythmContentState } from '../services/dailyRhythmCardState';
import { refreshMorningWidgetSnapshot } from '../services/morningWidgetService';
import { getDailyLine } from '../data/dailyLines';
import { playTodayOpeningSound } from '../utils/soundUtils';
import { seedWeeklyReviewPreviewData } from '../dev/seedPreviewData';
import { getWeeklyRhythm, type WeeklyRhythm } from '../services/weeklyRhythmService';

const CALENDAR_SHEET_HEIGHT = 60;
const CALENDAR_SPRING = { damping: 12, stiffness: 185, mass: 0.85 };
const REVIEW_PREVIEW_ORDER: ReviewType[] = ['weekly', 'monthly', 'quarterly', 'year_end', 'begin_year'];

const SectionHeading = ({ title, detail }: { title: string; detail: string }) => (
  <View style={styles.sectionHeading}>
    <ThemedText style={styles.eyebrow}>{title}</ThemedText>
    <ThemedText style={styles.sectionDetail}>{detail}</ThemedText>
  </View>
);

const IconTile = ({ icon, family = 'ion' }: { icon: string; family?: 'ion' | 'material' }) => (
  <View style={styles.iconTile}>
    {family === 'material'
      ? <MaterialCommunityIcons name={icon} size={25} color={Colors.sage} />
      : <Ionicons name={icon} size={25} color={Colors.sage} />}
  </View>
);

const Stagger = ({ children }: { children: React.ReactNode }) => (
  <View style={{ width: '100%' }}>
    {React.Children.toArray(children).map((child, i) =>
      child != null ? (
        <Animated.View
          key={(child as React.ReactElement).key ?? i}
          entering={FadeInUp.delay(i * 80).springify().damping(14).stiffness(180)}
        >
          {child}
        </Animated.View>
      ) : null
    )}
  </View>
);

const TodayScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, preferences: appPreferences, profile } = useAuth();
  const { showTabBar, setShowTabBar } = useScroll();
  const scrollRef = useRef<ScrollView>(null);
  const lastScrollYRef = useRef(0);
  const tabBarCollapsedRef = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [displayDate, setDisplayDate] = useState(() => now);
  const [manualDate, setManualDate] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const calendarProgress = useSharedValue(0);
  const greetingIconScale = useSharedValue(1);
  const greetingIconRotation = useSharedValue(0);
  const greetingIconLift = useSharedValue(0);
  const [morningState, setMorningState] = useState<RoutineState | null>(null);
  const [eveningState, setEveningState] = useState<RoutineState | null>(null);
  const [previewEvening, setPreviewEvening] = useState<boolean | null>(null);
  const [previewReviewType, setPreviewReviewType] = useState<ReviewType | null>(null);
  const [futurePlanParts, setFuturePlanParts] = useState({ focus: false, todos: false });
  const [pastContent, setPastContent] = useState({ morning: false, evening: false });
  const [contentState, setContentState] = useState<DailyRhythmContentState>({
    morning: { checkIn: false, psalm: false, focus: false, priorities: false },
    evening: { gratitude: false, win: false, proverbs: false, reflection: false },
  });
  const hour = displayDate.getHours();
  const isToday = isSameDay(displayDate, now);
  const selectedDateRelation = compareLocalDate(toLocalDateString(displayDate), toLocalDateString(now));
  const isEvening = (__DEV__ ? previewEvening : null) ?? (
    isToday ? now.getHours() >= 17 : selectedDateRelation === 'past' && pastContent.evening && !pastContent.morning
  );
  const greetingText = isToday
    ? (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    : 'Hi';
  const eveningDone = eveningState?.selected_date === format(displayDate, 'yyyy-MM-dd') && eveningState.completed;
  const morningDone = morningState?.selected_date === format(displayDate, 'yyyy-MM-dd') && morningState.completed;
  const routineDone = isEvening ? eveningDone : morningDone;
  const routineStarted = isEvening
    ? Boolean(eveningState?.completed_steps.length) && !eveningState?.completed
    : Boolean(morningState?.completed_steps.length) && !morningState?.completed;
  const routineHasContent = isEvening ? pastContent.evening : pastContent.morning;
  const hasFuturePlan = futurePlanParts.focus || futurePlanParts.todos;
  const displayedContent = isEvening ? Object.values(contentState.evening) : Object.values(contentState.morning);
  const allDisplayedContent = displayedContent.every(Boolean);
  const dayOffset = differenceInCalendarDays(displayDate, now);
  const isFutureDate = selectedDateRelation === 'future';
  const rhythmTitle =
    dayOffset === 0 ? 'TODAY' :
    dayOffset === 1 ? 'TOMORROW' :
    dayOffset === -1 ? 'YESTERDAY' :
    dayOffset > 0 ? 'UPCOMING' : 'PAST';
  const rhythmDetail =
    dayOffset === 0 ? 'your daily rhythm' :
    dayOffset === 1 ? 'your tomorrow daily rhythm' :
    dayOffset === -1 ? 'your yesterday daily rhythm' :
    dayOffset > 0 ? 'your upcoming daily rhythm' : 'your past daily rhythm';

  const dateContext = (() => {
    const today = startOfDay(now);
    const day = startOfDay(displayDate);
    if (isSameDay(day, today)) { return 'today'; }
    if (isYesterday(day)) { return 'yesterday'; }
    if (isAfter(day, today)) { return 'upcoming'; }
    return 'earlier';
  })();

  const routineCardState = getDailyRhythmCardState({
    relation: selectedDateRelation,
    period: isEvening ? 'evening' : 'morning',
    dayOffset,
    hasContent: routineHasContent,
    started: routineStarted,
    completed: routineDone,
    hasFocusPlan: futurePlanParts.focus,
    hasTodoPlan: futurePlanParts.todos,
    allDisplayedContent,
  });
  const routineTitle = routineCardState.title;

  const weekStartsOn = Math.max(0, ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(appPreferences?.weekStart || 'monday')) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const weekLabel = useMemo(() => {
    const start = startOfWeek(displayDate, { weekStartsOn });
    const end = endOfWeek(displayDate, { weekStartsOn });
    return `${format(start, 'MMM d')}–${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`.toUpperCase();
  }, [displayDate, weekStartsOn]);
  const dailyLine = getDailyLine(now, isEvening ? 'evening' : 'morning');
  const firstName = useMemo(() => {
    const metadata = profile;
    const value = metadata?.first_name || metadata?.full_name || user?.email?.split('@')[0] || 'Friend';
    const parts = String(value).trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ') || 'Friend';
  }, [user, profile]);

  const animateGreetingIcon = useCallback((evening: boolean) => {
    greetingIconScale.value = withSequence(
      withTiming(1.22, { duration: 280, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 8, stiffness: 170, mass: 0.7 }),
    );
    greetingIconLift.value = withSequence(
      withTiming(-4, { duration: 280, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 9, stiffness: 160 }),
    );
    greetingIconRotation.value = evening
      ? withSequence(
          withTiming(-14, { duration: 260, easing: Easing.out(Easing.cubic) }),
          withTiming(8, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 150 }),
        )
      : withTiming(360, { duration: 1050, easing: Easing.inOut(Easing.cubic) });
  }, [greetingIconLift, greetingIconRotation, greetingIconScale]);

  useEffect(() => {
    if (isToday) {
      let mounted = true;
      playTodayOpeningSound(() => {
        if (!mounted) { return; }
        animateGreetingIcon(isEvening);
      }).catch(() => {});

      return () => {
        mounted = false;
      };
    }
  }, [animateGreetingIcon, isEvening, isToday]);

  useEffect(() => {
    if (__DEV__ && previewEvening !== null) {
      animateGreetingIcon(previewEvening);
    }
  }, [animateGreetingIcon, previewEvening]);

  const greetingIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: greetingIconLift.value },
      { scale: greetingIconScale.value },
      { rotate: `${greetingIconRotation.value}deg` },
    ],
  }));

  useEffect(() => {
    if (!manualDate && !isSameDay(displayDate, now)) {
      setDisplayDate(now);
    }
  }, [now, manualDate, displayDate]);

  const [eligibility, setEligibility] = useState<ReviewEligibilityResult | null>(null);
  const [weeklyReviews, setWeeklyReviews] = useState<LocalReviewEntry[]>([]);
  const [seededWeeklyRhythm, setSeededWeeklyRhythm] = useState<WeeklyRhythm | null>(null);
  const [reviewDataReady, setReviewDataReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [staggerRun, setStaggerRun] = useState(0);
  const todayKey = format(now, 'yyyy-MM-dd');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // Seed before querying eligibility so a fresh simulator sees the
        // populated review on its very first Today render.
        await seedWeeklyReviewPreviewData(appPreferences?.weekStart || 'monday');
        const [nextEligibility, reviews] = await Promise.all([
          getReviewEligibility(todayKey, appPreferences?.weekStart || 'monday'),
          getLocalReviewsByType('weekly'),
        ]);
        const weeklyPeriod = nextEligibility.allActive.find(item => item.type === 'weekly')?.period;
        const verifiedRhythm = weeklyPeriod
          ? await getWeeklyRhythm(weeklyPeriod.periodStart, weeklyPeriod.periodEnd, todayKey)
          : null;
        if (!active) { return; }
        // Commit both sources together so review cards cannot insert at
        // different points in the opening stagger.
        setEligibility(nextEligibility);
        setWeeklyReviews(reviews);
        setSeededWeeklyRhythm(verifiedRhythm);
        setReviewDataReady(true);
        setStaggerRun(run => run + 1);
      } catch (error) {
        if (__DEV__) {console.error('[PreviewData] Today seed/load failed', error);}
        if (active) {
          setReviewDataReady(true);
          setStaggerRun(run => run + 1);
        }
      }
    })();
    return () => { active = false; };
  }, [tick, appPreferences?.weekStart, todayKey]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('previewDataSeeded', () => {
      setReviewDataReady(false);
      setTick(current => current + 1);
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Keep stale cards from flashing before the refreshed stagger mounts.
      setReviewDataReady(false);
      setTick((t) => t + 1);
      let focused = true;
      let loadVersion = 0;
      const refreshMorning = async () => {
        const version = ++loadVersion;
        setNow(new Date());
        try {
          const [morning, evening, focus, todos, derivedContent] = await Promise.all([
            getRoutineState('morning', displayDate),
            getRoutineState('evening', displayDate),
            isFutureDate ? getLocalJournalSingleton('todays_focus', displayDate) : Promise.resolve(null),
            isFutureDate ? getLocalJournalEntries('todo', displayDate) : Promise.resolve([]),
            isFutureDate ? Promise.resolve(null) : getDailyRhythmContentState(displayDate),
          ]);
          if (focused && version === loadVersion) {
            setMorningState(morning);
            setEveningState(evening);
            setFuturePlanParts(isFutureDate ? { focus: Boolean(focus), todos: todos.length > 0 } : { focus: false, todos: false });
            const nextContent = derivedContent ?? {
              morning: { checkIn: false, psalm: false, focus: false, priorities: false },
              evening: { gratitude: false, win: false, proverbs: false, reflection: false },
            };
            setContentState(nextContent);
            const routineMeaningful = (state: RoutineState | null) => Boolean(
              state?.completed || state?.completed_steps.length || Object.keys(state?.content_refs ?? {}).length,
            );
            setPastContent({
              morning: routineMeaningful(morning) || Object.values(nextContent.morning).some(Boolean),
              evening: routineMeaningful(evening) || Object.values(nextContent.evening).some(Boolean),
            });
          }
        } catch {
          if (focused && version === loadVersion) {
            setMorningState(null);
            setEveningState(null);
            setFuturePlanParts({ focus: false, todos: false });
            setPastContent({ morning: false, evening: false });
            setContentState({
              morning: { checkIn: false, psalm: false, focus: false, priorities: false },
              evening: { gratitude: false, win: false, proverbs: false, reflection: false },
            });
          }
        }
      };
      void refreshMorning();
      void refreshMorningWidgetSnapshot();
      const saved = DeviceEventEmitter.addListener('reflection_saved', () => { void refreshMorning(); });
      const planSaved = DeviceEventEmitter.addListener('future_plan_saved', () => { void refreshMorning(); });
      const timer = setInterval(() => { void refreshMorning(); }, 60000);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
      lastScrollYRef.current = 0;
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);

      return () => {
        focused = false;
        setReviewDataReady(false);
        saved.remove();
        planSaved.remove();
        clearInterval(timer);
        cancelAnimationFrame(frame);
        tabBarCollapsedRef.current = false;
        setShowTabBar(true);
      };
    }, [setShowTabBar, displayDate, isFutureDate])
  );

  useEffect(() => {
    if (showTabBar && lastScrollYRef.current > 60) {
      tabBarCollapsedRef.current = false;
    }
  }, [showTabBar]);

  const selectedWeekStart = format(startOfWeek(displayDate, { weekStartsOn }), 'yyyy-MM-dd');
  const selectedWeekEnd = format(endOfWeek(displayDate, { weekStartsOn }), 'yyyy-MM-dd');
  const selectedWeeklyReview = weeklyReviews.find(review =>
    review.status === 'completed'
    && review.periodStart === selectedWeekStart
    && review.periodEnd === selectedWeekEnd,
  ) ?? null;

  const previewEligibility = useMemo<ReviewEligibilityResult | null>(() => {
    if (!__DEV__ || !previewReviewType) { return null; }

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const previewDates: Record<ReviewType, { start: Date; end: Date }> = {
      weekly: {
        start: startOfWeek(displayDate, { weekStartsOn }),
        end: endOfWeek(displayDate, { weekStartsOn }),
      },
      monthly: {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
      },
      quarterly: {
        start: new Date(year, Math.floor(month / 3) * 3, 1),
        end: new Date(year, Math.floor(month / 3) * 3 + 3, 0),
      },
      year_end: {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      },
      begin_year: {
        start: new Date(year, 0, 1),
        end: new Date(year, 0, 14),
      },
    };
    const dates = previewDates[previewReviewType];
    const periodStart = format(dates.start, 'yyyy-MM-dd');
    const periodEnd = format(dates.end, 'yyyy-MM-dd');
    const previewMemories = previewReviewType === 'begin_year' ? [] : [
      { kind: 'prayer' as const, id: 'preview-prayer', selectedDate: periodEnd },
      { kind: 'gratitude' as const, id: 'preview-gratitude', selectedDate: periodEnd },
      { kind: 'win' as const, id: 'preview-win', selectedDate: periodEnd },
      { kind: 'scripture' as const, id: 'preview-scripture', selectedDate: periodEnd },
      { kind: 'reflection' as const, id: 'preview-reflection', selectedDate: periodEnd },
    ];
    const previewAnswers: Record<string, string> = previewReviewType === 'begin_year'
      ? {
          begin_year_priority_1: 'Walk closely with God',
          begin_year_priority_2: 'Make room for family',
          posture: 'Open-handed',
          scripture_begin: 'Proverbs 3:5–6',
          faithfulness_begin: 'Be present in ordinary days',
          surrender: 'The outcomes I cannot control',
        }
      : previewReviewType === 'quarterly'
        ? { quarter_priority_1: 'Protect what matters', quarter_priority_2: 'Finish faithfully' }
        : previewReviewType === 'year_end'
          ? { carry: 'God was faithful through every season.' }
          : { next_month_priority_1: 'Begin with prayer', next_month_priority_2: 'Stay present' };
    const preview = {
      type: previewReviewType,
      period: {
        type: previewReviewType,
        periodStart,
        periodEnd,
        availableFrom: periodStart,
        availableUntil: null,
      },
      review: {
        id: `preview-${previewReviewType}`,
        type: previewReviewType,
        periodStart,
        periodEnd,
        status: 'draft' as const,
        memorableItems: previewMemories,
        answers: previewAnswers,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    };
    return { main: preview, alsoReady: [], allActive: [preview] };
  }, [displayDate, previewReviewType, weekStartsOn]);

  const displayedEligibility = previewEligibility ?? eligibility;

  const handleScroll = useCallback((event: any) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (calendarVisible) {
      setCalendarVisible(false);
      calendarProgress.value = withSpring(0, CALENDAR_SPRING);
    }

    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar, calendarVisible, calendarProgress]);

  const toggleCalendar = useCallback(() => {
    triggerLightHaptic();
    const next = !calendarVisible;
    setCalendarVisible(next);
    calendarProgress.value = withSpring(next ? 1 : 0, CALENDAR_SPRING);
  }, [calendarVisible, calendarProgress]);

  const calendarSheetStyle = useAnimatedStyle(() => ({
    height: Math.max(0, calendarProgress.value * CALENDAR_SHEET_HEIGHT),
    opacity: Math.min(1, calendarProgress.value * 1.4),
    transform: [{ scaleY: 0.96 + Math.min(1, calendarProgress.value) * 0.04 }],
  }));

  const reviewCard = useMemo(() => {
    if (!displayedEligibility?.main) {return null;}
    const main = displayedEligibility.main;
    if (main.review.status === 'completed') {return null;}

    if (main.type === 'weekly') {
      return <WeeklyReviewCard
        key={`${main.period.periodStart}:${main.period.periodEnd}`}
        periodStart={main.period.periodStart}
        periodEnd={main.period.periodEnd}
        started={main.review.memorableItems.length > 0 || Object.values(main.review.answers).some(answer => answer.trim().length > 0)}
        seededRhythm={seededWeeklyRhythm}
        alsoReady={displayedEligibility.alsoReady.map(item => item.type.replace('_', ' ')).join(', ')}
        onBegin={() => (navigation as any).navigate('Journal', {
          screen: 'Review',
          params: { type: 'weekly', periodStart: main.period.periodStart, periodEnd: main.period.periodEnd },
        })}
      />;
    }

    const periodStart = new Date(main.period.periodStart);
    const periodEnd = new Date(main.period.periodEnd);
    const month = periodStart.toLocaleString('default', { month: 'short' }).toUpperCase();
    const sameYear = periodStart.getFullYear() === periodEnd.getFullYear();
    const sameMonth = sameYear && periodStart.getMonth() === periodEnd.getMonth();
    const periodText = sameMonth
      ? `${month} ${periodStart.getDate()}–${periodEnd.getDate()}, ${periodEnd.getFullYear()}`
      : `${format(periodStart, 'MMM d, yyyy')}–${format(periodEnd, 'MMM d, yyyy')}`;

    return (
      <ReviewOverviewCard
        review={main.review}
        periodLabel={periodText}
        alsoReady={displayedEligibility.alsoReady.map(item => item.type.replace('_', ' ')).join(', ')}
        onBegin={() => {
          (navigation as any).navigate('Journal', {
            screen: 'Review',
            params: { type: main.type, periodStart: main.period.periodStart, periodEnd: main.period.periodEnd },
          });
        }}
      />
    );
  }, [displayedEligibility, navigation, seededWeeklyRhythm]);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.headerColumn}>
          <Animated.View
            style={[styles.calendarSheet, calendarSheetStyle]}
            pointerEvents={calendarVisible ? 'auto' : 'none'}
            accessibilityElementsHidden={!calendarVisible}
          >
            <View>
              <JournalCalendarStrip
                currentDate={displayDate}
                onSelectDate={(date) => {
                  triggerLightHaptic();
                  setManualDate(true);
                  const picked = new Date(date);
                  if (isSameDay(picked, now)) {
                    picked.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
                  } else {
                    picked.setHours(0, 0, 0, 0);
                  }
                  setDisplayDate(picked);
                }}
                weekStartsOn={weekStartsOn}
              />
            </View>
          </Animated.View>
          <View style={styles.headerIconsRow}>
            <TouchableOpacity
              style={styles.calendarButton}
              activeOpacity={0.7}
              onPress={toggleCalendar}
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
            >
              <CalendarDays size={24} color={Colors.text} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerGreeting}>
            <ThemedText style={styles.date}>{format(displayDate, 'EEE, MMM d').toUpperCase()}</ThemedText>
            <ThemedText style={styles.greeting}>{greetingText},</ThemedText>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name}>{firstName}.</ThemedText>
              <Animated.View style={greetingIconStyle}>
                {isEvening ? (
                  <Moon size={24} color={Colors.sage} strokeWidth={1.6} />
                ) : (
                  <Sun size={24} color={Colors.sage} strokeWidth={1.6} />
                )}
              </Animated.View>
            </View>
            {isToday ? (
              <ThemedText style={styles.subtitle}>{dailyLine.text}</ThemedText>
            ) : null}
          </View>
          <DashboardHeaderScripture
            date={displayDate}
            bibleVersion={appPreferences?.content?.bibleVersion || 'NASB'}
            centered
          />
        </View>

        {dateContext === 'today' ? <ForMeDayCard /> : null}

        {reviewDataReady ? <Stagger key={staggerRun}>
        {dateContext === 'today' ? <React.Fragment key="review-card">{reviewCard}</React.Fragment> : null}

        <SectionHeading key="rhythm-heading" title={rhythmTitle} detail={rhythmDetail} />
        <TouchableOpacity
          key="rhythm-card"
          style={[styles.card, styles.morningCard]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isFutureDate ? (hasFuturePlan ? 'Edit this plan' : 'Plan this day') : selectedDateRelation === 'past' ? (routineHasContent ? `Revisit this ${isEvening ? 'evening' : 'morning'}` : `Reflect on this ${isEvening ? 'evening' : 'morning'}`) : isEvening ? (routineDone ? "View your saved evening" : "Begin your evening reflection") : (routineDone ? "View your saved morning" : "Begin your morning check-in")}
          onPress={isFutureDate ? () => {
            triggerLightHaptic();
            (navigation as any).navigate('FuturePlanning', {
              selectedDate: toLocalDateString(displayDate),
              isTomorrow: dayOffset === 1,
            });
          } : () => {
            triggerLightHaptic();
            if (isEvening) {
              (navigation as any).navigate('EveningFlow', {
                selectedDate: toLocalDateString(displayDate),
                ...(routineDone ? {
                  screen: 'EveningClosing',
                  params: { selectedDate: toLocalDateString(displayDate) },
                } : {}),
              });
            } else {
              (navigation as any).navigate('MorningFlow', {
                selectedDate: toLocalDateString(displayDate),
                ...(routineDone ? { screen: 'MorningClosing' } : {}),
              });
            }
          }}
        >
          <View style={styles.morningTop}>
            <View style={styles.routineIcon}>
              <Ionicons name={isFutureDate ? 'sunny-outline' : isEvening ? 'moon-outline' : 'sunny-outline'} size={24} color={Colors.sage} />
            </View>
            <View style={styles.morningCopy}>
              <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.morningTitle}>{routineTitle}</Text>
              <ThemedText style={styles.morningDescription}>{isFutureDate ? 'Set what matters before the day begins.' : selectedDateRelation === 'past' ? (routineHasContent ? 'Return to what you recorded without losing your progress.' : 'Make space to reflect on this day.') : isEvening ? (routineDone ? 'You’ve given thanks and closed your day with God.' : 'Give thanks, reflect, and rest your heart in God.') : (routineDone ? 'You’ve paused, reflected, and set your heart on what matters.' : 'Pause, reflect, and set your heart on what matters.')}</ThemedText>
            </View>
            <View style={styles.routineBegin}>
              {(!routineDone || isFutureDate || selectedDateRelation === 'past') && <Pencil size={14} color={Colors.hopeWhite} />}
              <ThemedText style={styles.beginButtonText}>{routineCardState.cta}</ThemedText>
            </View>
          </View>
          {isFutureDate && <>
            <View style={styles.futurePlanningSteps}>
              {([
                { label: 'Set Focus', Icon: Target, complete: futurePlanParts.focus },
                { label: 'Priorities', Icon: List, complete: futurePlanParts.todos },
              ] as const).map(({ label, Icon, complete }, index) => (
                <React.Fragment key={label}>
                  {index > 0 && <View style={styles.futureStepDivider} />}
                  <View style={styles.futurePlanningStep}>
                    <View style={[styles.routineStepIcon, complete && styles.routineStepIconComplete]}>
                      <Icon size={18} strokeWidth={1.7} color={complete ? Colors.hopeWhite : Colors.sage} />
                      {complete && <View style={styles.plannedCheck}><Ionicons name="checkmark" size={9} color={Colors.sage} /></View>}
                    </View>
                    <ThemedText style={styles.morningStepLabel}>{label}</ThemedText>
                  </View>
                </React.Fragment>
              ))}
            </View>
            <ThemedText style={styles.planningNote}>Morning and evening reflection will be available {dayOffset === 1 ? 'tomorrow' : 'that day'}.</ThemedText>
          </>}
          {!isFutureDate && <View style={styles.morningSteps}>
            {(isEvening ? [
              { label: 'Gratitude', Icon: Heart, complete: contentState.evening.gratitude },
              { label: 'Win', Icon: Sparkles, complete: contentState.evening.win },
              { label: 'Proverbs', Icon: BookOpen, complete: contentState.evening.proverbs },
              { label: 'Reflection', Icon: Leaf, complete: contentState.evening.reflection },
            ] : [
              { label: 'Check in', Icon: Leaf, complete: contentState.morning.checkIn },
              { label: 'Psalm', Icon: BookOpen, complete: contentState.morning.psalm },
              { label: 'Set Focus', Icon: Target, complete: contentState.morning.focus },
              { label: 'Priorities', Icon: List, complete: contentState.morning.priorities },
            ]).map(({ label, Icon, complete }, index) => (
              <React.Fragment key={label}>
                {index > 0 && <View style={styles.morningStepDivider} />}
                <View style={styles.morningStep}>
                  <View style={[styles.routineStepIcon, complete && styles.routineStepIconComplete]}>
                    <Icon size={18} strokeWidth={1.6} color={complete ? Colors.hopeWhite : Colors.sage} />
                    {complete && <View style={styles.plannedCheck}><Ionicons name="checkmark" size={9} color={Colors.sage} /></View>}
                  </View>
                  <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.morningStepLabel}>{label}</ThemedText>
                </View>
              </React.Fragment>
            ))}
          </View>}
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity
            key="period-preview"
            style={styles.routinePreviewButton}
            accessibilityRole="button"
            accessibilityLabel={isEvening ? 'Preview morning check-in' : 'Preview evening reflection at 5 PM'}
            onPress={() => { triggerLightHaptic(); setPreviewEvening(!isEvening); }}
          >
            <ThemedText style={styles.routinePreviewText}>{isEvening ? 'Preview morning' : 'Preview 5 PM'}</ThemedText>
          </TouchableOpacity>
        )}

        {__DEV__ && (
          <TouchableOpacity
            key="review-preview"
            style={styles.routinePreviewButton}
            accessibilityRole="button"
            accessibilityLabel="Preview review cards"
            onPress={() => {
              triggerLightHaptic();
              setPreviewReviewType(current => {
                if (current === null) { return REVIEW_PREVIEW_ORDER[0]; }
                const nextIndex = REVIEW_PREVIEW_ORDER.indexOf(current) + 1;
                return nextIndex < REVIEW_PREVIEW_ORDER.length ? REVIEW_PREVIEW_ORDER[nextIndex] : null;
              });
            }}
          >
            <ThemedText style={styles.routinePreviewText}>
              {previewReviewType
                ? `Preview: ${previewReviewType.replace('_', ' ')}`
                : 'Preview reviews'}
            </ThemedText>
          </TouchableOpacity>
        )}

        <SectionHeading key="quick-look-heading" title="A QUICK LOOK" detail={weekLabel} />
        <WeeklyQuickLook key="quick-look-card" start={format(startOfWeek(displayDate, { weekStartsOn }), 'yyyy-MM-dd')} end={format(endOfWeek(displayDate, { weekStartsOn }), 'yyyy-MM-dd')} />

        {selectedWeeklyReview ? <React.Fragment key="weekly-review-memory">
        <SectionHeading title="YOUR RHYTHM" detail="for this season" />
          <TouchableOpacity
            style={[styles.card, styles.weeklyPreviewCard]}
            activeOpacity={0.7}
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'Review',
                params: {
                  type: 'weekly',
                  periodStart: selectedWeeklyReview.periodStart,
                  periodEnd: selectedWeeklyReview.periodEnd,
                },
              });
            }}>
            <ThemedText style={styles.cardLabel}>FROM YOUR WEEK · {weekLabel}</ThemedText>
            <ThemedText style={styles.compactTitle}>You said this mattered.</ThemedText>
            {(['priority_1', 'priority_2', 'priority_3'] as const).map(key =>
              selectedWeeklyReview.answers[key]?.trim() ? (
                <View key={key} style={styles.priorityRow}>
                  <ThemedText style={styles.priorityBullet}>○</ThemedText>
                  <ThemedText style={styles.priorityText}>{selectedWeeklyReview.answers[key]}</ThemedText>
                </View>
              ) : null,
            )}
            {selectedWeeklyReview.answers.faithful_step?.trim() ? (
              <View style={styles.faithfulStepBox}>
                <ThemedText style={styles.meta}>One faithful step</ThemedText>
                <ThemedText style={styles.faithfulStepText}>{selectedWeeklyReview.answers.faithful_step}</ThemedText>
              </View>
            ) : null}
            <ThemedText style={styles.textLink}>Look back into this week →</ThemedText>
          </TouchableOpacity>
        </React.Fragment> : null}

        {!isFutureDate && <React.Fragment key="journal-section">
        <SectionHeading title="JOURNAL" detail="write anytime" />
        <TouchableOpacity
          style={[styles.card, styles.rowCard]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open Heart Journal"
          onPress={() => {
            triggerLightHaptic();
            (navigation as any).navigate('Journal', {
              screen: 'ReflectionEditor',
              params: {
                selectedDate: toLocalDateString(displayDate),
                initialMode: 'free-form',
                source: 'freeform',
                fromCarousel: true,
                openHeart: true,
                returnTo: 'Today',
              },
            });
          }}
        >
          <IconTile icon="heart" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Heart Journal</ThemedText>
            <ThemedText style={styles.meta}>What’s on your heart right now?</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </TouchableOpacity>
        <View style={styles.twoColumns}>
          <TouchableOpacity
            style={[styles.card, styles.smallCard]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open a guided reflection"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'ReflectionEditor',
                params: {
                  selectedDate: toLocalDateString(displayDate),
                  initialMode: 'guided',
                  source: 'guided',
                  fromCarousel: true,
                  openHeart: true,
                  returnTo: 'Today',
                },
              });
            }}>
            <IconTile icon="sunny" />
            <ThemedText weight="bold" style={styles.smallTitle}>Reflection</ThemedText>
            <ThemedText style={styles.meta}>Choose a gentle prompt.</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.smallCard]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Bible Study"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'BibleStudy',
                params: {
                  openMode: 'create',
                  openRequestId: `${Date.now()}-${Math.random()}`,
                  sessionId: null,
                  reflectionId: null,
                  selectedDate: toLocalDateString(displayDate),
                  returnTo: 'Today',
                },
              });
            }}
          >
            <IconTile icon="book" family="material" />
            <ThemedText weight="bold" style={styles.smallTitle}>Bible Study</ThemedText>
            <ThemedText style={styles.meta}>Read, notice, and go deeper.</ThemedText>
          </TouchableOpacity>
        </View>
        </React.Fragment>}

        {dateContext === 'today' && <React.Fragment key="prayer-section">
        <SectionHeading title="PRAYER" detail="bring it before God" />
        <TouchableOpacity
          style={[styles.card, styles.rowCard]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open Prayer"
          onPress={() => { triggerLightHaptic(); (navigation as any).navigate('Prayer'); }}>
          <IconTile icon="clover" family="material" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Prayer Journal</ThemedText>
            <ThemedText style={styles.meta}>Open Prayer · CAST · Pray for Someone</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </TouchableOpacity>
        <PrayerToRevisit />
        </React.Fragment>}

        {!isFutureDate && <TouchableOpacity
          key="write-anything"
          style={styles.writeButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Write anything"
          onPress={() => {
            triggerLightHaptic();
            (navigation as any).navigate('Journal', {
              screen: 'ReflectionEditor',
              params: {
                selectedDate: toLocalDateString(displayDate),
                initialMode: 'free-form',
                source: 'freeform',
                fromCarousel: true,
                returnTo: 'Today',
              },
            });
          }}>
          <Pencil size={16} color={Colors.hopeWhite} style={{ marginRight: 8 }} />
          <ThemedText weight="bold" style={styles.writeButtonText}>Write anything</ThemedText>
        </TouchableOpacity>}
        <ThemedText key="closing" style={styles.closing}>Nothing on Today has to be completed.</ThemedText>

        </Stagger> : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.lightBackground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, maxWidth: 760, width: '100%', alignSelf: 'center' },
  date: { color: Colors.sageMuted, fontFamily: Fonts.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.8 },
  greeting: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 31, lineHeight: 39, marginTop: 8, letterSpacing: -0.5 },
  name: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 31, lineHeight: 39, letterSpacing: -0.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtitle: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 4 },
  headerColumn: { width: '100%', alignItems: 'center', marginBottom: 24 },
  headerIconsRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', padding: 4, gap: 4 },
  notificationsButton: { padding: 4 },
  calendarButton: { padding: 4 },
  headerGreeting: { width: '100%', alignItems: 'flex-start' },
  calendarSheet: { width: '100%', backgroundColor: Colors.hopeWhite, borderRadius: 22, overflow: 'hidden' },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  eyebrow: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  sectionDetail: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  card: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: Colors.darkBackground, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  morningCard: { width: '100%', minHeight: 205,  paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18, overflow: 'hidden' },
  routineEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  routinePreviewButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: Colors.inputBorder, marginTop: 10 },
  routinePreviewText: { color: Colors.sage, fontSize: 12 },
  routineIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  routineBegin: { borderRadius: 22, backgroundColor: Colors.sage, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: 142 },
  routineStepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  routineStepIconComplete: { backgroundColor: Colors.sage },
  plannedCheck: { position: 'absolute', right: -3, bottom: -2, width: 15, height: 15, borderRadius: 8, backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  morningCopy: { flex: 1, minWidth: 0 },
  morningTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  morningEyebrow: { color: Colors.sage, fontSize: 10, lineHeight: 15, letterSpacing: 2.5 },
  morningTitle: { color: Colors.text, fontFamily: Fonts.semiBold, fontSize: 21, lineHeight: 28 },
  morningDoneLabel: { color: Colors.sage, fontSize: 10, letterSpacing: 1.5, marginTop: 12 },
  morningDescription: { color: Colors.textGray, fontSize: 12, lineHeight: 19, marginTop: 6 },
  planningNote: { color: Colors.textGray, fontSize: 10, lineHeight: 15, marginTop: 12, textAlign: 'center' },
  futurePlanningSteps: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingHorizontal: 32 },
  futurePlanningStep: { flex: 1, alignItems: 'center', gap: 8 },
  futureStepDivider: { width: 1, height: 44, backgroundColor: Colors.cardBorder, marginHorizontal: 24 },
  morningSteps: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  morningStep: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', gap: 8 },
  morningStepLabel: { color: Colors.text, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  morningStepDivider: { width: 1, height: 32, backgroundColor: Colors.cardBorder },
  heroCard: { padding: 20 },
  sunCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage, marginBottom: 16 },
  moonCircle: { backgroundColor: Colors.anchorBlueLight },
  cardTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 23, lineHeight: 30, marginBottom: 7, letterSpacing: -0.35 },
  compactTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 21, lineHeight: 28, marginTop: 9, marginBottom: 6, letterSpacing: -0.3 },
  body: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  meta: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 19 },
  cardLabel: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.7 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  button: { backgroundColor: Colors.sage, paddingHorizontal: 17, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  beginButton: { backgroundColor: Colors.sage, borderWidth: 1, borderColor: Colors.sage, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, minWidth: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  beginButtonIcon: { marginRight: 8 },
  beginButtonText: { fontSize: 15, color: Colors.hopeWhite, letterSpacing: 0.5 },
  leftButton: { alignSelf: 'flex-start', marginTop: 16 },
  buttonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 12 },
  rowCard: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconTile: { width: 52, height: 52, borderRadius: 18, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  twoColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  smallCard: { flex: 1, minHeight: 154, justifyContent: 'space-between', padding: 16 },
  smallTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, marginTop: 16 },
  memoryCard: { overflow: 'hidden', marginBottom: 12 },
  memoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  quote: { color: Colors.text, fontFamily: Fonts.lora.medium, fontSize: 22, lineHeight: 32, marginVertical: 18 },
  textLink: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12.5, marginTop: 18 },
  prayerMemory: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12 },
  writeButton: { height: 58, borderRadius: 20, backgroundColor: Colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  writeButtonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 17 },
  closing: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 12 },
  reviewCard: { backgroundColor: Colors.sage, borderColor: Colors.sage, marginBottom: 4 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewEyebrow: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 1.5, opacity: 0.9 },
  reviewTitle: { color: Colors.hopeWhite, fontFamily: Fonts.bold, fontSize: 21, marginTop: 6 },
  reviewPeriod: { color: Colors.hopeWhite, fontFamily: Fonts.regular, fontSize: 14, marginTop: 2, opacity: 0.95 },
  reviewAlso: { color: Colors.hopeWhite, fontFamily: Fonts.regular, fontSize: 12, marginTop: 10, opacity: 0.85 },
  weeklyPreviewCard: { padding: 18 },
  priorityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  priorityBullet: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 21 },
  priorityText: { color: Colors.text, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, flex: 1 },
  faithfulStepBox: { marginTop: 18, padding: 14, backgroundColor: Colors.anchorBlueLight, borderRadius: 14 },
  faithfulStepText: { color: Colors.text, fontFamily: Fonts.lora.medium, fontSize: 17, lineHeight: 24, marginTop: 6 },
});

export default TodayScreen;
