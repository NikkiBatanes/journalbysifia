const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IOS_MIN_VERSION,
  REQUIRED_SYMBOLS,
  assertRequiredAppleSymbols,
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
        LibraryPath: 'libsodium-simulator.a',
        SupportedArchitectures: ['arm64', 'x86_64'],
        SupportedPlatform: 'ios',
        SupportedPlatformVariant: 'simulator',
      },
    ],
  };
}

test('pins the application iOS deployment floor', () => {
  assert.equal(IOS_MIN_VERSION, '15.1');
});

test('requires device and dual-architecture simulator slices', () => {
  const result = validateXcframeworkInfo(completeInfo());
  assert.deepEqual(result.device.SupportedArchitectures, ['arm64']);
  assert.deepEqual(result.simulator.SupportedArchitectures, ['arm64', 'x86_64']);

  const incomplete = completeInfo();
  incomplete.AvailableLibraries[1].SupportedArchitectures = ['arm64'];
  assert.throws(() => validateXcframeworkInfo(incomplete), /x86_64 slice/);
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
