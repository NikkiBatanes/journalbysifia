import {
  getMonthlyCheckInFeelings,
  getMonthlyLookingForwardFeelings,
  getMonthlyWeeklyReviewFeelings,
  type MonthlyWeeklyReviewFeelings,
  type WeeklyCheckInFeeling,
} from './weeklyFeelingService';

export interface MonthlyPatternSources {
  morning: WeeklyCheckInFeeling[];
  weekly: MonthlyWeeklyReviewFeelings;
  lookingForward: WeeklyCheckInFeeling[];
}

const formatList = (values: string[]): string => {
  if (values.length <= 1) {
    return values[0] ?? '';
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

const summarizeSource = (
  feelings: WeeklyCheckInFeeling[],
  copy: {
    only: (name: string) => string;
    varied: string;
    recurring: (names: string, count: number, tied: boolean) => string;
  },
): string => {
  const recorded = feelings.filter(item => item.count > 0);
  const total = recorded.reduce((sum, item) => sum + item.count, 0);
  if (!total) {
    return '';
  }
  if (total === 1) {
    return copy.only(recorded[0].name);
  }

  const highestCount = Math.max(...recorded.map(item => item.count));
  if (highestCount === 1) {
    return copy.varied;
  }
  const leaders = recorded
    .filter(item => item.count === highestCount)
    .map(item => item.name);
  return copy.recurring(formatList(leaders), highestCount, leaders.length > 1);
};

/**
 * Produces a restrained, data-backed reading of the three feeling sources in
 * Monthly Review. It names recurrence without treating a feeling as a diagnosis.
 */
export const summarizeMonthlyPatterns = ({
  morning,
  weekly,
  lookingForward,
}: MonthlyPatternSources): string =>
  [
    summarizeSource(morning, {
      only: name => `${name} was the only feeling recorded in your mornings.`,
      varied: 'Your morning feelings varied, with none repeating.',
      recurring: (names, count, tied) =>
        `${names} appeared most often in your mornings (${count} ${
          count === 1 ? 'day' : 'days'
        }${tied ? ' each' : ''}).`,
    }),
    summarizeSource(weekly.feelings, {
      only: name => `${name} was the only feeling recorded in a weekly check-in.`,
      varied: 'Your weekly check-ins varied, with no feeling repeating.',
      recurring: (names, count, tied) =>
        `Across your weekly check-ins, ${names} showed up most often (${count}×${
          tied ? ' each' : ''
        }).`,
    }),
    summarizeSource(lookingForward, {
      only: name =>
        `${name} was the only feeling recorded while looking toward the next day.`,
      varied:
        'Your feelings about the next day varied, with none repeating.',
      recurring: (names, count, tied) =>
        `Looking toward the next day, ${names} appeared most often (${count} ${
          count === 1 ? 'day' : 'days'
        }${tied ? ' each' : ''}).`,
    }),
  ]
    .filter(Boolean)
    .join(' ');

export const getMonthlyPatternSummary = async (
  periodStart: string,
  periodEnd: string,
): Promise<string> => {
  const [morning, weekly, lookingForward] = await Promise.all([
    getMonthlyCheckInFeelings(periodStart, periodEnd),
    getMonthlyWeeklyReviewFeelings(periodStart, periodEnd),
    getMonthlyLookingForwardFeelings(periodStart, periodEnd),
  ]);
  return summarizeMonthlyPatterns({morning, weekly, lookingForward});
};
