const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ANDROID_ABIS,
  ANDROID_ARGON2_IMPLEMENTATION,
  ANDROID_BUILD_PROFILE,
  ANDROID_MIN_SDK,
  REQUIRED_SYMBOLS,
  RETAINED_AAR_NAME,
  RETAINED_LICENSE_NAME,
  applyPortableAndroidBuildProfile,
  assertNoUndefinedInternalSymbols,
  assertRequiredSymbols,
  parseAndroidArguments,
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
  assert.equal(
    ANDROID_BUILD_PROFILE,
    'portable-no-cpu-specific-implementations'
  );
  assert.equal(ANDROID_ARGON2_IMPLEMENTATION, 'reference');
});

test('rejects shared libraries with unresolved libsodium implementation symbols', () => {
  assert.doesNotThrow(() =>
    assertNoUndefinedInternalSymbols('                 U memcpy\n', 'arm64-v8a')
  );
  assert.throws(
    () =>
      assertNoUndefinedInternalSymbols(
        '                 U aegis128l_armcrypto_implementation\n',
        'arm64-v8a'
      ),
    /unresolved internal symbols/
  );
  assert.throws(
    () =>
      assertNoUndefinedInternalSymbols(
        '                 U argon2_fill_segment_avx2\n',
        'x86_64'
      ),
    /unresolved internal symbols/
  );
});

test('applies the reviewed portable build profile to exact upstream scripts', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sodium-profile-test-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const distBuild = path.join(root, 'dist-build');
  const argon2Directory = path.join(
    root,
    'src',
    'libsodium',
    'crypto_pwhash',
    'argon2'
  );
  await fs.mkdir(distBuild);
  await fs.mkdir(argon2Directory, {recursive: true});
  await fs.writeFile(
    path.join(root, 'configure'),
    'if test "x$EMSCRIPTEN" = "x"\nthen :\n\n\n  if test "x$target_cpu_aarch64" = "xyes"\n'
  );
  await fs.writeFile(
    path.join(distBuild, 'android-build.sh'),
    './configure \\\n  --disable-soname-versions\n'
  );
  await fs.writeFile(
    path.join(distBuild, 'android-armv8-a.sh'),
    'export CFLAGS="-Os -march=${TARGET_ARCH}"\n'
  );
  await fs.writeFile(
    path.join(distBuild, 'android-x86_64.sh'),
    'export CFLAGS="-Os -march=${TARGET_ARCH}"\n'
  );
  const argon2Condition = [
    '#if (defined(__aarch64__) || defined(_M_ARM64)) && \\',
    '    (defined(__ARM_NEON) || defined(__ARM_NEON__))',
  ].join('\n');
  await fs.writeFile(
    path.join(argon2Directory, 'argon2-core.c'),
    `${argon2Condition}\nfirst\n${argon2Condition}\nsecond\n`
  );

  await applyPortableAndroidBuildProfile(root);

  assert.match(
    await fs.readFile(path.join(root, 'configure'), 'utf8'),
    /test "\$enable_asm" != "no"/
  );
  assert.match(
    await fs.readFile(path.join(distBuild, 'android-build.sh'), 'utf8'),
    /--disable-asm/
  );
  assert.match(
    await fs.readFile(path.join(distBuild, 'android-armv8-a.sh'), 'utf8'),
    /-march=armv8-a"/
  );
  assert.match(
    await fs.readFile(path.join(distBuild, 'android-x86_64.sh'), 'utf8'),
    /-march=x86-64"/
  );
  const argon2Core = await fs.readFile(
    path.join(argon2Directory, 'argon2-core.c'),
    'utf8'
  );
  assert.equal(
    argon2Core.match(/JOURNAL_ARCHIVE_ENABLE_LIBSODIUM_NEON/g)?.length,
    2
  );
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

test('retention requires an exact new destination and fixed artifact names', () => {
  assert.deepEqual(parseAndroidArguments([]), {
    archivePath: null,
    retainDirectory: null,
  });
  assert.throws(
    () => parseAndroidArguments(['--retain-dir']),
    /exact destination directory/,
  );
  assert.equal(
    parseAndroidArguments(['--retain-dir', '/tmp/reviewed-libsodium'])
      .retainDirectory,
    '/tmp/reviewed-libsodium',
  );
  assert.equal(RETAINED_AAR_NAME, 'libsodium-1.0.22.0.aar');
  assert.equal(RETAINED_LICENSE_NAME, 'LICENSE.libsodium');
});
