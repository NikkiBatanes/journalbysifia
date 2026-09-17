import { canOpenRoutineForDate } from '../routineDatePolicy';
import { compareLocalDate, fromLocalDateString, toLocalDateString } from '../../utils/date';

describe('routine date policy', () => {
  const today = '2026-09-17';

  it('allows today and past dates but blocks future dates', () => {
    expect(canOpenRoutineForDate('2026-09-16', today)).toBe(true);
    expect(canOpenRoutineForDate(today, today)).toBe(true);
    expect(canOpenRoutineForDate('2026-09-18', today)).toBe(false);
    expect(canOpenRoutineForDate('2027-01-01', today)).toBe(false);
  });

  it('compares YYYY-MM-DD calendar identity without UTC parsing', () => {
    expect(compareLocalDate('2026-09-16', today)).toBe('past');
    expect(compareLocalDate(today, today)).toBe('today');
    expect(compareLocalDate('2026-09-18', today)).toBe('future');
    expect(toLocalDateString(fromLocalDateString('2026-09-17'))).toBe('2026-09-17');
  });
});
