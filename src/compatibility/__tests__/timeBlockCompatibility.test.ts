import fs from 'fs';
import path from 'path';
import type { JournalCategory, PrayerType } from '../../storage/prayerStorage';
import { sharedTimeBlock } from '../__fixtures__/sifiaPersistedRecords';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');

describe('cross-app compatibility contracts', () => {
  it('keeps the existing Time Block cloud-to-cache-to-Moments path', () => {
    const api = read('../../services/api/timeBlockApi.ts');
    const storage = read('../../storage/timeBlockStorage.ts');
    const moments = read('../../systems/journal/renderers/EnhancedMomentsRenderer.tsx');
    expect(api).toContain(".from('time_blocks')");
    expect(storage).toContain('timeblock_${userId}_${dateStr}');
    expect(storage).toContain('syncTimeBlocksFromCloud');
    expect(moments).toContain(".from('time_blocks')");
    expect(sharedTimeBlock.id).toBe('time-block-1');
    expect(sharedTimeBlock.version).toBe(2);
  });

  it('represents existing runtime prayer values without migrating records', () => {
    const prayerType: PrayerType = 'devotional';
    const category: JournalCategory = 'personal_prayer';
    expect(prayerType).toBe('devotional');
    expect(category).toBe('personal_prayer');
  });
});
