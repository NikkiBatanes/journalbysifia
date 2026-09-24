import {formatForMeDayTestimonyDate} from '../forMeDayTestimonyDate';

describe('For Me Day testimony date label', () => {
  it('hides the year when the testimony date is in the current year', () => {
    const timestamp = new Date(2026, 8, 24, 12).toISOString();

    expect(formatForMeDayTestimonyDate(timestamp, false, 2026)).toBe(
      'Written Thu, Sept 24',
    );
  });

  it('shows the year and Updated label after a later edit', () => {
    const timestamp = new Date(2024, 8, 24, 12).toISOString();

    expect(formatForMeDayTestimonyDate(timestamp, true, 2026)).toBe(
      'Updated Tue, Sept 24, 2024',
    );
  });

  it('returns no label for missing or invalid timestamps', () => {
    expect(formatForMeDayTestimonyDate()).toBe('');
    expect(formatForMeDayTestimonyDate('not-a-date')).toBe('');
  });
});
