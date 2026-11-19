import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {JOURNAL_BACKUP_RESTORE_POLICY as policy} from '../services/journalBackupContract';
import type {JournalBackupRestorePlan} from '../services/journalBackupRestorePlan';
import {
  getOrCreateSpikeEncryptionKey,
  readSpikeEncryptionKey,
} from '../services/journalEncryptedStorageSpike';
import {openRestoreSession} from './journalRestoreDatabase';
import {pauseAfterValue} from './journalRestoreReopenProbe';

const name = 'development-file-photo-restore-v1.sqlite';
const id = 'fixture';
const entryKey = 'journal_local:todo:2026-11-19:' + id;
const indexKey = 'journal_local_index:todo:2026-11-19';
const content = (replacement: boolean) =>
  replacement ? 'Replacement photo fixture' : 'Original photo fixture';
const filename = /^photo-[0-9a-f]{32}$/;

function plan(file: string, replacement: boolean): JournalBackupRestorePlan {
  if (!filename.test(file)) {
    throw new Error('Invalid test photo name');
  }
  const value = JSON.stringify({
    id,
    content_type: 'todo',
    selected_date: '2026-11-19',
    content: content(replacement),
    metadata: {
      journalBlocks: [
        {id: 'test-photo', kind: 'photo', uri: 'objects/' + file},
      ],
    },
  });
  return {
    valid: true,
    fatal: [],
    warnings: [],
    requiresRollbackSnapshot: true,
    operations: [
      {key: entryKey, value, kind: 'record', section: 'journalRecords'},
      {
        key: indexKey,
        value: JSON.stringify([id]),
        kind: 'index',
        section: 'journalRecords',
      },
    ],
    operationCounts: {record: 1, index: 1},
    clearOwnedKeysMatching: policy.ownedPrefixes,
    interruptionHandling: policy.interruptionHandling,
  };
}

async function verify(
  session: Awaited<ReturnType<typeof openRestoreSession>>,
  replacement: boolean,
) {
  const record = JSON.parse((await session.read(entryKey)) ?? 'null');
  const uri = record?.metadata?.journalBlocks?.[0]?.uri;
  if (
    record?.id !== id ||
    record.content !== content(replacement) ||
    (await session.read(indexKey)) !== JSON.stringify([id]) ||
    typeof uri !== 'string' ||
    !uri.startsWith('objects/') ||
    !filename.test(uri.slice(8)) ||
    !(await archive.verifySyntheticPhoto(uri.slice(8), replacement))
  ) {
    throw new Error('Journal entry, index or photo did not match');
  }
}

export type FilePhotoInterruption = 'database' | 'copy' | 'published';

export async function armFilePhotoReopen(
  onArmed: () => void,
  point: FilePhotoInterruption = 'database',
) {
  const encryptionKey = await getOrCreateSpikeEncryptionKey();
  const db = open({name, encryptionKey});
  try {
    const {rows} = await db.execute('PRAGMA cipher_version');
    if (!rows[0]?.cipher_version) {
      throw new Error('SQLCipher is unavailable in the test database');
    }
    const initial = await openRestoreSession(db);
    await initial.restore(
      plan(await archive.stageSyntheticPhoto(false), false),
      uuid(),
    );
    await verify(initial, false);
    if (point !== 'database') {
      await archive.interruptSyntheticPhoto(point === 'published');
      throw new Error('Journal stayed open after the interruption');
    }
    const next = plan(await archive.stageSyntheticPhoto(true), true);
    const interrupted = await openRestoreSession(
      pauseAfterValue(db, entryKey, next.operations[0].value, onArmed),
    );
    await interrupted.restore(next, uuid());
    throw new Error('Restore completed before the interruption');
  } finally {
    db.close();
  }
}

export async function verifyFilePhotoReopen(point: FilePhotoInterruption = 'database') {
  const encryptionKey = await readSpikeEncryptionKey();
  if (!encryptionKey) {
    throw new Error('The test storage key is unavailable');
  }
  const db = open({name, encryptionKey, failOnCreate: true});
  try {
    const session = await openRestoreSession(db);
    if ((session.recovered !== null) !== (point === 'database')) {
      throw new Error('Unexpected database recovery state');
    }
    if (point !== 'database' && !(await archive.checkSyntheticPhotoInterruption(point === 'published'))) {
      throw new Error('The staged files did not match the interruption point');
    }
    await verify(session, false);
    await session.restore(
      plan(await archive.stageSyntheticPhoto(true), true),
      uuid(),
    );
  } finally {
    db.close();
  }
  const reopened = open({name, encryptionKey, failOnCreate: true});
  try {
    const committed = await openRestoreSession(reopened);
    if (committed.recovered) {
      throw new Error('The retry left a pending restore');
    }
    await verify(committed, true);
  } finally {
    reopened.close();
  }
}
