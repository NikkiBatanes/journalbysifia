const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IOS_ARGON2_IMPLEMENTATION,
  IOS_BUILD_PROFILE,
  IOS_MIN_VERSION,
  REQUIRED_SYMBOLS,
  RETAINED_FRAMEWORK_NAME,
  RETAINED_INTEGRITY_NAME,
  RETAINED_LICENSE_NAME,
  assertRequiredAppleSymbols,
  parseIosArguments,
  validateXcframeworkInfo,
} = require('./run-journal-archive-libsodium-ios-artifact-spike.cjs');

function completeInfo() {
  return {
    AvailableLibraries: [
      {
        LibraryIdentifier: 'ios-arm64',
        LibraryPath: 'libsodium.a',
        SupportedArchitectures: ['arm64'],
        SupportedPlatform: 'ios',
      },
      {
        LibraryIdentifier: 'ios-arm64_x86_64-simulator',
        LibraryPath: 'libsodium.a',
        SupportedArchitectures: ['arm64', 'x86_64'],
        SupportedPlatform: 'ios',
        SupportedPlatformVariant: 'simulator',
      },
    ],
  };
}

test('pins the application iOS deployment floor', () => {
  assert.equal(IOS_MIN_VERSION, '15.1');
  assert.equal(IOS_BUILD_PROFILE, 'portable-static-minimal-xcframework');
  assert.equal(IOS_ARGON2_IMPLEMENTATION, 'reference');
  assert.equal(RETAINED_FRAMEWORK_NAME, 'Clibsodium.xcframework');
  assert.equal(RETAINED_LICENSE_NAME, 'LICENSE.libsodium');
  assert.equal(RETAINED_INTEGRITY_NAME, 'INTEGRITY.json');
});

test('parses an explicit retained-artifact directory', () => {
  const parsed = parseIosArguments([
    '--archive',
    '/tmp/libsodium.tar.gz',
    '--retain-dir',
    '/tmp/retained-ios-sodium',
  ]);
  assert.equal(parsed.archivePath, '/tmp/libsodium.tar.gz');
  assert.equal(parsed.retainDirectory, '/tmp/retained-ios-sodium');
  assert.throws(
    () => parseIosArguments(['--retain-dir']),
    /requires an exact destination/,
  );
});

test('requires device and dual-architecture simulator slices', () => {
  const result = validateXcframeworkInfo(completeInfo());
  assert.deepEqual(result.device.SupportedArchitectures, ['arm64']);
  assert.deepEqual(result.simulator.SupportedArchitectures, ['arm64', 'x86_64']);

  const incomplete = completeInfo();
  incomplete.AvailableLibraries[1].SupportedArchitectures = ['arm64'];
  assert.throws(() => validateXcframeworkInfo(incomplete), /x86_64 slice/);

  const mismatchedName = completeInfo();
  mismatchedName.AvailableLibraries[1].LibraryPath = 'libsodium-simulator.a';
  assert.throws(
    () => validateXcframeworkInfo(mismatchedName),
    /simulator binary must be named libsodium.a/,
  );
});

test('requires every selected symbol in Apple static libraries', () => {
  const output = REQUIRED_SYMBOLS.map((symbol, index) =>
    `${String(index + 1).padStart(16, '0')} T _${symbol}`
  ).join('\n');
  assert.doesNotThrow(() => assertRequiredAppleSymbols(output, 'device'));
  assert.throws(
    () => assertRequiredAppleSymbols(output.replace(REQUIRED_SYMBOLS[1], 'wrong'), 'simulator'),
    /missing required symbols/
  );
});
