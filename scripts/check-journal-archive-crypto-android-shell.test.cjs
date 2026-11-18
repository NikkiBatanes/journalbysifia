const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  inspectAndroidProvider,
} = require('./check-journal-archive-crypto-android-shell.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath));
const sources = {
  mainApplication: read(
    'android/app/src/main/java/app/journal/sifia/MainApplication.kt',
  ).toString('utf8'),
  moduleSource: read(
    'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoModule.kt',
  ).toString('utf8'),
  packageSource: read(
    'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoPackage.kt',
  ).toString('utf8'),
  buildSource: read('android/app/build.gradle').toString('utf8'),
  cmakeSource: read('android/app/src/main/jni/CMakeLists.txt').toString('utf8'),
  nativeSource: read(
    'android/app/src/main/cpp/journal_archive_crypto.cpp',
  ).toString('utf8'),
  integritySource: read(
    'android/app/libs/journal-archive-libsodium/INTEGRITY.json',
  ).toString('utf8'),
  aarBytes: read(
    'android/app/libs/journal-archive-libsodium/libsodium-1.0.22.0.aar',
  ),
  licenseBytes: read(
    'android/app/libs/journal-archive-libsodium/LICENSE.libsodium',
  ),
};

test('accepts the registered synthetic-only Android provider', () => {
  assert.deepEqual(inspectAndroidProvider(sources), {
    approved: true,
    failures: [],
  });
});

test('rejects premature provider approval', () => {
  const result = inspectAndroidProvider({
    ...sources,
    moduleSource: sources.moduleSource.replace(
      'putBoolean("mobileProviderApproved", false)',
      'putBoolean("mobileProviderApproved", true)',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('premature Android crypto surface'),
    ),
  );
});

test('rejects a customer file surface', () => {
  const result = inspectAndroidProvider({
    ...sources,
    moduleSource: `${sources.moduleSource}\n// encryptFile(sourcePath, destinationPath, passphrase)`,
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('premature Android crypto surface'),
    ),
  );
});

test('rejects missing application registration', () => {
  const result = inspectAndroidProvider({
    ...sources,
    mainApplication: sources.mainApplication.replace(
      'add(JournalArchiveCryptoPackage())',
      '',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('application registration'),
    ),
  );
});

test('rejects a changed retained AAR', () => {
  const result = inspectAndroidProvider({
    ...sources,
    aarBytes: Buffer.concat([sources.aarBytes, Buffer.from('changed')]),
  });
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('AAR digest')));
});

test('rejects a missing native assertion', () => {
  const result = inspectAndroidProvider({
    ...sources,
    nativeSource: sources.nativeSource.replaceAll('assertions[6]', 'assertionSix'),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('synthetic native assertion'),
    ),
  );
});
