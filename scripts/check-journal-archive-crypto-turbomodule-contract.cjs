#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');
const specPath = path.join(root, 'src/native/NativeJournalArchiveCrypto.ts');

function inspectContract(packageJson, spec) {
  const failures = [];
  const config = packageJson.codegenConfig;

  const expectedConfig = {
    name: 'JournalArchiveCryptoSpec',
    type: 'modules',
    jsSrcsDir: 'src/native',
    android: {javaPackageName: 'app.journal.sifia.archivecrypto'},
    ios: {
      modules: {
        JournalArchiveCrypto: {className: 'JournalArchiveCrypto'},
      },
    },
  };

  if (JSON.stringify(config) !== JSON.stringify(expectedConfig)) {
    failures.push('package.json codegenConfig differs from the approved isolated module configuration');
  }

  const requiredMarkers = [
    "TurboModuleRegistry.getEnforcing<Spec>('JournalArchiveCrypto')",
    'interruptSyntheticPhoto(afterPublication: boolean): Promise<void>',
    'checkSyntheticPhotoInterruption(afterPublication: boolean): Promise<boolean>',
    'stageSharedFixturePhoto(replacement: boolean): Promise<string>',
    'verifySharedFixturePhotos(shared: string, other: string): Promise<boolean>',
    'stageSyntheticPhoto(replacement: boolean): Promise<string>',
    'verifySyntheticPhoto(name: string, replacement: boolean): Promise<boolean>',
    'finishSampleRestorePreview(previewId: string, recoveryCode: string, confirm: boolean): Promise<string>',
    'chooseSampleBackupFile(exporting: boolean, recoveryCode: string): Promise<string>',
    'exportSharedPhotoTransfer(): Promise<string>',
    'importSharedPhotoTransfer(): Promise<string>',
    'verifyTransferredPhotos(shared: string, sharedDigest: string, other: string, otherDigest: string): Promise<boolean>',
    'exportSyntheticTransfer(): Promise<string>',
    'importSyntheticTransfer(): Promise<string>',
    'getProviderEvidence(): Promise<JournalArchiveCryptoProviderEvidence>',
    'runSyntheticSelfTest(): Promise<JournalArchiveCryptoSyntheticEvidence>',
    'runPortableVectorSelfTest(): Promise<JournalArchiveCryptoPortableVectorEvidence>',
    'runFileTransportSelfTest(): Promise<JournalArchiveCryptoFileTransportEvidence>',
    'runMediaPackagingSelfTest(): Promise<JournalArchiveCryptoMediaPackagingEvidence>',
    'runtimeOffJavaScriptThread: boolean',
    'syntheticOnly: boolean',
    'mobileProviderApproved: boolean',
    'wrongPasswordRejected: boolean',
    'tamperRejected: boolean',
    'truncationRejected: boolean',
    'reorderingRejected: boolean',
    'finalTagRequired: boolean',
    'sensitiveBuffersCleared: boolean',
    'plaintextFileWritten: boolean',
    'derivedKeyMatches: boolean',
    'ciphertextMatches: boolean',
    'decryptMatches: boolean',
    'tamperAndTruncationRejected: boolean',
    'boundedChunkWrites: boolean',
    'sizeLimitRejected: boolean',
    'temporaryFileUsed: boolean',
    'incompletePublishHidden: boolean',
    'atomicPublishSucceeded: boolean',
    'fileAndDirectorySynced: boolean',
    'staleTemporaryCleaned: boolean',
    'publishedBytesVerified: boolean',
    'artifactsCleaned: boolean',
    'allowedMediaPackaged: boolean',
    'contentTypeMismatchRejected: boolean',
    'perAssetLimitRejected: boolean',
    'aggregateLimitsRejected: boolean',
    'hashMismatchRejected: boolean',
    'ownerMismatchRejected: boolean',
    'unsafePathRejected: boolean',
    'duplicateAssetRejected: boolean',
    'metadataTamperRejected: boolean',
    'chunkReorderingRejected: boolean',
    'missingFinalMarkerRejected: boolean',
  ];

  for (const marker of requiredMarkers) {
    if (!spec.includes(marker)) {
      failures.push(`missing contract marker: ${marker}`);
    }
  }

  const forbiddenCustomerSurface = [
    /encryptFile/i,
    /decryptFile/i,
    /sourcePath/i,
    /destinationPath/i,
    /\bcustomer(?:Data|Path|File)\b/i,
  ];

  for (const pattern of forbiddenCustomerSurface) {
    if (pattern.test(spec)) {
      failures.push(`customer-data surface is forbidden before provider approval: ${pattern}`);
    }
  }

  return {approved: failures.length === 0, failures};
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const spec = fs.readFileSync(specPath, 'utf8');
  const result = inspectContract(packageJson, spec);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.approved) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {inspectContract};
