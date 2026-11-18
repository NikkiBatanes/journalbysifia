#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const paths = {
  podfile: 'ios/Podfile',
  podspec: 'ios/JournalArchiveCrypto/JournalArchiveCrypto.podspec',
  header: 'ios/JournalArchiveCrypto/Sources/JournalArchiveCrypto.h',
  moduleSource: 'ios/JournalArchiveCrypto/Sources/JournalArchiveCrypto.mm',
  transportHeader:
    'ios/JournalArchiveCrypto/Sources/JournalArchiveFileTransport.h',
  transportSource:
    'ios/JournalArchiveCrypto/Sources/JournalArchiveFileTransport.mm',
  integrity: 'ios/JournalArchiveCrypto/Vendor/INTEGRITY.json',
  framework: 'ios/JournalArchiveCrypto/Vendor/Clibsodium.xcframework',
  license: 'ios/JournalArchiveCrypto/Vendor/LICENSE.libsodium',
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Tree(directory) {
  const entries = [];
  function visit(current, relative) {
    const children = fs
      .readdirSync(current, {withFileTypes: true})
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        visit(childPath, childRelative);
      } else if (child.isFile()) {
        entries.push(`${childRelative}:${sha256(fs.readFileSync(childPath))}`);
      } else {
        throw new Error(`Unsupported XCFramework entry: ${childRelative}`);
      }
    }
  }
  visit(directory, '');
  return {
    entryCount: entries.length,
    sha256: sha256(entries.join('\n')),
  };
}

function requireMarkers(source, markers, label, failures) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`missing ${label}: ${marker}`);
    }
  }
}

