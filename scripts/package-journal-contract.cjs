/* Build a portable contract archive. Never overwrite a published version. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageDir = path.join(root, 'packages', 'journal-contract');
const checkOnly = process.argv.includes('--check');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr || `Command failed with status ${result.status}`);
  }
  return result.stdout;
};

run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(packageDir, 'tsconfig.json')], {stdio: 'inherit'});
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sifia-contract-'));
let packedPath;
try {
  const output = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'pack', packageDir, '--pack-destination', temporary, '--ignore-scripts', '--offline', '--json',
  ]);
  const [info] = JSON.parse(output);
  if (!info?.filename || path.basename(info.filename) !== info.filename) { throw new Error('Invalid archive filename'); }
  packedPath = path.join(temporary, info.filename);
  const bytes = fs.readFileSync(packedPath);
  const destination = path.join(root, 'vendor', info.filename);
  if (fs.existsSync(destination)) {
    if (!fs.readFileSync(destination).equals(bytes)) {
      throw new Error('Archive differs from this version. Bump the package version before distributing changed code.');
    }
  } else {
    if (checkOnly) { throw new Error('Contract archive is missing; run npm run contract:pack'); }
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(packedPath, destination, fs.constants.COPYFILE_EXCL);
  }
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  process.stdout.write(`${checkOnly ? 'Verified' : 'Packed'} ${path.relative(root, destination)}\nSHA-256 ${hash}\n`);
} finally {
  // Only remove the exact generated archive and newly created temp directory.
  if (packedPath && fs.existsSync(packedPath)) { fs.unlinkSync(packedPath); }
  if (fs.readdirSync(temporary).length === 0) { fs.rmdirSync(temporary); }
}
