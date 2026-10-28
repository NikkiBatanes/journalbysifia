import fs from 'fs';
import path from 'path';

describe('Journal core tier access', () => {
  it('contains no Time Block payment or tier-gating branches', () => {
    const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
    const sources = [
      read('components/journal/TimeBlockLogEditor.tsx'),
      read('components/journal/TimeBlockReactQuery.tsx'),
      read('components/CalendarSyncButton.tsx'),
      read('components/DeleteTimeBlockModal.tsx'),
      read('screens/TimeBlockEditorScreen.tsx'),
      read('screens/SmartJournalingTimeBlockModal.tsx'),
    ].join('\n');

    [
      'useCalendarGating',
      'canUseRepeat',
      'canSyncToCalendar',
      'canDeleteSeries',
      'repeatLocked',
      'onRepeatLocked',
      'onUpgradeRequired',
      'Upgrade to Sync',
      'isPremiumFeature',
    ].forEach(term => {
      expect(sources).not.toContain(term);
    });
    expect(fs.existsSync(path.resolve(__dirname, '../useCalendarGating.ts'))).toBe(false);
  });
});
