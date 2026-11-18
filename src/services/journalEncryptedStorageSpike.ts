import {open, type DB} from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import 'react-native-get-random-values';

const SPIKE_DATABASE_NAME = 'journal-cloud-storage-spike-v1.sqlite';
const SPIKE_KEYCHAIN_SERVICE =
  'app.journal.sifia.spike.encrypted-database-key.v1';
const SPIKE_KEYCHAIN_USERNAME = 'journal-cloud-storage-spike';
const SPIKE_MARKER_ID = 'encrypted-storage-spike';
const SPIKE_MARKER_PAYLOAD = 'synthetic-only-no-customer-data';
const SPIKE_DISK_FULL_ID = 'synthetic-disk-full-write';
const SPIKE_INTERRUPTION_BASELINE_ID = 'synthetic-interruption-baseline';
const SPIKE_INTERRUPTION_BASELINE_PAYLOAD =
  'synthetic-interruption-baseline-data';
const SPIKE_INTERRUPTED_WRITE_ID = 'synthetic-interrupted-write';
const SPIKE_INTERRUPTED_WRITE_PAYLOAD =
  'synthetic-uncommitted-interruption-data';
const ENCRYPTION_KEY_BYTES = 32;
const SQLITE_MAX_PAGE_COUNT = 2_147_483_646;

type RandomFill = (bytes: Uint8Array) => Uint8Array;

export interface JournalEncryptedStorageSpikeResult {
  databaseName: string;
  sqlCipherVersion: string;
  rollbackVerified: true;
  reopenVerified: true;
  wrongKeyRejected: true;
  diskFullRollbackVerified: true;
}

