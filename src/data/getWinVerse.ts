import { differenceInCalendarDays, startOfDay } from 'date-fns';
import verses from './winVerses.json';

// A stable daily rotation; opening the editor or typing does not change the verse.
export const getWinVerse = (date: Date) => {
  const day = differenceInCalendarDays(startOfDay(date), new Date(2026, 0, 1));
  const index = ((day % verses.length) + verses.length) % verses.length;
  return verses[index];
};
