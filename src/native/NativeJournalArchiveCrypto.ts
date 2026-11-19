import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Development archive operations use synthetic data. The picker-photo check
 * reads local files and returns only a byte count or status.
 */
export type JournalArchiveCryptoProviderEvidence = {
  libsodiumVersion: string;
  platform: string;
  architecture: string;
  runtimeOffJavaScriptThread: boolean;
  syntheticOnly: boolean;
  mobileProviderApproved: boolean;
};

export type JournalArchiveCryptoSyntheticEvidence = {
  argon2id: boolean;
  secretstream: boolean;
  wrongPasswordRejected: boolean;
  tamperRejected: boolean;
  truncationRejected: boolean;
  reorderingRejected: boolean;
  finalTagRequired: boolean;
  sensitiveBuffersCleared: boolean;
  plaintextFileWritten: boolean;
};

export type JournalArchiveCryptoPortableVectorEvidence = {
  vectorId: string;
  vectorSha256: string;
  derivedKeyMatches: boolean;
  ciphertextMatches: boolean;
  decryptMatches: boolean;
  wrongPasswordRejected: boolean;
  tamperAndTruncationRejected: boolean;
  reorderingRejected: boolean;
  finalTagRequired: boolean;
  sensitiveBuffersCleared: boolean;
  plaintextFileWritten: boolean;
};

export type JournalArchiveCryptoFileTransportEvidence = {
  boundedChunkWrites: boolean;
  sizeLimitRejected: boolean;
  temporaryFileUsed: boolean;
  incompletePublishHidden: boolean;
  atomicPublishSucceeded: boolean;
  fileAndDirectorySynced: boolean;
  staleTemporaryCleaned: boolean;
  publishedBytesVerified: boolean;
  artifactsCleaned: boolean;
  plaintextFileWritten: boolean;
};

export type JournalArchiveCryptoMediaPackagingEvidence = {
  allowedMediaPackaged: boolean;
  contentTypeMismatchRejected: boolean;
  perAssetLimitRejected: boolean;
  aggregateLimitsRejected: boolean;
  hashMismatchRejected: boolean;
  ownerMismatchRejected: boolean;
  unsafePathRejected: boolean;
  duplicateAssetRejected: boolean;
  metadataTamperRejected: boolean;
  chunkReorderingRejected: boolean;
  missingFinalMarkerRejected: boolean;
  plaintextFileWritten: boolean;
};

export interface Spec extends TurboModule {
  describeLocalPickerPhoto(uri: string, remainingBytes: number): Promise<string>;
  inspectLocalPickerPhoto(uri: string, remainingBytes: number): Promise<number>;
  interruptSyntheticPhoto(afterPublication: boolean): Promise<void>;
  checkSyntheticPhotoInterruption(afterPublication: boolean): Promise<boolean>;
  stageSharedFixturePhoto(replacement: boolean): Promise<string>;
  verifySharedFixturePhotos(shared: string, other: string): Promise<boolean>;
  stageSyntheticPhoto(replacement: boolean): Promise<string>;
  verifySyntheticPhoto(name: string, replacement: boolean): Promise<boolean>;
  finishSampleRestorePreview(previewId: string, recoveryCode: string, confirm: boolean): Promise<string>;
  saveInventorySample(recoveryCode: string, entryCount: number): Promise<string>;
  chooseSampleBackupFile(exporting: boolean, recoveryCode: string): Promise<string>;
  exportSharedPhotoTransfer(): Promise<string>;
  importSharedPhotoTransfer(): Promise<string>;
  verifyTransferredPhotos(shared: string, sharedDigest: string, other: string, otherDigest: string): Promise<boolean>;
  checkRestoredPhotos(shared: string, sharedDigest: string, other: string, otherDigest: string): Promise<boolean>;
  exportSyntheticTransfer(): Promise<string>;
  importSyntheticTransfer(): Promise<string>;
  getProviderEvidence(): Promise<JournalArchiveCryptoProviderEvidence>;
  runSyntheticSelfTest(): Promise<JournalArchiveCryptoSyntheticEvidence>;
  runPortableVectorSelfTest(): Promise<JournalArchiveCryptoPortableVectorEvidence>;
  runFileTransportSelfTest(): Promise<JournalArchiveCryptoFileTransportEvidence>;
  runMediaPackagingSelfTest(): Promise<JournalArchiveCryptoMediaPackagingEvidence>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('JournalArchiveCrypto');
