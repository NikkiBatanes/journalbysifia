import {format} from 'date-fns';

export const formatForMeDayTestimonyDate = (
  timestamp?: string,
  updated = false,
  currentYear = new Date().getFullYear(),
): string => {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const datePattern = date.getFullYear() === currentYear
    ? 'EEE, MMM d'
    : 'EEE, MMM d, yyyy';
  const dateLabel = format(date, datePattern).replace(', Sep ', ', Sept ');
  return `${updated ? 'Updated' : 'Written'} ${dateLabel}`;
};
