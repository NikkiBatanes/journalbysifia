import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { getReviewCapture } from './reviewCaptureService';
import { getRoutineState } from '../storage/routineStateStorage';
import { getLocalJournalSingleton } from '../storage/journalStorage';
import { getLocalPrayers } from '../storage/prayerStorage';

export interface WeeklyRhythm {
  days: { date: string; active: boolean }[];
  activeDays: number;
  morning: number;
  evening: number;
  prayers: number;
  journal: number;
}

export const getWeeklyRhythm = async (start: string, end: string): Promise<WeeklyRhythm> => {
  const capture = await getReviewCapture(start, end);
  const dates = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  const details = await Promise.all(dates.map(async day => {
    const date = format(day, 'yyyy-MM-dd');
    const [morning, evening, checkIn, prayers] = await Promise.all([
      getRoutineState('morning', date), getRoutineState('evening', date),
      getLocalJournalSingleton('morning_check_in', date), getLocalPrayers(date),
    ]);
    const routineIds = new Set([morning, evening].flatMap(state =>
      Object.values(state?.content_refs || {}).flatMap(ref =>
        (Array.isArray(ref) ? ref : [ref]).map(item => item.local_id))));
    const journal = new Set(capture.items.filter(item => item.selectedDate === date
      && !['morning', 'evening', 'prayer'].includes(item.kind)
      && !routineIds.has(item.id)).map(item => item.id)).size;
    const prayerCount = new Set(prayers.filter(prayer => !(prayer.is_prayer_request && prayer.prayed))
      .filter(prayer => prayer.content.trim())
      .map(prayer => prayer.metadata?.prayer_style === 'cast' && prayer.metadata?.prayer_session_id
        ? `cast:${prayer.metadata.prayer_session_id}` : prayer.id)).size;
    const morningCount = morning?.completed ? 1 : 0;
    const eveningCount = evening?.completed ? 1 : 0;
    return { date, active: Boolean(checkIn || morningCount || eveningCount || prayerCount
      || capture.items.some(item => item.selectedDate === date && item.kind !== 'prayer')), morning: morningCount,
      evening: eveningCount, prayers: prayerCount, journal };
  }));
  return {
    days: details.map(({ date, active }) => ({ date, active })),
    activeDays: details.filter(day => day.active).length,
    morning: details.reduce((sum, day) => sum + day.morning, 0),
    evening: details.reduce((sum, day) => sum + day.evening, 0),
    prayers: details.reduce((sum, day) => sum + day.prayers, 0),
    journal: details.reduce((sum, day) => sum + day.journal, 0),
  };
};
