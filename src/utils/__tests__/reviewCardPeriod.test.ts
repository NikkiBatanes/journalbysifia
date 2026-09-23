import {formatReviewCardPeriod} from '../reviewCardPeriod';

describe('formatReviewCardPeriod', () => {
  it('uses title case and a compact same-month range', () => {
    expect(formatReviewCardPeriod('2025-08-01', '2025-08-31')).toBe('Aug 1–31');
  });

  it('shows both month names when a period crosses months', () => {
    expect(formatReviewCardPeriod('2026-01-01', '2026-03-31')).toBe('Jan 1–Mar 31');
  });

  it('can keep the year for year-long review cards', () => {
    expect(formatReviewCardPeriod('2025-01-01', '2025-12-31', true)).toBe('Jan 1–Dec 31, 2025');
  });

  it('shows both years when a period crosses years', () => {
    expect(formatReviewCardPeriod('2025-12-29', '2026-01-04')).toBe('Dec 29, 2025–Jan 4, 2026');
  });
});
