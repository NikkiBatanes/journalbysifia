import {eachDayOfInterval, format, parseISO} from 'date-fns';
import {getLocalJournalSingleton} from '../storage/journalStorage';
import {getLocalReviewsByType} from '../storage/reviewStorage';
import {safeJsonParse} from '../utils/safeJsonParse';

export interface WeeklyCheckInFeeling {
  name: string;
  count: number;
  dates: string[];
}

export interface MonthlyCheckInFeelingEntry {
  date: string;
  underneathIt?: string;
  feelingIcon?: string;
  feelingIconType?: 'ionicons' | 'material' | 'fontawesome';
}

export interface MonthlyCheckInFeeling extends WeeklyCheckInFeeling {
  entries: MonthlyCheckInFeelingEntry[];
}

export interface MonthlyWeeklyReviewFeelings {
  reviewCount: number;
  feelings: WeeklyCheckInFeeling[];
}

const getPeriodCheckInFeelings = async (
  periodStart: string,
  periodEnd: string,
): Promise<MonthlyCheckInFeeling[]> => {
  const days = eachDayOfInterval({
    start: parseISO(periodStart),
    end: parseISO(periodEnd),
  });
  const entries = await Promise.all(
    days.map(async day => {
      const date = format(day, 'yyyy-MM-dd');
      const record = await getLocalJournalSingleton('morning_check_in', date);
      const content = record
        ? safeJsonParse<Record<string, unknown>>(record.content, {fallback: {}})
        : {};
      const feeling =
        typeof content?.feeling === 'string' ? content.feeling.trim() : '';
      if (!feeling) {
        return null;
      }
      const underneathIt =
        typeof content?.underneathIt === 'string'
          ? content.underneathIt.trim()
          : '';
      const feelingIcon =
        typeof content?.feelingIcon === 'string'
          ? content.feelingIcon.trim()
          : '';
      const savedIconType =
        typeof content?.feelingIconType === 'string'
          ? content.feelingIconType
          : '';
      const feelingIconType: MonthlyCheckInFeelingEntry['feelingIconType'] =
        savedIconType === 'material' || savedIconType === 'fontawesome'
          ? savedIconType
          : 'ionicons';
      return {
        date,
        feeling,
        underneathIt: underneathIt || undefined,
        feelingIcon: feelingIcon || undefined,
        feelingIconType: feelingIcon ? feelingIconType : undefined,
      };
    }),
  );
  const grouped = new Map<
    string,
    MonthlyCheckInFeeling & {firstIndex: number}
  >();
  entries.forEach((entry, index) => {
    if (!entry) {
      return;
    }
    const key = entry.feeling.toLocaleLowerCase();
    const detail: MonthlyCheckInFeelingEntry = {
      date: entry.date,
      underneathIt: entry.underneathIt,
      feelingIcon: entry.feelingIcon,
      feelingIconType: entry.feelingIconType,
    };
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.dates.push(entry.date);
      existing.entries.push(detail);
      return;
    }
    grouped.set(key, {
      name: entry.feeling,
      count: 1,
      dates: [entry.date],
      entries: [detail],
      firstIndex: index,
    });
  });
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map(({firstIndex: _, ...feeling}) => feeling);
};

/** Summarizes the canonical Morning "How are you feeling?" choices for a week. */
export const getWeeklyCheckInFeelings = async (
  periodStart: string,
  periodEnd: string,
): Promise<WeeklyCheckInFeeling[]> =>
  (await getPeriodCheckInFeelings(periodStart, periodEnd)).map(
    ({name, count, dates}) => ({name, count, dates}),
  );

/** Collates every canonical Morning feeling and its reflection for a month. */
export const getMonthlyCheckInFeelings = getPeriodCheckInFeelings;

/**
 * Collates retrospective feeling words from completed Weekly Reviews whose
 * ending date falls inside the month. They stay separate from Morning feelings
 * because the two sources describe different units: weeks and days.
 */
export const getMonthlyWeeklyReviewFeelings = async (
  periodStart: string,
  periodEnd: string,
): Promise<MonthlyWeeklyReviewFeelings> => {
  const reviews = (await getLocalReviewsByType('weekly')).filter(
    review =>
      review.status === 'completed' &&
      review.periodEnd >= periodStart &&
      review.periodEnd <= periodEnd,
  );
  const grouped = new Map<
    string,
    WeeklyCheckInFeeling & {firstIndex: number}
  >();
  let feelingIndex = 0;

  reviews.forEach(review => {
    const selected = (review.answers.week_feelings ?? '')
      .split('|')
      .map(value => value.trim())
      .filter(value => value && value.toLocaleLowerCase() !== 'other');
    const custom = review.answers.week_feeling_other?.trim();
    const feelings = [...selected, ...(custom ? [custom] : [])].filter(
      (value, index, values) =>
        values.findIndex(
          candidate =>
            candidate.toLocaleLowerCase() === value.toLocaleLowerCase(),
        ) === index,
    );

    feelings.forEach(feeling => {
      const key = feeling.toLocaleLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        existing.dates.push(review.periodEnd);
      } else {
        grouped.set(key, {
          name: feeling,
          count: 1,
          dates: [review.periodEnd],
          firstIndex: feelingIndex,
        });
      }
      feelingIndex += 1;
    });
  });

  return {
    reviewCount: reviews.length,
    feelings: [...grouped.values()]
      .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
      .map(({firstIndex: _, ...feeling}) => feeling),
  };
};
