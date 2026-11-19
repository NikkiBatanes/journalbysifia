import {Alert, DevSettings, Platform} from 'react-native';
import {markRestoreStartupPending, relaunchDatabase} from './journalRestoreStartup';
import {open} from '@op-engineering/op-sqlite';
import {armRestoreInterruption, verifyRecoveredRestore, verifyRestoreReopen} from './journalRestoreReopenProbe';

import {
  armJournalEncryptedStorageInterruptionProbe,
  generateSpikeEncryptionKey,
  getOrCreateSpikeEncryptionKey,
  readSpikeEncryptionKey,
  runJournalEncryptedStorageSpike,
  verifyJournalEncryptedStorageInterruptionRecovery,
} from '../services/journalEncryptedStorageSpike';

let installed = false;

/**
 * Registers an explicit development-only command. Arming is manual. Startup checks only the
 * pending synthetic restore. Diagnostic messages exclude the encryption key.
 */
export const installJournalEncryptedStorageSpikeMenu = (): void => {
  if (!__DEV__ || installed) {
    return;
  }

  installed = true;

  let transferBusy = false;
  async function transferFixture(exporting: boolean) {
    if (transferBusy) {return;}
    transferBusy = true;
    try {
      const token = exporting
        ? await (await import('../native/NativeJournalArchiveCrypto')).default.exportSyntheticTransfer()
        : await (await import('./journalArchiveTransferProbe')).restoreTransferredFixture();
      Alert.alert(exporting ? 'Test backup exported' : 'Transferred restore passed', token);
    } catch {
      Alert.alert('Test backup transfer failed');
    } finally {
      transferBusy = false;
    }
  }
  DevSettings.addMenuItem('Test portable Journal backup', () => {
    Alert.alert('Test portable Journal backup', 'Transfer the encrypted test file between installations.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Export', onPress: () => transferFixture(true)},
      {text: 'Restore', onPress: () => transferFixture(false)},
    ]);
  });

  let filePhotoBusy = false;
  async function checkFilePhoto(arm: boolean) {
    if (filePhotoBusy) {return;}
    filePhotoBusy = true;
    try {
      const probe = await import('./journalFilePhotoReopenProbe');
      if (arm) {
        await probe.armFilePhotoReopen(() => Alert.alert('Photo restore armed',
          'Fully stop Journal now. Reopen it and choose Verify in the same test.'));
      } else {
        await probe.verifyFilePhotoReopen();
        Alert.alert('Photo restore passed', 'Journal recovered the original entry and photo. The retry also survived reopening.');
      }
    } catch (error) {
      Alert.alert('Photo restore failed', error instanceof Error ? error.message : 'Unknown diagnostic error');
    } finally {
      filePhotoBusy = false;
    }
  }
  DevSettings.addMenuItem('Test full-size photo recovery', () => {
    Alert.alert('Test full-size photo recovery', 'Use Arm first. Choose Verify after restarting Journal.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Arm', onPress: () => checkFilePhoto(true)},
      {text: 'Verify', onPress: () => checkFilePhoto(false)},
    ]);
  });

  let relaunchBusy = false;
  async function runRelaunchStep(arm: boolean) {
    if (relaunchBusy) {
      Alert.alert('Close and reopen Journal to continue the test');
      return;
    }
    relaunchBusy = true;
    try {
      const encryptionKey = arm ? await getOrCreateSpikeEncryptionKey() : await readSpikeEncryptionKey();
      if (!encryptionKey) {
        throw new Error('The saved test key is missing');
      }
      const db = open({name: relaunchDatabase, encryptionKey, failOnCreate: !arm});
      let deleted = false;
      try {
        if (arm) {
          await armRestoreInterruption(db, () => Alert.alert(
            'Journal restore interruption armed',
            'Fully close Journal and reopen it. Journal will check the test entry automatically.',
          ), markRestoreStartupPending);
        } else {
          await verifyRecoveredRestore(db);
          db.delete();
          deleted = true;
          Alert.alert('Journal restore after relaunch passed');
        }
      } finally {
        if (!deleted) {
          db.close();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown diagnostic error';
      Alert.alert('Journal restore after relaunch failed', message.replace(/[0-9a-f]{64}/gi, '[redacted]'));
    } finally {
      relaunchBusy = false;
    }
  }
  DevSettings.addMenuItem('Test Journal restore after relaunch', () => {
    Alert.alert('Test Journal restore after relaunch', 'Choose Arm, then close and reopen Journal. Verify is for older tests armed before automatic checks.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Arm', onPress: () => runRelaunchStep(true)},
      {text: 'Verify', onPress: () => runRelaunchStep(false)},
    ]);
  });

  let restoreProbeRunning = false;
  DevSettings.addMenuItem('Verify Journal restore on reopen', async () => {
    if (restoreProbeRunning) {
      return;
    }
    restoreProbeRunning = true;
    try {
      const encryptionKey = generateSpikeEncryptionKey();
      const options = {name: `journal-restore-probe-${Date.now()}.sqlite`, encryptionKey};
      try {
        await verifyRestoreReopen(() => open(options));
      } finally {
        open(options).delete();
      }
      Alert.alert('Journal restore on reopen passed');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Journal restore on reopen failed', detail.replace(/[0-9a-f]{64}/gi, '[redacted]'));
    } finally {
      restoreProbeRunning = false;
    }
  });

  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    const nativePlatform = Platform.OS;
    const platformName = nativePlatform === 'ios' ? 'iOS' : 'Android';
    DevSettings.addMenuItem(`Verify ${platformName} archive crypto`, () => {
      import('../native/NativeJournalArchiveCrypto').then(
        async ({default: archiveCrypto}) => {
          const [provider, assertions, portable, transport, media] = await Promise.all([
            archiveCrypto.getProviderEvidence(),
            archiveCrypto.runSyntheticSelfTest(),
            archiveCrypto.runPortableVectorSelfTest(),
            archiveCrypto.runFileTransportSelfTest(),
            archiveCrypto.runMediaPackagingSelfTest(),
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
            portable.vectorId === 'journal-archive-portable-v1',
            portable.vectorSha256 ===
              '1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14',
            portable.derivedKeyMatches,
            portable.ciphertextMatches,
            portable.decryptMatches,
            portable.wrongPasswordRejected,
            portable.tamperAndTruncationRejected,
            portable.reorderingRejected,
            portable.finalTagRequired,
            portable.sensitiveBuffersCleared,
            !portable.plaintextFileWritten,
            transport.boundedChunkWrites,
            transport.sizeLimitRejected,
            transport.temporaryFileUsed,
            transport.incompletePublishHidden,
            transport.atomicPublishSucceeded,
            transport.fileAndDirectorySynced,
            transport.staleTemporaryCleaned,
            transport.publishedBytesVerified,
            transport.artifactsCleaned,
            !transport.plaintextFileWritten,
            media.allowedMediaPackaged,
            media.contentTypeMismatchRejected,
            media.perAssetLimitRejected,
            media.aggregateLimitsRejected,
            media.hashMismatchRejected,
            media.ownerMismatchRejected,
            media.unsafePathRejected,
            media.duplicateAssetRejected,
            media.metadataTamperRejected,
            media.chunkReorderingRejected,
            media.missingFinalMarkerRejected,
            !media.plaintextFileWritten,
          ];
          if (
            provider.platform !== nativePlatform ||
            provider.libsodiumVersion !== '1.0.22' ||
            !provider.runtimeOffJavaScriptThread ||
            !provider.syntheticOnly ||
            provider.mobileProviderApproved ||
            expectedAssertions.some(passed => !passed)
          ) {
            throw new Error('One or more fail-closed crypto assertions failed');
          }
          Alert.alert(
            `${platformName} archive crypto passed`,
            [
              `libsodium: ${provider.libsodiumVersion}`,
              `Architecture: ${provider.architecture}`,
              'Argon2id derivation: passed',
              'Secretstream round trip: passed',
              'Wrong password rejection: passed',
              'Tamper and truncation rejection: passed',
              'Reordering and missing-final rejection: passed',
              'Sensitive-buffer clearing: passed',
              `Portable vector: ${portable.vectorId}`,
              'Cross-platform key and bytes: passed',
              'Cross-platform failure parity: passed',
              'Bounded encrypted chunk writes: passed',
              'Oversized output rejection: passed',
              'Temporary-file isolation: passed',
              'Interrupted-file cleanup: passed',
              'Atomic publish and durability sync: passed',
              'Published ciphertext verification: passed',
              'Synthetic artifacts cleaned: passed',
              'Authenticated image/audio packaging: passed',
              'Media signature and size limits: passed',
              'Asset hash, owner and path binding: passed',
              'Duplicate and metadata tamper rejection: passed',
              'Media chunk order and final marker: passed',
              'Plaintext file written: no',
              'Customer-data API enabled: no',
            ].join('\n'),
          );
        },
      ).catch(error => {
        const message =
          error instanceof Error ? error.message : 'Unknown diagnostic error';
        Alert.alert(`${platformName} archive crypto failed`, message);
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
