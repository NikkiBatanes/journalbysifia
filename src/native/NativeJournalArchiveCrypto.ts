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

export interface Spec extends TurboModule {
  getProviderEvidence(): Promise<JournalArchiveCryptoProviderEvidence>;
  runSyntheticSelfTest(): Promise<JournalArchiveCryptoSyntheticEvidence>;
  runPortableVectorSelfTest(): Promise<JournalArchiveCryptoPortableVectorEvidence>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('JournalArchiveCrypto');
