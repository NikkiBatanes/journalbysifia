import {format} from 'date-fns';

import {fromLocalDateString} from './date';

/** Keeps dashboard review dates consistent across every review cadence. */
export const formatReviewCardPeriod = (
  periodStart: string,
  periodEnd: string,
  includeSameYear = false,
): string => {
  const start = fromLocalDateString(periodStart);
  const end = fromLocalDateString(periodEnd);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${format(start, 'MMM d')}–${format(end, includeSameYear ? 'd, yyyy' : 'd')}`;
  }
  if (sameYear) {
    return `${format(start, 'MMM d')}–${format(end, includeSameYear ? 'MMM d, yyyy' : 'MMM d')}`;
  }
  return `${format(start, 'MMM d, yyyy')}–${format(end, 'MMM d, yyyy')}`;
};
