export const REVIEW_QA_WEEKLY_REFERENCE_DATE = '2026-09-21';

export const reviewQAReferenceDate = (): Date => {
  const [year, month, day] = REVIEW_QA_WEEKLY_REFERENCE_DATE.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};
