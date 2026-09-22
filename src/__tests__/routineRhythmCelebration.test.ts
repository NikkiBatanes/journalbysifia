import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

const read = (relativePath: string): string => (
  fs.readFileSync(path.join(SRC, relativePath), 'utf8')
);

describe('Morning and Evening rhythm celebration', () => {
  it('opens the Morning rhythm streak after a new Morning completion', () => {
    const source = read('screens/morning/MorningClosingScreen.tsx');

    expect(source).toMatch(/await completeRoutine\(\)[\s\S]*navigation\.navigate\('StreakPlan'/);
    expect(source).toContain("rhythm: 'morning'");
    expect(source).toContain("returnTo: 'moments'");
  });

  it('opens the Evening rhythm streak after a new Evening completion', () => {
    const source = read('screens/evening/EveningFlowScreens.tsx');

    expect(source).toMatch(/await completeRoutine\(\)[\s\S]*navigation\.navigate\('StreakPlan'/);
    expect(source).toContain("rhythm: 'evening'");
    expect(source).toContain("returnTo: 'moments'");
  });

  it('uses Journal-specific wording and routine-specific streak data', () => {
    const source = read('screens/StreakPlanScreen.tsx');

    expect(source).toContain('getFaithfulRhythmsSnapshot');
    expect(source).toContain('rhythms[params.rhythm]');
    expect(source).toContain('`${streakCount}-${streakUnit} ${rhythmName.toLowerCase()} streak`');
    expect(source).not.toContain('-day Faith in Action streak');
    expect(source).toContain('You made space to begin with intention.');
    expect(source).toContain('Your evening reflection is complete.');
    expect(source).toContain('Your Heart Journal entry is saved.');
    expect(source).toContain('It also counts toward your Heart Journal rhythm.');
    expect(source).toContain('They also count toward your Heart Journal rhythm.');
    expect(source).toContain('Your Bible Study is complete.');
    expect(source).toContain('You completed Sermon Notes for every Sunday this month.');
    expect(source).not.toContain('scripture_notes:');
    expect(source).not.toContain('Carry today’s focus with you.');
    expect(source).not.toContain('You took a faithful step today.');
    expect(source).not.toContain('Keep bringing your real moments before God.');
    expect(source).toContain("params.returnTo === 'moments'");
    expect(source).toContain("StackActions.popTo('MainTabs', destination)");
    expect(source).toContain('target: rootNavigation.getState().key');
    expect(source).toContain('backgroundColor: Colors.cardBackground');
  });

  it('returns Heart Journal completions to Moments without exposing the legacy Journal screen', () => {
    const reflectionEditor = read('screens/ReflectionEditorScreen.tsx');
    const streakScreen = read('screens/StreakPlanScreen.tsx');
    const journalStack = read('navigation/JournalStackNavigator.tsx');
    const rootStack = read('navigation/RootStackNavigator.tsx');

    expect(reflectionEditor).toContain("returnTo: 'moments'");
    expect(reflectionEditor).not.toContain("returnTo: 'journal'");
    expect(streakScreen).not.toContain('JournalMain');
    expect(streakScreen).not.toContain("params.returnTo === 'journal'");
    expect(journalStack).not.toContain('JournalScreen');
    expect(journalStack).not.toContain('JournalMain');
    expect(rootStack).not.toContain("import JournalScreen from '../screens/JournalScreen'");
    expect(fs.existsSync(path.join(SRC, 'screens/JournalScreen.tsx'))).toBe(false);
  });

  it('uses a fade transition instead of sliding from the bottom', () => {
    const source = read('navigation/RootStackNavigator.tsx');
    const registration = source.slice(source.indexOf('name="StreakPlan"'), source.indexOf('name="StreakPlan"') + 500);

    expect(registration).toContain("animation: 'fade'");
    expect(registration).not.toContain("animation: 'slide_from_bottom'");
  });

  it('uses quiet routine icons without sparkle or floating white treatment', () => {
    const screen = read('screens/StreakPlanScreen.tsx');
    const weekRow = read('components/WeeklyStreakRow.tsx');

    expect(screen).toContain("'sunny-outline'");
    expect(screen).toContain("'moon-outline'");
    expect(screen).not.toContain('name="sparkles"');
    expect(screen).not.toContain('shadowOpacity');
    expect(weekRow).not.toContain('name="sparkles"');
    expect(weekRow).toContain('name="checkmark"');
  });

  it('animates the routine icon and opens a dedicated streak share composer', () => {
    const screen = read('screens/StreakPlanScreen.tsx');
    const composer = read('components/TruthToCarryShareComposer.tsx');

    expect(screen).toContain('Animated.loop');
    expect(screen).toContain('iconMotionAnim.interpolate');
    expect(screen).toContain('name="paper-plane-outline"');
    expect(screen).toContain('variant="streak"');
    expect(screen).toContain('streakSummary={{');
    expect(screen).toContain('dayLabels={activeRhythm?.days.map(day => day.label)}');
    expect(composer).toContain("variant?: 'text' | 'morning-summary' | 'streak'");
    expect(composer).toContain('MORNING RHYTHM COMPLETE');
    expect(composer).toContain('EVENING RHYTHM COMPLETE');
    expect(composer).toContain('STREAK_WEEK_ORDER[streakSummary.weekStart]');
  });

  it('asks for an App Store review only after a meaningful Morning or Evening milestone', () => {
    const screen = read('screens/StreakPlanScreen.tsx');
    const legacyMilestones = read('services/milestoneCelebrationService.ts');

    expect(screen).toContain("params.rhythm === 'morning' || params.rhythm === 'evening'");
    expect(screen).toContain('[7, 30, 100].includes(streakCount)');
    expect(screen).toContain('requestReview({triggerSource: `${params.rhythm}_rhythm_${streakCount}`}');
    expect(legacyMilestones).not.toContain('requestReview');
  });
});
