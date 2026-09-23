import {formatWeeklyGratitudePeriod} from '../weeklyGratitudePeriod';

describe('Weekly Gratitude period labels', () => {
  it('shows a shared month and year only once', () => {
    expect(formatWeeklyGratitudePeriod('2026-09-14', '2026-09-21'))
      .toBe('Sep 14–21, 2026');
  });

  it('shows both months but only one shared year', () => {
    expect(formatWeeklyGratitudePeriod('2026-09-28', '2026-10-04'))
      .toBe('Sep 28–Oct 4, 2026');
  });

  it('shows both years when a week crosses years', () => {
    expect(formatWeeklyGratitudePeriod('2025-12-29', '2026-01-04'))
      .toBe('Dec 29, 2025–Jan 4, 2026');
  });

  it('supports full month names for prominent review headers', () => {
    expect(formatWeeklyGratitudePeriod('2026-09-14', '2026-09-20', 2026, 'long'))
      .toBe('September 14–20');
    expect(formatWeeklyGratitudePeriod('2026-09-28', '2026-10-04', 2026, 'long'))
      .toBe('September 28–October 4');
  });

  it.each([
    ['2026-09-14', '2026-09-20', 'Sep 14–20'],
    ['2026-09-28', '2026-10-04', 'Sep 28–Oct 4'],
    ['2025-09-14', '2025-09-20', 'Sep 14–20, 2025'],
    ['2025-12-29', '2026-01-04', 'Dec 29, 2025–Jan 4, 2026'],
    ['2026-12-28', '2027-01-03', 'Dec 28, 2026–Jan 3, 2027'],
  ])('omits only the shared current year for %s–%s', (start, end, expected) => {
    expect(formatWeeklyGratitudePeriod(start, end, 2026)).toBe(expected);
  });
});
