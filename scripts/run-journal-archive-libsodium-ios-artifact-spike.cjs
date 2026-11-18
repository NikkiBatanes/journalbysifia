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

const IOS_MIN_VERSION = '15.1';
const REQUIRED_SYMBOLS = [
  'crypto_pwhash_argon2id',
  'crypto_secretstream_xchacha20poly1305_init_push',
  'randombytes_buf',
  'sodium_memzero',
];

function assertRequiredAppleSymbols(nmOutput, platform) {
  const present = new Set(
    nmOutput
      .split('\n')
      .map(line => line.trim().split(/\s+/).at(-1)?.replace(/^_/, ''))
      .filter(Boolean)
  );
  const missing = REQUIRED_SYMBOLS.filter(symbol => !present.has(symbol));
  if (missing.length > 0) {
    throw new Error(`${platform} libsodium.a is missing required symbols: ${missing.join(', ')}`);
  }
}

function validateXcframeworkInfo(info) {
  const libraries = info.AvailableLibraries;
  if (!Array.isArray(libraries)) {
    throw new Error('XCFramework Info.plist has no AvailableLibraries array');
  }
  const device = libraries.find(
    item =>
      item.SupportedPlatform === 'ios' &&
      item.SupportedPlatformVariant === undefined
  );
  const simulator = libraries.find(
    item =>
      item.SupportedPlatform === 'ios' &&
      item.SupportedPlatformVariant === 'simulator'
  );
  if (!device || !device.SupportedArchitectures?.includes('arm64')) {
    throw new Error('XCFramework is missing the iOS arm64 device slice');
  }
  for (const architecture of ['arm64', 'x86_64']) {
    if (!simulator?.SupportedArchitectures?.includes(architecture)) {
      throw new Error(`XCFramework is missing the iOS simulator ${architecture} slice`);
    }
  }
  return {device, simulator};
}

async function configureAndBuild({
  architecture,
  compiler,
  host,
  installPath,
  minimumFlag,
  sdkPath,
  sourcePath,
  toolPaths,
}) {
  if (fs.existsSync(path.join(sourcePath, 'Makefile'))) {
    run('make', ['distclean'], {capture: true, cwd: sourcePath});
  }
  const flags = `-O2 -arch ${architecture} -isysroot ${sdkPath} ${minimumFlag}`;
  const environment = {
    ...process.env,
    AR: toolPaths.ar,
    CC: compiler,
    CFLAGS: flags,
    LDFLAGS: flags,
    RANLIB: toolPaths.ranlib,
    STRIP: toolPaths.strip,
  };
  if (architecture === 'x86_64') {
    environment.cross_compiling = 'yes';
  }
  run(
    './configure',
    [
      `--host=${host}`,
      `--prefix=${installPath}`,
      '--disable-shared',
      '--enable-static',
      '--enable-minimal',
    ],
    {capture: true, cwd: sourcePath, env: environment}
  );
  const jobs = String(Math.max(1, Math.min(4, os.cpus().length)));
  run('make', [`-j${jobs}`, 'install'], {
    capture: true,
    cwd: sourcePath,
    env: environment,
  });
}

