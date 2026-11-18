import {JOURNAL_BACKUP_RESTORE_POLICY as policy} from '../services/journalBackupContract';
import {
  JOURNAL_RESTORE_RECOVERY_MARKER_KEY as marker,
  JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY as snapshot,
} from '../services/journalBackupRestoreExecutor';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';

const id = '11782d26-36db-4cb1-ac77-45c3bcff9f09';
const key = 'review_settings_v1';

// Supply only a dedicated synthetic database. The interruption fixture is a
// committed partial state so the next connection must recover it on opening.
export async function verifyRestoreReopen(connect: () => RestoreDatabase & {close(): void}) {
  const first = connect();
  try {
    const session = await openRestoreSession(first);
    await session.restore({
      valid: true, fatal: [], warnings: [], requiresRollbackSnapshot: true,
      operations: [{key, value: 'synthetic-original', kind: 'setting', section: 'reviewSettings'}],
      operationCounts: {setting: 1}, clearOwnedKeysMatching: policy.ownedPrefixes,
      interruptionHandling: policy.interruptionHandling,
    }, id);
    await first.transaction(async tx => {
      for (const [k, v] of [
        [snapshot, JSON.stringify({version: 1, transactionId: id, entries: [{key, value: 'synthetic-original'}]})],
        [marker, JSON.stringify({version: 1, transactionId: id, stage: 'applying', operationCount: 1})],
        [key, 'synthetic-interrupted'],
      ]) {
        await tx.execute('INSERT OR REPLACE INTO restore_kv (k,v) VALUES (?,?)', [k, v]);
      }
    });
  } finally {
    first.close();
  }

  const second = connect();
  try {
    const session = await openRestoreSession(second);
    if (session.recovered?.transactionId !== id ||
        await session.read(key) !== 'synthetic-original' ||
        await session.read(marker) !== null || await session.read(snapshot) !== null) {
      throw new Error('Synthetic restore recovery did not verify');
    }
  } finally {
    second.close();
  }
}
