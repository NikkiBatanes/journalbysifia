import {Alert, DevSettings} from 'react-native';

import {runJournalEncryptedStorageSpike} from '../services/journalEncryptedStorageSpike';

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
};
