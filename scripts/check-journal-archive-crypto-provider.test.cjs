const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assessJournalArchiveCryptoProvider,
  compareVersions,
  requiredProviderCapabilities,
  requiredRuntimeAssertions,
} = require('./check-journal-archive-crypto-provider.cjs');

const passingAssertions = names =>
  Object.fromEntries(names.map(name => [name, true]));

const approvedEvidence = {
  packageName: 'synthetic-reviewed-native-provider',
  packageVersion: '1.2.3',
  packageIntegrity: 'sha512-synthetic-test-integrity',
  license: 'ISC',
  libsodiumVersion: '1.0.22',
  libsodiumSourceVerified: true,
  capabilities: passingAssertions(requiredProviderCapabilities),
  runtime: {
    ios: {
      reactNativeVersion: '0.88.1',
      ...passingAssertions(requiredRuntimeAssertions),
    },
    android: {
      reactNativeVersion: '0.88.1',
      ...passingAssertions(requiredRuntimeAssertions),
    },
  },
};

test('compares exact semantic versions', () => {
  assert.equal(compareVersions('1.0.21', '1.0.22'), -1);
  assert.equal(compareVersions('1.0.22', '1.0.22'), 0);
  assert.equal(compareVersions('1.1.0', '1.0.22'), 1);
  assert.equal(compareVersions('1.0', '1.0.22'), null);
});

test('approves only complete synthetic provider and runtime evidence', () => {
  const result = assessJournalArchiveCryptoProvider(approvedEvidence);
  assert.equal(result.approved, true);
  assert.deepEqual(result.failures, []);
});

test('rejects missing evidence by default', () => {
  const result = assessJournalArchiveCryptoProvider(null);
  assert.equal(result.approved, false);
  assert.deepEqual(result.failures, [
    'No archive crypto provider evidence was supplied.',
  ]);
});

test('rejects an old or unaudited native dependency', () => {
  const result = assessJournalArchiveCryptoProvider({
    ...approvedEvidence,
    packageVersion: '^1.2.3',
    packageIntegrity: '',
    libsodiumVersion: '1.0.19',
    libsodiumSourceVerified: false,
  });

  assert.equal(result.approved, false);
  assert.match(result.failures.join('\n'), /exact semantic version/);
  assert.match(result.failures.join('\n'), /sha512 integrity/);
  assert.match(
    result.failures.join('\n'),
    /below the reviewed minimum 1\.0\.22/,
  );
  assert.match(result.failures.join('\n'), /source and release integrity/);
});

test('rejects missing native primitives and blocking Argon2id', () => {
  const result = assessJournalArchiveCryptoProvider({
    ...approvedEvidence,
    capabilities: {
      ...approvedEvidence.capabilities,
      secretstreamXChaCha20Poly1305: false,
      argon2idOffJsThread: false,
    },
  });

  assert.equal(result.approved, false);
  assert.match(
    result.failures.join('\n'),
    /secretstreamXChaCha20Poly1305 is missing/,
  );
  assert.match(result.failures.join('\n'), /argon2idOffJsThread is missing/);
});

test('rejects incomplete or wrong-version platform evidence', () => {
  const result = assessJournalArchiveCryptoProvider({
    ...approvedEvidence,
    runtime: {
      ...approvedEvidence.runtime,
      ios: {
        ...approvedEvidence.runtime.ios,
        reactNativeVersion: '0.83.0',
        truncatedStreamRejected: false,
      },
      android: null,
    },
  });

  assert.equal(result.approved, false);
  assert.match(
    result.failures.join('\n'),
    /iOS was not tested on React Native 0\.88\.1/,
  );
  assert.match(
    result.failures.join('\n'),
    /iOS runtime assertion truncatedStreamRejected has not passed/,
  );
  assert.match(
    result.failures.join('\n'),
    /Android runtime evidence is missing/,
  );
});
