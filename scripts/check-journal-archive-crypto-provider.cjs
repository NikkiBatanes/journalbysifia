const minimumLibsodiumVersion = '1.0.22';
const requiredReactNativeVersion = '0.88.1';

const requiredProviderCapabilities = Object.freeze([
  'nativeIos',
  'nativeAndroid',
  'reactNativeNewArchitecture',
  'secretstreamXChaCha20Poly1305',
  'secretstreamFinalTag',
  'argon2id',
  'argon2idOffJsThread',
  'secureRandom',
  'secureMemoryZeroing',
  'boundedNativeStreaming',
]);

const requiredRuntimeAssertions = Object.freeze([
  'cleanNativeBuild',
  'knownAnswerVector',
  'crossPlatformRoundTrip',
  'wrongKeyRejected',
  'corruptChunkRejected',
  'truncatedStreamRejected',
  'reorderedChunkRejected',
  'missingFinalTagRejected',
  'boundedMemoryVerified',
  'interruptedWriteLeavesNoPlaintext',
  'logsContainNoSecretsOrPlaintext',
]);

const parseVersion = value => {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
};

const compareVersions = (left, right) => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) {
    return null;
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
};

const assessRuntimePlatform = (platform, evidence, failures) => {
  if (!evidence || typeof evidence !== 'object') {
    failures.push(`${platform} runtime evidence is missing.`);
    return;
  }

  if (evidence.reactNativeVersion !== requiredReactNativeVersion) {
    failures.push(
      `${platform} was not tested on React Native ${requiredReactNativeVersion}.`,
    );
  }

  for (const assertion of requiredRuntimeAssertions) {
    if (evidence[assertion] !== true) {
      failures.push(
        `${platform} runtime assertion ${assertion} has not passed.`,
      );
    }
  }
};

const assessJournalArchiveCryptoProvider = evidence => {
  const failures = [];
  const warnings = [
    'Static declarations never replace clean-device iOS and Android runtime evidence.',
    'Passing this gate approves a provider spike, not a customer-data migration or release.',
  ];

  if (!evidence || typeof evidence !== 'object') {
    return {
      approved: false,
      failures: ['No archive crypto provider evidence was supplied.'],
      warnings,
      minimumLibsodiumVersion,
      requiredReactNativeVersion,
    };
  }

  if (!evidence.packageName || typeof evidence.packageName !== 'string') {
    failures.push('A package name is required.');
  }
  if (!parseVersion(evidence.packageVersion)) {
    failures.push('The provider package must use an exact semantic version.');
  }
  if (!String(evidence.packageIntegrity || '').startsWith('sha512-')) {
    failures.push('The provider lock entry must include sha512 integrity.');
  }
  if (evidence.license !== 'ISC') {
    failures.push('The bundled libsodium ISC license has not been verified.');
  }

  const libsodiumComparison = compareVersions(
    evidence.libsodiumVersion,
    minimumLibsodiumVersion,
  );
  if (libsodiumComparison === null) {
    failures.push('The bundled libsodium version must be exact and auditable.');
  } else if (libsodiumComparison < 0) {
    failures.push(
      `Bundled libsodium ${evidence.libsodiumVersion} is below the reviewed minimum ${minimumLibsodiumVersion}.`,
    );
  }
  if (evidence.libsodiumSourceVerified !== true) {
    failures.push(
      'The bundled libsodium source and release integrity are unverified.',
    );
  }

  const capabilities = evidence.capabilities || {};
  for (const capability of requiredProviderCapabilities) {
    if (capabilities[capability] !== true) {
      failures.push(`Required native capability ${capability} is missing.`);
    }
  }

  assessRuntimePlatform('iOS', evidence.runtime?.ios, failures);
  assessRuntimePlatform('Android', evidence.runtime?.android, failures);

  return {
    approved: failures.length === 0,
    failures,
    warnings,
    minimumLibsodiumVersion,
    requiredReactNativeVersion,
  };
};

const main = () => {
  const result = assessJournalArchiveCryptoProvider(null);
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'blocked_until_reviewed_provider_evidence_is_supplied',
        result,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
};

if (require.main === module) {
  main();
}

module.exports = {
  assessJournalArchiveCryptoProvider,
  compareVersions,
  minimumLibsodiumVersion,
  requiredProviderCapabilities,
  requiredReactNativeVersion,
  requiredRuntimeAssertions,
};
