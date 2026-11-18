import {
  executeJournalBackupRestore,
  recoverInterruptedJournalBackupRestore,
  type JournalBackupRestoreStorage,
} from '../services/journalBackupRestoreExecutor';
import type {JournalBackupRestorePlan} from '../services/journalBackupRestorePlan';

// The supplied connection is exclusively owned by this session in the
// development probe. Each bulk mutation commits atomically, including removal
// of the marker and rollback snapshot together.
type Statement = (sql: string, parameters?: string[]) =>
  Promise<{rows: Array<Record<string, unknown>>}>;
export interface RestoreDatabase {
  execute: Statement;
  transaction(work: (transaction: {execute: Statement}) => Promise<void>): Promise<void>;
}

const requireText = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('Invalid restore database row');
  }
  return value;
};

export async function openRestoreSession(db: RestoreDatabase) {
  await db.execute('CREATE TABLE IF NOT EXISTS restore_kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL)');
  const storage: JournalBackupRestoreStorage = {
    async getAllKeys() {
      return (await db.execute('SELECT k FROM restore_kv')).rows.map(row => requireText(row.k));
    },
    async multiGet(keys) {
      const found = new Map<string, string>();
      for (let start = 0; start < keys.length; start += 256) {
        const chunk = keys.slice(start, start + 256);
        const placeholders = chunk.map(() => '?').join(',');
        const result = await db.execute(
          `SELECT k, v FROM restore_kv WHERE k IN (${placeholders})`, chunk,
        );
        result.rows.forEach(row => found.set(requireText(row.k), requireText(row.v)));
      }
      return keys.map(key => [key, found.get(key) ?? null] as const);
    },
    multiSet(entries) {
      return db.transaction(async tx => {
        for (const [key, value] of entries) {
          await tx.execute('INSERT OR REPLACE INTO restore_kv (k,v) VALUES (?,?)', [key, value]);
        }
      });
    },
    multiRemove(keys) {
      return db.transaction(async tx => {
        for (const key of keys) {
          await tx.execute('DELETE FROM restore_kv WHERE k=?', [key]);
        }
      });
    },
  };
  let tail: Promise<void> = Promise.resolve();
  const coordinator = {
    runExclusive<T>(work: () => Promise<T>): Promise<T> {
      const result = tail.then(work);
      tail = result.then(() => {}, () => {});
      return result;
    },
  };
  const recovered = await recoverInterruptedJournalBackupRestore(storage, coordinator);
  let blocked = false;
  const requireReady = () => {
    if (blocked) {
      throw new Error('Reopen database for restore recovery');
    }
  };
  return {
    recovered,
    read(key: string) {
      return coordinator.runExclusive(async () => {
        requireReady();
        return (await storage.multiGet([key]))[0][1];
      });
    },
    restore(plan: JournalBackupRestorePlan, transactionId: string) {
      return coordinator.runExclusive(async () => {
        requireReady();
        try {
          // Already holding the shared queue throughout the entire restore.
          return await executeJournalBackupRestore(storage, {runExclusive: work => work()}, plan, transactionId);
        } catch (error) {
          blocked = true;
          throw error;
        }
      });
    },
  };
}
