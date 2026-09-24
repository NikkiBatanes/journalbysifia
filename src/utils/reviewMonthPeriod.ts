import {fromLocalDateString} from './date';

const formatMonth = (
  date: Date,
  currentYear: number,
  locale?: string,
): string =>
  date.toLocaleDateString(locale, {
    month: 'long',
    ...(date.getFullYear() === currentYear
      ? {}
      : {year: 'numeric' as const}),
  });

export const formatReviewedMonthPeriod = (
  periodStart: string,
  currentYear = new Date().getFullYear(),
  locale?: string,
): string => formatMonth(fromLocalDateString(periodStart), currentYear, locale);

export const formatNextMonthPeriod = (
  periodEnd: string,
  currentYear = new Date().getFullYear(),
  locale?: string,
): string => {
  const end = fromLocalDateString(periodEnd);
  return formatMonth(
    new Date(end.getFullYear(), end.getMonth() + 1, 1, 12),
    currentYear,
    locale,
  );
};
