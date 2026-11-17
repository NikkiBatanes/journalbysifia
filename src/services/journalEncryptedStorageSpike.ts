import {open, type DB} from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import 'react-native-get-random-values';

const SPIKE_DATABASE_NAME = 'journal-cloud-storage-spike-v1.sqlite';
const SPIKE_KEYCHAIN_SERVICE =
  'app.journal.sifia.spike.encrypted-database-key.v1';
const SPIKE_KEYCHAIN_USERNAME = 'journal-cloud-storage-spike';
const SPIKE_MARKER_ID = 'encrypted-storage-spike';
const SPIKE_MARKER_PAYLOAD = 'synthetic-only-no-customer-data';
const ENCRYPTION_KEY_BYTES = 32;

type RandomFill = (bytes: Uint8Array) => Uint8Array;

export interface JournalEncryptedStorageSpikeResult {
  databaseName: string;
  sqlCipherVersion: string;
  rollbackVerified: true;
  reopenVerified: true;
  wrongKeyRejected: true;
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
export const getOrCreateSpikeEncryptionKey = async (): Promise<string> => {
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

const closeQuietly = (database: DB | null): void => {
  try {
    database?.close();
  } catch {
    // The spike reports the primary verification error, not a close failure.
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
      };
    } finally {
      closeQuietly(database);
    }
  };
