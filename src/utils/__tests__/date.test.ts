import { formatLocalDateLong, fromLocalDateString, toLocalDateString } from '../date';

describe('local calendar date formatting', () => {
  it('formats a canonical date without changing its local calendar day', () => {
    expect(formatLocalDateLong('2026-09-19')).toBe('September 19, 2026');
    expect(toLocalDateString(fromLocalDateString('2026-09-19'))).toBe('2026-09-19');
  });
});
