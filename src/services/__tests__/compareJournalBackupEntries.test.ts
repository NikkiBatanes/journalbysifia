import AsyncStorage from '@react-native-async-storage/async-storage';
import {createJournalBackup} from '../journalBackupContract';
import {compareJournalBackupEntries, reviewJournalBackupEntries} from '../compareJournalBackupEntries';
import {prepareJournalPhotoManifest} from '../../dev/prepareJournalPhotoManifest';

jest.mock('uuid', () => ({v4: require('node:crypto').randomUUID}));

it('classifies overlapping records, occupied slots and deletion records without using timestamps to pick a winner', async () => {
  jest.mocked(AsyncStorage.getAllKeys).mockResolvedValue([]);
  const timestamp = '2026-11-20T12:00:00Z';
  const entry = (id: string, date = '2026-11-20') => ({
    id, content_type: 'todo' as const, content: id, selected_date: date, updated_at: timestamp, created_at: timestamp,
  });
  const file = await createJournalBackup(timestamp);
  const phone = await createJournalBackup(timestamp);
  file.inventory.journalRecords = [entry('equal'), entry('new'), entry('edited'), entry('moved'), entry('slot-in'),
    {...entry('gone'), deleted: true}, {...entry('deleted-here'), deleted: true}];
  phone.inventory.journalRecords = [entry('equal'), entry('device'), {...entry('edited'), content: 'later'},
    entry('moved', '2026-11-21'), entry('slot-local'), entry('deleted-here')];
  const equal = phone.inventory.journalRecords[0];
  const {selected_date, ...remaining} = equal;
  phone.inventory.journalRecords[0] = {selected_date, ...remaining};
  for (const backup of [file, phone]) {
    backup.inventory.recordLocations.journalRecords = backup.inventory.journalRecords.map(record => ({
      id: record.id, key: record.id.startsWith('slot-') ? 'journal_local_singleton:todo:2026-11-20' :
        'journal_local:todo:' + record.selected_date + ':' + record.id,
    }));
  }
  const saved = await prepareJournalPhotoManifest(file, jest.fn());
  const current = await prepareJournalPhotoManifest(phone, jest.fn());
  expect(compareJournalBackupEntries(saved, current)).toEqual({
    matching: 1, backupOnly: 1, deviceOnly: 1, review: 4, backupOnlyDeletions: 1,
  });
  const groups = reviewJournalBackupEntries(saved, current);
  expect(groups.review.find(item => item.id === 'edited')).toMatchObject({
    reason: 'The entry content differs.', backup: {excerpt: 'edited'}, device: [{excerpt: 'later'}],
  });
  expect(groups.review.find(item => item.id === 'slot-in')?.device[0].excerpt).toBe('slot-local');
  expect(groups.backupOnlyDeletions[0].backup).toMatchObject({deleted: true, excerpt: ''});
  // The backup ID now exists at a different key while its original slot has another occupant.
  current.backup.inventory.journalRecords.push(entry('slot-in', '2026-11-21'));
  current.backup.inventory.recordLocations.journalRecords.push({id: 'slot-in', key: 'journal_local:todo:2026-11-21:slot-in'});
  const collision = reviewJournalBackupEntries(saved, current).review.find(item => item.id === 'slot-in');
  expect(collision?.device.map(row => row.date)).toEqual(['2026-11-21', '2026-11-20']);
  current.backup.inventory.recordLocations.journalRecords[0].key = 'invalid';
  expect(() => compareJournalBackupEntries(saved, current)).toThrow('Invalid entry locations');
});
