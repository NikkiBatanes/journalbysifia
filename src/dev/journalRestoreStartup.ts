import AsyncStorage from '@react-native-async-storage/async-storage';

import {recoverInterruptedJournalBackupRestore} from '../services/journalBackupRestoreExecutor';
import {localJournalMutations} from '../storage/journalMutationCoordinator';
import {createJournalRestoreStorage} from '../storage/journalRestoreStorage';

const deviceStorage = createJournalRestoreStorage('');
export const relaunchDatabase = 'journal-restore-relaunch-probe-v1.sqlite';
const fullPractice = 'large-local-entries-full';
const pendingKey = 'journal:dev:restore-relaunch-pending:v1';

export const markRestoreStartupPending = () => AsyncStorage.setItem(pendingKey, '1');

export const markLocalRestorePending = () => AsyncStorage.setItem(pendingKey, 'local-entries');

export const markLargeRestorePending = () => AsyncStorage.setItem(pendingKey, fullPractice);

export async function releasePracticeStorageLimit() {
  if (await AsyncStorage.getItem(pendingKey) === fullPractice) {
    await AsyncStorage.setItem(pendingKey, 'large-local-entries');
  }
}

async function checkStartup() {
  const recoveredDeviceJournal = await recoverInterruptedJournalBackupRestore(deviceStorage, localJournalMutations);
  const pending = await AsyncStorage.getItem(pendingKey);
  if (pending === null) {
    return recoveredDeviceJournal ? 'device-recovered' as const : 'idle' as const;
  }
  if (pending === 'large-local-entries' || pending === fullPractice) {
    const fixture = require('./journalLargeRestoreProbe') as typeof import('./journalLargeRestoreProbe');
    try {
      await fixture.verifyLargeRestoreAfterReopen(pending === fullPractice);
    } catch (error) {
      if (error instanceof fixture.PracticeStorageFullError) {return 'practice-full' as const;}
      throw error;
    }
    await AsyncStorage.removeItem(pendingKey);
    await fixture.clearLargeRestoreFixture();
    return 'large-recovered' as const;
  }
  if (pending === 'local-entries') {
    const fixture = require('./journalLocalRestoreInterruption') as typeof import('./journalLocalRestoreInterruption');
    const result = await fixture.verifyLocalRestoreAfterReopen();
    await AsyncStorage.removeItem(pendingKey);
    await fixture.clearLocalRestoreFixture();
    return result;
  }
  if (pending !== '1') {
    throw new Error('Unknown development restore state');
  }
  const {readSpikeEncryptionKey} = require('../services/journalEncryptedStorageSpike') as typeof import('../services/journalEncryptedStorageSpike');
  const encryptionKey = await readSpikeEncryptionKey();
  if (!encryptionKey) {
    throw new Error('The saved test key is unavailable');
  }
  const {open} = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const {checkRestoreBaseline} = require('./journalRestoreReopenProbe') as typeof import('./journalRestoreReopenProbe');
  const db = open({name: relaunchDatabase, encryptionKey, failOnCreate: true});
  let deleted = false;
  try {
    const recovered = await checkRestoreBaseline(db);
    // A second interruption before this removal repeats the baseline check.
    // After removal, any leftover disposable file can be reused by the next test.
    await AsyncStorage.removeItem(pendingKey);
    db.delete();
    deleted = true;
    return recovered ? 'recovered' as const : 'baseline' as const;
  } finally {
    if (!deleted) {
      db.close();
    }
  }
}

let inFlight: ReturnType<typeof checkStartup> | undefined;
export function checkDevelopmentRestoreAtStartup() {
  if (!inFlight) {
    inFlight = checkStartup().finally(() => { inFlight = undefined; });
  }
  return inFlight;
}
