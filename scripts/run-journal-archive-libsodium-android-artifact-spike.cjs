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

async function main(argv = process.argv.slice(2), environment = process.env) {
  const {archivePath: suppliedArchivePath} = parseArguments(argv);
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
      verifiedAbis[abi] = {requiredSymbols: REQUIRED_SYMBOLS};
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
      artifactRetained: false,
      mobileProviderApproved: false,
      nextStep:
        'Prove the pinned iOS XCFramework, then integrate isolated TurboModules.',
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
  ANDROID_MIN_SDK,
  REQUIRED_SYMBOLS,
  assertRequiredSymbols,
  findLlvmNm,
  resolveNdkPath,
  validateAarEntries,
};
