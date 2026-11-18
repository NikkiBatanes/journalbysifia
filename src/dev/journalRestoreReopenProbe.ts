import {JOURNAL_BACKUP_RESTORE_POLICY as policy} from '../services/journalBackupContract';
import {
  JOURNAL_RESTORE_RECOVERY_MARKER_KEY as marker,
  JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY as snapshot,
} from '../services/journalBackupRestoreExecutor';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';
import type {JournalBackupRestorePlan} from '../services/journalBackupRestorePlan';

const id = '11782d26-36db-4cb1-ac77-45c3bcff9f09';
const key = 'review_settings_v1';
const original = 'synthetic-original';
const replacement = 'synthetic-interrupted';

const plan = (value: string): JournalBackupRestorePlan => ({
  valid: true, fatal: [], warnings: [], requiresRollbackSnapshot: true,
  operations: [{key, value, kind: 'setting', section: 'reviewSettings'}],
  operationCounts: {setting: 1}, clearOwnedKeysMatching: policy.ownedPrefixes,
  interruptionHandling: policy.interruptionHandling,
});

// Suspend the actual executor after its changed value commits and before it
// can verify the result or clear its rollback records. The OS ends the run.
export async function armRestoreInterruption(db: RestoreDatabase, onArmed: () => void,
  beforeInterruption?: () => Promise<void>) {
  const initial = await openRestoreSession(db);
  await initial.restore(plan(original), id);
  const interruptible: RestoreDatabase = {
    execute: (sql, params) => db.execute(sql, params),
    async transaction(work) {
      await db.transaction(work);
      const {rows} = await db.execute('SELECT v FROM restore_kv WHERE k=?', [key]);
      if (rows[0]?.v === replacement) {
        onArmed();
        await new Promise<never>(() => {});
      }
    },
  };
  const session = await openRestoreSession(interruptible);
  await beforeInterruption?.();
  await session.restore(plan(replacement), id);
  throw new Error('Restore finished without reaching the interruption point');
}

export async function checkRestoreBaseline(db: RestoreDatabase) {
  const session = await openRestoreSession(db);
  if ((session.recovered && session.recovered.transactionId !== id) ||
      await session.read(key) !== original ||
      await session.read(marker) !== null || await session.read(snapshot) !== null) {
    throw new Error('Synthetic restore recovery did not verify');
  }
  return session.recovered !== null;
}

export async function verifyRecoveredRestore(db: RestoreDatabase) {
  if (!await checkRestoreBaseline(db)) {
    throw new Error('Synthetic restore recovery did not verify');
  }
}

// Supply only a dedicated synthetic database. The interruption fixture is a
// committed partial state so the next connection must recover it on opening.
export async function verifyRestoreReopen(connect: () => RestoreDatabase & {close(): void}) {
  const first = connect();
  try {
    const session = await openRestoreSession(first);
    await session.restore(plan(original), id);
    await first.transaction(async tx => {
      for (const [k, v] of [
        [snapshot, JSON.stringify({version: 1, transactionId: id, entries: [{key, value: original}]})],
        [marker, JSON.stringify({version: 1, transactionId: id, stage: 'applying', operationCount: 1})],
        [key, replacement],
      ]) {
        await tx.execute('INSERT OR REPLACE INTO restore_kv (k,v) VALUES (?,?)', [k, v]);
      }
    });
  } finally {
    first.close();
  }

  const second = connect();
  try {
    await verifyRecoveredRestore(second);
  } finally {
    second.close();
  }
}
