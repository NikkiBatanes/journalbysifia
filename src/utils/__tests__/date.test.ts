import {
  formatLocalDateLong,
  formatSessionNoteHeaderDate,
  fromLocalDateString,
  toLocalDateString,
} from '../date';

describe('local calendar date formatting', () => {
  it('formats a canonical date without changing its local calendar day', () => {
    expect(formatLocalDateLong('2026-09-19')).toBe('September 19, 2026');
    expect(toLocalDateString(fromLocalDateString('2026-09-19'))).toBe('2026-09-19');
  });

  it('formats the session-note header date and hides the current year', () => {
    expect(
      formatSessionNoteHeaderDate('2026-09-06', new Date(2026, 0, 1)),
    ).toBe('SUN, SEPT 6');
    expect(
      formatSessionNoteHeaderDate('2025-09-07', new Date(2026, 0, 1)),
    ).toBe('SUN, SEPT 7, 2025');
  });
});
