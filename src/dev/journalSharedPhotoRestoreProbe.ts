import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {
  JOURNAL_BACKUP_APP_IDENTIFIER, JOURNAL_BACKUP_FORMAT, JOURNAL_BACKUP_SCHEMA_VERSION,
} from '../services/journalBackupContract';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {getOrCreateSpikeEncryptionKey, readSpikeEncryptionKey} from '../services/journalEncryptedStorageSpike';
import type {LocalJournalEntry} from '../storage/journalStorage';
import {openRestoreSession} from './journalRestoreDatabase';
import {pauseAfterValue} from './journalRestoreReopenProbe';

const name = 'development-shared-photo-restore-v1.sqlite';
const date = '2026-11-19';
const indexKey = 'journal_local_index:todo:' + date;
const entryKey = (id: string) => 'journal_local:todo:' + date + ':' + id;
const ids = ['first', 'second'] as const;
type EntryId = (typeof ids)[number];
type Photo = 'shared' | 'other';
type Photos = Record<Photo, string>;
type Layout = Record<EntryId, readonly Photo[]>;

const original: Layout = {first: ['shared', 'other'], second: ['shared']};
const edited: Layout = {first: ['other'], second: ['shared']};
const lastReferenceRemoved: Layout = {first: ['other'], second: ['other']};
const safeName = /^photo-[a-f0-9]{32}$/;

function backupPlan(files: Photos, layout: Layout) {
  const entries: LocalJournalEntry[] = ids.map(id => ({
    id, content_type: 'todo', selected_date: date, content: 'Synthetic entry ' + id,
    created_at: date + 'T00:00:00Z', updated_at: date + 'T00:00:00Z',
    metadata: {journalBlocks: layout[id].map(photo => ({
      kind: 'photo', id: id + '-' + photo, uri: 'objects/' + files[photo],
    }))},
  }));
  const integrity = {
    counts: {journalRecords: entries.length}, tombstones: {journalRecords: 0, reflectionRecords: 0, prayerRecords: 0},
    duplicateIds: [], danglingReferences: [], legacyOnlyRecords: {reflectionLogs: 0, journalRecords: 0},
  };
  const plan = planJournalBackupRestore({
    format: JOURNAL_BACKUP_FORMAT, appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
    schemaVersion: JOURNAL_BACKUP_SCHEMA_VERSION, sensitive: true, exportedAt: date + 'T00:00:00Z',
    inventory: {
      journalRecords: entries, reflectionRecords: [], prayerRecords: [], bibleStudySessions: [],
      routineStates: [], reviews: [], reviewSettings: null, prayerDrafts: [],
      authoredDrafts: {sessionNotes: [], guidedReflections: [], routines: []},
      preferences: [], gospelAuthoredContent: [], legacyAuthoredContent: {reflectionLogs: [], journalRecords: []},
      recordLocations: {
        journalRecords: ids.map(id => ({id, key: entryKey(id)})), reflectionRecords: [],
        prayerRecords: [], bibleStudySessions: [], routineStates: [], reviews: [],
      }, integrity,
    }, integrity,
  });
  if (!plan.valid) {throw new Error('Invalid two-entry backup');}
  return plan;
}

// This fixture owns exactly two entries. Gather both entries' live references
// before allowing the native collector to remove any staged file.
async function verify(session: Awaited<ReturnType<typeof openRestoreSession>>, layout: Layout) {
  if ((await session.read(indexKey)) !== JSON.stringify(ids)) {
    throw new Error('The restored two-entry index did not match');
  }
  const files: Photos = {shared: '', other: ''};
  for (const id of ids) {
    const record = JSON.parse((await session.read(entryKey(id))) ?? 'null');
    const blocks = record?.metadata?.journalBlocks;
    if (record?.id !== id || record.content !== 'Synthetic entry ' + id ||
        !Array.isArray(blocks) || blocks.length !== layout[id].length) {
      throw new Error('The restored record or attachment count did not match');
    }
    layout[id].forEach((photo, index) => {
      const block = blocks[index];
      const uri = block?.uri;
      if (block?.kind !== 'photo' || block.id !== id + '-' + photo ||
          typeof uri !== 'string' || !uri.startsWith('objects/') || !safeName.test(uri.slice(8))) {
        throw new Error('The restored photo block did not match');
      }
      const file = uri.slice(8);
      if (files[photo] && files[photo] !== file) {
        throw new Error('Two references to the same photo point to different files');
      }
      files[photo] = file;
    });
  }
  if (!files.other || files.other === files.shared || !(await archive.verifySharedFixturePhotos(files.shared, files.other))) {
    throw new Error('The referenced photos failed verification');
  }
  return files;
}

export async function armSharedPhotoRestore(onArmed: () => void) {
  const db = open({name, encryptionKey: await getOrCreateSpikeEncryptionKey()});
  try {
    const {rows} = await db.execute('PRAGMA cipher_version');
    if (!rows[0]?.cipher_version) {throw new Error('The encrypted test database is unavailable');}
    const session = await openRestoreSession(db);
    const files: Photos = {
      shared: await archive.stageSharedFixturePhoto(false),
      other: await archive.stageSharedFixturePhoto(true),
    };
    await session.restore(backupPlan(files, original), uuid());
    await verify(session, original);
    const next = backupPlan(files, edited);
    const write = next.operations.find(operation => operation.key === entryKey('first'));
    if (!write) {throw new Error('The replacement record is missing');}
    const interrupted = await openRestoreSession(pauseAfterValue(db, write.key, write.value, onArmed));
    await interrupted.restore(next, uuid());
    throw new Error('The replacement completed before the test could stop Journal');
  } finally {
    db.close();
  }
}

export async function verifySharedPhotoRestore() {
  const encryptionKey = await readSpikeEncryptionKey();
  if (!encryptionKey) {throw new Error('The saved test key is missing');}
  const options = {name, encryptionKey, failOnCreate: true};
  const db = open(options);
  let recoveredFiles: Photos;
  try {
    const session = await openRestoreSession(db);
    if (!session.recovered) {throw new Error('Expected an interrupted two-entry restore');}
    recoveredFiles = await verify(session, original);
    await session.restore(backupPlan(recoveredFiles, edited), uuid());
  } finally {
    db.close();
  }
  const reopened = open(options);
  try {
    const session = await openRestoreSession(reopened);
    if (session.recovered) {throw new Error('The retry left a pending restore');}
    const files = await verify(session, edited);
    if (files.shared !== recoveredFiles.shared || files.other !== recoveredFiles.other) {
      throw new Error('Retry changed a referenced photo file');
    }
    await session.restore(backupPlan(files, lastReferenceRemoved), uuid());
    const remaining = await verify(session, lastReferenceRemoved);
    if (remaining.other !== files.other) {throw new Error('The surviving photo changed');}
  } finally {
    reopened.close();
  }
}
