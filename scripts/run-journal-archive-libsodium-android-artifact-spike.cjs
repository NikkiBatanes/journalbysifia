#!/usr/bin/env node

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  LIBSODIUM_ARCHIVE_ROOT,
  LIBSODIUM_ARCHIVE_SHA256,
  LIBSODIUM_RELEASE_URL,
  LIBSODIUM_VERSION,
  MAX_ARCHIVE_BYTES,
  assertExpectedHash,
  downloadVerifiedArchive,
  parseArguments,
  run,
  sha256File,
  validateArchiveEntries,
} = require('./run-journal-archive-libsodium-host-spike.cjs');

const ANDROID_MIN_SDK = 24;
const ANDROID_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const REQUIRED_SYMBOLS = [
  'crypto_pwhash_argon2id',
  'crypto_secretstream_xchacha20poly1305_init_push',
  'randombytes_buf',
  'sodium_memzero',
];
const RETAINED_AAR_NAME = `libsodium-${LIBSODIUM_VERSION}.0.aar`;
const RETAINED_LICENSE_NAME = 'LICENSE.libsodium';
const ANDROID_BUILD_PROFILE = 'portable-no-cpu-specific-implementations';
const ANDROID_ARGON2_IMPLEMENTATION = 'reference';
const INTERNAL_UNDEFINED_SYMBOL = /^(?:(?:aegis128l|aegis256|ipcrypt)_[A-Za-z0-9_]*_implementation|argon2_fill_segment_[A-Za-z0-9_]+)$/;

function parseAndroidArguments(argv) {
  const {archivePath} = parseArguments(argv);
  const retainIndex = argv.indexOf('--retain-dir');
  if (retainIndex === -1) {
    return {archivePath, retainDirectory: null};
  }
  const retainDirectory = argv[retainIndex + 1];
  if (!retainDirectory || retainDirectory.startsWith('--')) {
    throw new Error('--retain-dir requires an exact destination directory');
  }
  return {archivePath, retainDirectory: path.resolve(retainDirectory)};
}

function resolveNdkPath(environment = process.env) {
  const candidate =
    environment.ANDROID_NDK_HOME || environment.ANDROID_NDK_ROOT;
  if (!candidate) {
    throw new Error(
      'Set ANDROID_NDK_HOME to the reviewed Android NDK directory'
    );
  }
  return path.resolve(candidate);
}

function validateAarEntries(listing) {
  const entries = new Set(listing.split('\n').filter(Boolean));
  const required = ['AndroidManifest.xml', 'prefab/prefab.json'];
  for (const abi of ANDROID_ABIS) {
    required.push(
      `prefab/modules/sodium/libs/android.${abi}/abi.json`,
      `prefab/modules/sodium/libs/android.${abi}/libsodium.so`,
      `prefab/modules/sodium-static/libs/android.${abi}/libsodium-static.a`,
      `prefab/modules/sodium-minimal/libs/android.${abi}/libsodium.so`,
      `prefab/modules/sodium-minimal-static/libs/android.${abi}/libsodium-minimal-static.a`
    );
  }
  const missing = required.filter(entry => !entries.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `Android AAR is missing required entries: ${missing.join(', ')}`
    );
  }
  return entries.size;
}

async function findLlvmNm(ndkPath) {
  const prebuiltPath = path.join(ndkPath, 'toolchains', 'llvm', 'prebuilt');
  const prebuilts = await fsPromises.readdir(prebuiltPath, {
    withFileTypes: true,
  });
  for (const prebuilt of prebuilts) {
    if (!prebuilt.isDirectory()) {
      continue;
    }
    const candidate = path.join(prebuiltPath, prebuilt.name, 'bin', 'llvm-nm');
    try {
      await fsPromises.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue to the next host prebuilt.
    }
  }
  throw new Error(
    'The selected Android NDK does not contain an executable llvm-nm'
  );
}

function assertRequiredSymbols(nmOutput, abi) {
  const present = new Set(
    nmOutput
      .split('\n')
      .map(line => line.trim().split(/\s+/).at(-1))
      .filter(Boolean)
  );
  const missing = REQUIRED_SYMBOLS.filter(symbol => !present.has(symbol));
  if (missing.length > 0) {
    throw new Error(
      `${abi} libsodium.so is missing required symbols: ${missing.join(', ')}`
    );
  }
}

function assertNoUndefinedInternalSymbols(nmOutput, abi) {
  const undefinedInternalSymbols = nmOutput
    .split('\n')
    .map(line => line.trim().split(/\s+/).at(-1))
    .filter(symbol => symbol && INTERNAL_UNDEFINED_SYMBOL.test(symbol));
  if (undefinedInternalSymbols.length > 0) {
    throw new Error(
      `${abi} libsodium.so has unresolved internal symbols: ${[
        ...new Set(undefinedInternalSymbols),
      ].join(', ')}`
    );
  }
}

