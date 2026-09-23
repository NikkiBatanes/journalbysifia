import {fromLocalDateString, toLocalDateString} from './date';
import {formatWeeklyGratitudePeriod} from './weeklyGratitudePeriod';

/** The seven calendar days following the saved review period, not the current date. */
export const formatWeeklyLookingAheadPeriod = (
  reviewPeriodEnd: string,
  omitYear?: number,
  monthStyle: 'short' | 'long' = 'short',
): string => {
  if (!reviewPeriodEnd) {return '';}
  const start = fromLocalDateString(reviewPeriodEnd);
  if (!Number.isFinite(start.getTime())) {return '';}
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return formatWeeklyGratitudePeriod(toLocalDateString(start), toLocalDateString(end), omitYear, monthStyle);
};
