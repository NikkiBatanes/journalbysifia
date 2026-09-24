import {
  formatNextMonthPeriod,
  formatReviewedMonthPeriod,
} from '../reviewMonthPeriod';

describe('review month period labels', () => {
  it('hides the year for months in the current year', () => {
    expect(formatReviewedMonthPeriod('2026-08-01', 2026, 'en-US')).toBe(
      'August',
    );
    expect(formatNextMonthPeriod('2026-08-31', 2026, 'en-US')).toBe(
      'September',
    );
  });

  it('retains the year for months outside the current year', () => {
    expect(formatReviewedMonthPeriod('2025-12-01', 2026, 'en-US')).toBe(
      'December 2025',
    );
    expect(formatNextMonthPeriod('2026-12-31', 2026, 'en-US')).toBe(
      'January 2027',
    );
  });
});
