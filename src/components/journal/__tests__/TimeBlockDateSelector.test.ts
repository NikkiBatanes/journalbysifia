import fs from 'fs';
import path from 'path';

const editorSource = fs.readFileSync(path.resolve(__dirname, '../TimeBlockLogEditor.tsx'), 'utf8');
const todaySource = fs.readFileSync(path.resolve(__dirname, '../../../screens/TodayScreen.tsx'), 'utf8');

describe('Time Block date selection', () => {
  it('reuses the calendar strip from the Today screen', () => {
    expect(todaySource).toContain('<JournalCalendarStrip');
    expect(editorSource).toContain("import JournalCalendarStrip from '../dashboard/JournalCalendarStrip'");
    expect(editorSource).toContain('<JournalCalendarStrip');
    expect(editorSource).toContain('currentDate={selectedDate}');
    expect(editorSource).toContain('weekStartsOn={weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6}');
  });

  it('makes the displayed date open the calendar and updates the selected date', () => {
    expect(editorSource).toContain('accessibilityLabel={`Choose time block date. Currently ${formattedHeaderDate}`}');
    expect(editorSource).toContain('toggleJournalCalendar()');
    expect(editorSource).toContain('setSelectedDate(picked)');
    expect(editorSource).toMatch(/style=\{s\.headerDateText\}>\s*\{formattedHeaderDate\}/);
    expect(editorSource).not.toContain('For {formattedHeaderDate}');
  });

  it('pre-measures the calendar and reveals it with the Today spring animation', () => {
    expect(editorSource).toContain('const CALENDAR_SHEET_HEIGHT = 62');
    expect(editorSource).toContain('const CALENDAR_SPRING = { damping: 12, stiffness: 185, mass: 0.85 }');
    expect(editorSource).toContain('const journalCalendarProgress = useSharedValue(0)');
    expect(editorSource).toContain('withSpring(next ? 1 : 0, CALENDAR_SPRING)');
    expect(editorSource).toContain('marginBottom: Math.max(0, journalCalendarProgress.value * 28)');
    expect(editorSource).toContain('<Reanimated.View');
    expect(editorSource).toContain("pointerEvents={journalCalendarVisible ? 'auto' : 'none'}");
    expect(editorSource).not.toContain("context === 'journal' && journalCalendarVisible &&");
  });

  it('saves the newly selected calendar date with the time block', () => {
    expect(editorSource).toMatch(/onSave\(\{[\s\S]*?date: selectedDate,/);
  });
});
