import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllRoutineStates, type RoutineState, type RoutineType } from '../storage/routineStateStorage';
import { getLocalReviewsByType, type LocalReviewEntry, type ReviewType } from '../storage/reviewStorage';
import { fromLocalDateString, toLocalDateString } from '../utils/date';
import { resolveSessionNoteType } from '../types/sessionNotes';
import { getCanonicalMomentTimeline, type MomentTimelineItem } from './momentTimelineService';

export const FAITHFUL_RHYTHM_UPDATED = 'faithful_rhythm_updated';

export type FaithfulRhythmId =
  | RoutineType
  | 'heart_journal'
  | 'prayer'
  | 'bible_study'
  | 'session_notes'
  | 'reviews';

export type RhythmCadence = 'daily' | 'weekly' | 'monthly' | 'periodic';

export type RhythmDayStatus = 'complete' | 'partial' | 'open' | 'future';

export interface RhythmDay {
  date: string;
  label: string;
  status: RhythmDayStatus;
  progress: number;
}

export interface RoutineRhythmSnapshot {
  id: FaithfulRhythmId;
  label: string;
  cadence: RhythmCadence;
  unitLabel: 'days' | 'weeks' | 'months' | 'reviews';
  days: RhythmDay[];
  weekCompleted: number;
  weekEligible: number;
  weeklyPercent: number;
  todayProgress: number;
  currentStreak: number;
  longestStreak: number;
}

export interface FaithfulRhythmsSnapshot {
  morning: RoutineRhythmSnapshot;
  evening: RoutineRhythmSnapshot;
  heart_journal: RoutineRhythmSnapshot;
  prayer: RoutineRhythmSnapshot;
  bible_study: RoutineRhythmSnapshot;
  session_notes: RoutineRhythmSnapshot;
  reviews: RoutineRhythmSnapshot;
}

export const FAITHFUL_RHYTHM_ORDER: FaithfulRhythmId[] = [
  'morning', 'evening', 'heart_journal', 'prayer',
  'bible_study', 'session_notes', 'reviews',
];

const RHYTHM_LABELS: Record<FaithfulRhythmId, string> = {
  morning: 'Morning',
  evening: 'Evening',
  heart_journal: 'Heart Journal',
  prayer: 'Prayer',
  bible_study: 'Bible Study',
  session_notes: 'Sunday Sermons',
  reviews: 'Reviews',
};

const REVIEW_TYPES: ReviewType[] = ['weekly', 'monthly', 'quarterly', 'year_end', 'begin_year'];
const HEART_JOURNAL_TYPES = new Set(['free', 'freeform', 'free-form', 'guided', 'thought', 'thoughts', 'reflection']);

const celebrationBucket = (
  id: FaithfulRhythmId,
  selectedDate: string,
  weekStart: string,
): string => {
  if (id === 'session_notes') {return selectedDate.slice(0, 7);}
  if (id !== 'bible_study') {return selectedDate;}
  return toLocalDateString(startOfWeek(fromLocalDateString(selectedDate), weekStart));
};

export const claimFaithfulRhythmCelebration = async (
  id: FaithfulRhythmId,
  selectedDate = toLocalDateString(new Date()),
  weekStart = 'monday',
): Promise<boolean> => {
  const bucket = celebrationBucket(id, selectedDate, weekStart);
  const key = `faithful_rhythm_celebrated:${id}:${bucket}`;
  if (await AsyncStorage.getItem(key)) {return false;}
  await AsyncStorage.setItem(key, 'true');
  return true;
};

const DAY_NUMBERS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// These correspond to the four sections presented on the Today card. Some
// sections contain more than one screen; the last persisted step represents
// completion of the visible section.
const PROGRESS_STEPS: Record<RoutineType, readonly string[]> = {
  morning: ['underneath', 'carry', 'todays_focus', 'todos'],
  evening: ['gratitude', 'win', 'proverbs', 'looking_forward'],
};

const addCalendarDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const startOfLocalDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const mergeStatesByDate = (
  routine: RoutineType,
  states: RoutineState[],
): Map<string, RoutineState> => {
  const byDate = new Map<string, RoutineState>();

  states.forEach(state => {
    if (state.routine !== routine || !/^\d{4}-\d{2}-\d{2}$/.test(state.selected_date)) {
      return;
    }

    const existing = byDate.get(state.selected_date);
    if (!existing) {
      byDate.set(state.selected_date, state);
      return;
    }

    byDate.set(state.selected_date, {
      ...existing,
      ...state,
      completed: existing.completed || state.completed,
      completed_steps: Array.from(new Set([
        ...(existing.completed_steps ?? []),
        ...(state.completed_steps ?? []),
      ])),
    });
  });

  return byDate;
};

export const getRoutineProgress = (
  routine: RoutineType,
  state: RoutineState | null | undefined,
): number => {
  if (!state) {return 0;}
  if (state.completed) {return 100;}

  const completed = new Set(state.completed_steps ?? []);
  const finishedSections = PROGRESS_STEPS[routine].filter(step => completed.has(step)).length;
  return Math.round((finishedSections / PROGRESS_STEPS[routine].length) * 100);
};

const getStreaks = (
  statesByDate: Map<string, RoutineState>,
  today: Date,
): { currentStreak: number; longestStreak: number } => {
  const todayString = toLocalDateString(today);
  return getDateStreaks(
    Array.from(statesByDate.values())
      .filter(state => state.completed && state.selected_date <= todayString)
      .map(state => state.selected_date),
    today,
  );
};

const getDateStreaks = (
  dates: string[],
  today: Date,
): { currentStreak: number; longestStreak: number } => {
  const todayString = toLocalDateString(today);
  const completedDates = new Set(dates.filter(date => date <= todayString));

  const sortedDates = Array.from(completedDates).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;

  sortedDates.forEach(dateString => {
    const date = fromLocalDateString(dateString);
    const followsPrevious = previousDate
      && toLocalDateString(addCalendarDays(previousDate, 1)) === dateString;
    runningStreak = followsPrevious ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = date;
  });

  // Today remains an open opportunity. A streak completed through yesterday
  // should not disappear at midnight before the user can do today's routine.
  let cursor = completedDates.has(todayString) ? today : addCalendarDays(today, -1);
  let currentStreak = 0;
  while (completedDates.has(toLocalDateString(cursor))) {
    currentStreak += 1;
    cursor = addCalendarDays(cursor, -1);
  }

  return { currentStreak, longestStreak };
};

export const buildRoutineRhythmSnapshot = (
  routine: RoutineType,
  states: RoutineState[],
  weekStart: string = 'monday',
  referenceDate: Date = new Date(),
): RoutineRhythmSnapshot => {
  const today = startOfLocalDay(referenceDate);
  const todayString = toLocalDateString(today);
  const startDayNumber = DAY_NUMBERS[weekStart.toLowerCase()] ?? DAY_NUMBERS.monday;
  const daysSinceWeekStart = (today.getDay() - startDayNumber + 7) % 7;
  const weekStartDate = addCalendarDays(today, -daysSinceWeekStart);
  const statesByDate = mergeStatesByDate(routine, states);

  const days: RhythmDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStartDate, index);
    const dateString = toLocalDateString(date);
    const state = statesByDate.get(dateString);
    const progress = getRoutineProgress(routine, state);
    const status: RhythmDayStatus = dateString > todayString
      ? 'future'
      : state?.completed
        ? 'complete'
        : progress > 0
          ? 'partial'
          : 'open';

    return {
      date: dateString,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      status,
      progress,
    };
  });

  const eligibleDays = days.filter(day => day.status !== 'future');
  const weekCompleted = eligibleDays.filter(day => day.status === 'complete').length;
  const todayState = statesByDate.get(todayString);
  const { currentStreak, longestStreak } = getStreaks(statesByDate, today);

  return {
    id: routine,
    label: RHYTHM_LABELS[routine],
    cadence: 'daily',
    unitLabel: 'days',
    days,
    weekCompleted,
    weekEligible: eligibleDays.length,
    weeklyPercent: eligibleDays.length
      ? Math.round((weekCompleted / eligibleDays.length) * 100)
      : 0,
    todayProgress: getRoutineProgress(routine, todayState),
    currentStreak,
    longestStreak,
  };
};

