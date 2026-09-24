export const REVIEW_QA_WEEKLY_REFERENCE_DATE = '2026-09-28';
export const REVIEW_QA_MONTHLY_REFERENCE_DATE = '2026-09-01';

export const REVIEW_QA_PREVIOUS_WEEK_DATES = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
] as const;

export const REVIEW_QA_WEEKLY_DATES = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
] as const;

export const reviewQAWeeklyPeriodEndDate = (): Date => {
  const [year, month, day] = REVIEW_QA_WEEKLY_DATES[6].split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const reviewQAPreviousWeeklyPeriodEndDate = (): Date => {
  const [year, month, day] = REVIEW_QA_PREVIOUS_WEEK_DATES[6]
    .split('-')
    .map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const reviewQAReferenceDate = (): Date => {
  const [year, month, day] = REVIEW_QA_WEEKLY_REFERENCE_DATE.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};
