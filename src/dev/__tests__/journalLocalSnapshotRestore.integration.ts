import AsyncStorage from '@react-native-async-storage/async-storage';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJournalBackup} from '../../services/journalBackupContract';
import {openRestoreSession} from '../journalRestoreDatabase';
import {planStagedLocalSnapshot, prepareJournalPhotoExport} from '../prepareJournalPhotoManifest';
import {hasDeviceRestoreSample, readDeviceSample, restoreDeviceSample} from '../journalDeviceSnapshotRestore';
import {connect} from './restoreTestDatabase';

jest.mock('uuid', () => ({v4: require('node:crypto').randomUUID}));

it('restores a saved snapshot with a shared photo and reopens it in fresh processes', async () => {
  const {env} = process;
  const host = env.JOURNAL_SNAPSHOT_HOST;
  if (!host) {throw new Error('Set JOURNAL_SNAPSHOT_HOST to the compiled test-journal-local-restore executable');}
  const root = mkdtempSync(join(tmpdir(), 'journal-snapshot-restore-'));
  const run = (mode: string, dir: string, arg: string) =>
    execFileSync(host, [mode, dir, arg], {stdio: ['ignore', 'pipe', 'pipe']});
  const code = randomUUID().replace(/-/g, '');
  const leaf = randomUUID() + '.png';
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGk8AAAAASUVORK5CYII=', 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const prefix = 'reflection_local:free:2026-09-17:';
  const rows: [string, string][] = ['a', 'b'].map(id => [prefix + id, JSON.stringify({
    id, type: 'free', selected_date: '2026-09-17', content: 'Panalangin 🙏 ' + id,
    created_at: '2026-09-17T12:00:00Z', updated_at: '2026-09-17T12:00:00Z',
    metadata: {journalBlocks: [{id: 'picture', kind: 'photo', uri: 'file://' + join(root, leaf)}]},
  })]);
  try {
    jest.mocked(AsyncStorage.getAllKeys).mockResolvedValue(rows.map(([key]) => key));
    jest.mocked(AsyncStorage.multiGet).mockResolvedValue(rows);
    const {manifest, sources} = await prepareJournalPhotoExport(await createJournalBackup(), async () => bytes.length + ':' + sha256);
    writeFileSync(join(root, 'manifest'), JSON.stringify(manifest));
    writeFileSync(join(root, 'sources'), sources);
    writeFileSync(join(root, leaf), bytes);
    run('save', root, code);
    expect(hasDeviceRestoreSample(run('preview-sample', root, code).toString())).toBe(false);
    rmSync(join(root, leaf));
    const archive = join(root, 'archive');
    const original = readFileSync(archive);
    const damaged = Buffer.from(original);
    damaged[damaged.length - 1] ^= 1;
    writeFileSync(archive, damaged);
    expect(() => run('stage', root, code)).toThrow();
    expect(existsSync(join(root, 'objects'))).toBe(false);
    writeFileSync(archive, original);
    expect(() => run('stage', root, '0'.repeat(32))).toThrow();
    expect(existsSync(join(root, 'objects'))).toBe(false);

    const result = run('stage', root, code).toString();
    const newline = result.indexOf('\n');
    const files = JSON.parse(result.slice(0, newline));
    const evidence = result.slice(newline + 1);
    expect(files).toHaveLength(1);
    expect(() => planStagedLocalSnapshot(evidence, [])).toThrow();
    expect(() => planStagedLocalSnapshot(evidence, [{...files[0], sha256: '0'.repeat(64)}])).toThrow();
    const plan = planStagedLocalSnapshot(evidence, files);
    const dbFile = join(root, 'restored.sqlite');
    const db = connect(dbFile);
    try {
      const session = await openRestoreSession(db);
      await session.restore(plan, randomUUID());
    } finally {db.close();}
    rmSync(archive);

    const sql = "SELECT k,v FROM restore_kv";
    const script = "const db = new (require('node:sqlite').DatabaseSync)(process.argv[1], {readOnly:true});" +
      "process.stdout.write(JSON.stringify(db.prepare(process.argv[2]).all()));db.close()";
    const reopened: {k: string; v: string}[] = JSON.parse(execFileSync(process.execPath, ['-e', script, dbFile, sql], {encoding: 'utf8'}));
    const values = new Map(reopened.map(({k, v}) => [k, JSON.parse(v)]));
    expect(values.get('reflection_local_index:free:2026-09-17').sort()).toEqual(['a', 'b']);
    for (const id of ['a', 'b']) {
      const restored = values.get(prefix + id);
      expect(restored.content).toBe('Panalangin 🙏 ' + id);
      expect(restored.metadata.journalBlocks[0].uri).toBe('objects/' + files[0].file);
    }
    expect(run('reopen', join(root, 'objects'), files[0].file)).toEqual(bytes);
  } finally {rmSync(root, {recursive: true, force: true});}
});

it('confirms only the Files test sample and checks its linked photo after reopening', async () => {
  const {env} = process;
  const root = mkdtempSync(join(tmpdir(), 'journal-device-sample-'));
  try {
    copyFileSync(join(__dirname, '../../../scripts/fixtures/journal-backup/JournalRestoreSample.bin'), join(root, 'archive'));
    const document = execFileSync(env.JOURNAL_SNAPSHOT_HOST!, ['preview-sample', root, '12233445566778899aabbccddeeff001'], {encoding: 'utf8'});
    expect(hasDeviceRestoreSample(document)).toBe(true);
    const path = join(root, 'sample.sqlite');
    const db = connect(path);
    try {
      await restoreDeviceSample(db, document);
      await restoreDeviceSample(db, document);
    } finally {db.close();}
    const reopened = connect(path);
    try {
      expect(await readDeviceSample(reopened)).toMatchObject({content: 'QA fixture', photoBytes: 85, photoUri: expect.stringMatching(/^data:image\/png;base64,/)});
      await reopened.execute('DELETE FROM sample_photo');
      await expect(readDeviceSample(reopened)).rejects.toThrow('photo differs');
    } finally {reopened.close();}
  } finally {rmSync(root, {recursive: true, force: true});}
});
