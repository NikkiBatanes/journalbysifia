#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {isDeepStrictEqual} = require('node:util');

const LIBSODIUM_VERSION = '1.0.22';
const LIBSODIUM_ARCHIVE_ROOT = `libsodium-${LIBSODIUM_VERSION}`;
const LIBSODIUM_RELEASE_URL =
  'https://github.com/jedisct1/libsodium/releases/download/1.0.22-RELEASE/libsodium-1.0.22.tar.gz';
const LIBSODIUM_ARCHIVE_SHA256 =
  'adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349';
const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;
const PORTABLE_VECTOR_PATH = path.join(
  __dirname,
  '..',
  'security',
  'journal-archive-crypto',
  'portable-v1.json',
);

function parseArguments(argv) {
  const archiveIndex = argv.indexOf('--archive');
  if (archiveIndex === -1) {
    return {archivePath: null};
  }
  const archivePath = argv[archiveIndex + 1];
  if (!archivePath || archivePath.startsWith('--')) {
    throw new Error('--archive requires an exact local tar.gz path');
  }
  return {archivePath: path.resolve(archivePath)};
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} exited with status ${result.status}${details}`);
  }
  return result.stdout || '';
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function assertExpectedHash(actualHash) {
  if (actualHash !== LIBSODIUM_ARCHIVE_SHA256) {
    throw new Error(
      `libsodium archive SHA-256 mismatch: expected ${LIBSODIUM_ARCHIVE_SHA256}, received ${actualHash}`,
    );
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadPortableVectorFixture() {
  const fixture = JSON.parse(fs.readFileSync(PORTABLE_VECTOR_PATH, 'utf8'));
  if (
    fixture.schema !== 'app.journal.sifia.archive-crypto-portable-vector' ||
    fixture.schemaVersion !== 1 ||
    fixture.source?.library !== 'libsodium' ||
    fixture.source?.version !== LIBSODIUM_VERSION ||
    fixture.source?.sourceSha256 !== LIBSODIUM_ARCHIVE_SHA256
  ) {
    throw new Error('portable vector source metadata is not the reviewed contract');
  }
  const digest = sha256(JSON.stringify(fixture.vector));
  if (digest !== fixture.vectorSha256) {
    throw new Error('portable vector digest does not match its canonical content');
  }
  return fixture;
}

function assertPortableVector(actual, fixture = loadPortableVectorFixture()) {
  if (!isDeepStrictEqual(actual, fixture.vector)) {
    throw new Error('native host output differs from portable vector v1');
  }
  return fixture.vectorSha256;
}

function validateArchiveEntries(listing) {
  const entries = listing.split('\n').filter(Boolean);
  if (entries.length === 0) {
    throw new Error('libsodium archive is empty');
  }
  for (const entry of entries) {
    const segments = entry.split('/');
    if (
      entry.startsWith('/') ||
      segments.includes('..') ||
      (entry !== LIBSODIUM_ARCHIVE_ROOT &&
        !entry.startsWith(`${LIBSODIUM_ARCHIVE_ROOT}/`))
    ) {
      throw new Error(`unsafe or unexpected archive entry: ${entry}`);
    }
  }
  return entries.length;
}

async function downloadVerifiedArchive(destination) {
  const response = await fetch(LIBSODIUM_RELEASE_URL, {redirect: 'follow'});
  if (!response.ok) {
    throw new Error(`libsodium download failed with HTTP ${response.status}`);
  }
  const finalHost = new URL(response.url).hostname;
  if (
    finalHost !== 'github.com' &&
    finalHost !== 'objects.githubusercontent.com' &&
    !finalHost.endsWith('.githubusercontent.com')
  ) {
    throw new Error(`libsodium download redirected to an unexpected host: ${finalHost}`);
  }
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_ARCHIVE_BYTES) {
    throw new Error('libsodium archive exceeds the download size bound');
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > MAX_ARCHIVE_BYTES) {
    throw new Error('libsodium archive is empty or exceeds the download size bound');
  }
  await fsPromises.writeFile(destination, body, {flag: 'wx', mode: 0o600});
}

async function main(argv = process.argv.slice(2)) {
  const {archivePath: suppliedArchivePath} = parseArguments(argv);
  const workspace = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), 'journal-archive-libsodium-host-spike-'),
  );
  const archivePath =
    suppliedArchivePath || path.join(workspace, `libsodium-${LIBSODIUM_VERSION}.tar.gz`);
  const installPath = path.join(workspace, 'install');
  const executablePath = path.join(workspace, 'journal-archive-crypto-host-spike');
  const harnessPath = path.join(
    __dirname,
    'journal-archive-libsodium-host-spike.c',
  );

  try {
    if (!suppliedArchivePath) {
      process.stderr.write(
        `Downloading pinned libsodium ${LIBSODIUM_VERSION} source from the official release...\n`,
      );
      await downloadVerifiedArchive(archivePath);
    }
    const stats = await fsPromises.stat(archivePath);
    if (!stats.isFile() || stats.size === 0 || stats.size > MAX_ARCHIVE_BYTES) {
      throw new Error('libsodium archive is missing, empty, or exceeds the size bound');
    }
    assertExpectedHash(await sha256File(archivePath));

    const listing = run('tar', ['-tzf', archivePath], {capture: true});
    const archiveEntryCount = validateArchiveEntries(listing);
    run('tar', ['-xzf', archivePath, '-C', workspace]);

    const sourcePath = path.join(workspace, LIBSODIUM_ARCHIVE_ROOT);
    run(
      './configure',
      [
        '--disable-shared',
        '--enable-static',
        '--enable-minimal',
        `--prefix=${installPath}`,
      ],
      {cwd: sourcePath, capture: true},
    );
    const jobs = String(Math.max(1, Math.min(4, os.cpus().length)));
    run('make', [`-j${jobs}`], {cwd: sourcePath, capture: true});
    run('make', ['install'], {cwd: sourcePath, capture: true});
    run('clang', [
      '-std=c11',
      '-O2',
      '-Wall',
      '-Wextra',
      '-Werror',
      harnessPath,
      `-I${path.join(installPath, 'include')}`,
      `-L${path.join(installPath, 'lib')}`,
      '-lsodium',
      '-o',
      executablePath,
    ], {capture: true});

    const nativeOutput = run(executablePath, [], {capture: true}).trim();
    const nativeEvidence = JSON.parse(nativeOutput);
    const portableVectorSha256 = assertPortableVector(
      nativeEvidence.portableVector,
    );
    const result = {
      source: {
        version: LIBSODIUM_VERSION,
        releaseUrl: LIBSODIUM_RELEASE_URL,
        sha256: LIBSODIUM_ARCHIVE_SHA256,
        archiveEntryCount,
        integrityVerified: true,
      },
      nativeHostEvidence: nativeEvidence,
      portableVectorSha256,
      scope: 'synthetic-host-spike-only',
      mobileProviderApproved: false,
      nextStep: 'Require the locked portable vector on Android and iOS.',
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
  LIBSODIUM_ARCHIVE_ROOT,
  LIBSODIUM_ARCHIVE_SHA256,
  LIBSODIUM_RELEASE_URL,
  LIBSODIUM_VERSION,
  MAX_ARCHIVE_BYTES,
  PORTABLE_VECTOR_PATH,
  assertPortableVector,
  assertExpectedHash,
  downloadVerifiedArchive,
  parseArguments,
  run,
  sha256File,
  loadPortableVectorFixture,
  validateArchiveEntries,
};
