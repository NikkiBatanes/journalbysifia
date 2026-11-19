#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const paths = {
  mainApplication: 'android/app/src/main/java/app/journal/sifia/MainApplication.kt',
  moduleSource:
    'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoModule.kt',
  packageSource:
    'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoPackage.kt',
  buildSource: 'android/app/build.gradle',
  cmakeSource: 'android/app/src/main/jni/CMakeLists.txt',
  nativeSource: 'android/app/src/main/cpp/journal_archive_crypto.cpp',
  transportSource:
    'android/app/src/main/cpp/journal_archive_file_transport.cpp',
  mediaPackagingSource:
    'android/app/src/main/cpp/journal_archive_media_packaging.cpp',
  integritySource:
    'android/app/libs/journal-archive-libsodium/INTEGRITY.json',
  aar: 'android/app/libs/journal-archive-libsodium/libsodium-1.0.22.0.aar',
  license: 'android/app/libs/journal-archive-libsodium/LICENSE.libsodium',
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireMarkers(source, markers, label, failures) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`missing ${label}: ${marker}`);
    }
  }
}

function inspectAndroidProvider(sources) {
  const failures = [];
  const {
    mainApplication,
    moduleSource,
    packageSource,
    buildSource,
    cmakeSource,
    nativeSource,
    transportSource,
    mediaPackagingSource,
    integritySource,
    aarBytes,
    licenseBytes,
  } = sources;

  requireMarkers(
    moduleSource,
    [
      'class JournalArchiveCryptoModule(reactContext: ReactApplicationContext)',
      'NativeJournalArchiveCryptoSpec(reactContext)',
      'private val cryptoExecutor: ExecutorService',
      'Thread(runnable, "journal-archive-crypto")',
      'private external fun nativeSodiumVersion(): String',
      'private external fun nativeRunSyntheticSelfTest(): BooleanArray',
      'private external fun nativeRunFileTransportSelfTest(cacheDirectory: String): BooleanArray',
      'private external fun nativeRunMediaPackagingSelfTest(): BooleanArray',
      'putString("libsodiumVersion", nativeSodiumVersion())',
      'putString("platform", "android")',
      'putBoolean("runtimeOffJavaScriptThread", true)',
      'putBoolean("syntheticOnly", true)',
      'putBoolean("mobileProviderApproved", false)',
      'putBoolean("argon2id", assertions[0])',
      'putBoolean("secretstream", assertions[1])',
      'putBoolean("wrongPasswordRejected", assertions[2])',
      'putBoolean("tamperRejected", assertions[3])',
      'putBoolean("truncationRejected", assertions[4])',
      'putBoolean("reorderingRejected", assertions[5])',
      'putBoolean("finalTagRequired", assertions[6])',
      'putBoolean("sensitiveBuffersCleared", assertions[7])',
      'putBoolean("plaintextFileWritten", false)',
      'putBoolean("boundedChunkWrites", assertions[0])',
      'putBoolean("sizeLimitRejected", assertions[1])',
      'putBoolean("temporaryFileUsed", assertions[2])',
      'putBoolean("incompletePublishHidden", assertions[3])',
      'putBoolean("atomicPublishSucceeded", assertions[4])',
      'putBoolean("fileAndDirectorySynced", assertions[5])',
      'putBoolean("staleTemporaryCleaned", assertions[6])',
      'putBoolean("publishedBytesVerified", assertions[7])',
      'putBoolean("artifactsCleaned", assertions[8])',
      'putBoolean("allowedMediaPackaged", assertions[0])',
      'putBoolean("contentTypeMismatchRejected", assertions[1])',
      'putBoolean("perAssetLimitRejected", assertions[2])',
      'putBoolean("aggregateLimitsRejected", assertions[3])',
      'putBoolean("hashMismatchRejected", assertions[4])',
      'putBoolean("ownerMismatchRejected", assertions[5])',
      'putBoolean("unsafePathRejected", assertions[6])',
      'putBoolean("duplicateAssetRejected", assertions[7])',
      'putBoolean("metadataTamperRejected", assertions[8])',
      'putBoolean("chunkReorderingRejected", assertions[9])',
      'putBoolean("missingFinalMarkerRejected", assertions[10])',
      'cryptoExecutor.shutdownNow()',
      'System.loadLibrary("journal_archive_crypto")',
      'const val NAME = "JournalArchiveCrypto"',
    ],
    'synthetic Android provider marker',
    failures,
  );

  requireMarkers(
    mainApplication,
    [
      'add(JournalArchiveCryptoPackage())',
      'import app.journal.sifia.archivecrypto.JournalArchiveCryptoPackage',
    ],
    'Android application registration',
    failures,
  );

  requireMarkers(
    packageSource,
    [
      'class JournalArchiveCryptoPackage : BaseReactPackage()',
      'if (name == JournalArchiveCryptoModule.NAME)',
      'JournalArchiveCryptoModule(reactContext)',
      'JournalArchiveCryptoModule::class.java.name',
    ],
    'Android package marker',
    failures,
  );

  requireMarkers(
    buildSource,
    [
      'prefab true',
      'path file("src/main/jni/CMakeLists.txt")',
      'implementation files("libs/journal-archive-libsodium/libsodium-1.0.22.0.aar")',
    ],
    'Android native build marker',
    failures,
  );

  requireMarkers(
    cmakeSource,
    [
      'project(appmodules LANGUAGES C CXX)',
      'include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)',
      'find_package(sodium REQUIRED CONFIG)',
      '../cpp/journal_archive_crypto.cpp',
      '../cpp/journal_archive_file_transport.cpp',
      '../cpp/journal_archive_media_packaging.cpp',
      'target_compile_features(journal_archive_crypto PRIVATE cxx_std_20)',
      '-Werror',
      '-fvisibility=hidden',
      'target_link_libraries(journal_archive_crypto PRIVATE sodium::sodium z)',
    ],
    'Android CMake boundary',
    failures,
  );

  requireMarkers(
    nativeSource,
    [
      'crypto_pwhash_ALG_ARGON2ID13',
      'crypto_secretstream_xchacha20poly1305_TAG_FINAL',
      'sodium_memzero',
      'nativeSodiumVersion',
      'nativeRunSyntheticSelfTest',
      'assertions[2]',
      'assertions[3]',
      'assertions[4]',
      'assertions[5]',
      'assertions[6]',
      'assertions[7]',
    ],
    'synthetic native assertion',
    failures,
  );

  requireMarkers(
    transportSource,
    [
      'kMaximumSyntheticArchiveBytes = 4096',
      'journal-archive-transport-XXXXXX',
      'archive.sifia.part',
      'O_EXCL | O_CLOEXEC | O_NOFOLLOW',
      '::fsync(',
      '::rename(partial.c_str(), published.c_str())',
      'RunFileTransportSelfTest',
      'nativeRunFileTransportSelfTest',
      'assertions[8]',
    ],
    'synthetic Android file-transport assertion',
    failures,
  );

  requireMarkers(
    mediaPackagingSource,
    [
      'kMaximumAssetCount = 2',
      'kMaximumAssetBytes = 1024',
      'kMaximumTotalAssetBytes = 1536',
      'journal-media-v1',
      'objects/',
      'crypto_hash_sha256',
      'crypto_secretstream_xchacha20poly1305_push',
      'crypto_secretstream_xchacha20poly1305_TAG_FINAL',
      'nativeRunMediaPackagingSelfTest',
      'assertions[10]',
    ],
    'synthetic Android media-packaging assertion',
    failures,
  );

  const forbiddenSurface = [
    /encryptFile/i,
    /decryptFile/i,
    /sourcePath/i,
    /destinationPath/i,
    /\b(?:password|passphrase)\s*:/i,
    /putBoolean\("mobileProviderApproved",\s*true\)/,
  ];
  for (const pattern of forbiddenSurface) {
    if (pattern.test(moduleSource)) {
      failures.push(`premature Android crypto surface is forbidden: ${pattern}`);
    }
  }

  const forbiddenNativeSurface = [
    /Java_.*encrypt/i,
    /Java_.*decrypt/i,
    /fopen\s*\(/,
    /std::filesystem/,
    /AAssetManager/,
  ];
  for (const pattern of forbiddenNativeSurface) {
    if (pattern.test(nativeSource)) {
      failures.push(`native customer/file surface is forbidden: ${pattern}`);
    }
  }

  for (const pattern of [
    /jbyteArray/,
    /jobjectArray/,
    /password/i,
    /passphrase/i,
    /customer/i,
  ]) {
    if (pattern.test(transportSource)) {
      failures.push(`synthetic Android transport accepted forbidden input: ${pattern}`);
    }
  }

  for (const pattern of [
    /jbyteArray/,
    /jobjectArray/,
    /jstring/,
    /password/i,
    /passphrase/i,
    /customer/i,
  ]) {
    if (pattern.test(mediaPackagingSource)) {
      failures.push(`synthetic Android media packaging accepted forbidden input: ${pattern}`);
    }
  }

  let integrity;
  try {
    integrity = JSON.parse(integritySource);
  } catch (error) {
    failures.push(`invalid Android libsodium integrity manifest: ${error.message}`);
  }

  if (integrity) {
    const expected = {
      library: 'libsodium',
      version: '1.0.22',
      sourceSha256:
        'adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349',
      androidNdkVersion: '27.1.12297006',
      androidMinSdk: 24,
      buildProfile: 'portable-no-cpu-specific-implementations',
      argon2Implementation: 'reference',
      aar: 'libsodium-1.0.22.0.aar',
      license: 'LICENSE.libsodium',
      scope: 'journal-archive-synthetic-native-provider',
      mobileProviderApproved: false,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (integrity[key] !== value) {
        failures.push(`unexpected Android libsodium integrity value: ${key}`);
      }
    }
    if (integrity.aarSha256 !== sha256(aarBytes)) {
      failures.push('Android libsodium AAR digest does not match INTEGRITY.json');
    }
    if (integrity.licenseSha256 !== sha256(licenseBytes)) {
      failures.push('Android libsodium license digest does not match INTEGRITY.json');
    }
  }

  return {approved: failures.length === 0, failures};
}

function main() {
  const readText = key => fs.readFileSync(path.join(root, paths[key]), 'utf8');
  const result = inspectAndroidProvider({
    mainApplication: readText('mainApplication'),
    moduleSource: readText('moduleSource'),
    packageSource: readText('packageSource'),
    buildSource: readText('buildSource'),
    cmakeSource: readText('cmakeSource'),
    nativeSource: readText('nativeSource'),
    transportSource: readText('transportSource'),
    mediaPackagingSource: readText('mediaPackagingSource'),
    integritySource: readText('integritySource'),
    aarBytes: fs.readFileSync(path.join(root, paths.aar)),
    licenseBytes: fs.readFileSync(path.join(root, paths.license)),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.approved) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {inspectAndroidProvider};
