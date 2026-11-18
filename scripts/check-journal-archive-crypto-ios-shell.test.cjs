const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  inspectIosProvider,
  sha256Tree,
} = require('./check-journal-archive-crypto-ios-shell.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath));
const frameworkPath = path.join(
  root,
  'ios/JournalArchiveCrypto/Vendor/Clibsodium.xcframework',
);
const sources = {
  podfile: read('ios/Podfile').toString('utf8'),
  podspec: read(
    'ios/JournalArchiveCrypto/JournalArchiveCrypto.podspec',
  ).toString('utf8'),
  header: read(
    'ios/JournalArchiveCrypto/Sources/JournalArchiveCrypto.h',
  ).toString('utf8'),
  moduleSource: read(
    'ios/JournalArchiveCrypto/Sources/JournalArchiveCrypto.mm',
  ).toString('utf8'),
  integritySource: read(
    'ios/JournalArchiveCrypto/Vendor/INTEGRITY.json',
  ).toString('utf8'),
  frameworkDigest: sha256Tree(frameworkPath),
  licenseBytes: read(
    'ios/JournalArchiveCrypto/Vendor/LICENSE.libsodium',
  ),
};

test('accepts the registered synthetic-only iOS provider', () => {
  assert.deepEqual(inspectIosProvider(sources), {
    approved: true,
    failures: [],
  });
});

test('rejects premature provider approval', () => {
  const result = inspectIosProvider({
    ...sources,
    moduleSource: sources.moduleSource.replace(
      '@"mobileProviderApproved" : @NO',
      '@"mobileProviderApproved" : @YES',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('premature iOS crypto surface'),
    ),
  );
});

test('rejects a customer file surface', () => {
  const result = inspectIosProvider({
    ...sources,
    header: `${sources.header}\n// encryptFile(sourcePath, destinationPath)`,
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('premature iOS crypto surface'),
    ),
  );
});

test('rejects missing Pod registration', () => {
  const result = inspectIosProvider({
    ...sources,
    podfile: sources.podfile.replace(
      "pod 'JournalArchiveCrypto', :path => './JournalArchiveCrypto'",
      '',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure => failure.includes('Pod registration')),
  );
});

test('rejects a changed retained XCFramework', () => {
  const result = inspectIosProvider({
    ...sources,
    frameworkDigest: {
      ...sources.frameworkDigest,
      sha256: '0'.repeat(64),
    },
  });
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('XCFramework digest')));
});

test('rejects a missing native assertion', () => {
  const result = inspectIosProvider({
    ...sources,
    moduleSource: sources.moduleSource.replace(
      '@"finalTagRequired" : @(assertions[6])',
      '@"finalTagRequired" : @NO',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure =>
      failure.includes('synthetic iOS provider marker'),
    ),
  );
});
