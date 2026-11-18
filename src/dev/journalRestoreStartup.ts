import AsyncStorage from '@react-native-async-storage/async-storage';

export const relaunchDatabase = 'journal-restore-relaunch-probe-v1.sqlite';
const pendingKey = 'journal:dev:restore-relaunch-pending:v1';

export const markRestoreStartupPending = () => AsyncStorage.setItem(pendingKey, '1');

async function checkStartup() {
  const pending = await AsyncStorage.getItem(pendingKey);
  if (pending === null) {
    return 'idle' as const;
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
