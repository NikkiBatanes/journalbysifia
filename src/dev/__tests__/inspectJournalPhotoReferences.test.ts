import {inspectJournalPhotoReferences} from '../inspectJournalPhotoReferences';
import type {JournalBackupInventory} from '../../services/journalBackupInventory';

it('checks shared files once, counts incomplete blocks, avoids remote reads and budgets actual bytes', async () => {
  const entry = (...uris: unknown[]) => ({
    metadata: {journalBlocks: uris.map(uri => ({kind: 'photo', uri}))},
  });
  const inventory = {
    journalRecords: [entry('file:///image', 'file:///missing'), {...entry('file:///deleted'), deleted: true}],
    reflectionRecords: [entry('file:///image', undefined, 'https://example.com/a.jpg', 'file:///big')],
    prayerRecords: [entry('file:///failed', 'file:///other')],
  } as unknown as JournalBackupInventory;
  const read = jest.fn<Promise<number>, [string, number]>()
    .mockResolvedValueOnce(120).mockResolvedValueOnce(-1).mockResolvedValueOnce(-4)
    .mockResolvedValueOnce(-3).mockResolvedValueOnce(-2);
  expect(await inspectJournalPhotoReferences(inventory, read)).toEqual({
    entries: 3, references: 8, readable: 1, missing: 2, unsupported: 2, unreadable: 1, overLimit: 1,
  });
  expect(read.mock.calls).toEqual(['image', 'missing', 'big', 'failed', 'other'].map((name, i) =>
    ['file:///' + name, i === 0 ? 5_000_000_000 : 5_000_000_000 - 120]));
});