function inspectIosProvider(sources) {
  const failures = [];
  const {
    podfile,
    podspec,
    header,
    moduleSource,
    transportHeader,
    transportSource,
    integritySource,
    frameworkDigest,
    licenseBytes,
  } = sources;

  requireMarkers(
    podfile,
    ["pod 'JournalArchiveCrypto', :path => './JournalArchiveCrypto'"],
    'iOS Pod registration',
    failures,
  );
  requireMarkers(
    podspec,
    [
      "spec.platform = :ios, '15.1'",
      "spec.source_files = 'Sources/**/*.{h,mm}'",
      "spec.vendored_frameworks = 'Vendor/Clibsodium.xcframework'",
      "spec.dependency 'ReactCodegen'",
      "'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'",
    ],
    'iOS Pod boundary',
    failures,
  );
  requireMarkers(
    header,
    [
      '#import <JournalArchiveCryptoSpec/JournalArchiveCryptoSpec.h>',
      '@interface JournalArchiveCrypto : NativeJournalArchiveCryptoSpecBase <NativeJournalArchiveCryptoSpec>',
    ],
    'iOS generated-contract bridge',
    failures,
  );
  requireMarkers(
    moduleSource,
    [
      'RCT_EXPORT_MODULE(JournalArchiveCrypto)',
      'dispatch_queue_create(',
      '"app.journal.sifia.archive-crypto", DISPATCH_QUEUE_SERIAL',
      '- (void)getProviderEvidence:(RCTPromiseResolveBlock)resolve',
      '- (void)runSyntheticSelfTest:(RCTPromiseResolveBlock)resolve',
      '- (void)runFileTransportSelfTest:(RCTPromiseResolveBlock)resolve',
      '@"platform" : @"ios"',
      '@"runtimeOffJavaScriptThread" : @YES',
      '@"syntheticOnly" : @YES',
      '@"mobileProviderApproved" : @NO',
      '@"argon2id" : @(assertions[0])',
      '@"secretstream" : @(assertions[1])',
      '@"wrongPasswordRejected" : @(assertions[2])',
      '@"tamperRejected" : @(assertions[3])',
      '@"truncationRejected" : @(assertions[4])',
      '@"reorderingRejected" : @(assertions[5])',
      '@"finalTagRequired" : @(assertions[6])',
      '@"sensitiveBuffersCleared" : @(assertions[7])',
      '@"plaintextFileWritten" : @NO',
      '@"boundedChunkWrites" : @(assertions[0])',
      '@"sizeLimitRejected" : @(assertions[1])',
      '@"temporaryFileUsed" : @(assertions[2])',
      '@"incompletePublishHidden" : @(assertions[3])',
      '@"atomicPublishSucceeded" : @(assertions[4])',
      '@"fileAndDirectorySynced" : @(assertions[5])',
      '@"staleTemporaryCleaned" : @(assertions[6])',
      '@"publishedBytesVerified" : @(assertions[7])',
      '@"artifactsCleaned" : @(assertions[8])',
      'crypto_pwhash_ALG_ARGON2ID13',
      'crypto_secretstream_xchacha20poly1305_TAG_FINAL',
      'sodium_memzero',
      'NativeJournalArchiveCryptoSpecJSI',
    ],
    'synthetic iOS provider marker',
    failures,
  );

  requireMarkers(
    `${transportHeader}\n${transportSource}`,
    [
      'RunJournalArchiveFileTransportAssertions',
      'kMaximumSyntheticArchiveBytes = 4096',
      'journal-archive-transport-XXXXXX',
      'archive.sifia.part',
      'O_EXCL | O_CLOEXEC | O_NOFOLLOW',
      '::fsync(',
      '::rename(partial.c_str(), published.c_str())',
      'assertions[8]',
    ],
    'synthetic iOS file-transport assertion',
    failures,
  );

  const forbiddenBridgeSurface = [
    /encryptFile/i,
    /decryptFile/i,
    /sourcePath/i,
    /destinationPath/i,
    /customerData/i,
    /NSFileManager/,
    /putBoolean\("mobileProviderApproved",\s*true\)/,
    /@"mobileProviderApproved"\s*:\s*@YES/,
  ];
  for (const pattern of forbiddenBridgeSurface) {
    if (pattern.test(`${header}\n${moduleSource}`)) {
      failures.push(`premature iOS crypto surface is forbidden: ${pattern}`);
    }
  }
  for (const pattern of [/fopen\s*\(/, /std::filesystem/, /NSData\s*\*/]) {
    if (pattern.test(moduleSource)) {
      failures.push(`native customer/file surface is forbidden: ${pattern}`);
    }
  }
  for (const pattern of [/password/i, /passphrase/i, /customer/i]) {
    if (pattern.test(`${transportHeader}\n${transportSource}`)) {
      failures.push(`synthetic iOS transport accepted forbidden input: ${pattern}`);
    }
  }

  let integrity;
  try {
    integrity = JSON.parse(integritySource);
  } catch (error) {
    failures.push(`invalid iOS libsodium integrity manifest: ${error.message}`);
  }
  if (integrity) {
    const expected = {
      library: 'libsodium',
      version: '1.0.22',
      sourceSha256:
        'adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349',
      iosMinimumVersion: '15.1',
      buildProfile: 'portable-static-minimal-xcframework',
      argon2Implementation: 'reference',
      framework: 'Clibsodium.xcframework',
      license: 'LICENSE.libsodium',
      scope: 'journal-archive-synthetic-native-provider',
      mobileProviderApproved: false,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (integrity[key] !== value) {
        failures.push(`unexpected iOS libsodium integrity value: ${key}`);
      }
    }
    if (integrity.frameworkSha256 !== frameworkDigest.sha256) {
      failures.push('iOS libsodium XCFramework digest does not match INTEGRITY.json');
    }
    if (integrity.frameworkEntryCount !== frameworkDigest.entryCount) {
      failures.push('iOS libsodium XCFramework entry count does not match INTEGRITY.json');
    }
    if (integrity.licenseSha256 !== sha256(licenseBytes)) {
      failures.push('iOS libsodium license digest does not match INTEGRITY.json');
    }
  }

  return {approved: failures.length === 0, failures};
}

function main() {
  const readText = key => fs.readFileSync(path.join(root, paths[key]), 'utf8');
  const result = inspectIosProvider({
    podfile: readText('podfile'),
    podspec: readText('podspec'),
    header: readText('header'),
    moduleSource: readText('moduleSource'),
    transportHeader: readText('transportHeader'),
    transportSource: readText('transportSource'),
    integritySource: readText('integrity'),
    frameworkDigest: sha256Tree(path.join(root, paths.framework)),
    licenseBytes: fs.readFileSync(path.join(root, paths.license)),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.approved) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {inspectIosProvider, sha256Tree};
