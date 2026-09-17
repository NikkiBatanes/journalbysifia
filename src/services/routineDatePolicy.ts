import { compareLocalDate, toLocalDateString } from '../utils/date';

export const canOpenRoutineForDate = (
  selectedDate: string,
  today = toLocalDateString(new Date()),
): boolean => compareLocalDate(selectedDate, today) !== 'future';