export interface JournalEncryptedStorageInterruptionResult {
  databaseName: string;
  integrityCheck: 'ok';
  baselinePreserved: true;
  interruptedWriteDiscarded: true;
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export const isValidSpikeEncryptionKey = (value: string): boolean =>
  /^[a-f0-9]{64}$/.test(value);

export const generateSpikeEncryptionKey = (
  fillRandom: RandomFill = bytes => globalThis.crypto.getRandomValues(bytes),
): string => {
  const bytes = new Uint8Array(ENCRYPTION_KEY_BYTES);
  const filled = fillRandom(bytes);

  if (filled !== bytes) {
    throw new Error('Secure random provider returned an unexpected buffer');
  }

  return bytesToHex(bytes);
};

/**
 * This key is intentionally device-only. It must never be copied into logs,
 * AsyncStorage, cloud backup payloads, analytics, or source control.
 */
export const readSpikeEncryptionKey = async (): Promise<string | null> => {
  const existing = await Keychain.getGenericPassword({
    service: SPIKE_KEYCHAIN_SERVICE,
    cloudSync: false,
  });

  if (existing) {
    if (!isValidSpikeEncryptionKey(existing.password)) {
      throw new Error('Encrypted storage spike key has an invalid format');
    }
    return existing.password;
  }

  return null;
};

export const getOrCreateSpikeEncryptionKey = async (): Promise<string> => {
  const existing = await readSpikeEncryptionKey();
  if (existing !== null) {
    return existing;
  }
  const key = generateSpikeEncryptionKey();
  const stored = await Keychain.setGenericPassword(
    SPIKE_KEYCHAIN_USERNAME,
    key,
    {
      service: SPIKE_KEYCHAIN_SERVICE,
      cloudSync: false,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
    },
  );

  if (!stored) {
    throw new Error('Could not store the encrypted storage spike key');
  }

  return key;
};

const readSingleText = (
  rows: Array<Record<string, unknown>>,
  field: string,
): string | null => {
  const value = rows[0]?.[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const readSingleNumber = (
  rows: Array<Record<string, unknown>>,
  fields: string[],
): number | null => {
  const row = rows[0];
  if (!row) {
    return null;
  }

  const labelledValue = fields
    .map(field => row[field])
    .find(value => value !== undefined && value !== null);
  const fallbackValue =
    labelledValue ??
    (Object.keys(row).length === 1 ? Object.values(row)[0] : undefined);
  const value = Number(fallbackValue);

  return Number.isSafeInteger(value) ? value : null;
};

const closeQuietly = (database: DB | null): void => {
  try {
    database?.close();
  } catch {
    // The spike reports the primary verification error, not a close failure.
  }
};

const ensureSpikeTable = async (database: DB): Promise<void> => {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS encrypted_storage_spike (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    )
  `);
};

/**
 * Development-only interruption fixture. After onArmed fires, the caller must
 * terminate the native app process without allowing this promise to resolve.
 * SQLite should roll back the open transaction during recovery on next launch.
 */
export const armJournalEncryptedStorageInterruptionProbe = async (
  onArmed: () => void,
): Promise<never> => {
  const encryptionKey = await getOrCreateSpikeEncryptionKey();
  let database: DB | null = null;

  try {
    database = open({
      name: SPIKE_DATABASE_NAME,
      encryptionKey,
    });
    await ensureSpikeTable(database);
    await database.transaction(async transaction => {
      await transaction.execute(
        'DELETE FROM encrypted_storage_spike WHERE id IN (?, ?)',
        [SPIKE_INTERRUPTION_BASELINE_ID, SPIKE_INTERRUPTED_WRITE_ID],
      );
      await transaction.execute(
        'INSERT INTO encrypted_storage_spike (id, payload) VALUES (?, ?)',
        [
          SPIKE_INTERRUPTION_BASELINE_ID,
          SPIKE_INTERRUPTION_BASELINE_PAYLOAD,
        ],
      );
    });

    await database.transaction(async transaction => {
      await transaction.execute(
        'INSERT INTO encrypted_storage_spike (id, payload) VALUES (?, ?)',
        [SPIKE_INTERRUPTED_WRITE_ID, SPIKE_INTERRUPTED_WRITE_PAYLOAD],
      );
      onArmed();
      await new Promise<never>(() => {
        // Intentionally unresolved. The native process must be terminated.
      });
    });

    throw new Error('Interruption probe unexpectedly completed');
  } finally {
    closeQuietly(database);
  }
};

export const verifyJournalEncryptedStorageInterruptionRecovery =
  async (): Promise<JournalEncryptedStorageInterruptionResult> => {
    const encryptionKey = await getOrCreateSpikeEncryptionKey();
    let database: DB | null = null;

    try {
      database = open({
        name: SPIKE_DATABASE_NAME,
        encryptionKey,
        failOnCreate: true,
      });
      const integrityResult = await database.execute('PRAGMA integrity_check');
      const integrityCheck = readSingleText(integrityResult.rows, 'integrity_check');
      const rows = await database.execute(
        `SELECT id, payload FROM encrypted_storage_spike
         WHERE id IN (?, ?) ORDER BY id`,
        [SPIKE_INTERRUPTION_BASELINE_ID, SPIKE_INTERRUPTED_WRITE_ID],
      );
      const baseline = rows.rows.find(
        row => row.id === SPIKE_INTERRUPTION_BASELINE_ID,
      );
      const interruptedWrite = rows.rows.find(
        row => row.id === SPIKE_INTERRUPTED_WRITE_ID,
      );

      if (
        integrityCheck !== 'ok' ||
        baseline?.payload !== SPIKE_INTERRUPTION_BASELINE_PAYLOAD ||
        interruptedWrite
      ) {
        throw new Error(
          'Encrypted storage did not recover safely from interruption',
        );
      }

      return {
        databaseName: SPIKE_DATABASE_NAME,
        integrityCheck: 'ok',
        baselinePreserved: true,
        interruptedWriteDiscarded: true,
      };
    } finally {
      closeQuietly(database);
    }
  };

/**
 * Explicit development probe only. A development menu command may invoke it,
 * but it never runs automatically, is absent from release behavior, is not
 * wired to a journal read/write path, and stores only synthetic data.
 */
export const runJournalEncryptedStorageSpike =
  async (): Promise<JournalEncryptedStorageSpikeResult> => {
    const encryptionKey = await getOrCreateSpikeEncryptionKey();
    let database: DB | null = null;

    try {
      database = open({
        name: SPIKE_DATABASE_NAME,
        encryptionKey,
      });

      const cipherResult = await database.execute('PRAGMA cipher_version');
      const sqlCipherVersion = readSingleText(
        cipherResult.rows,
        'cipher_version',
      );
      if (!sqlCipherVersion) {
        throw new Error('SQLCipher is not active for the storage spike');
      }

      await database.transaction(async transaction => {
        await transaction.execute(`
          CREATE TABLE IF NOT EXISTS encrypted_storage_spike (
            id TEXT PRIMARY KEY NOT NULL,
            payload TEXT NOT NULL
          )
        `);
        await transaction.execute(
          'DELETE FROM encrypted_storage_spike WHERE id = ?',
          [SPIKE_MARKER_ID],
        );
      });

      try {
        await database.transaction(async transaction => {
          await transaction.execute(
            'INSERT INTO encrypted_storage_spike (id, payload) VALUES (?, ?)',
            [SPIKE_MARKER_ID, SPIKE_MARKER_PAYLOAD],
          );
          throw new Error('intentional-spike-rollback');
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'intentional-spike-rollback') {
          throw error;
        }
      }

      const rolledBack = await database.execute(
        'SELECT COUNT(*) AS count FROM encrypted_storage_spike WHERE id = ?',
        [SPIKE_MARKER_ID],
      );
      if (Number(rolledBack.rows[0]?.count) !== 0) {
        throw new Error('Encrypted storage transaction did not roll back');
      }

      await database.transaction(async transaction => {
        await transaction.execute(
          'INSERT INTO encrypted_storage_spike (id, payload) VALUES (?, ?)',
          [SPIKE_MARKER_ID, SPIKE_MARKER_PAYLOAD],
        );
      });
      database.close();
      database = null;

      database = open({
        name: SPIKE_DATABASE_NAME,
        encryptionKey,
        failOnCreate: true,
      });
      const reopened = await database.execute(
        'SELECT payload FROM encrypted_storage_spike WHERE id = ?',
        [SPIKE_MARKER_ID],
      );
      if (readSingleText(reopened.rows, 'payload') !== SPIKE_MARKER_PAYLOAD) {
        throw new Error('Encrypted storage did not persist across reopen');
      }

      // This database contains synthetic probe data only. Compact it first so
      // no free pages can absorb the constrained write and make this failure
      // simulation device-dependent.
      await database.execute('VACUUM');
      const pageCountResult = await database.execute('PRAGMA page_count');
      const pageSizeResult = await database.execute('PRAGMA cipher_page_size');
      const freeListResult = await database.execute('PRAGMA freelist_count');
      const pageCount = readSingleNumber(pageCountResult.rows, ['page_count']);
      const pageSize = readSingleNumber(pageSizeResult.rows, [
        'cipher_page_size',
        'page_size',
      ]);
      const freePageCount = readSingleNumber(freeListResult.rows, [
        'freelist_count',
      ]);
      if (
        pageCount === null ||
        pageCount < 1 ||
        pageSize === null ||
        pageSize < 512 ||
        freePageCount !== 0
      ) {
        throw new Error(
          'Could not determine encrypted database page limits ' +
            `(pages=${String(pageCount)}, pageSize=${String(pageSize)}, ` +
            `freePages=${String(freePageCount)})`,
        );
      }

      await database.execute(`PRAGMA max_page_count = ${pageCount}`);

      let diskFullWriteRejected = false;
      try {
        await database.transaction(async transaction => {
          await transaction.execute(
            `INSERT INTO encrypted_storage_spike (id, payload)
             VALUES (?, zeroblob(?))`,
            [SPIKE_DISK_FULL_ID, pageSize * 16],
          );
        });
      } catch {
        diskFullWriteRejected = true;
      } finally {
        await database.execute(
          `PRAGMA max_page_count = ${SQLITE_MAX_PAGE_COUNT}`,
        );
      }

      const diskFullState = await database.execute(
        `SELECT id, payload FROM encrypted_storage_spike
         WHERE id IN (?, ?) ORDER BY id`,
        [SPIKE_MARKER_ID, SPIKE_DISK_FULL_ID],
      );
      const baselineAfterDiskFull = diskFullState.rows.find(
        row => row.id === SPIKE_MARKER_ID,
      );
      const partialDiskFullRow = diskFullState.rows.find(
        row => row.id === SPIKE_DISK_FULL_ID,
      );
      if (
        !diskFullWriteRejected ||
        baselineAfterDiskFull?.payload !== SPIKE_MARKER_PAYLOAD ||
        partialDiskFullRow
      ) {
        throw new Error(
          'Synthetic disk-full transaction was not safely rolled back',
        );
      }

      database.close();
      database = null;

      const wrongKey = `${encryptionKey[0] === '0' ? '1' : '0'}${encryptionKey.slice(1)}`;
      let wrongKeyDatabase: DB | null = null;
      let wrongKeyRejected = false;
      try {
        wrongKeyDatabase = open({
          name: SPIKE_DATABASE_NAME,
          encryptionKey: wrongKey,
          failOnCreate: true,
          readOnly: true,
        });
        await wrongKeyDatabase.execute(
          'SELECT payload FROM encrypted_storage_spike LIMIT 1',
        );
      } catch {
        wrongKeyRejected = true;
      } finally {
        closeQuietly(wrongKeyDatabase);
      }

      if (!wrongKeyRejected) {
        throw new Error('Encrypted storage unexpectedly opened with a wrong key');
      }

      return {
        databaseName: SPIKE_DATABASE_NAME,
        sqlCipherVersion,
        rollbackVerified: true,
        reopenVerified: true,
        wrongKeyRejected: true,
        diskFullRollbackVerified: true,
      };
    } finally {
      closeQuietly(database);
    }
  };
