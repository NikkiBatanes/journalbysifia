const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {inspectContract} = require('./check-journal-archive-crypto-turbomodule-contract.cjs');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const spec = fs.readFileSync(path.join(root, 'src/native/NativeJournalArchiveCrypto.ts'), 'utf8');

test('accepts the synthetic-only TurboModule contract', () => {
  assert.deepEqual(inspectContract(packageJson, spec), {approved: true, failures: []});
});

test('rejects a customer file-encryption surface before provider approval', () => {
  const changed = `${spec}\n// encryptFile(sourcePath, destinationPath)`;
  const result = inspectContract(packageJson, changed);
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('customer-data surface')));
});

test('rejects Android and iOS codegen drift', () => {
  const changed = JSON.parse(JSON.stringify(packageJson));
  changed.codegenConfig.android.javaPackageName = 'app.journal.sifia.wrong';
  changed.codegenConfig.ios.modules.JournalArchiveCrypto.className = 'WrongClass';
  const result = inspectContract(changed, spec);
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('codegenConfig')));
});
