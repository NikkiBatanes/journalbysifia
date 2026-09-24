import {
  buildDailyRhythmSnapshot,
  buildReviewRhythmSnapshot,
  buildRoutineRhythmSnapshot,
  buildSundaySermonRhythmSnapshot,
  buildWeeklyRhythmSnapshot,
  getRoutineProgress,
} from '../faithfulRhythmService';
import type { RoutineState, RoutineType } from '../../storage/routineStateStorage';

const state = (
  routine: RoutineType,
  selectedDate: string,
  completed: boolean,
  completedSteps: string[] = [],
): RoutineState => ({
  id: `${routine}:${selectedDate}`,
  routine,
  selected_date: selectedDate,
  completed,
  completed_steps: completedSteps,
});

describe('faithfulRhythmService', () => {
  const referenceDate = new Date(2026, 8, 24, 12);

  it('turns the four visible morning sections into transparent progress', () => {
    expect(getRoutineProgress('morning', state('morning', '2026-09-24', false, ['underneath']))).toBe(25);
    expect(getRoutineProgress('morning', state('morning', '2026-09-24', false, ['underneath', 'carry', 'todays_focus']))).toBe(75);
    expect(getRoutineProgress('morning', state('morning', '2026-09-24', true))).toBe(100);
  });

  it('counts a completed morning only once and excludes future days from the percentage', () => {
    const snapshot = buildRoutineRhythmSnapshot('morning', [
      state('morning', '2026-09-21', true),
      state('morning', '2026-09-22', true),
      state('morning', '2026-09-23', false, ['underneath']),
      state('morning', '2026-09-24', true),
    ], 'monday', referenceDate);

    expect(snapshot.weekCompleted).toBe(3);
    expect(snapshot.weekEligible).toBe(4);
    expect(snapshot.weeklyPercent).toBe(75);
    expect(snapshot.todayProgress).toBe(100);
    expect(snapshot.currentStreak).toBe(1);
    expect(snapshot.days.map(day => day.status)).toEqual([
      'complete', 'complete', 'partial', 'complete', 'future', 'future', 'future',
    ]);
  });

  it('keeps an active streak through today when yesterday was completed', () => {
    const snapshot = buildRoutineRhythmSnapshot('evening', [
      state('evening', '2026-09-20', true),
      state('evening', '2026-09-21', true),
      state('evening', '2026-09-22', true),
      state('evening', '2026-09-23', true),
    ], 'monday', referenceDate);

    expect(snapshot.currentStreak).toBe(4);
    expect(snapshot.longestStreak).toBe(4);
  });

  it('builds a separate daily Heart Journal streak and deduplicates entries on the same day', () => {
    const snapshot = buildDailyRhythmSnapshot(
      'heart_journal',
      ['2026-09-22', '2026-09-23', '2026-09-23', '2026-09-24'],
      'monday',
      referenceDate,
    );

    expect(snapshot.cadence).toBe('daily');
    expect(snapshot.currentStreak).toBe(3);
    expect(snapshot.weekCompleted).toBe(3);
    expect(snapshot.unitLabel).toBe('days');
  });

  it('counts Bible Study by active week instead of pretending it is daily', () => {
    const snapshot = buildWeeklyRhythmSnapshot(
      'bible_study',
      ['2026-09-08', '2026-09-17', '2026-09-24'],
      'monday',
      referenceDate,
    );

    expect(snapshot.cadence).toBe('weekly');
    expect(snapshot.currentStreak).toBe(3);
    expect(snapshot.weekCompleted).toBe(3);
    expect(snapshot.unitLabel).toBe('weeks');
    expect(snapshot.days.map(day => day.label)).toEqual([
      'Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Wk6', 'Wk7',
    ]);
  });

  it('builds the Sunday sermon streak only after every Sunday in the month is complete', () => {
    const inProgress = buildSundaySermonRhythmSnapshot(
      ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-21'],
      new Date(2026, 8, 24, 12),
    );

    expect(inProgress.cadence).toBe('monthly');
    expect(inProgress.weekCompleted).toBe(3);
    expect(inProgress.weekEligible).toBe(4);
    expect(inProgress.currentStreak).toBe(0);
    expect(inProgress.days.at(-1)?.status).toBe('future');

    const completed = buildSundaySermonRhythmSnapshot(
      ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'],
      new Date(2026, 8, 27, 12),
    );

    expect(completed.currentStreak).toBe(1);
    expect(completed.longestStreak).toBe(1);
    expect(completed.weeklyPercent).toBe(100);
    expect(completed.unitLabel).toBe('months');
  });

  it('continues Sunday sermon streaks across fully completed consecutive months', () => {
    const snapshot = buildSundaySermonRhythmSnapshot([
      '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
      '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25',
    ], new Date(2026, 9, 25, 12));

    expect(snapshot.currentStreak).toBe(2);
    expect(snapshot.longestStreak).toBe(2);
  });

  it('tracks completed review records by their own periods', () => {
    const base = {
      type: 'weekly' as const,
      periodStart: '2026-09-14',
      memorableItems: [],
      answers: {},
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    };
    const snapshot = buildReviewRhythmSnapshot([
      {...base, id: 'one', periodEnd: '2026-09-20', status: 'completed'},
      {...base, id: 'two', periodEnd: '2026-09-27', status: 'completed'},
      {...base, id: 'month-one', type: 'monthly', periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'completed'},
      {...base, id: 'month-two', type: 'monthly', periodStart: '2026-10-01', periodEnd: '2026-10-31', status: 'completed'},
    ]);

    expect(snapshot.cadence).toBe('periodic');
    expect(snapshot.currentStreak).toBe(4);
    expect(snapshot.weeklyPercent).toBe(100);
    expect(snapshot.unitLabel).toBe('reviews');
    expect(snapshot.days.map(day => day.label)).toEqual(['Wk1', 'Wk2', 'M1', 'M2']);
  });
});
