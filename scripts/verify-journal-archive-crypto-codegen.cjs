#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules/react-native/cli.js');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-archive-codegen-'));

const requiredFiles = {
  android: path.join(
    output,
    'android/app/build/generated/source/codegen/java/com/facebook/fbreact/specs/NativeJournalArchiveCryptoSpec.java',
  ),
  ios: path.join(
    output,
    'build/generated/ios/ReactCodegen/JournalArchiveCryptoSpec/JournalArchiveCryptoSpec.h',
  ),
  iosProvider: path.join(
    output,
    'build/generated/ios/ReactCodegen/RCTModuleProviders.mm',
  ),
};

function fail(message, details = '') {
  process.stderr.write(`${message}\n${details}`);
  process.exitCode = 1;
}

try {
  if (!fs.existsSync(cli)) {
    fail('React Native CLI is missing; install dependencies before running codegen verification');
  } else {
    const generated = spawnSync(
      process.execPath,
      [cli, 'codegen', '--platform', 'all', '--outputPath', output, '--source', 'app'],
      {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
    );

    if (generated.status !== 0) {
      fail('React Native codegen rejected the JournalArchiveCrypto contract', `${generated.stdout}${generated.stderr}`);
    } else {
      const missing = Object.entries(requiredFiles)
        .filter(([, file]) => !fs.existsSync(file))
        .map(([platform]) => platform);

      if (missing.length > 0) {
        fail(`Codegen did not produce required artifacts: ${missing.join(', ')}`);
      } else {
        const android = fs.readFileSync(requiredFiles.android, 'utf8');
        const ios = fs.readFileSync(requiredFiles.ios, 'utf8');
        const iosProvider = fs.readFileSync(requiredFiles.iosProvider, 'utf8');
        const assertions = {
          androidModuleName: android.includes('public static final String NAME = "JournalArchiveCrypto"'),
          androidProviderEvidence: android.includes('void getProviderEvidence(Promise promise)'),
          androidSyntheticSelfTest: android.includes('void runSyntheticSelfTest(Promise promise)'),
          androidPortableVectorSelfTest: android.includes(
            'void runPortableVectorSelfTest(Promise promise)',
          ),
          androidFileTransportSelfTest: android.includes(
            'void runFileTransportSelfTest(Promise promise)',
          ),
          iosProviderEvidence: ios.includes('getProviderEvidence:(RCTPromiseResolveBlock)resolve'),
          iosSyntheticSelfTest: ios.includes('runSyntheticSelfTest:(RCTPromiseResolveBlock)resolve'),
          iosPortableVectorSelfTest: ios.includes(
            'runPortableVectorSelfTest:(RCTPromiseResolveBlock)resolve',
          ),
          iosFileTransportSelfTest: ios.includes(
            'runFileTransportSelfTest:(RCTPromiseResolveBlock)resolve',
          ),
          iosProviderRegistration: iosProvider.includes('@"JournalArchiveCrypto": @"JournalArchiveCrypto"'),
        };
        const rejected = Object.entries(assertions)
          .filter(([, passed]) => !passed)
          .map(([name]) => name);

        if (rejected.length > 0) {
          fail(`Generated bridge assertions failed: ${rejected.join(', ')}`);
        } else {
          process.stdout.write(`${JSON.stringify({approved: true, platforms: ['android', 'ios'], assertions}, null, 2)}\n`);
        }
      }
    }
  }
} finally {
  fs.rmSync(output, {recursive: true, force: true});
}
