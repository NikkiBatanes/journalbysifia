import {
  addDays,
  addMonths,
  addQuarters,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  getDate,
  getMonth,
  getYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
} from 'date-fns';
import { toLocalDateString } from '../utils/date';
import { type ReviewType } from '../storage/reviewStorage';

export interface ReviewPeriod {
  type: ReviewType;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  availableFrom: string; // YYYY-MM-DD, inclusive
  availableUntil: string | null; // YYYY-MM-DD, exclusive; null = no known expiry
}

const parseYMD = (value: string | Date): Date => {
  if (value instanceof Date) {return value;}
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const localToday = (): string => toLocalDateString(new Date());

const getPreviousDayOfWeek = (
  anchor: Date,
  dayOfWeek: number,
): Date => {
  const current = new Date(anchor);
  // Reset time to avoid DST / time-of-day drift during math.
  current.setHours(0, 0, 0, 0);
  const diff = (current.getDay() - dayOfWeek + 7) % 7;
  current.setDate(current.getDate() - diff);
  return current;
};

export const getWeeklyPeriodFor = (
  weekEndsOn: number,
  anchor: string | Date = localToday(),
): ReviewPeriod => {
  const anchorDate = parseYMD(anchor);
  const periodEnd = getPreviousDayOfWeek(anchorDate, weekEndsOn);
  const periodStart = subDays(periodEnd, 6);
  const nextPeriodEnd = addDays(periodEnd, 7);

  return {
    type: 'weekly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(periodEnd),
    availableUntil: toLocalDateString(nextPeriodEnd),
  };
};

export const getMonthlyPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod => {
  const anchorDate = parseYMD(anchor);
  const periodEnd = endOfMonth(anchorDate);
  const periodStart = startOfMonth(anchorDate);
  const availableFrom = subDays(periodEnd, 2);

  const nextPeriodEnd = endOfMonth(addMonths(anchorDate, 1));
  const nextAvailableFrom = subDays(nextPeriodEnd, 2);

  return {
    type: 'monthly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(availableFrom),
    availableUntil: toLocalDateString(nextAvailableFrom),
  };
};

export const getQuarterlyPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod => {
  const anchorDate = parseYMD(anchor);
  const periodEnd = endOfQuarter(anchorDate);
  const periodStart = startOfQuarter(anchorDate);
  const availableFrom = subDays(periodEnd, 6);

  const nextPeriodEnd = endOfQuarter(addQuarters(anchorDate, 1));
  const nextAvailableFrom = subDays(nextPeriodEnd, 6);

  return {
    type: 'quarterly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(availableFrom),
    availableUntil: toLocalDateString(nextAvailableFrom),
  };
};

export const getYearEndPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod | null => {
  const anchorDate = parseYMD(anchor);
  const year = getYear(anchorDate);
  const availableFrom = new Date(year, 11, 15); // Dec 15
  const availableUntil = new Date(year, 11, 31); // Dec 31

  const anchorYMD = toLocalDateString(anchorDate);
  const fromYMD = toLocalDateString(availableFrom);
  const untilYMD = toLocalDateString(availableUntil);

  if (anchorYMD < fromYMD || anchorYMD > untilYMD) {
    return null;
  }

  const periodStart = startOfYear(anchorDate);
  const periodEnd = endOfYear(anchorDate);

  return {
    type: 'year_end',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: fromYMD,
    availableUntil: untilYMD,
  };
};

export const getBeginYearPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod | null => {
  const anchorDate = parseYMD(anchor);
  const year = getYear(anchorDate);
  const availableFrom = new Date(year, 0, 1); // Jan 1
  const availableUntil = new Date(year, 0, 14); // Jan 14

  const anchorYMD = toLocalDateString(anchorDate);
  const fromYMD = toLocalDateString(availableFrom);
  const untilYMD = toLocalDateString(availableUntil);

  if (anchorYMD < fromYMD || anchorYMD > untilYMD) {
    return null;
  }

  return {
    type: 'begin_year',
    periodStart: fromYMD,
    periodEnd: untilYMD,
    availableFrom: fromYMD,
    availableUntil: null,
  };
};
