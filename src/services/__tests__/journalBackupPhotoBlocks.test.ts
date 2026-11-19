import type {LocalJournalEntry} from '../../storage/journalStorage';
import type {JournalBackupArchiveAssetV1} from '../journalBackupArchiveContract';
import {resolveJournalBackupPhotoBlocks as resolve} from '../journalBackupPhotoBlocks';

function entry(id: string, blocks?: object[]): LocalJournalEntry {
  return {id, content_type: 'gratitude', content: 'Dinner together', selected_date: '2026-11-19',
    created_at: '2026-11-19T00:00:00Z', updated_at: '2026-11-19T00:00:00Z',
    metadata: blocks && {title: 'Evening', journalBlocks: blocks}};
}
function asset(n: number): JournalBackupArchiveAssetV1 {
  const assetId = '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  return {assetId, path: 'objects/' + assetId, kind: 'image', mediaType: 'image/png',
    byteLength: 100, sha256: 'a'.repeat(64), ownerRecordId: String(n)};
}
const assets = [asset(0), asset(1), asset(2)];
const staged = assets.map(({assetId}, n) => ({assetId, file: 'photo-' + String(n).padStart(32, '0')}));
const note = {id: 'note', kind: 'text', text: 'Keep this caption'};
const blank = {id: 'empty-photo', kind: 'photo', uri: ''};
const photo = (n: number) => ({kind: 'photo', id: 'block-' + n, uri: assets[n].path, text: 'Caption ' + n});

test('restores references by archive path across 300 entries and preserves block identity and order', () => {
  const records = Array.from({length: 300}, (_, n) => entry(String(n), [note, photo(n % 3), blank, photo((n + 1) % 3)]));
  const before = JSON.stringify(records);
  const result = resolve(records, [...assets].reverse(), [staged[1], staged[0], staged[2]]);
  expect(JSON.stringify(records)).toBe(before);
  records.forEach((original, n) => {
    const restoredPhoto = (i: number) => ({...photo(i), uri: 'objects/' + staged[i].file});
    expect(result[n]).toEqual({...original, metadata: {title: 'Evening', journalBlocks: [
      note, restoredPhoto(n % 3), blank, restoredPhoto((n + 1) % 3),
    ]}});
  });
});

test('supports empty backups, entries without blocks, and entries with no attached photos', () => {
  expect(resolve([], [], [])).toEqual([]);
  const records = [entry('empty'), entry('notes', [note, blank])];
  expect(resolve(records, [], [])).toEqual(records);
});

test('rejects missing, extra, ambiguous or unsafe staged files', () => {
  const records = assets.map((_, n) => entry(String(n), [photo(n)]));
  for (const files of [staged.slice(1), [...staged, {...staged[0], assetId: 'extra', file: 'photo-' + 'a'.repeat(32)}],
    [...staged, staged[0]], [{...staged[0], file: staged[1].file}, ...staged.slice(1)],
    [{...staged[0], file: '../' + staged[0].file}, ...staged.slice(1)]]) {
    expect(() => resolve(records, assets, files)).toThrow();
  }
});

test('rejects unrecognized references, unsupported assets and an owner missing its photo', () => {
  const one = assets.slice(0, 1);
  const files = staged.slice(0, 1);
  for (const uri of ['file:///old-phone/photo.jpg', assets[1].path, 'objects/../photo']) {
    expect(() => resolve([entry('0', [{...photo(0), uri}])], one, files)).toThrow('reference');
  }
  expect(() => resolve([entry('0'), entry('another', [photo(0)])], one, files)).toThrow('owning entry');
  expect(() => resolve([entry('0', [photo(0)])], [{...one[0], kind: 'audio'}], files)).toThrow();
});