const startOfWeek = (date: Date, weekStart: string): Date => {
  const result = startOfLocalDay(date);
  const startDayNumber = DAY_NUMBERS[weekStart.toLowerCase()] ?? DAY_NUMBERS.monday;
  result.setDate(result.getDate() - ((result.getDay() - startDayNumber + 7) % 7));
  return result;
};

const uniqueDates = (dates: string[]): string[] => Array.from(new Set(
  dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)),
)).sort();

export const buildDailyRhythmSnapshot = (
  id: Exclude<FaithfulRhythmId, RoutineType | 'bible_study' | 'session_notes' | 'reviews'>,
  dates: string[],
  weekStart: string = 'monday',
  referenceDate: Date = new Date(),
): RoutineRhythmSnapshot => {
  const today = startOfLocalDay(referenceDate);
  const todayString = toLocalDateString(today);
  const completedDates = new Set(uniqueDates(dates).filter(date => date <= todayString));
  const firstDay = startOfWeek(today, weekStart);
  const days: RhythmDay[] = Array.from({length: 7}, (_, index) => {
    const date = addCalendarDays(firstDay, index);
    const dateString = toLocalDateString(date);
    const complete = completedDates.has(dateString);
    return {
      date: dateString,
      label: date.toLocaleDateString('en-US', {weekday: 'short'}),
      status: dateString > todayString ? 'future' : complete ? 'complete' : 'open',
      progress: complete ? 100 : 0,
    };
  });
  const eligible = days.filter(day => day.status !== 'future');
  const completed = eligible.filter(day => day.status === 'complete').length;
  const streaks = getDateStreaks([...completedDates], today);
  return {
    id,
    label: RHYTHM_LABELS[id],
    cadence: 'daily',
    unitLabel: 'days',
    days,
    weekCompleted: completed,
    weekEligible: eligible.length,
    weeklyPercent: eligible.length ? Math.round((completed / eligible.length) * 100) : 0,
    todayProgress: completedDates.has(todayString) ? 100 : 0,
    ...streaks,
  };
};

export const buildWeeklyRhythmSnapshot = (
  id: 'bible_study',
  dates: string[],
  weekStart: string = 'monday',
  referenceDate: Date = new Date(),
): RoutineRhythmSnapshot => {
  const currentWeek = startOfWeek(referenceDate, weekStart);
  const activeWeeks = new Set(uniqueDates(dates).map(date => (
    toLocalDateString(startOfWeek(fromLocalDateString(date), weekStart))
  )));
  const days: RhythmDay[] = Array.from({length: 7}, (_, index) => {
    const week = addCalendarDays(currentWeek, (index - 6) * 7);
    const date = toLocalDateString(week);
    const complete = activeWeeks.has(date);
    return {
      date,
      label: index === 6 ? 'Now' : week.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}),
      status: complete ? 'complete' : 'open',
      progress: complete ? 100 : 0,
    };
  });
  const activeWeekDates = [...activeWeeks].sort();
  let cursor = new Date(currentWeek);
  if (!activeWeeks.has(toLocalDateString(cursor))) {cursor = addCalendarDays(cursor, -7);}
  let currentStreak = 0;
  while (activeWeeks.has(toLocalDateString(cursor))) {
    currentStreak += 1;
    cursor = addCalendarDays(cursor, -7);
  }
  let longestStreak = 0;
  let runningStreak = 0;
  let previous: string | null = null;
  activeWeekDates.forEach(date => {
    runningStreak = previous && toLocalDateString(addCalendarDays(fromLocalDateString(previous), 7)) === date
      ? runningStreak + 1
      : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previous = date;
  });
  const completed = days.filter(day => day.status === 'complete').length;
  return {
    id,
    label: RHYTHM_LABELS[id],
    cadence: 'weekly',
    unitLabel: 'weeks',
    days,
    weekCompleted: completed,
    weekEligible: days.length,
    weeklyPercent: Math.round((completed / days.length) * 100),
    todayProgress: activeWeeks.has(toLocalDateString(currentWeek)) ? 100 : 0,
    currentStreak,
    longestStreak,
  };
};

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const addCalendarMonths = (date: Date, amount: number): Date => (
  new Date(date.getFullYear(), date.getMonth() + amount, 1)
);

