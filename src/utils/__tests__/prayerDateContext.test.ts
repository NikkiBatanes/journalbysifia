import { formatPrayerDateContext, formatPrayerDateLong } from '../date';

const reference = new Date(2026, 8, 21, 12);
const ago = (days: number) => {
  const date = new Date(reference);
  date.setDate(date.getDate() - days);
  return date;
};

describe('Prayer date context', () => {
  it.each([
    [0, 'Today'], [1, 'Yesterday'], [2, '2 days ago'], [6, '6 days ago'],
    [7, '1 week ago'], [13, '1 week ago'], [21, '3 weeks ago'], [34, '4 weeks ago'],
    [35, '1 month ago'], [60, '2 months ago'], [183, '6 months ago'],
    [335, '11 months ago'], [365, '1 year ago'], [730, '2 years ago'],
  ])('formats %i days before the reference date as %s', (days, relative) => {
    expect(formatPrayerDateContext(ago(days), reference)?.relativeLabel).toBe(relative);
  });

  it('uses the full actual calendar date and a local-calendar relative label', () => {
    expect(formatPrayerDateContext('2026-03-18', reference)).toEqual({
      dateLabel: 'March 18, 2026',
      relativeLabel: '6 months ago',
      combinedLabel: 'March 18, 2026 · 6 months ago',
    });
    expect(formatPrayerDateContext('2026-01-20', reference)?.relativeLabel).toBe('8 months ago');
    expect(formatPrayerDateLong('2026-03-18')).toBe('Wednesday, March 18, 2026');
  });

  it('handles calendar boundaries, leap dates, and invalid values safely', () => {
    expect(formatPrayerDateContext(new Date(2026, 8, 20, 23, 58), reference)?.relativeLabel).toBe('Yesterday');
    expect(formatPrayerDateContext(new Date(2024, 1, 29, 12), new Date(2025, 2, 1, 12))?.relativeLabel).toBe('1 year ago');
    expect(formatPrayerDateContext('not-a-date', reference)).toBeUndefined();
    expect(formatPrayerDateContext(undefined, reference)).toBeUndefined();
    expect(formatPrayerDateLong('not-a-date')).toBe('');
  });
});
