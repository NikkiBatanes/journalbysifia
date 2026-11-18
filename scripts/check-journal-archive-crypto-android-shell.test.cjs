const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {inspectAndroidShell} = require('./check-journal-archive-crypto-android-shell.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const mainApplication = read('android/app/src/main/java/app/journal/sifia/MainApplication.kt');
const moduleSource = read(
  'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoModule.kt',
);
const packageSource = read(
  'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoPackage.kt',
);

test('accepts the registered fail-closed Android shell', () => {
  assert.deepEqual(inspectAndroidShell(mainApplication, moduleSource, packageSource), {
    approved: true,
    failures: [],
  });
});

test('rejects premature provider approval', () => {
  const changed = moduleSource.replace(
    'putBoolean("mobileProviderApproved", false)',
    'putBoolean("mobileProviderApproved", true)',
  );
  const result = inspectAndroidShell(mainApplication, changed, packageSource);
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('premature Android crypto surface')));
});

test('rejects a customer file surface', () => {
  const changed = `${moduleSource}\n// encryptFile(sourcePath, destinationPath, passphrase)`;
  const result = inspectAndroidShell(mainApplication, changed, packageSource);
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('premature Android crypto surface')));
});

test('rejects missing application registration', () => {
  const changed = mainApplication.replace('add(JournalArchiveCryptoPackage())', '');
  const result = inspectAndroidShell(changed, moduleSource, packageSource);
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('application registration')));
});
