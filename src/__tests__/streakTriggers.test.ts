/**
 * Streak Trigger Implementation Audit
 *
 * Static-analysis tests: reads each source file and verifies the exact
 * patterns that implement each streak trigger correctly.
 *
 * Checks for every trigger:
 *   ✅ Correct activity type string (not a stale/wrong one)
 *   ✅ shouldShowCelebration() call present
 *   ✅ markShownToday() call present
 *   ✅ navigate('StreakPlan', ...) present
 *   ✅ Playbook-completion guard present (when required)
 *   ✅ New-entry-only guard present (when required)
 *   ❌ Forbidden / old activity type strings absent
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SRC = path.resolve(__dirname, '../../src');

function read(relPath: string): string {
  return fs.readFileSync(path.join(SRC, relPath), 'utf8');
}

function has(src: string, pattern: RegExp | string): boolean {
  return typeof pattern === 'string'
    ? src.includes(pattern)
    : pattern.test(src);
}

function hasNot(src: string, pattern: RegExp | string): boolean {
  return !has(src, pattern);
}

// ---------------------------------------------------------------------------
// Shared patterns
// ---------------------------------------------------------------------------

const SHOULD_SHOW   = (type: string) => `shouldShowCelebration(` && new RegExp(`shouldShowCelebration\\([^,]+,\\s*'${type}'`);
const MARK_SHOWN    = /markShownToday\(/;
const NAV_STREAK    = /navigate\([^)]*'StreakPlan'/;
const SOURCE_FIELD  = (type: string) => new RegExp(`source:\\s*'${type}'`);

// ---------------------------------------------------------------------------
// GATED TRIGGERS — playbook must be completed
// ---------------------------------------------------------------------------

describe('Gated triggers — playbook completion required', () => {

  // ── 1. SmartJournalingReflectionModal ──────────────────────────────────
  describe('SmartJournalingReflectionModal → reflection_saved', () => {
    const src = read('screens/SmartJournalingReflectionModal.tsx');

    it('imports visibleStreakService', () => {
      expect(has(src, 'visibleStreakService')).toBe(true);
    });

    it('has playbook-completion guard (!playbookId || playbookStatus === completed)', () => {
      expect(has(src, /shouldCheckReflectionStreak\s*=\s*!playbookId\s*\|\|\s*playbookStatus\s*===\s*'completed'/)).toBe(true);
    });

    it('calls shouldShowCelebration with reflection_saved', () => {
      expect(has(src, SHOULD_SHOW('reflection_saved'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });

    it('passes source: reflection_saved', () => {
      expect(has(src, SOURCE_FIELD('reflection_saved'))).toBe(true);
    });
  });

  // ── 2. SmartJournalingGratitudeModal ───────────────────────────────────
  describe('SmartJournalingGratitudeModal → journal_gratitude_added', () => {
    const src = read('screens/SmartJournalingGratitudeModal.tsx');

    it('has playbook-completion guard (!isPlaybookContext || isPlaybookCompleted)', () => {
      expect(has(src, /shouldCheckStreak\s*=\s*!isPlaybookContext\s*\|\|\s*isPlaybookCompleted/)).toBe(true);
    });

    it('calls shouldShowCelebration with journal_gratitude_added', () => {
      expect(has(src, SHOULD_SHOW('journal_gratitude_added'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── 3. SmartJournalingTimeBlockModal ───────────────────────────────────
  describe('SmartJournalingTimeBlockModal → journal_timeblock_added', () => {
    const src = read('screens/SmartJournalingTimeBlockModal.tsx');

    it('has playbook-completion guard (!isPlaybookContext || isPlaybookCompleted)', () => {
      expect(has(src, /shouldCheckStreak\s*=\s*!isPlaybookContext\s*\|\|\s*isPlaybookCompleted/)).toBe(true);
    });

    it('calls shouldShowCelebration with journal_timeblock_added', () => {
      expect(has(src, SHOULD_SHOW('journal_timeblock_added'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── 4. PrayerJournalWalkthroughScreen — CAST & Open ───────────────────
  describe('PrayerJournalWalkthroughScreen → prayer_journal_acts / prayer_journal_open', () => {
    const src = read('screens/PrayerJournalWalkthroughScreen.tsx');

    it('has playbook-completion guard (!fromPlaybook || playbookStatus === completed)', () => {
      expect(has(src, /shouldCheckPrayerStreak\s*=\s*!fromPlaybook\s*\|\|\s*playbookStatus\s*===\s*'completed'/)).toBe(true);
    });

    it('uses correct CAST activity type: prayer_journal_acts', () => {
      expect(has(src, "'prayer_journal_acts'")).toBe(true);
    });

    it('uses correct Open activity type: prayer_journal_open', () => {
      expect(has(src, "'prayer_journal_open'")).toBe(true);
    });

    it('derives activity type from selectedPath (acts vs open)', () => {
      expect(has(src, /prayerActivityType\s*=\s*selectedPath.*acts.*prayer_journal_acts.*prayer_journal_open/s)).toBe(true);
    });

    it('does NOT use stale activity type journal_prayer_completed', () => {
      expect(hasNot(src, "'journal_prayer_completed'")).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });

    it('extracts playbookStatus from route params', () => {
      expect(has(src, /playbookStatus.*route\.params/s)).toBe(true);
    });
  });

  // ── 5. PrayersForPeopleWalkthroughScreen ──────────────────────────────
  describe('PrayersForPeopleWalkthroughScreen → prayer_saved', () => {
    const src = read('screens/PrayersForPeopleWalkthroughScreen.tsx');

    it('imports visibleStreakService', () => {
      expect(has(src, 'visibleStreakService')).toBe(true);
    });

    it('extracts playbookStatus from route params', () => {
      expect(has(src, /playbookStatus.*route\.params/s)).toBe(true);
    });

    it('has playbook-completion guard (!fromPlaybook || playbookStatus === completed)', () => {
      expect(has(src, /shouldCheckPeopleStreak\s*=\s*!fromPlaybook\s*\|\|\s*playbookStatus\s*===\s*'completed'/)).toBe(true);
    });

    it('calls shouldShowCelebration with prayer_saved', () => {
      expect(has(src, SHOULD_SHOW('prayer_saved'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── 6. PlaybookWalkthroughScreen — Affirmation ────────────────────────
  describe('PlaybookWalkthroughScreen → affirmation_read_aloud', () => {
    const src = read('screens/PlaybookWalkthroughScreen.tsx');

    it('has playbookStatus === completed guard for affirmation', () => {
      expect(has(src, /playbookStatus\s*===\s*'completed'/)).toBe(true);
    });

    it('calls shouldShowCelebration with affirmation_read_aloud', () => {
      expect(has(src, SHOULD_SHOW('affirmation_read_aloud'))).toBe(true);
    });

    it('calls shouldShowCelebration with playbook_completed', () => {
      expect(has(src, SHOULD_SHOW('playbook_completed'))).toBe(true);
    });

    it('threads playbookStatus into prayer metadata', () => {
      expect(has(src, /playbookStatus[,\s]/)).toBe(true);
    });

    it('passes playbookStatus to SmartJournalingReflectionModal', () => {
      expect(has(src, /SmartJournalingReflectionModal[\s\S]{0,300}playbookStatus=\{playbookStatus\}/)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── 7. ActionStepsCard ────────────────────────────────────────────────
  describe('ActionStepsCard → action_step_completed', () => {
    const src = read('components/ActionStepsCard.tsx');

    it('has playbookStatus prop in interface', () => {
      expect(has(src, /playbookStatus\?\s*:\s*string/)).toBe(true);
    });

    it('fires for individual steps when playbookStatus === completed', () => {
      expect(has(src, /isPlaybookCompleted\s*=\s*allStepsComplete\s*\|\|\s*playbookStatus\s*===\s*'completed'/)).toBe(true);
    });

    it('calls shouldShowCelebration with action_step_completed', () => {
      expect(has(src, SHOULD_SHOW('action_step_completed'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── 8. DevotionalDetailReflectionModal — gated by devotional day ──────
  describe('DevotionalDetailReflectionModal → reflection_saved (gated: devotionalDayCompleted)', () => {
    const src = read('screens/DevotionalDetailReflectionModal.tsx');

    it('has devotionalDayCompleted prop in interface', () => {
      expect(has(src, 'devotionalDayCompleted')).toBe(true);
    });

    it('gates streak on new entry AND devotionalDayCompleted', () => {
      expect(has(src, /!existingEntry\s*&&\s*user\?\.id\s*&&\s*devotionalDayCompleted/)).toBe(true);
    });

    it('calls shouldShowCelebration with reflection_saved', () => {
      expect(has(src, SHOULD_SHOW('reflection_saved'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── DevotionalDetailScreen — passes devotionalDayCompleted ────────────
  describe('DevotionalDetailScreen — passes devotionalDayCompleted to reflection modal', () => {
    const src = read('screens/DevotionalDetailScreen.tsx');

    it('passes devotionalDayCompleted computed from prayedDays', () => {
      expect(has(src, /devotionalDayCompleted=\{prayedDays\[`\$\{devotionalId\}-\$\{currentDayIndex\}`\]\s*===\s*true\}/)).toBe(true);
    });

    it('does NOT trigger streak for devotional_prayer (faith points only, not streak)', () => {
      // The devotional_prayer source should only appear in faithPointsService.awardPoints,
      // never in visibleStreakService.shouldShowCelebration
      const streakCallsForDevPrayer = /shouldShowCelebration[^)]*devotional_prayer/.test(src);
      expect(streakCallsForDevPrayer).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// UNGATED TRIGGERS — independent activities, always fire
// ---------------------------------------------------------------------------

describe('Ungated triggers — independent activities', () => {

  // ── ReflectionEditorScreen ────────────────────────────────────────────
  describe('ReflectionEditorScreen → reflection_saved (new entries only)', () => {
    const src = read('screens/ReflectionEditorScreen.tsx');

    it('imports visibleStreakService', () => {
      expect(has(src, 'visibleStreakService')).toBe(true);
    });

    it('gates on new entry only (!editingId)', () => {
      expect(has(src, /if\s*\(!editingId\)/)).toBe(true);
    });

    it('calls shouldShowCelebration with reflection_saved', () => {
      expect(has(src, SHOULD_SHOW('reflection_saved'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── GratitudeListReactQuery ───────────────────────────────────────────
  describe('GratitudeListReactQuery → journal_gratitude_added (journal screen)', () => {
    const src = read('components/journal/GratitudeListReactQuery.tsx');

    it('imports useNavigation', () => {
      expect(has(src, "from '@react-navigation/native'")).toBe(true);
      expect(has(src, 'useNavigation')).toBe(true);
    });

    it('calls useNavigation() inside component', () => {
      expect(has(src, /const navigation\s*=\s*useNavigation\(\)/)).toBe(true);
    });

    it('calls shouldShowCelebration with journal_gratitude_added', () => {
      expect(has(src, SHOULD_SHOW('journal_gratitude_added'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('actually navigates to StreakPlan (not dead code)', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });

    it('does NOT have dead-code comment (navigate was previously skipped)', () => {
      expect(hasNot(src, 'skip navigation since this component does not have direct navigation access')).toBe(true);
    });
  });

  // ── EnhancedPrayerListReactQuery ─────────────────────────────────────
  describe('EnhancedPrayerListReactQuery → prayer_list_request_added', () => {
    const src = read('components/journal/EnhancedPrayerListReactQuery.tsx');

    it('calls shouldShowCelebration with prayer_list_request_added', () => {
      expect(has(src, SHOULD_SHOW('prayer_list_request_added'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── DashboardHomeScreen ───────────────────────────────────────────────
  describe('DashboardHomeScreen → prayer_for_now', () => {
    const src = read('screens/DashboardHomeScreen.tsx');

    it('calls shouldShowCelebration with prayer_for_now', () => {
      expect(has(src, SHOULD_SHOW('prayer_for_now'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── PrayerEditorScreen (journal "Pray for now") ───────────────────────
  describe('PrayerEditorScreen → prayer_for_now (journal screen)', () => {
    const src = read('screens/PrayerEditorScreen.tsx');

    it('imports visibleStreakService', () => {
      expect(has(src, 'visibleStreakService')).toBe(true);
    });

    it('calls shouldShowCelebration with prayer_for_now', () => {
      expect(has(src, SHOULD_SHOW('prayer_for_now'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });

    it('guards on user?.id before calling streak service', () => {
      expect(has(src, /user\?\.id[\s\S]{0,200}shouldShowCelebration/)).toBe(true);
    });
  });

  // ── TodaysWinWalkthroughScreen ────────────────────────────────────────
  describe('TodaysWinWalkthroughScreen → journal_win_added', () => {
    const src = read('screens/TodaysWinWalkthroughScreen.tsx');

    it('uses correct activity type: journal_win_added', () => {
      expect(has(src, "'journal_win_added'")).toBe(true);
    });

    it('does NOT use stale activity type journal_today_win', () => {
      expect(hasNot(src, "'journal_today_win'")).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── TomorrowInHisHandsWalkthroughScreen ──────────────────────────────
  describe('TomorrowInHisHandsWalkthroughScreen → journal_looking_forward_added', () => {
    const src = read('screens/TomorrowInHisHandsWalkthroughScreen.tsx');

    it('uses correct activity type: journal_looking_forward_added', () => {
      expect(has(src, "'journal_looking_forward_added'")).toBe(true);
    });

    it('does NOT use stale activity type journal_looking_forward', () => {
      // Only the _added variant should appear; bare 'journal_looking_forward' must not
      expect(hasNot(src, "'journal_looking_forward'")).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── TodaysFocusReactQuery ─────────────────────────────────────────────
  describe('TodaysFocusReactQuery → journal_focus_set', () => {
    const src = read('components/journal/TodaysFocusReactQuery.tsx');

    it('calls shouldShowCelebration with journal_focus_set', () => {
      expect(has(src, SHOULD_SHOW('journal_focus_set'))).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });

  // ── DevotionalDetailScreen — devotional completion ────────────────────
  describe('DevotionalDetailScreen → devotional_completed / devotional_full_completed', () => {
    const src = read('screens/DevotionalDetailScreen.tsx');

    it('uses devotional_completed activity type', () => {
      expect(has(src, "'devotional_completed'")).toBe(true);
    });

    it('uses devotional_full_completed activity type', () => {
      expect(has(src, "'devotional_full_completed'")).toBe(true);
    });

    it('calls markShownToday', () => {
      expect(has(src, MARK_SHOWN)).toBe(true);
    });

    it('navigates to StreakPlan', () => {
      expect(has(src, NAV_STREAK)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// ACTIVITY TYPE REGISTRY — all types used must be valid
// ---------------------------------------------------------------------------

describe('Activity type validity — all used types must be in VISIBLE_STREAK_ACTIVITY_TYPES', () => {
  const registry = read('services/visibleStreakService.ts');

  const validTypes = [
    'playbook_completed',
    'action_step_completed',
    'affirmation_read_aloud',
    'devotional_completed',
    'devotional_full_completed',
    'reflection_saved',
    'prayer_journal_open',
    'prayer_list_request_added',
    'prayer_for_now',
    'prayer_journal_acts',
    'prayer_saved',
    'journal_focus_set',
    'journal_win_added',
    'journal_looking_forward_added',
    'journal_gratitude_added',
    'journal_timeblock_added',
  ];

  validTypes.forEach(type => {
    it(`'${type}' is registered in VISIBLE_STREAK_ACTIVITY_TYPES`, () => {
      expect(has(registry, `'${type}'`)).toBe(true);
    });
  });

  const invalidTypes = [
    'journal_today_win',
    'journal_looking_forward',
    'journal_prayer_completed',
  ];

  invalidTypes.forEach(type => {
    it(`stale type '${type}' is NOT registered`, () => {
      // It must not appear inside the VISIBLE_STREAK_ACTIVITY_TYPES array block
      const arrayBlock = registry.match(/VISIBLE_STREAK_ACTIVITY_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
      expect(arrayBlock.includes(`'${type}'`)).toBe(false);
    });
  });
});
