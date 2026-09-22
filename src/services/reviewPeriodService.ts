import {
  addDays,
  addMonths,
  addQuarters,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  getYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
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
  if (value instanceof Date) {
    const local = new Date(value);
    local.setHours(0, 0, 0, 0);
    return local;
  }
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
  if (periodEnd >= anchorDate) {
    periodEnd.setDate(periodEnd.getDate() - 7);
  }
  const periodStart = subDays(periodEnd, 6);
  const availableFrom = addDays(periodEnd, 1);

  return {
    type: 'weekly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(availableFrom),
    availableUntil: toLocalDateString(addDays(availableFrom, 7)),
  };
};

export const getMonthlyPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod => {
  const anchorDate = parseYMD(anchor);
  const reviewedMonth = subMonths(anchorDate, 1);
  const periodEnd = endOfMonth(reviewedMonth);
  const periodStart = startOfMonth(reviewedMonth);
  const availableFrom = startOfMonth(anchorDate);

  return {
    type: 'monthly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(availableFrom),
    availableUntil: toLocalDateString(addMonths(availableFrom, 1)),
  };
};

export const getQuarterlyPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod => {
  const anchorDate = parseYMD(anchor);
  const reviewedQuarter = subQuarters(anchorDate, 1);
  const periodEnd = endOfQuarter(reviewedQuarter);
  const periodStart = startOfQuarter(reviewedQuarter);
  const availableFrom = startOfQuarter(anchorDate);

  return {
    type: 'quarterly',
    periodStart: toLocalDateString(periodStart),
    periodEnd: toLocalDateString(periodEnd),
    availableFrom: toLocalDateString(availableFrom),
    availableUntil: toLocalDateString(addQuarters(availableFrom, 1)),
  };
};

export const getYearEndPeriodFor = (
  anchor: string | Date = localToday(),
): ReviewPeriod | null => {
  const anchorDate = parseYMD(anchor);
  const year = getYear(anchorDate);
  const availableFrom = new Date(year, 0, 1);
  const availableUntil = new Date(year, 0, 15);

  const anchorYMD = toLocalDateString(anchorDate);
  const fromYMD = toLocalDateString(availableFrom);
  const untilYMD = toLocalDateString(availableUntil);

  if (anchorYMD < fromYMD || anchorYMD >= untilYMD) {
    return null;
  }

  const reviewedYear = subYears(anchorDate, 1);
  const periodStart = startOfYear(reviewedYear);
  const periodEnd = endOfYear(reviewedYear);

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
  const availableUntil = new Date(year, 0, 15); // exclusive

  const anchorYMD = toLocalDateString(anchorDate);
  const fromYMD = toLocalDateString(availableFrom);
  const untilYMD = toLocalDateString(availableUntil);

  if (anchorYMD < fromYMD || anchorYMD >= untilYMD) {
    return null;
  }

  return {
    type: 'begin_year',
    periodStart: fromYMD,
    periodEnd: toLocalDateString(endOfYear(anchorDate)),
    availableFrom: fromYMD,
    availableUntil: untilYMD,
  };
};
