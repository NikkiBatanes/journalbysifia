import AsyncStorage from '@react-native-async-storage/async-storage';
import {checkDevelopmentRestoreAtStartup, relaunchDatabase} from '../journalRestoreStartup';
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

it('opens normally without accessing native test storage on an unarmed launch', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  await expect(checkDevelopmentRestoreAtStartup()).resolves.toBe('idle');
  expect(readSpikeEncryptionKey).not.toHaveBeenCalled();
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