const monthKey = (date: Date): string => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
);

const getSundaysInMonth = (month: Date): Date[] => {
  const first = startOfMonth(month);
  const firstSunday = addCalendarDays(first, (7 - first.getDay()) % 7);
  const sundays: Date[] = [];
  let cursor = firstSunday;

  while (cursor.getMonth() === first.getMonth()) {
    sundays.push(cursor);
    cursor = addCalendarDays(cursor, 7);
  }

  return sundays;
};

export const buildSundaySermonRhythmSnapshot = (
  dates: string[],
  referenceDate: Date = new Date(),
): RoutineRhythmSnapshot => {
  const today = startOfLocalDay(referenceDate);
  const todayString = toLocalDateString(today);
  const completedSundays = new Set(uniqueDates(dates).filter(date => (
    date <= todayString && fromLocalDateString(date).getDay() === 0
  )));
  const currentMonth = startOfMonth(today);
  const earliestCompletedSunday = [...completedSundays].at(0);
  const firstTrackedMonth = earliestCompletedSunday
    ? startOfMonth(fromLocalDateString(earliestCompletedSunday))
    : currentMonth;
  const completedMonths = new Set<string>();

  for (let month = firstTrackedMonth; month <= currentMonth; month = addCalendarMonths(month, 1)) {
    const sundays = getSundaysInMonth(month);
    if (sundays.every(sunday => completedSundays.has(toLocalDateString(sunday)))) {
      completedMonths.add(monthKey(month));
    }
  }

  const currentMonthSundays = getSundaysInMonth(currentMonth);
  const days: RhythmDay[] = currentMonthSundays.map(sunday => {
    const date = toLocalDateString(sunday);
    const complete = completedSundays.has(date);
    return {
      date,
      label: sunday.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}),
      status: date > todayString ? 'future' : complete ? 'complete' : 'open',
      progress: complete ? 100 : 0,
    };
  });

  const lastSunday = currentMonthSundays.at(-1)!;
  let streakCursor = currentMonth;
  if (!completedMonths.has(monthKey(currentMonth)) && today <= lastSunday) {
    streakCursor = addCalendarMonths(currentMonth, -1);
  }
  let currentStreak = 0;
  while (completedMonths.has(monthKey(streakCursor))) {
    currentStreak += 1;
    streakCursor = addCalendarMonths(streakCursor, -1);
  }

  let longestStreak = 0;
  let runningStreak = 0;
  for (let month = firstTrackedMonth; month <= currentMonth; month = addCalendarMonths(month, 1)) {
    runningStreak = completedMonths.has(monthKey(month)) ? runningStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  const completedThisMonth = days.filter(day => day.status === 'complete').length;
  const monthlyPercent = Math.round((completedThisMonth / days.length) * 100);
  return {
    id: 'session_notes',
    label: RHYTHM_LABELS.session_notes,
    cadence: 'monthly',
    unitLabel: 'months',
    days,
    weekCompleted: completedThisMonth,
    weekEligible: days.length,
    weeklyPercent: monthlyPercent,
    todayProgress: monthlyPercent,
    currentStreak,
    longestStreak,
  };
};

