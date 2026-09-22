import { differenceInCalendarDays, differenceInCalendarMonths, differenceInCalendarYears, format, isToday, isYesterday, startOfDay } from 'date-fns';

export type DateContext = 'today' | 'yesterday' | 'earlier';

// Utility to format a Date as YYYY-MM-DD in local time
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse the app's YYYY-MM-DD calendar value without treating it as UTC.
export function fromLocalDateString(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return new Date(value);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Format a date-only Journal value without converting it through UTC. */
export function formatLocalDateLong(value: string | Date): string {
  const date = typeof value === 'string' ? fromLocalDateString(value) : value;
  return format(date, 'MMMM d, yyyy');
}

export type PrayerDateContext = { dateLabel: string; relativeLabel: string; combinedLabel: string };

const parsePrayerDate = (value: string | Date | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromLocalDateString(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

/** Local-calendar Prayer date and relative time; presentation only, never a stored-date conversion. */
export function formatPrayerDateContext(value: string | Date | null | undefined, referenceDate = new Date()): PrayerDateContext | undefined {
  const date = parsePrayerDate(value);
  if (!date || !Number.isFinite(referenceDate.getTime())) return undefined;

  const days = differenceInCalendarDays(startOfDay(referenceDate), startOfDay(date));
  let relativeLabel: string;
  if (days === 0) relativeLabel = 'Today';
  else if (days === 1) relativeLabel = 'Yesterday';
  else if (days > 1 && days < 7) relativeLabel = `${days} days ago`;
  else if (days >= 7 && days < 35) relativeLabel = `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'week' : 'weeks'} ago`;
  else if (days >= 35 && days < 365) {
    const months = Math.max(1, differenceInCalendarMonths(referenceDate, date));
    relativeLabel = `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else if (days >= 365) {
    const years = Math.max(1, differenceInCalendarYears(referenceDate, date));
    relativeLabel = `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } else {
    const futureDays = Math.abs(days);
    if (futureDays === 1) relativeLabel = 'Tomorrow';
    else if (futureDays < 7) relativeLabel = `In ${futureDays} days`;
    else if (futureDays < 35) relativeLabel = `In ${Math.floor(futureDays / 7)} ${Math.floor(futureDays / 7) === 1 ? 'week' : 'weeks'}`;
    else if (futureDays < 365) {
      const months = Math.max(1, Math.abs(differenceInCalendarMonths(referenceDate, date)));
      relativeLabel = `In ${months} ${months === 1 ? 'month' : 'months'}`;
    } else {
      const years = Math.max(1, Math.abs(differenceInCalendarYears(referenceDate, date)));
      relativeLabel = `In ${years} ${years === 1 ? 'year' : 'years'}`;
    }
  }

  const dateLabel = format(date, 'MMMM d, yyyy');
  return { dateLabel, relativeLabel, combinedLabel: `${dateLabel} · ${relativeLabel}` };
}

export function formatPrayerDateLong(value: string | Date | null | undefined): string {
  const date = parsePrayerDate(value);
  return date ? format(date, 'EEEE, MMMM d, yyyy') : '';
}

export type LocalDateRelation = 'past' | 'today' | 'future';

export function compareLocalDate(value: string, today = toLocalDateString(new Date())): LocalDateRelation {
  if (value < today) {return 'past';}
  if (value > today) {return 'future';}
  return 'today';
}

// Helper to compute date context from selected date
export const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};
