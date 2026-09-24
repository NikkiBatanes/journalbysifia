import {eachDayOfInterval, format, parseISO} from 'date-fns';
import {getLocalJournalSingleton} from '../storage/journalStorage';
import {getLocalReviewsByType} from '../storage/reviewStorage';
import {WEEKLY_LIFE_AREAS} from '../data/weeklyLifeAreas';
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

export type WeeklyLifeCheckInValue = 'struggling' | 'okay' | 'well';

export interface MonthlyLifeAreaPattern {
  key: (typeof WEEKLY_LIFE_AREAS)[number]['key'];
  label: string;
  icon: string;
  values: Array<WeeklyLifeCheckInValue | null>;
  counts: Record<WeeklyLifeCheckInValue, number>;
  answeredWeeks: number;
  interpretation: string;
  trend: 'improving' | 'declining' | 'steady' | 'varied' | 'insufficient';
  trendLabel: string;
  score: number | null;
}

export interface MonthlyLifeCheckInSummary {
  reviewCount: number;
  areas: MonthlyLifeAreaPattern[];
  insight: string;
}

const LIFE_CHECK_IN_SCORES: Record<WeeklyLifeCheckInValue, number> = {
  struggling: 0,
  okay: 1,
  well: 2,
};

const isLifeCheckInValue = (value: unknown): value is WeeklyLifeCheckInValue =>
  value === 'struggling' || value === 'okay' || value === 'well';

const formatAreaList = (labels: string[]): string => {
  if (labels.length <= 1) {
    return labels[0] ?? '';
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
};

const interpretLifeArea = (
  values: Array<WeeklyLifeCheckInValue | null>,
): Pick<
  MonthlyLifeAreaPattern,
  | 'counts'
  | 'answeredWeeks'
  | 'interpretation'
  | 'trend'
  | 'trendLabel'
  | 'score'
> => {
  const answered = values.filter(isLifeCheckInValue);
  const counts = answered.reduce<Record<WeeklyLifeCheckInValue, number>>(
    (totals, value) => ({...totals, [value]: totals[value] + 1}),
    {struggling: 0, okay: 0, well: 0},
  );
  if (answered.length === 0) {
    return {
      counts,
      answeredWeeks: 0,
      interpretation: 'No check-ins yet',
      trend: 'insufficient',
      trendLabel: 'Not enough to interpret',
      score: null,
    };
  }

  if (answered.length === 1) {
    return {
      counts,
      answeredWeeks: 1,
      interpretation: 'One check-in only',
      trend: 'insufficient',
      trendLabel: 'Not enough to see a pattern',
      score: LIFE_CHECK_IN_SCORES[answered[0]],
    };
  }

  let interpretation = 'Mixed through the month';
  if (counts.well === answered.length) {
    interpretation = 'Consistently well';
  } else if (counts.okay === answered.length) {
    interpretation = 'Consistently okay';
  } else if (counts.struggling === answered.length) {
    interpretation = 'Consistently needed care';
  } else {
    const largestCount = Math.max(counts.struggling, counts.okay, counts.well);
    const leaders = (
      ['struggling', 'okay', 'well'] as WeeklyLifeCheckInValue[]
    ).filter(value => counts[value] === largestCount);
    if (leaders.length === 1) {
      interpretation =
        leaders[0] === 'well'
          ? 'Mostly well'
          : leaders[0] === 'okay'
          ? 'Mostly okay'
          : 'Often needed care';
    }
  }

  let trend: MonthlyLifeAreaPattern['trend'];
  let trendLabel: string;
  const firstScore = LIFE_CHECK_IN_SCORES[answered[0]];
  const lastScore = LIFE_CHECK_IN_SCORES[answered[answered.length - 1]];
  if (lastScore > firstScore) {
    trend = 'improving';
    trendLabel = 'Improved by month’s end';
  } else if (lastScore < firstScore) {
    trend = 'declining';
    trendLabel = 'Needed more care by month’s end';
  } else if (answered.every(value => value === answered[0])) {
    trend = 'steady';
    trendLabel = 'Stayed steady';
  } else {
    trend = 'varied';
    trendLabel = 'Varied week to week';
  }

  return {
    counts,
    answeredWeeks: answered.length,
    interpretation,
    trend,
    trendLabel,
    score:
      answered.reduce(
        (total, value) => total + LIFE_CHECK_IN_SCORES[value],
        0,
      ) / answered.length,
  };
};

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

/** Collates the emotion saved with each daily Looking Forward reflection. */
export const getMonthlyLookingForwardFeelings = async (
  periodStart: string,
  periodEnd: string,
): Promise<WeeklyCheckInFeeling[]> => {
  const days = eachDayOfInterval({
    start: parseISO(periodStart),
    end: parseISO(periodEnd),
  });
  const entries = await Promise.all(
    days.map(async day => {
      const date = format(day, 'yyyy-MM-dd');
      const record = await getLocalJournalSingleton('looking_forward', date);
      const content = record
        ? safeJsonParse<Record<string, unknown>>(record.content, {fallback: {}})
        : {};
      const feeling =
        typeof content?.emotionName === 'string'
          ? content.emotionName.trim()
          : '';
      return feeling ? {date, feeling} : null;
    }),
  );
  const grouped = new Map<
    string,
    WeeklyCheckInFeeling & {firstIndex: number}
  >();

  entries.forEach((entry, index) => {
    if (!entry) {
      return;
    }
    const key = entry.feeling.toLocaleLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.dates.push(entry.date);
      return;
    }
    grouped.set(key, {
      name: entry.feeling,
      count: 1,
      dates: [entry.date],
      firstIndex: index,
    });
  });

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map(({firstIndex: _, ...feeling}) => feeling);
};

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

