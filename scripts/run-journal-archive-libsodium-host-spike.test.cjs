const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIBSODIUM_ARCHIVE_ROOT,
  LIBSODIUM_ARCHIVE_SHA256,
  LIBSODIUM_RELEASE_URL,
  LIBSODIUM_VERSION,
  assertExpectedHash,
  parseArguments,
  validateArchiveEntries,
} = require('./run-journal-archive-libsodium-host-spike.cjs');

test('pins the reviewed official libsodium release and digest', () => {
  assert.equal(LIBSODIUM_VERSION, '1.0.22');
  assert.equal(
    LIBSODIUM_RELEASE_URL,
    'https://github.com/jedisct1/libsodium/releases/download/1.0.22-RELEASE/libsodium-1.0.22.tar.gz',
  );
  assert.equal(
    LIBSODIUM_ARCHIVE_SHA256,
    'adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349',
  );
  assert.doesNotThrow(() => assertExpectedHash(LIBSODIUM_ARCHIVE_SHA256));
});

test('rejects a source archive with the wrong digest', () => {
  assert.throws(
    () => assertExpectedHash('0'.repeat(64)),
    /archive SHA-256 mismatch/,
  );
});

test('accepts only entries rooted in the pinned release directory', () => {
  const count = validateArchiveEntries(
    `${LIBSODIUM_ARCHIVE_ROOT}/\n${LIBSODIUM_ARCHIVE_ROOT}/src/libsodium/sodium/core.c\n`,
  );
  assert.equal(count, 2);
  assert.throws(
    () => validateArchiveEntries(`${LIBSODIUM_ARCHIVE_ROOT}/../escape\n`),
    /unsafe or unexpected archive entry/,
  );
  assert.throws(
    () => validateArchiveEntries('/absolute/path\n'),
    /unsafe or unexpected archive entry/,
  );
  assert.throws(
    () => validateArchiveEntries('different-root/file.c\n'),
    /unsafe or unexpected archive entry/,
  );
});

test('parses an explicit local archive without accepting a missing value', () => {
  assert.deepEqual(parseArguments([]), {archivePath: null});
  assert.equal(
    parseArguments(['--archive', './libsodium.tar.gz']).archivePath.endsWith(
      '/libsodium.tar.gz',
    ),
    true,
  );
  assert.throws(() => parseArguments(['--archive']), /requires an exact local/);
});
