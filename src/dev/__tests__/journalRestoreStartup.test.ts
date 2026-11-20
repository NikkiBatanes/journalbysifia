import AsyncStorage from '@react-native-async-storage/async-storage';
import {checkDevelopmentRestoreAtStartup, relaunchDatabase} from '../journalRestoreStartup';
import {JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY as snapshot} from '../../services/journalBackupRestoreExecutor';
import {readSpikeEncryptionKey} from '../../services/journalEncryptedStorageSpike';
import {open} from '@op-engineering/op-sqlite';
import {checkRestoreBaseline} from '../journalRestoreReopenProbe';

jest.mock('../../services/journalEncryptedStorageSpike', () => ({readSpikeEncryptionKey: jest.fn()}));
jest.mock('@op-engineering/op-sqlite', () => ({open: jest.fn()}));
jest.mock('../journalRestoreReopenProbe', () => ({checkRestoreBaseline: jest.fn()}));

const db = {close: jest.fn(), delete: jest.fn()};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('1');
  jest.mocked(readSpikeEncryptionKey).mockResolvedValue('test-key');
  (open as jest.Mock).mockReturnValue(db);
  jest.mocked(checkRestoreBaseline).mockResolvedValue(true);
});

it('opens normally without reading journal entries or opening a test database on an unarmed launch', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('idle');
  expect(readSpikeEncryptionKey).not.toHaveBeenCalled();
  expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

it('preserves the pending test when the device key is unavailable', async () => {
  jest.mocked(readSpikeEncryptionKey).mockResolvedValue(null);
  await expect(checkDevelopmentRestoreAtStartup()).rejects.toThrow('key');
  expect(open).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

it('shares concurrent opens and retries a blocked verification without deleting evidence', async () => {
  jest.mocked(checkRestoreBaseline).mockRejectedValueOnce(new Error('Cannot recover'));
  const first = checkDevelopmentRestoreAtStartup();
  expect(checkDevelopmentRestoreAtStartup()).toBe(first);
  await expect(first).rejects.toThrow('Cannot recover');
  expect(db.close).toHaveBeenCalledTimes(1);
  expect(db.delete).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('recovered');
  expect(open).toHaveBeenCalledWith({name: relaunchDatabase, encryptionKey: 'test-key', failOnCreate: true});
});

it('can finish cleanup after recovery has already committed', async () => {
  jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('Interrupted'));
  await expect(checkDevelopmentRestoreAtStartup()).rejects.toThrow('Interrupted');
  expect(db.delete).not.toHaveBeenCalled();
  jest.mocked(checkRestoreBaseline).mockResolvedValue(false);
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('baseline');
  expect(db.delete).toHaveBeenCalledTimes(1);
});

it('recovers device entries at ordinary launch without a pending practice exercise', async () => {
  const key = 'journal_local:heart:practice';
  const values = new Map([[key, 'partial'], ['unrelated', 'keep'], [snapshot, JSON.stringify({
    version: 1, transactionId: '418493f6-2d2f-43cb-8c23-1fd0e40b7d44', entries: [{key, value: 'saved'}],
  })]]);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.getAllKeys).mockImplementation(async () => Array.from(values.keys()));
  jest.mocked(AsyncStorage.multiGet).mockImplementation(async keys => keys.map<[string, string | null]>(k => [k, values.get(k) ?? null]));
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async k => {values.delete(k);});
  jest.mocked(AsyncStorage.multiSet).mockRejectedValueOnce(new Error('Storage full')).mockImplementation(async rows => {
    rows.forEach(([k, value]) => values.set(k, value));
  });
  await expect(checkDevelopmentRestoreAtStartup()).rejects.toThrow();
  expect(values.has(snapshot)).toBe(true);
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('device-recovered');
  expect(Array.from(values.entries())).toEqual([[key, 'saved'], ['unrelated', 'keep']]);
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('idle');
});
