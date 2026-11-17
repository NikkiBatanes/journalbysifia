import {Alert, DevSettings} from 'react-native';

import {
  armJournalEncryptedStorageInterruptionProbe,
  runJournalEncryptedStorageSpike,
  verifyJournalEncryptedStorageInterruptionRecovery,
} from '../services/journalEncryptedStorageSpike';

let installed = false;

/**
 * Registers an explicit development-only command. The probe never runs during
 * startup and its result deliberately excludes the encryption key.
 */
export const installJournalEncryptedStorageSpikeMenu = (): void => {
  if (!__DEV__ || installed) {
    return;
  }

  installed = true;
  DevSettings.addMenuItem('Verify encrypted journal storage', () => {
    runJournalEncryptedStorageSpike().then(
      result => {
        Alert.alert(
          'Encrypted storage passed',
          [
            `SQLCipher: ${result.sqlCipherVersion}`,
            'Transaction rollback: passed',
            'Close and reopen: passed',
            'Wrong key rejected: passed',
            'Simulated disk-full rollback: passed',
          ].join('\n'),
        );
      },
      error => {
        const message =
          error instanceof Error ? error.message : 'Unknown diagnostic error';
        Alert.alert('Encrypted storage failed', message);
      },
    );
  });

  DevSettings.addMenuItem('Arm encrypted interruption test', () => {
    armJournalEncryptedStorageInterruptionProbe(() => {
      Alert.alert(
        'Interruption test armed',
        'The synthetic write is open and uncommitted. Terminate the app ' +
          'process externally now, then relaunch and choose “Verify encrypted ' +
          'interruption recovery”.',
      );
    }).catch(error => {
      const message =
        error instanceof Error ? error.message : 'Unknown diagnostic error';
      Alert.alert('Could not arm interruption test', message);
    });
  });

  DevSettings.addMenuItem('Verify encrypted interruption recovery', () => {
    verifyJournalEncryptedStorageInterruptionRecovery().then(
      () => {
        Alert.alert(
          'Interruption recovery passed',
          [
            'Database integrity: passed',
            'Committed baseline preserved: passed',
            'Interrupted write discarded: passed',
          ].join('\n'),
        );
      },
      error => {
        const message =
          error instanceof Error ? error.message : 'Unknown diagnostic error';
        Alert.alert('Interruption recovery failed', message);
      },
    );
  });
};
