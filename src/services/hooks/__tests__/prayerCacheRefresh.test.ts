import fs from 'fs';
import path from 'path';

const hookSource = fs.readFileSync(path.resolve(__dirname, '../usePrayerData.ts'), 'utf8');
const prayerHomeSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/PrayerListScreen.tsx'), 'utf8');
const journalWalkthroughSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/PrayerJournalWalkthroughScreen.tsx'), 'utf8');
const peopleWalkthroughSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/PrayersForPeopleWalkthroughScreen.tsx'), 'utf8');

describe('prayer cache refresh', () => {
  it('optimistically updates the cross-date cache used by the Prayers screen', () => {
    expect(hookSource).toContain('queryKeys.prayers.allEntries(prayerUserId)');
    expect(hookSource).toContain('(old = []) => [optimisticPrayer, ...old]');
    expect(hookSource).toContain('prayer.id === context?.optimisticPrayer.id ? data : prayer');
  });

  it('uses the same local user key for every prayer flow', () => {
    [prayerHomeSource, journalWalkthroughSource, peopleWalkthroughSource].forEach(source => {
      expect(source).toContain("const prayerUserId = user?.id || 'local'");
    });
    expect(prayerHomeSource).toContain('useAllPrayerData(prayerUserId)');
    expect(journalWalkthroughSource).toContain('useACTSPrayerData(prayerUserId, dateStr)');
    expect(peopleWalkthroughSource).toContain('user_id: prayerUserId');
  });

  it('refetches all prayer types when the Prayers screen regains focus', () => {
    expect(prayerHomeSource).toContain('refetch: refetchPrayers');
    expect(prayerHomeSource).toMatch(/useFocusEffect\(useCallback\(\(\) => \{\s*void refetchPrayers\(\)/);
  });
});