function replaceExactOnce(source, expected, replacement, label) {
  const firstIndex = source.indexOf(expected);
  if (firstIndex === -1 || source.indexOf(expected, firstIndex + 1) !== -1) {
    throw new Error(`Unable to apply the reviewed ${label} source patch`);
  }
  return source.replace(expected, replacement);
}

function replaceExactCount(source, expected, replacement, count, label) {
  const occurrences = source.split(expected).length - 1;
  if (occurrences !== count) {
    throw new Error(`Unable to apply the reviewed ${label} source patch`);
  }
  return source.split(expected).join(replacement);
}

async function applyPortableAndroidBuildProfile(sourcePath) {
  const configurePath = path.join(sourcePath, 'configure');
  const buildScriptPath = path.join(sourcePath, 'dist-build', 'android-build.sh');
  const arm64ScriptPath = path.join(
    sourcePath,
    'dist-build',
    'android-armv8-a.sh'
  );
  const x86_64ScriptPath = path.join(
    sourcePath,
    'dist-build',
    'android-x86_64.sh'
  );
  const argon2CorePath = path.join(
    sourcePath,
    'src',
    'libsodium',
    'crypto_pwhash',
    'argon2',
    'argon2-core.c'
  );

  const configure = replaceExactOnce(
    await fsPromises.readFile(configurePath, 'utf8'),
    'if test "x$EMSCRIPTEN" = "x"\nthen :\n\n\n  if test "x$target_cpu_aarch64" = "xyes"',
    'if test "x$EMSCRIPTEN" = "x" && test "$enable_asm" != "no"\nthen :\n\n\n  if test "x$target_cpu_aarch64" = "xyes"',
    'CPU-specific implementation guard'
  );
  const buildScript = replaceExactOnce(
    await fsPromises.readFile(buildScriptPath, 'utf8'),
    './configure \\\n  --disable-soname-versions',
    './configure \\\n  --disable-asm \\\n  --disable-soname-versions',
    'portable configure'
  );
  const arm64Script = replaceExactOnce(
    await fsPromises.readFile(arm64ScriptPath, 'utf8'),
    'export CFLAGS="-Os -march=${TARGET_ARCH}"',
    'export CFLAGS="-Os -march=armv8-a"',
    'baseline arm64 compiler target'
  );
  const x86_64Script = replaceExactOnce(
    await fsPromises.readFile(x86_64ScriptPath, 'utf8'),
    'export CFLAGS="-Os -march=${TARGET_ARCH}"',
    'export CFLAGS="-Os -march=x86-64"',
    'baseline x86_64 compiler target'
  );
  const argon2NeonCondition = [
    '#if (defined(__aarch64__) || defined(_M_ARM64)) && \\',
    '    (defined(__ARM_NEON) || defined(__ARM_NEON__))',
  ].join('\n');
  const portableArgon2Condition = [
    '#if defined(JOURNAL_ARCHIVE_ENABLE_LIBSODIUM_NEON) && \\',
    '    (defined(__aarch64__) || defined(_M_ARM64)) && \\',
    '    (defined(__ARM_NEON) || defined(__ARM_NEON__))',
  ].join('\n');
  const argon2Core = replaceExactCount(
    await fsPromises.readFile(argon2CorePath, 'utf8'),
    argon2NeonCondition,
    portableArgon2Condition,
    2,
    'portable Argon2 implementation'
  );

  await Promise.all([
    fsPromises.writeFile(configurePath, configure),
    fsPromises.writeFile(buildScriptPath, buildScript),
    fsPromises.writeFile(arm64ScriptPath, arm64Script),
    fsPromises.writeFile(x86_64ScriptPath, x86_64Script),
    fsPromises.writeFile(argon2CorePath, argon2Core),
  ]);
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  const {archivePath: suppliedArchivePath, retainDirectory} =
    parseAndroidArguments(argv);
  const ndkPath = resolveNdkPath(environment);
  const ndkPropertiesPath = path.join(ndkPath, 'source.properties');
  const ndkProperties = await fsPromises.readFile(ndkPropertiesPath, 'utf8');
  const ndkRevision = ndkProperties
    .match(/^Pkg\.Revision\s*=\s*(.+)$/m)?.[1]
    ?.trim();
  if (!ndkRevision) {
    throw new Error('The selected Android NDK has no auditable Pkg.Revision');
  }

  const workspace = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), 'journal-archive-libsodium-android-artifact-spike-')
  );
  const archivePath =
    suppliedArchivePath ||
    path.join(workspace, `libsodium-${LIBSODIUM_VERSION}.tar.gz`);

  try {
    if (!suppliedArchivePath) {
      process.stderr.write(
        `Downloading pinned libsodium ${LIBSODIUM_VERSION} source from the official release...\n`
      );
      await downloadVerifiedArchive(archivePath);
    }
    const archiveStats = await fsPromises.stat(archivePath);
    if (
      !archiveStats.isFile() ||
      archiveStats.size === 0 ||
      archiveStats.size > MAX_ARCHIVE_BYTES
    ) {
      throw new Error(
        'libsodium archive is missing, empty, or exceeds the size bound'
      );
    }
    assertExpectedHash(await sha256File(archivePath));
    const sourceListing = run('tar', ['-tzf', archivePath], {capture: true});
    const sourceEntryCount = validateArchiveEntries(sourceListing);
    run('tar', ['-xzf', archivePath, '-C', workspace], {capture: true});

    const sourcePath = path.join(workspace, LIBSODIUM_ARCHIVE_ROOT);
    await applyPortableAndroidBuildProfile(sourcePath);
    run('./dist-build/android-aar.sh', [], {
      capture: true,
      cwd: sourcePath,
      env: {
        ...environment,
        ANDROID_NDK_HOME: ndkPath,
        NDK_PLATFORM: `android-${ANDROID_MIN_SDK}`,
      },
    });

    const aarPath = path.join(
      sourcePath,
      `libsodium-${LIBSODIUM_VERSION}.0.aar`
    );
    const aarStats = await fsPromises.stat(aarPath);
    if (!aarStats.isFile() || aarStats.size === 0) {
      throw new Error(
        'The official Android build did not produce a non-empty AAR'
      );
    }
    const aarListing = run('unzip', ['-Z1', aarPath], {capture: true});
    const aarEntryCount = validateAarEntries(aarListing);
    const extractedAarPath = path.join(workspace, 'aar');
    await fsPromises.mkdir(extractedAarPath);
    run('unzip', ['-q', aarPath, '-d', extractedAarPath], {capture: true});

    const llvmNmPath = await findLlvmNm(ndkPath);
    const verifiedAbis = {};
    for (const abi of ANDROID_ABIS) {
      const libraryPath = path.join(
        extractedAarPath,
        'prefab',
        'modules',
        'sodium',
        'libs',
        `android.${abi}`,
        'libsodium.so'
      );
      const nmOutput = run(llvmNmPath, ['-D', '--defined-only', libraryPath], {
        capture: true,
      });
      assertRequiredSymbols(nmOutput, abi);
      const undefinedOutput = run(
        llvmNmPath,
        ['-D', '--undefined-only', libraryPath],
        {capture: true}
      );
      assertNoUndefinedInternalSymbols(undefinedOutput, abi);
      verifiedAbis[abi] = {
        requiredSymbols: REQUIRED_SYMBOLS,
        unresolvedInternalSymbols: [],
      };
    }

    let retainedArtifact = null;
    if (retainDirectory) {
      const parentDirectory = path.dirname(retainDirectory);
      const parentStats = await fsPromises.stat(parentDirectory);
      if (!parentStats.isDirectory()) {
        throw new Error('The retained-artifact parent must be a directory');
      }
      try {
        await fsPromises.mkdir(retainDirectory);
      } catch (error) {
        if (error?.code === 'EEXIST') {
          throw new Error(
            'Refusing to replace an existing retained-artifact directory'
          );
        }
        throw error;
      }

      try {
        const retainedAarPath = path.join(retainDirectory, RETAINED_AAR_NAME);
        const retainedLicensePath = path.join(
          retainDirectory,
          RETAINED_LICENSE_NAME
        );
        await fsPromises.copyFile(
          aarPath,
          retainedAarPath,
          fs.constants.COPYFILE_EXCL
        );
        await fsPromises.copyFile(
          path.join(sourcePath, 'LICENSE'),
          retainedLicensePath,
          fs.constants.COPYFILE_EXCL
        );
        retainedArtifact = {
          directory: retainDirectory,
          aar: RETAINED_AAR_NAME,
          aarSha256: await sha256File(retainedAarPath),
          license: RETAINED_LICENSE_NAME,
        };
      } catch (error) {
        await fsPromises.rm(retainDirectory, {recursive: true, force: true});
        throw error;
      }
    }

    const result = {
      source: {
        version: LIBSODIUM_VERSION,
        releaseUrl: LIBSODIUM_RELEASE_URL,
        sha256: LIBSODIUM_ARCHIVE_SHA256,
        archiveEntryCount: sourceEntryCount,
        integrityVerified: true,
      },
      androidArtifactEvidence: {
        minSdk: ANDROID_MIN_SDK,
        ndkRevision,
        buildProfile: ANDROID_BUILD_PROFILE,
        argon2Implementation: ANDROID_ARGON2_IMPLEMENTATION,
        aarEntryCount,
        aarBytes: aarStats.size,
        prefabModules: [
          'sodium',
          'sodium-static',
          'sodium-minimal',
          'sodium-minimal-static',
        ],
        verifiedAbis,
      },
      scope: 'synthetic-android-artifact-spike-only',
      artifactRetained: retainedArtifact !== null,
      retainedArtifact,
      mobileProviderApproved: false,
      nextStep:
        'Use only behind the synthetic provider gate; do not expose customer-data methods.',
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await fsPromises.rm(workspace, {recursive: true, force: true});
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
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
  findLlvmNm,
  parseAndroidArguments,
  resolveNdkPath,
  validateAarEntries,
};