export const buildReviewRhythmSnapshot = (reviews: LocalReviewEntry[]): RoutineRhythmSnapshot => {
  const recent = [...reviews]
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
    .slice(-7);
  const days: RhythmDay[] = recent.map(review => ({
    date: review.periodEnd,
    label: review.type === 'year_end'
      ? 'Year'
      : review.type === 'begin_year'
        ? 'Begin'
        : review.type.charAt(0).toUpperCase() + review.type.slice(1, 3),
    status: review.status === 'completed' ? 'complete' : 'open',
    progress: review.status === 'completed' ? 100 : 0,
  }));
  const completed = days.filter(day => day.status === 'complete').length;
  let currentStreak = 0;
  for (let index = days.length - 1; index >= 0 && days[index].status === 'complete'; index -= 1) {
    currentStreak += 1;
  }
  let longestStreak = 0;
  let runningStreak = 0;
  days.forEach(day => {
    runningStreak = day.status === 'complete' ? runningStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, runningStreak);
  });
  return {
    id: 'reviews',
    label: RHYTHM_LABELS.reviews,
    cadence: 'periodic',
    unitLabel: 'reviews',
    days,
    weekCompleted: completed,
    weekEligible: days.length,
    weeklyPercent: days.length ? Math.round((completed / days.length) * 100) : 0,
    todayProgress: recent.at(-1)?.status === 'completed' ? 100 : 0,
    currentStreak,
    longestStreak,
  };
};

const isCompletedHeartJournalItem = (item: MomentTimelineItem): boolean => {
  const reflection = item.reflection;
  if (!reflection || !HEART_JOURNAL_TYPES.has(reflection.type)) {return false;}
  if (reflection.type !== 'guided') {return true;}
  if (reflection.source === 'guided_prompt') {return false;}
  const storedJourney = reflection.metadata?.guidedJourney || reflection.metadata?.guided_journey;
  if (storedJourney && typeof storedJourney === 'object' && 'completed' in storedJourney) {
    return storedJourney.completed === true;
  }
  try {
    const content = typeof reflection.content === 'string' ? JSON.parse(reflection.content) : reflection.content;
    if (content && typeof content === 'object' && 'completed' in content) {
      return content.completed === true;
    }
    return reflection.source === 'guided';
  } catch {
    return reflection.source === 'guided';
  }
};

export const getFaithfulRhythmsSnapshot = async (
  weekStart: string = 'monday',
  referenceDate: Date = new Date(),
): Promise<FaithfulRhythmsSnapshot> => {
  const [states, timeline, reviewGroups] = await Promise.all([
    getAllRoutineStates(),
    getCanonicalMomentTimeline(),
    Promise.all(REVIEW_TYPES.map(type => getLocalReviewsByType(type))),
  ]);
  const datesFor = (predicate: (item: MomentTimelineItem) => boolean) => (
    timeline.filter(predicate).map(item => item.selectedDate)
  );
  return {
    morning: buildRoutineRhythmSnapshot('morning', states, weekStart, referenceDate),
    evening: buildRoutineRhythmSnapshot('evening', states, weekStart, referenceDate),
    heart_journal: buildDailyRhythmSnapshot(
      'heart_journal',
      datesFor(item => (
        (item.kind === 'reflection' && isCompletedHeartJournalItem(item))
        || item.kind === 'scripture_note'
        || (item.kind === 'sermon' && item.reflection?.metadata?.is_complete === true)
      )),
      weekStart,
      referenceDate,
    ),
    prayer: buildDailyRhythmSnapshot('prayer', datesFor(item => item.kind === 'prayer'), weekStart, referenceDate),
    bible_study: buildWeeklyRhythmSnapshot('bible_study', datesFor(item => item.kind === 'bible_study'), weekStart, referenceDate),
    session_notes: buildSundaySermonRhythmSnapshot(
      datesFor(item => (
        item.kind === 'sermon'
        && item.reflection?.metadata?.is_complete === true
        && resolveSessionNoteType(item.reflection) === 'sermon'
      )),
      referenceDate,
    ),
    reviews: buildReviewRhythmSnapshot(reviewGroups.flat()),
  };
};
