import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Evidence returned by the native provider before any customer-data surface is
 * allowed. This bridge remains synthetic-only until the mobile provider and
 * device failure suites are approved.
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
  interruptSyntheticPhoto(afterPublication: boolean): Promise<void>;
  checkSyntheticPhotoInterruption(afterPublication: boolean): Promise<boolean>;
  stageSyntheticPhoto(replacement: boolean): Promise<string>;
  verifySyntheticPhoto(name: string, replacement: boolean): Promise<boolean>;
  exportSyntheticTransfer(): Promise<string>;
  importSyntheticTransfer(): Promise<string>;
  getProviderEvidence(): Promise<JournalArchiveCryptoProviderEvidence>;
  runSyntheticSelfTest(): Promise<JournalArchiveCryptoSyntheticEvidence>;
  runPortableVectorSelfTest(): Promise<JournalArchiveCryptoPortableVectorEvidence>;
  runFileTransportSelfTest(): Promise<JournalArchiveCryptoFileTransportEvidence>;
  runMediaPackagingSelfTest(): Promise<JournalArchiveCryptoMediaPackagingEvidence>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('JournalArchiveCrypto');
