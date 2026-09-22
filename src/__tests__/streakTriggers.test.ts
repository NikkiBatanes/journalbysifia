/**
 * Faithful-rhythm completion audit.
 *
 * These static checks protect the meaningful completion boundaries used by
 * Journal by siFia. They replace the original siFia generic-streak audit.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

const read = (relativePath: string): string => (
  fs.readFileSync(path.join(SRC, relativePath), 'utf8')
);

const expectFaithfulRhythmTrigger = (source: string, rhythm: string) => {
  expect(source).toContain('claimFaithfulRhythmCelebration');
  expect(source).toContain(`rhythm: '${rhythm}'`);
  expect(source).toContain("navigate('StreakPlan'");
  expect(source).not.toContain('visibleStreakService');
};

describe('Faithful rhythm completion boundaries', () => {
  it('counts only new or completed Heart Journal entries', () => {
    const source = read('screens/ReflectionEditorScreen.tsx');

    expectFaithfulRhythmTrigger(source, 'heart_journal');
    expect(source).toContain("normalizedType !== 'guided' || entryData.guidedJourney?.completed === true");
    expect(source).toContain('if (!editingId && completesHeartJournal)');
  });

  it('counts newly created Scripture Notes toward Heart Journal', () => {
    const source = read('screens/ScriptureNoteEditorScreen.tsx');

    expectFaithfulRhythmTrigger(source, 'heart_journal');
    expect(source).toMatch(/if \(!editingId\)[\s\S]{0,400}claimFaithfulRhythmCelebration\('heart_journal'/);
    expect(source).not.toContain("rhythm: 'scripture_notes'");
  });

  it('counts Bible Study only when the study reaches saved', () => {
    const source = read('screens/BibleStudyScreen.tsx');

    expectFaithfulRhythmTrigger(source, 'bible_study');
    expect(source).toMatch(/if \(next === 'saved'\)[\s\S]{0,400}claimFaithfulRhythmCelebration\('bible_study'/);
    expect(source).toContain("preferences?.weekStart || 'monday'");
  });

  it('counts completed Session Notes toward Heart Journal and reserves their own streak for full Sunday-sermon months', () => {
    const source = read('screens/SermonNotesScreen.tsx');

    expectFaithfulRhythmTrigger(source, 'heart_journal');
    expect(source).toContain('markComplete && previousMetadata.is_complete !== true');
    expect(source).toContain("sessionNoteType === 'sermon' && completedDate.getDay() === 0");
    expect(source).toContain("claimFaithfulRhythmCelebration('session_notes'");
    expect(source).toContain('sermonRhythm.days.every');
  });

  it('counts new prayers while keeping playbook completion guards', () => {
    const prayerJournal = read('screens/PrayerJournalWalkthroughScreen.tsx');
    const peoplePrayer = read('screens/PrayersForPeopleWalkthroughScreen.tsx');
    const quickPrayer = read('screens/PrayerEditorScreen.tsx');
    const prayerList = read('components/journal/EnhancedPrayerListReactQuery.tsx');

    [prayerJournal, peoplePrayer, quickPrayer, prayerList].forEach(source => {
      expectFaithfulRhythmTrigger(source, 'prayer');
    });
    expect(prayerJournal).toContain('shouldCheckPrayerStreak && !isEditing');
    expect(peoplePrayer).toContain('shouldCheckPeopleStreak && !editingPrayerId');
  });

  it('counts a Review when its final stage is completed', () => {
    const source = read('screens/ReviewScreen.tsx');

    expectFaithfulRhythmTrigger(source, 'reviews');
    expect(source).toContain("review.status !== 'completed'");
    expect(source).toContain("source: 'review_complete'");
  });
});

describe('Unified tracker coverage', () => {
  it('defines every Journal by siFia rhythm in one ordered model', () => {
    const service = read('services/faithfulRhythmService.ts');

    [
      'morning',
      'evening',
      'heart_journal',
      'prayer',
      'bible_study',
      'session_notes',
      'reviews',
    ].forEach(rhythm => expect(service).toContain(`'${rhythm}'`));
    expect(service).toContain("cadence: 'daily'");
    expect(service).toContain("cadence: 'weekly'");
    expect(service).toContain("cadence: 'monthly'");
    expect(service).toContain("cadence: 'periodic'");
    expect(service).not.toContain('scripture_notes: buildDailyRhythmSnapshot');
    expect(service).toContain("item.kind === 'scripture_note'");
    expect(service).toContain("resolveSessionNoteType(item.reflection) === 'sermon'");
  });

  it('shows a compact tracker with a full tracker destination', () => {
    const card = read('components/dashboard/FaithfulRhythmsCard.tsx');
    const screen = read('screens/FaithfulRhythmsScreen.tsx');
    const navigator = read('navigation/RootStackNavigator.tsx');

    expect(card).toContain('name="flame"');
    expect(card).toContain('color={Colors.faithGold}');
    expect(card).toContain('bestRhythm.currentStreak');
    expect(card).toContain('Tap to see your rhythm details');
    expect(card).not.toContain('FAITHFUL_RHYTHM_ORDER.slice(0, 4)');
    expect(card).not.toContain('visibleRhythms.map');
    expect(card).not.toContain('shadowOpacity');
    expect(card).not.toContain('elevation:');
    expect(card).toContain("navigate('FaithfulRhythms')");
    expect(screen).toContain('accessibilityLabel="Close faithful rhythms"');
    expect(screen).toContain('contentInsetAdjustmentBehavior="never"');
    expect(screen).toContain('paddingTop: insets.top + 72');
    expect(screen).not.toContain('<SafeAreaView');
    expect(screen).toContain('title="Daily rhythms"');
    expect(screen).toContain('title="Weekly rhythms"');
    expect(screen).toContain('title="Sunday sermon rhythm"');
    expect(screen).toContain('title="Review rhythm"');
    expect(navigator).toContain('name="FaithfulRhythms"');
  });
});
