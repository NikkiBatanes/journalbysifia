import { format, isToday, isYesterday, startOfDay } from 'date-fns';

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
