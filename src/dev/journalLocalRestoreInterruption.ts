import {practiceRestoreStorage} from './practiceRestoreStorage';
import {JOURNAL_BACKUP_RESTORE_POLICY} from '../services/journalBackupContract';
import {
  JournalBackupRestoreExecutionError, previewJournalBackupRestore,
  recoverInterruptedJournalBackupRestore, type JournalBackupRestoreStorage,
} from '../services/journalBackupRestoreExecutor';
import type {JournalBackupRestorePlan} from '../services/journalBackupRestorePlan';
import {localJournalMutations} from '../storage/journalMutationCoordinator';

// Every physical read and write in this exercise belongs to a disposable namespace.
const prefix = 'journal:dev:restore-device-entries:v1:';
const entry = 'journal_local:heart:2026-11-20:practice';
const index = 'journal_local_index:heart:2026-11-20';
const transaction = 'd3879b9a-3208-4d18-803f-ad8db677222b';
const edited = JSON.stringify({id: 'practice', content: 'Saved after preview'});
const incoming = JSON.stringify({id: 'practice', content: 'From backup'});
const ids = JSON.stringify(['practice']);
const storage = practiceRestoreStorage(prefix);
const plan: JournalBackupRestorePlan = {
  valid: true, fatal: [], warnings: [], requiresRollbackSnapshot: true,
  clearOwnedKeysMatching: JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes,
  interruptionHandling: JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling,
  operations: [
    {key: entry, value: incoming, kind: 'record', section: 'journalRecords'},
    {key: index, value: ids, kind: 'index', section: 'journalRecords'},
  ],
  operationCounts: {record: 1, index: 1},
};

export async function armLocalRestoreInterruption(markPending: () => Promise<void>, onArmed: () => void) {
  await recoverInterruptedJournalBackupRestore(storage, localJournalMutations);
  await localJournalMutations.runExclusive(() => storage.multiSet([[entry, '{"id":"practice","content":"First draft"}'], [index, ids]]));
  const initial = await previewJournalBackupRestore(storage, localJournalMutations, plan);
  await localJournalMutations.runExclusive(() => storage.multiSet([[entry, edited]]));
  try {
    await initial.confirm(transaction);
    throw new Error('An outdated restore preview was accepted');
  } catch (error) {
    if (!(error instanceof JournalBackupRestoreExecutionError && error.code === 'restore_preview_stale')) {throw error;}
  }
  const pausingStore: JournalBackupRestoreStorage = {...storage,
    async multiSet(rows) {
      await storage.multiSet(rows);
      if (rows.some(([key, value]) => key === entry && value === incoming)) {
        onArmed();
        await new Promise<never>(() => {});
      }
    },
  };
  const reviewed = await previewJournalBackupRestore(pausingStore, localJournalMutations, plan);
  await markPending();
  await reviewed.confirm(transaction);
  throw new Error('The interruption point was missed');
}

export async function verifyLocalRestoreAfterReopen() {
  const recovered = await recoverInterruptedJournalBackupRestore(storage, localJournalMutations);
  await localJournalMutations.runExclusive(async () => {
    const rows = new Map(await storage.multiGet([entry, index]));
    if ((recovered && recovered.transactionId !== transaction) || rows.get(entry) !== edited ||
        rows.get(index) !== ids || (await storage.getAllKeys()).length !== 2) {
      throw new Error('The latest saved entry and index could not be verified');
    }
  });
  return recovered ? 'recovered' as const : 'baseline' as const;
}

export const clearLocalRestoreFixture = () =>
  localJournalMutations.runExclusive(() => storage.multiRemove([entry, index]));
