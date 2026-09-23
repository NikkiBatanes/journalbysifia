import {gospelStorage} from '../storage/gospelStorage';
import {toLocalDateString} from '../utils/date';
import {getCarryForwardReferences} from './reviewMemoryService';
import {getWeeklyRhythm} from './weeklyRhythmService';

export interface MonthlyReviewStats {
  activeDays: number;
  morning: number;
  evening: number;
  prayers: number;
  journal: number;
  answeredPrayers: number;
  rememberedFromWeeks: number;
  gospelShares: number;
}

export const getMonthlyReviewStats = async (
  periodStart: string,
  periodEnd: string,
  referenceDate = toLocalDateString(new Date()),
): Promise<MonthlyReviewStats> => {
  const [rhythm, remembered, gospelShareEvents] = await Promise.all([
    getWeeklyRhythm(periodStart, periodEnd, referenceDate),
    getCarryForwardReferences('monthly', periodStart, periodEnd),
    gospelStorage.getShareEvents(),
  ]);

  const gospelShares = gospelShareEvents.filter(event => {
    const date = toLocalDateString(new Date(event.sharedAt));
    return date >= periodStart && date <= periodEnd && date <= referenceDate;
  }).length;

  return {
    activeDays: rhythm.activeDays,
    morning: rhythm.morning,
    evening: rhythm.evening,
    prayers: rhythm.prayers,
    journal: rhythm.journal,
    answeredPrayers: rhythm.answeredPrayers,
    rememberedFromWeeks: remembered.length,
    gospelShares,
  };
};
