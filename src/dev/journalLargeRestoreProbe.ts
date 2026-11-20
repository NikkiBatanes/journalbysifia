import {JOURNAL_BACKUP_RESTORE_POLICY} from '../services/journalBackupContract';
import {
  executeJournalBackupRestore, JournalBackupRestoreExecutionError,
  JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY, recoverInterruptedJournalBackupRestore,
  type JournalBackupRestoreStorage,
} from '../services/journalBackupRestoreExecutor';
import type {JournalBackupRestorePlan} from '../services/journalBackupRestorePlan';
import {localJournalMutations} from '../storage/journalMutationCoordinator';
import {practiceRestoreStorage} from './practiceRestoreStorage';

const storage = practiceRestoreStorage('journal:dev:large-restore:v1:');
const transaction = '418493f6-2d2f-43cb-8c23-1fd0e40b7d44';
const index = 'journal_local_index:heart:2026-11-20';
const key = (i: number) => 'journal_local:heart:2026-11-20:large-' + i;
const originals = () => {
  const rows = Array.from({length: 96}, (_, i) => [key(i),
    JSON.stringify({id: 'large-' + i, content: i + ' 🌱 ' + 'J'.repeat(24 * 1024)})] as const);
  return [...rows, [index, JSON.stringify(rows.map(([id]) => id))] as const];
};
const replacement = '{"id":"large-0","content":"Practice replacement"}';
const plan: JournalBackupRestorePlan = {
  valid: true, fatal: [], warnings: [], requiresRollbackSnapshot: true,
  clearOwnedKeysMatching: JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes,
  interruptionHandling: JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling,
  operations: [{key: key(0), value: replacement, kind: 'record', section: 'journalRecords'},
    {key: index, value: JSON.stringify([key(0)]), kind: 'index', section: 'journalRecords'}],
  operationCounts: {record: 1, index: 1},
};

async function verifyOriginals() {
  const rows = originals();
  const actual = new Map(await storage.multiGet(rows.map(([id]) => id)));
  if ((await storage.getAllKeys()).length !== rows.length || rows.some(([id, value]) => actual.get(id) !== value)) {
    throw new Error('Large journal recovery verification failed');
  }
}

async function expectFailure(store: JournalBackupRestoreStorage, code: string) {
  try {
    await executeJournalBackupRestore(store, localJournalMutations, plan, transaction);
  } catch (error) {
    if (error instanceof JournalBackupRestoreExecutionError && error.code === code) {return;}
    throw error;
  }
  throw new Error('The simulated storage failure was missed');
}

export async function armLargeRestore(markPending: () => Promise<void>) {
  await recoverInterruptedJournalBackupRestore(storage, localJournalMutations);
  await localJournalMutations.runExclusive(() => storage.multiSet(originals()));
  await expectFailure({...storage, async multiSet(rows) {
    if (rows.some(([id]) => id === JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY + ':part:1')) {
      throw new Error('Simulated device storage full');
    }
    await storage.multiSet(rows);
  }}, 'restore_snapshot_stage_failed');
  await localJournalMutations.runExclusive(verifyOriginals);
  await markPending();
  // Save one replacement, then model a full disk through the automatic rollback.
  let full = false;
  await expectFailure({...storage, async multiSet(rows) {
    if (full) {throw new Error('Simulated device storage full');}
    if (rows.some(([id, value]) => id === key(0) && value === replacement)) {
      await storage.multiSet([rows[0]]);
      full = true;
      throw new Error('Simulated partial write');
    }
    await storage.multiSet(rows);
  }}, 'restore_rollback_failed');
}

export async function verifyLargeRestoreAfterReopen() {
  await recoverInterruptedJournalBackupRestore(storage, localJournalMutations);
  await localJournalMutations.runExclusive(verifyOriginals);
}

export const clearLargeRestoreFixture = () =>
  localJournalMutations.runExclusive(async () => storage.multiRemove(await storage.getAllKeys()));