async function main(argv = process.argv.slice(2)) {
  const {archivePath: suppliedArchivePath} = parseArguments(argv);
  const workspace = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), 'journal-archive-libsodium-ios-artifact-spike-')
  );
  const archivePath =
    suppliedArchivePath || path.join(workspace, `libsodium-${LIBSODIUM_VERSION}.tar.gz`);

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
      throw new Error('libsodium archive is missing, empty, or exceeds the size bound');
    }
    assertExpectedHash(await sha256File(archivePath));
    const sourceListing = run('tar', ['-tzf', archivePath], {capture: true});
    const sourceEntryCount = validateArchiveEntries(sourceListing);
    run('tar', ['-xzf', archivePath, '-C', workspace], {capture: true});

    const sourcePath = path.join(workspace, LIBSODIUM_ARCHIVE_ROOT);
    const deviceSdk = run('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], {
      capture: true,
    }).trim();
    const simulatorSdk = run(
      'xcrun',
      ['--sdk', 'iphonesimulator', '--show-sdk-path'],
      {capture: true}
    ).trim();
    const compiler = run('xcrun', ['--find', 'clang'], {capture: true}).trim();
    const toolPaths = {
      ar: run('xcrun', ['--find', 'ar'], {capture: true}).trim(),
      ranlib: run('xcrun', ['--find', 'ranlib'], {capture: true}).trim(),
      strip: run('xcrun', ['--find', 'strip'], {capture: true}).trim(),
    };
    const xcodeVersion = run('xcodebuild', ['-version'], {capture: true})
      .trim()
      .replace(/\n/g, '; ');
    const deviceInstall = path.join(workspace, 'ios-arm64');
    const simulatorArmInstall = path.join(workspace, 'ios-simulator-arm64');
    const simulatorIntelInstall = path.join(workspace, 'ios-simulator-x86_64');

    await configureAndBuild({
      architecture: 'arm64',
      compiler,
      host: 'aarch64-apple-darwin23',
      installPath: deviceInstall,
      minimumFlag: `-mios-version-min=${IOS_MIN_VERSION}`,
      sdkPath: deviceSdk,
      sourcePath,
      toolPaths,
    });
    await configureAndBuild({
      architecture: 'arm64',
      compiler,
      host: 'aarch64-apple-darwin23',
      installPath: simulatorArmInstall,
      minimumFlag: `-mios-simulator-version-min=${IOS_MIN_VERSION}`,
      sdkPath: simulatorSdk,
      sourcePath,
      toolPaths,
    });
    await configureAndBuild({
      architecture: 'x86_64',
      compiler,
      host: 'x86_64-apple-darwin23',
      installPath: simulatorIntelInstall,
      minimumFlag: `-mios-simulator-version-min=${IOS_MIN_VERSION}`,
      sdkPath: simulatorSdk,
      sourcePath,
      toolPaths,
    });

    const deviceLibrary = path.join(deviceInstall, 'lib', 'libsodium.a');
    const simulatorLibrary = path.join(workspace, 'libsodium-simulator.a');
    run(
      'xcrun',
      [
        'lipo',
        '-create',
        path.join(simulatorArmInstall, 'lib', 'libsodium.a'),
        path.join(simulatorIntelInstall, 'lib', 'libsodium.a'),
        '-output',
        simulatorLibrary,
      ],
      {capture: true}
    );

    const headersPath = path.join(workspace, 'headers');
    await fsPromises.cp(path.join(deviceInstall, 'include'), headersPath, {
      recursive: true,
    });
    await fsPromises.writeFile(
      path.join(headersPath, 'module.modulemap'),
      'module Clibsodium {\n  umbrella header "sodium.h"\n  export *\n}\n',
      {flag: 'wx', mode: 0o600}
    );
    const xcframeworkPath = path.join(workspace, 'Clibsodium.xcframework');
    run(
      'xcodebuild',
      [
        '-create-xcframework',
        '-library',
        deviceLibrary,
        '-headers',
        headersPath,
        '-library',
        simulatorLibrary,
        '-headers',
        headersPath,
        '-output',
        xcframeworkPath,
      ],
      {capture: true}
    );

    const infoJson = run(
      'plutil',
      ['-convert', 'json', '-o', '-', path.join(xcframeworkPath, 'Info.plist')],
      {capture: true}
    );
    const {device, simulator} = validateXcframeworkInfo(JSON.parse(infoJson));
    const evidence = {};
    for (const [name, item] of [
      ['device', device],
      ['simulator', simulator],
    ]) {
      const libraryPath = path.join(
        xcframeworkPath,
        item.LibraryIdentifier,
        item.LibraryPath
      );
      const nmOutput = run('xcrun', ['nm', '-gU', libraryPath], {capture: true});
      assertRequiredAppleSymbols(nmOutput, name);
      evidence[name] = {
        architectures: item.SupportedArchitectures,
        libraryIdentifier: item.LibraryIdentifier,
        requiredSymbols: REQUIRED_SYMBOLS,
      };
    }

    const result = {
      source: {
        version: LIBSODIUM_VERSION,
        releaseUrl: LIBSODIUM_RELEASE_URL,
        sha256: LIBSODIUM_ARCHIVE_SHA256,
        archiveEntryCount: sourceEntryCount,
        integrityVerified: true,
      },
      iosArtifactEvidence: {
        minimumVersion: IOS_MIN_VERSION,
        xcodeVersion,
        slices: evidence,
        moduleMapPresent: true,
      },
      scope: 'synthetic-ios-artifact-spike-only',
      artifactRetained: false,
      mobileProviderApproved: false,
      nextStep: 'Integrate the verified artifacts behind isolated React Native TurboModules.',
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
  IOS_MIN_VERSION,
  REQUIRED_SYMBOLS,
  assertRequiredAppleSymbols,
  validateXcframeworkInfo,
};
