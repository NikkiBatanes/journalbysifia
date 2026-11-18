const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  inspectPortableVectors,
  paths,
} = require('./check-journal-archive-crypto-portable-vectors.cjs');

const root = path.resolve(__dirname, '..');
const read = key => fs.readFileSync(path.join(root, paths[key]), 'utf8');
const sources = {
  fixtureSource: read('fixture'),
  host: read('host'),
  spec: read('spec'),
  devMenu: read('devMenu'),
  androidNative: read('androidNative'),
  androidModule: read('androidModule'),
  iosModule: read('iosModule'),
};

test('accepts the locked portable vector across host, Android and iOS', () => {
  const result = inspectPortableVectors(sources);
  assert.equal(result.approved, true, result.failures.join('\n'));
  assert.equal(result.vectorId, 'journal-archive-portable-v1');
  assert.equal(
    result.vectorSha256,
    '1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14',
  );
});

test('rejects changed canonical bytes', () => {
  const changed = JSON.parse(sources.fixtureSource);
  changed.vector.headerHex = `00${changed.vector.headerHex.slice(2)}`;
  const result = inspectPortableVectors({
    ...sources,
    fixtureSource: JSON.stringify(changed),
  });
  assert.equal(result.approved, false);
  assert.ok(result.failures.some(failure => failure.includes('digest mismatch')));
});

test('rejects platform byte drift', () => {
  const result = inspectPortableVectors({
    ...sources,
    androidNative: sources.androidNative.replace(
      '71ca27880bd58fc77fec42bbbaba42258ab3fd5c9367c490c15050380a8a397b',
      '00ca27880bd58fc77fec42bbbaba42258ab3fd5c9367c490c15050380a8a397b',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure => failure.includes('Android native provider')),
  );
});

test('rejects caller-controlled portable-vector input', () => {
  const result = inspectPortableVectors({
    ...sources,
    spec: sources.spec.replace(
      'runPortableVectorSelfTest()',
      'runPortableVectorSelfTest(sourcePath: string)',
    ),
  });
  assert.equal(result.approved, false);
  assert.ok(
    result.failures.some(failure => failure.includes('caller-controlled')),
  );
});
