const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

/** Omit a matching shared year when requested; cross-year weeks retain both years. */
export const formatWeeklyGratitudePeriod = (
  periodStart: string,
  periodEnd: string,
  omitYear?: number,
  monthStyle: 'short' | 'long' = 'short',
): string => {
  const start = parseLocalDate(periodStart);
  const end = parseLocalDate(periodEnd);
  const months = monthStyle === 'long' ? LONG_MONTHS : SHORT_MONTHS;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const yearSuffix = end.getFullYear() === omitYear ? '' : `, ${end.getFullYear()}`;

  if (sameMonth) {
    return `${months[start.getMonth()]} ${start.getDate()}–${end.getDate()}${yearSuffix}`;
  }
  if (sameYear) {
    return `${months[start.getMonth()]} ${start.getDate()}–${months[end.getMonth()]} ${end.getDate()}${yearSuffix}`;
  }
  return `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}–${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
};
