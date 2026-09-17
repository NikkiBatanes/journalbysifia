import fs from 'fs';
import path from 'path';

describe('Today calendar animation', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../TodayScreen.tsx'), 'utf8');

  it('opens the one-row calendar with one stable spring target', () => {
    expect(source).toContain('const CALENDAR_SHEET_HEIGHT = 60');
    expect(source).toContain('withSpring(next ? 1 : 0, CALENDAR_SPRING)');
    expect(source).toContain('calendarProgress.value * CALENDAR_SHEET_HEIGHT');
  });

  it('does not retarget the animation from runtime height measurements', () => {
    expect(source).not.toContain('calendarSheetHeight');
    expect(source).not.toContain('setCalendarSheetHeight');
  });
});
