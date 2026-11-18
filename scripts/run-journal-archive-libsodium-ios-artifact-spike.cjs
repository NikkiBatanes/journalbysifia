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
const IOS_BUILD_PROFILE = 'portable-static-minimal-xcframework';
const IOS_ARGON2_IMPLEMENTATION = 'reference';
const RETAINED_FRAMEWORK_NAME = 'Clibsodium.xcframework';
const RETAINED_LICENSE_NAME = 'LICENSE.libsodium';
const RETAINED_INTEGRITY_NAME = 'INTEGRITY.json';
const REQUIRED_SYMBOLS = [
  'crypto_pwhash_argon2id',
  'crypto_secretstream_xchacha20poly1305_init_push',
  'randombytes_buf',
  'sodium_memzero',
];

function parseIosArguments(argv) {
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

function replaceExactOnce(source, expected, replacement, label) {
  const firstIndex = source.indexOf(expected);
  if (firstIndex === -1 || source.indexOf(expected, firstIndex + 1) !== -1) {
    throw new Error(`Unable to apply the reviewed ${label} source patch`);
  }
  return source.replace(expected, replacement);
}

function replaceExactCount(source, expected, replacement, count, label) {
  if (source.split(expected).length - 1 !== count) {
    throw new Error(`Unable to apply the reviewed ${label} source patch`);
  }
  return source.split(expected).join(replacement);
}

async function applyPortableIosBuildProfile(sourcePath) {
  const configurePath = path.join(sourcePath, 'configure');
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
    fsPromises.writeFile(argon2CorePath, argon2Core),
  ]);
}

async function sha256Tree(directory) {
  const entries = [];
  async function visit(current, relative) {
    const children = await fsPromises.readdir(current, {withFileTypes: true});
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        await visit(childPath, childRelative);
      } else if (child.isFile()) {
        entries.push(`${childRelative}:${await sha256File(childPath)}`);
      } else {
        throw new Error(`Unsupported retained XCFramework entry: ${childRelative}`);
      }
    }
  }
  await visit(directory, '');
  const crypto = require('node:crypto');
  return {
    entryCount: entries.length,
    sha256: crypto.createHash('sha256').update(entries.join('\n')).digest('hex'),
  };
}

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
  if (device.LibraryPath !== 'libsodium.a') {
    throw new Error('XCFramework device binary must be named libsodium.a');
  }
  for (const architecture of ['arm64', 'x86_64']) {
    if (!simulator?.SupportedArchitectures?.includes(architecture)) {
      throw new Error(`XCFramework is missing the iOS simulator ${architecture} slice`);
    }
  }
  if (simulator.LibraryPath !== 'libsodium.a') {
    throw new Error('XCFramework simulator binary must be named libsodium.a');
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
      '--disable-asm',
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
  const {archivePath: suppliedArchivePath, retainDirectory} =
    parseIosArguments(argv);
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
    await applyPortableIosBuildProfile(sourcePath);
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
    const simulatorUniversalInstall = path.join(
      workspace,
      'ios-simulator-universal',
      'lib'
    );
    await fsPromises.mkdir(simulatorUniversalInstall, {recursive: true});
    const simulatorLibrary = path.join(
      simulatorUniversalInstall,
      'libsodium.a'
    );
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

    let retainedArtifact = null;
    if (retainDirectory) {
      const parentStats = await fsPromises.stat(path.dirname(retainDirectory));
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
        const retainedFrameworkPath = path.join(
          retainDirectory,
          RETAINED_FRAMEWORK_NAME
        );
        const retainedLicensePath = path.join(
          retainDirectory,
          RETAINED_LICENSE_NAME
        );
        await fsPromises.cp(xcframeworkPath, retainedFrameworkPath, {
          recursive: true,
          force: false,
          errorOnExist: true,
        });
        await fsPromises.copyFile(
          path.join(sourcePath, 'LICENSE'),
          retainedLicensePath,
          fs.constants.COPYFILE_EXCL
        );
        const frameworkDigest = await sha256Tree(retainedFrameworkPath);
        const integrity = {
          library: 'libsodium',
          version: LIBSODIUM_VERSION,
          sourceUrl: LIBSODIUM_RELEASE_URL,
          sourceSha256: LIBSODIUM_ARCHIVE_SHA256,
          iosMinimumVersion: IOS_MIN_VERSION,
          xcodeVersion,
          buildProfile: IOS_BUILD_PROFILE,
          argon2Implementation: IOS_ARGON2_IMPLEMENTATION,
          framework: RETAINED_FRAMEWORK_NAME,
          frameworkSha256: frameworkDigest.sha256,
          frameworkEntryCount: frameworkDigest.entryCount,
          license: RETAINED_LICENSE_NAME,
          licenseSha256: await sha256File(retainedLicensePath),
          scope: 'journal-archive-synthetic-native-provider',
          mobileProviderApproved: false,
        };
        await fsPromises.writeFile(
          path.join(retainDirectory, RETAINED_INTEGRITY_NAME),
          `${JSON.stringify(integrity, null, 2)}\n`,
          {flag: 'wx', mode: 0o600}
        );
        retainedArtifact = {
          directory: retainDirectory,
          framework: RETAINED_FRAMEWORK_NAME,
          frameworkSha256: frameworkDigest.sha256,
          frameworkEntryCount: frameworkDigest.entryCount,
          license: RETAINED_LICENSE_NAME,
          integrity: RETAINED_INTEGRITY_NAME,
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
      iosArtifactEvidence: {
        minimumVersion: IOS_MIN_VERSION,
        xcodeVersion,
        buildProfile: IOS_BUILD_PROFILE,
        argon2Implementation: IOS_ARGON2_IMPLEMENTATION,
        slices: evidence,
        moduleMapPresent: true,
      },
      scope: 'synthetic-ios-artifact-spike-only',
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
  IOS_ARGON2_IMPLEMENTATION,
  IOS_BUILD_PROFILE,
  IOS_MIN_VERSION,
  REQUIRED_SYMBOLS,
  RETAINED_FRAMEWORK_NAME,
  RETAINED_INTEGRITY_NAME,
  RETAINED_LICENSE_NAME,
  applyPortableIosBuildProfile,
  assertRequiredAppleSymbols,
  parseIosArguments,
  sha256Tree,
  validateXcframeworkInfo,
};
