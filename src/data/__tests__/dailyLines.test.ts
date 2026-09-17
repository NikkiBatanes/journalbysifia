import {
  DAILY_LINES,
  getDailyLine,
  type DailyLineCategory,
  type DailyLinePeriod,
} from '../dailyLines';

const PERIODS: DailyLinePeriod[] = ['morning', 'evening'];

const CATEGORIES: DailyLineCategory[] = [
  'stillness',
  'attention',
  'faithfulness',
  'grace',
  'scripture',
  'gratitude',
];

const TIMES = ['any', 'morning', 'evening'];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

describe('daily lines', () => {
  it('provides at least 90 unique lines', () => {
    const texts = DAILY_LINES.map(line => line.text);
    expect(texts.length).toBeGreaterThanOrEqual(90);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('only contains well-formed entries', () => {
    for (const line of DAILY_LINES) {
      expect(line.text.trim().length).toBeGreaterThan(0);
      expect(TIMES).toContain(line.time);
      expect(CATEGORIES).toContain(line.category);
    }
  });

  it('keeps a meaningful share of period-specific lines', () => {
    const morningOnly = DAILY_LINES.filter(line => line.time === 'morning');
    const eveningOnly = DAILY_LINES.filter(line => line.time === 'evening');
    const anyTime = DAILY_LINES.filter(line => line.time === 'any');
    expect(morningOnly.length).toBeGreaterThanOrEqual(20);
    expect(eveningOnly.length).toBeGreaterThanOrEqual(20);
    expect(anyTime.length).toBeGreaterThanOrEqual(75);
  });

  it('resolves to the same line for the whole period of a calendar day', () => {
    for (const period of PERIODS) {
      const early = new Date(2026, 8, 17, 0, 1);
      const late = new Date(2026, 8, 17, 23, 59);
      expect(getDailyLine(early, period)).toEqual(getDailyLine(late, period));
    }
  });

  it('never repeats a category on consecutive days', () => {
    const start = new Date(2026, 0, 1);
    for (const period of PERIODS) {
      for (let i = 0; i < 400; i++) {
        const today = getDailyLine(addDays(start, i), period);
        const tomorrow = getDailyLine(addDays(start, i + 1), period);
        expect(today.category).not.toBe(tomorrow.category);
      }
    }
  });

  it('never shows the same line two days in a row', () => {
    const start = new Date(2026, 0, 1);
    for (const period of PERIODS) {
      for (let i = 0; i < 400; i++) {
        const today = getDailyLine(addDays(start, i), period);
        const tomorrow = getDailyLine(addDays(start, i + 1), period);
        expect(today.text).not.toBe(tomorrow.text);
      }
    }
  });

  it('exhausts each pool evenly and spaces repeats out', () => {
    const start = new Date(2026, 0, 1);
    const anyPool = DAILY_LINES.filter(line => line.time === 'any');
    for (const period of PERIODS) {
      const specificPool = DAILY_LINES.filter(line => line.time === period);
      const anySeen = new Map<string, number[]>();
      const specificSeen = new Map<string, number[]>();
      for (let i = 0; i < 730; i++) {
        const line = getDailyLine(addDays(start, i), period);
        const seen = line.time === 'any' ? anySeen : specificSeen;
        const days = seen.get(line.text) ?? [];
        days.push(i);
        seen.set(line.text, days);
      }
      // every line in each pool is used
      expect(anySeen.size).toBe(anyPool.length);
      expect(specificSeen.size).toBe(specificPool.length);
      // occurrences are evenly spread — no line dominates or starves
      const spread = (seen: Map<string, number[]>) => {
        const counts = [...seen.values()].map(days => days.length);
        return Math.max(...counts) - Math.min(...counts);
      };
      expect(spread(anySeen)).toBeLessThanOrEqual(2);
      expect(spread(specificSeen)).toBeLessThanOrEqual(2);
      // a line never repeats within 24 hours of its last showing
      for (const days of [...anySeen.values(), ...specificSeen.values()]) {
        for (let i = 1; i < days.length; i++) {
          expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('surfaces period-specific lines roughly a third of the time', () => {
    const start = new Date(2026, 0, 1);
    for (const period of PERIODS) {
      let specific = 0;
      for (let i = 0; i < 365; i++) {
        if (getDailyLine(addDays(start, i), period).time === period) {
          specific++;
        }
      }
      const rate = specific / 365;
      expect(rate).toBeGreaterThanOrEqual(0.33);
      expect(rate).toBeLessThanOrEqual(0.42);
    }
  });

  it('only serves lines eligible for the period', () => {
    const start = new Date(2026, 0, 1);
    for (let i = 0; i < 300; i++) {
      const date = addDays(start, i);
      expect(getDailyLine(date, 'morning').time).not.toBe('evening');
      expect(getDailyLine(date, 'evening').time).not.toBe('morning');
    }
  });

  it('keeps rotating categories across month and year boundaries', () => {
    for (const period of PERIODS) {
      expect(getDailyLine(new Date(2028, 1, 29), period).category)
        .not.toBe(getDailyLine(new Date(2028, 2, 1), period).category);
      expect(getDailyLine(new Date(2026, 11, 31), period).category)
        .not.toBe(getDailyLine(new Date(2027, 0, 1), period).category);
    }
  });
});
