#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const paths = {
  fixture: 'security/journal-archive-crypto/portable-v1.json',
  host: 'scripts/journal-archive-libsodium-host-spike.c',
  spec: 'src/native/NativeJournalArchiveCrypto.ts',
  devMenu: 'src/dev/installJournalEncryptedStorageSpikeMenu.ts',
  androidNative: 'android/app/src/main/cpp/journal_archive_crypto.cpp',
  androidModule:
    'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoModule.kt',
  iosModule: 'ios/JournalArchiveCrypto/Sources/JournalArchiveCrypto.mm',
};

const sha256 = value =>
  crypto.createHash('sha256').update(value).digest('hex');

function requireMarker(source, marker, label, failures) {
  if (!source.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function inspectPortableVectors(sources) {
  const failures = [];
  const {
    fixtureSource,
    host,
    spec,
    devMenu,
    androidNative,
    androidModule,
    iosModule,
  } = sources;
  let fixture;
  try {
    fixture = JSON.parse(fixtureSource);
  } catch (error) {
    return {approved: false, failures: [`invalid portable vector JSON: ${error.message}`]};
  }

  if (
    fixture.schema !== 'app.journal.sifia.archive-crypto-portable-vector' ||
    fixture.schemaVersion !== 1 ||
    fixture.source?.library !== 'libsodium' ||
    fixture.source?.version !== '1.0.22' ||
    fixture.source?.sourceSha256 !==
      'adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349'
  ) {
    failures.push('portable vector source metadata differs from the reviewed provider');
  }

  const vector = fixture.vector || {};
  const canonicalDigest = sha256(JSON.stringify(vector));
  if (canonicalDigest !== fixture.vectorSha256) {
    failures.push('portable vector canonical digest mismatch');
  }
  if (fixture.vectorSha256 !==
      '1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14') {
    failures.push('portable vector v1 digest is not the reviewed digest');
  }
  if (
    vector.id !== 'journal-archive-portable-v1' ||
    vector.algorithm !== 'secretstream-xchacha20poly1305' ||
    vector.kdf !== 'argon2id13' ||
    vector.opslimit !== 2 ||
    vector.memlimit !== 67108864
  ) {
    failures.push('portable vector algorithm or KDF parameters changed');
  }

  const expectedByteLengths = [
    ['saltHex', vector.saltHex, 16],
    ['keyHex', vector.keyHex, 32],
    ['headerHex', vector.headerHex, 24],
  ];
  for (const [label, hex, byteLength] of expectedByteLengths) {
    if (typeof hex !== 'string' || !/^[0-9a-f]+$/.test(hex) || hex.length !== byteLength * 2) {
      failures.push(`${label} is not ${byteLength} canonical bytes`);
    }
  }
  if (
    !Array.isArray(vector.plaintextChunksHex) ||
    !Array.isArray(vector.ciphertextChunksHex) ||
    vector.plaintextChunksHex.length !== 3 ||
    vector.ciphertextChunksHex.length !== 3 ||
    JSON.stringify(vector.tags) !== JSON.stringify(['message', 'message', 'final'])
  ) {
    failures.push('portable vector framing differs from three ordered final-tagged chunks');
  } else {
    for (let index = 0; index < 3; index += 1) {
      const plaintext = vector.plaintextChunksHex[index];
      const ciphertext = vector.ciphertextChunksHex[index];
      if (
        !/^[0-9a-f]+$/.test(plaintext) ||
        !/^[0-9a-f]+$/.test(ciphertext) ||
        ciphertext.length / 2 !== plaintext.length / 2 + 17
      ) {
        failures.push(`portable vector chunk ${index} has invalid authenticated length`);
      }
    }
  }

  const nativeValues = [
    vector.passwordUtf8,
    vector.saltHex,
    vector.keyHex,
    vector.headerHex,
    ...(vector.plaintextChunksHex || []),
    ...(vector.ciphertextChunksHex || []),
  ];
  for (const value of nativeValues) {
    for (const [label, source] of [
      ['Android native provider', androidNative],
      ['iOS native provider', iosModule],
    ]) {
      requireMarker(source, value, label, failures);
    }
  }
  for (const marker of [
    vector.id,
    vector.passwordUtf8,
    vector.algorithm,
    vector.kdf,
    'portableVector',
    'crypto_secretstream_xchacha20poly1305_init_pull',
  ]) {
    requireMarker(host, marker, 'host vector generator', failures);
  }

  for (const [label, source] of [
    ['Android module', androidModule],
    ['iOS module', iosModule],
    ['development diagnostic', devMenu],
  ]) {
    requireMarker(source, vector.id, label, failures);
    requireMarker(source, fixture.vectorSha256, label, failures);
  }

  const contractMarkers = [
    'runPortableVectorSelfTest(): Promise<JournalArchiveCryptoPortableVectorEvidence>',
    'derivedKeyMatches: boolean',
    'ciphertextMatches: boolean',
    'decryptMatches: boolean',
    'tamperAndTruncationRejected: boolean',
  ];
  for (const marker of contractMarkers) {
    requireMarker(spec, marker, 'portable-vector TurboModule contract', failures);
  }
  for (const [label, source] of [
    ['Android native provider', androidNative],
    ['iOS native provider', iosModule],
  ]) {
    requireMarker(
      source,
      'crypto_secretstream_xchacha20poly1305_init_push',
      `${label} randomized production primitive`,
      failures,
    );
    requireMarker(
      source,
      'fixedSyntheticHeader',
      `${label} fixed-vector isolation`,
      failures,
    );
    requireMarker(
      source,
      'crypto_secretstream_xchacha20poly1305_init_pull',
      `${label} portable vector initialization`,
      failures,
    );
  }

  if (!/runPortableVectorSelfTest\(\): Promise</.test(spec)) {
    failures.push('portable-vector bridge must accept no caller-controlled input');
  }
  for (const pattern of [
    /runPortableVectorSelfTest\([^)]{1,}\)/,
    /portable.*(?:sourcePath|destinationPath|customerData)/i,
  ]) {
    if (pattern.test(spec)) {
      failures.push(`portable-vector contract exposes forbidden caller input: ${pattern}`);
    }
  }

  return {approved: failures.length === 0, failures, vectorId: vector.id, vectorSha256: fixture.vectorSha256};
}

function main() {
  const read = key => fs.readFileSync(path.join(root, paths[key]), 'utf8');
  const result = inspectPortableVectors({
    fixtureSource: read('fixture'),
    host: read('host'),
    spec: read('spec'),
    devMenu: read('devMenu'),
    androidNative: read('androidNative'),
    androidModule: read('androidModule'),
    iosModule: read('iosModule'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.approved) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {inspectPortableVectors, paths};
