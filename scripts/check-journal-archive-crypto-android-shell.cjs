#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mainApplicationPath = path.join(
  root,
  'android/app/src/main/java/app/journal/sifia/MainApplication.kt',
);
const modulePath = path.join(
  root,
  'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoModule.kt',
);
const packagePath = path.join(
  root,
  'android/app/src/main/java/app/journal/sifia/archivecrypto/JournalArchiveCryptoPackage.kt',
);

function inspectAndroidShell(mainApplication, moduleSource, packageSource) {
  const failures = [];
  const requiredModuleMarkers = [
    'class JournalArchiveCryptoModule(reactContext: ReactApplicationContext)',
    'NativeJournalArchiveCryptoSpec(reactContext)',
    'putString("libsodiumVersion", "not-linked")',
    'putString("platform", "android")',
    'putBoolean("runtimeOffJavaScriptThread", false)',
    'putBoolean("syntheticOnly", true)',
    'putBoolean("mobileProviderApproved", false)',
    'putBoolean("argon2id", false)',
    'putBoolean("secretstream", false)',
    'putBoolean("wrongPasswordRejected", false)',
    'putBoolean("tamperRejected", false)',
    'putBoolean("truncationRejected", false)',
    'putBoolean("reorderingRejected", false)',
    'putBoolean("finalTagRequired", false)',
    'putBoolean("sensitiveBuffersCleared", false)',
    'putBoolean("plaintextFileWritten", false)',
    'const val NAME = "JournalArchiveCrypto"',
  ];

  for (const marker of requiredModuleMarkers) {
    if (!moduleSource.includes(marker)) {
      failures.push(`missing fail-closed Android marker: ${marker}`);
    }
  }

  const requiredRegistrationMarkers = [
    'add(JournalArchiveCryptoPackage())',
    'import app.journal.sifia.archivecrypto.JournalArchiveCryptoPackage',
  ];
  for (const marker of requiredRegistrationMarkers) {
    if (!mainApplication.includes(marker)) {
      failures.push(`missing Android application registration: ${marker}`);
    }
  }

  const requiredPackageMarkers = [
    'class JournalArchiveCryptoPackage : BaseReactPackage()',
    'if (name == JournalArchiveCryptoModule.NAME)',
    'JournalArchiveCryptoModule(reactContext)',
    'JournalArchiveCryptoModule::class.java.name',
  ];
  for (const marker of requiredPackageMarkers) {
    if (!packageSource.includes(marker)) {
      failures.push(`missing Android package marker: ${marker}`);
    }
  }

  const forbiddenSurface = [
    /encryptFile/i,
    /decryptFile/i,
    /sourcePath/i,
    /destinationPath/i,
    /\b(?:password|passphrase)\s*:/i,
    /putBoolean\("mobileProviderApproved",\s*true\)/,
    /putBoolean\("runtimeOffJavaScriptThread",\s*true\)/,
    /putString\("libsodiumVersion",\s*"(?!not-linked")/,
  ];
  for (const pattern of forbiddenSurface) {
    if (pattern.test(moduleSource)) {
      failures.push(`premature Android crypto surface is forbidden: ${pattern}`);
    }
  }

  return {approved: failures.length === 0, failures};
}

function main() {
  const result = inspectAndroidShell(
    fs.readFileSync(mainApplicationPath, 'utf8'),
    fs.readFileSync(modulePath, 'utf8'),
    fs.readFileSync(packagePath, 'utf8'),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.approved) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {inspectAndroidShell};
