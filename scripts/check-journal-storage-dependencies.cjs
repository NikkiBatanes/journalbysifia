const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const minimumPatchedOpSqlite = '18.2.4';
const approvedOpenSslBranches = new Set(['3.5']);

const read = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const parseVersionParts = version => {
  const match = String(version).match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
};

const compareVersions = (left, right) => {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
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

const openSslBranch = version => {
  const parts = parseVersionParts(version);
  return parts ? `${parts[0]}.${parts[1]}` : null;
};

const assessJournalStorageGraph = graph => {
  const failures = [];
  const warnings = [
    'Static dependency evidence does not replace the on-device SQLCipher runtime probe.',
  ];

  if (!graph.sqlcipherEnabled) {
    failures.push('OP-SQLite SQLCipher configuration is not enabled.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(graph.opSqliteVersion)) {
    failures.push('OP-SQLite must be pinned to an exact semantic version.');
  } else if (
    compareVersions(graph.opSqliteVersion, minimumPatchedOpSqlite) < 0
  ) {
    failures.push(
      `OP-SQLite ${graph.opSqliteVersion} is below the patched minimum ${minimumPatchedOpSqlite}.`,
    );
  }
  if (!graph.opSqliteIntegrity?.startsWith('sha512-')) {
    failures.push('The OP-SQLite package-lock entry lacks a sha512 integrity value.');
  }

  for (const [platform, version] of [
    ['iOS', graph.iosOpenSslVersion],
    ['Android', graph.androidOpenSslVersion],
  ]) {
    const branch = openSslBranch(version);
    if (!branch) {
      failures.push(`${platform} OpenSSL version could not be determined.`);
    } else if (!approvedOpenSslBranches.has(branch)) {
      failures.push(
        `${platform} OpenSSL ${version} is not on an approved supported branch ` +
          `(approved: ${[...approvedOpenSslBranches].join(', ')}).`,
      );
    }
  }

  return {
    approved: failures.length === 0,
    approvedOpenSslBranches: [...approvedOpenSslBranches],
    minimumPatchedOpSqlite,
    failures,
    warnings,
  };
};

const collectJournalStorageGraph = () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  const podfileLock = read('ios/Podfile.lock');
  const androidBuild = read(
    'node_modules/@op-engineering/op-sqlite/android/build.gradle',
  );
  const opSqliteVersion = packageJson.dependencies?.['@op-engineering/op-sqlite'];
  const lockEntry =
    packageLock.packages?.['node_modules/@op-engineering/op-sqlite'];
  const iosMatch = podfileLock.match(/- OpenSSL-Universal \(([^)]+)\)/);
  const androidMatch = androidBuild.match(
    /io\.github\.ronickg:openssl:([^'"\s)]+)/,
  );

  return {
    sqlcipherEnabled: packageJson['op-sqlite']?.sqlcipher === true,
    opSqliteVersion: opSqliteVersion || '',
    opSqliteIntegrity: lockEntry?.integrity || '',
    iosOpenSslVersion: iosMatch?.[1] || '',
    androidOpenSslVersion: androidMatch?.[1] || '',
  };
};

const main = () => {
  const graph = collectJournalStorageGraph();
  const assessment = assessJournalStorageGraph(graph);
  process.stdout.write(
    `${JSON.stringify({graph, assessment}, null, 2)}\n`,
  );
  if (!assessment.approved) {
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  assessJournalStorageGraph,
  compareVersions,
  openSslBranch,
};
