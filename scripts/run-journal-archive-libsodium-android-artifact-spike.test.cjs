const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ANDROID_ABIS,
  ANDROID_MIN_SDK,
  REQUIRED_SYMBOLS,
  assertRequiredSymbols,
  resolveNdkPath,
  validateAarEntries,
} = require('./run-journal-archive-libsodium-android-artifact-spike.cjs');

function completeAarListing() {
  const entries = ['AndroidManifest.xml', 'prefab/prefab.json'];
  for (const abi of ANDROID_ABIS) {
    entries.push(
      `prefab/modules/sodium/libs/android.${abi}/abi.json`,
      `prefab/modules/sodium/libs/android.${abi}/libsodium.so`,
      `prefab/modules/sodium-static/libs/android.${abi}/libsodium-static.a`,
      `prefab/modules/sodium-minimal/libs/android.${abi}/libsodium.so`,
      `prefab/modules/sodium-minimal-static/libs/android.${abi}/libsodium-minimal-static.a`
    );
  }
  return `${entries.join('\n')}\n`;
}

test('pins the app Android floor and all supported ABIs', () => {
  assert.equal(ANDROID_MIN_SDK, 24);
  assert.deepEqual(ANDROID_ABIS, ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']);
});

test('requires an explicit Android NDK directory', () => {
  assert.throws(() => resolveNdkPath({}), /ANDROID_NDK_HOME/);
  assert.equal(
    resolveNdkPath({ANDROID_NDK_ROOT: '/tmp/reviewed-ndk'}),
    '/tmp/reviewed-ndk'
  );
});

test('accepts only an AAR containing every required ABI and Prefab module', () => {
  assert.equal(validateAarEntries(completeAarListing()), 22);
  assert.throws(
    () =>
      validateAarEntries(
        completeAarListing().replace('libsodium.so', 'missing.so')
      ),
    /missing required entries/
  );
});

test('requires every selected cryptographic symbol in each shared library', () => {
  const output = REQUIRED_SYMBOLS.map(
    (symbol, index) => `${String(index + 1).padStart(8, '0')} T ${symbol}`
  ).join('\n');
  assert.doesNotThrow(() => assertRequiredSymbols(output, 'arm64-v8a'));
  assert.throws(
    () =>
      assertRequiredSymbols(
        output.replace(REQUIRED_SYMBOLS[0], 'wrong_symbol'),
        'x86'
      ),
    /missing required symbols/
  );
});
