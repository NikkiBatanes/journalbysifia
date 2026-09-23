import fs from 'fs';
import path from 'path';

describe('JournalCalendarStrip rotation consistency', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../JournalCalendarStrip.tsx'), 'utf8');

  it('does not treat layout-driven scrolling as a user week selection', () => {
    expect(source).toContain('const userPagingRef = useRef(false)');
    expect(source).toContain('userPagingRef.current = false;');
    expect(source).toContain('if (!userPagingRef.current) { return; }');
    expect(source).toContain('onScrollBeginDrag={() => { userPagingRef.current = true; }}');
  });

  it('re-centers the selected week after the rotated content is laid out', () => {
    expect(source).toContain('const scrollToCurrentWeek = useCallback');
    expect(source).toContain('const scrollTo = currentWeekIndex * headerWidth');
    expect(source).toContain('onContentSizeChange={scrollToCurrentWeek}');
  });
});
