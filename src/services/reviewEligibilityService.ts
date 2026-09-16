import { toLocalDateString } from '../utils/date';
import { type ReviewType, type LocalReviewEntry } from '../storage/reviewStorage';
import { getOrCreateLocalReviewForPeriod } from '../storage/reviewStorage';
import { getReviewSettings, type ReviewSettings } from '../storage/reviewSettingsStorage';
import {
  getWeeklyPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
  getYearEndPeriodFor,
  getBeginYearPeriodFor,
  type ReviewPeriod,
} from './reviewPeriodService';

export interface DashboardReview {
  type: ReviewType;
  period: ReviewPeriod;
  review: LocalReviewEntry;
}

export interface ReviewEligibilityResult {
  main: DashboardReview | null;
  alsoReady: DashboardReview[];
  allActive: DashboardReview[];
}

const PRIORITY: Record<ReviewType, number> = {
  year_end: 10,
  begin_year: 9,
  quarterly: 4,
  monthly: 3,
  weekly: 2,
};

const isInActiveWindow = (period: ReviewPeriod, anchor: string): boolean => {
  if (anchor < period.availableFrom) {
    return false;
  }
  if (period.availableUntil && anchor >= period.availableUntil) {
    return false;
  }
  return true;
};

export const getReviewEligibility = async (
  anchor: string | Date = toLocalDateString(new Date()),
  weekStart?: string,
): Promise<ReviewEligibilityResult> => {
  const anchorYMD = typeof anchor === 'string' ? anchor : toLocalDateString(anchor);
  const settings = await getReviewSettings(weekStart);

  const activePeriods: ReviewPeriod[] = [];

  if (settings.enabledCadences.weekly) {
    activePeriods.push(getWeeklyPeriodFor(settings.weekEndsOn, anchorYMD));
  }
  if (settings.enabledCadences.monthly) {
    const monthly = getMonthlyPeriodFor(anchorYMD);
    if (isInActiveWindow(monthly, anchorYMD)) {
      activePeriods.push(monthly);
    }
  }
  if (settings.enabledCadences.quarterly) {
    const quarterly = getQuarterlyPeriodFor(anchorYMD);
    if (isInActiveWindow(quarterly, anchorYMD)) {
      activePeriods.push(quarterly);
    }
  }
  if (settings.enabledCadences.year_end) {
    const yearEnd = getYearEndPeriodFor(anchorYMD);
    if (yearEnd) {
      activePeriods.push(yearEnd);
    }
  }
  if (settings.enabledCadences.begin_year) {
    const beginYear = getBeginYearPeriodFor(anchorYMD);
    if (beginYear) {
      activePeriods.push(beginYear);
    }
  }

  const reviews: DashboardReview[] = [];
  for (const period of activePeriods) {
    const review = await getOrCreateLocalReviewForPeriod({
      type: period.type,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });
    reviews.push({type: period.type, period, review});
  }

  reviews.sort((a, b) => PRIORITY[b.type] - PRIORITY[a.type]);

  const main = reviews.length > 0 ? reviews[0] : null;
  const alsoReady = reviews.slice(1);

  return {
    main,
    alsoReady,
    allActive: reviews,
  };
};

export const getReviewSettingsWithDefaults = async (): Promise<ReviewSettings> => {
  return getReviewSettings();
};
