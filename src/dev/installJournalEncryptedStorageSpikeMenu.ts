import {Alert, DevSettings, Platform} from 'react-native';

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

  if (Platform.OS === 'android') {
    DevSettings.addMenuItem('Verify Android archive crypto', () => {
      import('../native/NativeJournalArchiveCrypto').then(
        async ({default: archiveCrypto}) => {
          const [provider, assertions] = await Promise.all([
            archiveCrypto.getProviderEvidence(),
            archiveCrypto.runSyntheticSelfTest(),
          ]);
          const expectedAssertions = [
            assertions.argon2id,
            assertions.secretstream,
            assertions.wrongPasswordRejected,
            assertions.tamperRejected,
            assertions.truncationRejected,
            assertions.reorderingRejected,
            assertions.finalTagRequired,
            assertions.sensitiveBuffersCleared,
            !assertions.plaintextFileWritten,
          ];
          if (
            provider.platform !== 'android' ||
            provider.libsodiumVersion !== '1.0.22' ||
            !provider.runtimeOffJavaScriptThread ||
            !provider.syntheticOnly ||
            provider.mobileProviderApproved ||
            expectedAssertions.some(passed => !passed)
          ) {
            throw new Error('One or more fail-closed crypto assertions failed');
          }
          Alert.alert(
            'Android archive crypto passed',
            [
              `libsodium: ${provider.libsodiumVersion}`,
              `Architecture: ${provider.architecture}`,
              'Argon2id derivation: passed',
              'Secretstream round trip: passed',
              'Wrong password rejection: passed',
              'Tamper and truncation rejection: passed',
              'Reordering and missing-final rejection: passed',
              'Sensitive-buffer clearing: passed',
              'Plaintext file written: no',
              'Customer-data API enabled: no',
            ].join('\n'),
          );
        },
      ).catch(error => {
        const message =
          error instanceof Error ? error.message : 'Unknown diagnostic error';
        Alert.alert('Android archive crypto failed', message);
      });
    });
  }

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