/**
 * Turns the Weekly Whole-life check-ins completed during a month into a
 * chronological, read-only monthly interpretation. The source answers remain
 * in their Weekly Reviews; the Monthly Review never asks for the same ratings
 * again.
 */
export const getMonthlyLifeCheckInSummary = async (
  periodStart: string,
  periodEnd: string,
): Promise<MonthlyLifeCheckInSummary> => {
  const reviews = (await getLocalReviewsByType('weekly'))
    .filter(
      review =>
        review.status === 'completed' &&
        review.periodEnd >= periodStart &&
        review.periodEnd <= periodEnd,
    )
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

  const areas: MonthlyLifeAreaPattern[] = WEEKLY_LIFE_AREAS.map(area => {
    const values = reviews.map(review => {
      const value = review.answers[area.answerKey]?.trim();
      return isLifeCheckInValue(value) ? value : null;
    });
    return {
      key: area.key,
      label: area.label,
      icon: area.icon,
      values,
      ...interpretLifeArea(values),
    };
  });
  const answeredAreas = areas.filter(
    (area): area is MonthlyLifeAreaPattern & {score: number} =>
      area.score !== null && area.answeredWeeks >= 2,
  );

  let insight = '';
  if (answeredAreas.length === 1) {
    insight = `${answeredAreas[0].label} was the only area with enough weekly answers to interpret this month.`;
  } else if (answeredAreas.length > 1) {
    const highestScore = Math.max(...answeredAreas.map(area => area.score));
    const lowestScore = Math.min(...answeredAreas.map(area => area.score));
    const strongest = answeredAreas
      .filter(area => area.score === highestScore)
      .map(area => area.label);
    const needsCare = answeredAreas
      .filter(area => area.score === lowestScore)
      .map(area => area.label);
    const improvingNeedsCare = answeredAreas.filter(
      area => area.score === lowestScore && area.trend === 'improving',
    );

    if (highestScore === lowestScore) {
      insight = 'Your life areas checked in at a similar level this month.';
    } else {
      insight = `${formatAreaList(strongest)} ${
        strongest.length === 1 ? 'was' : 'were'
      } the most supported. ${formatAreaList(needsCare)} needed the most care.`;
      if (improvingNeedsCare.length > 0) {
        insight += ` ${formatAreaList(
          improvingNeedsCare.map(area => area.label),
        )} strengthened by month’s end.`;
      }
    }
  }

  return {reviewCount: reviews.length, areas, insight};
};
