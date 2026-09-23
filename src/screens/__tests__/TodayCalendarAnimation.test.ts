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

  it('uses the live asymmetric safe area instead of front and inside screen guesses', () => {
    expect(source).toContain("Platform.OS === 'ios' && insets.left !== insets.right");
    expect(source).toContain('const SIDE_REGION_TOP_SPACING = 20');
    expect(source).toContain('Math.min(TODAY_READABLE_MAX_WIDTH, windowWidth)');
    expect(source).toContain('const readableLeadingPadding');
    expect(source).toContain('event.nativeEvent.layout.x + TODAY_HORIZONTAL_MARGIN');
    expect(source).toContain('readableContentLeading ?? readableLeadingPadding');
    expect(source).toContain('onLayout={handleReadableContentLayout}');
    expect(source).toContain('insets.left + TODAY_HORIZONTAL_MARGIN');
    expect(source).toContain('{ paddingLeft: calendarLeadingPadding, paddingRight: topCalendarTrailingPadding }');
    expect(source).toContain('<View style={styles.readableRail}>');
    expect(source).not.toContain('styles.readableRail, { paddingLeft: insets.left, paddingRight: insets.right }');
    expect(source).toContain('style={usesSideSystemRegion ? styles.dateRow : undefined}');
    expect(source).toContain('style={styles.sideCalendarButton}');
    expect(source).not.toContain('IPHONE_DUO_MIN_WIDTH');
    expect(source).not.toContain('IPHONE_DUO_INSIDE_MIN_WIDTH');
    expect(source).not.toContain("width: '114%'");
    expect(source.indexOf('styles.sideCalendarRail,')).toBeLessThan(
      source.indexOf('style={usesSideSystemRegion ? styles.dateRow : undefined}'),
    );
    expect(source.indexOf('{!usesTopCalendarRail ? calendarSheet : null}')).toBeLessThan(
      source.indexOf('style={usesSideSystemRegion ? styles.dateRow : undefined}'),
    );
  });

  it('uses the open Duo portrait top rail beside the status region', () => {
    expect(source).toContain("sizeClasses.horizontal === 'regular'");
    expect(source).toContain("sizeClasses.vertical === 'regular'");
    expect(source).toContain("sizeClasses.horizontal === 'unspecified'");
    expect(source).toContain('windowWidth / windowHeight > 0.58');
    expect(source).toContain('hasInnerPortraitSizeClasses || hasInnerPortraitProportions');
    expect(source).toContain('!Platform.isPad');
    expect(source).toContain('const INNER_PORTRAIT_TOP_SPACING = 18');
    expect(source).toContain('const INNER_PORTRAIT_STATUS_CLEARANCE = 128');
    expect(source).toContain('const INNER_PORTRAIT_CALENDAR_CONTROL_WIDTH = 52');
    expect(source).toContain('const INNER_PORTRAIT_CALENDAR_GAP = 12');
    expect(source).toContain('usesInnerPortraitRail && styles.innerPortraitCalendarRail');
    expect(source).toContain('usesInnerPortraitRail && calendarVisible && styles.innerPortraitCalendarRailOpen');
    expect(source).toContain('style={styles.innerPortraitCalendarButton}');
    expect(source).toContain('right: INNER_PORTRAIT_STATUS_CLEARANCE');
    expect(source).toContain('{!usesTopCalendarRail ? <View style={styles.headerIconsRow}>');
  });
});
