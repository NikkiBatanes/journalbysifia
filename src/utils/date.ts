import { isToday, isYesterday, startOfDay } from 'date-fns';

export type DateContext = 'today' | 'yesterday' | 'earlier';

// Utility to format a Date as YYYY-MM-DD in local time
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to compute date context from selected date
export const getDateContext = (selectedDate: Date): DateContext => {
  const day = startOfDay(selectedDate);

  if (isToday(day)) {return 'today';}
  if (isYesterday(day)) {return 'yesterday';}
  return 'earlier';
};
