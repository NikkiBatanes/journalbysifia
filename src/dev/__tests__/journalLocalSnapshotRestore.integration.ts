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
import {restoreStreamedSnapshot} from '../journalStreamingSnapshotRestore';
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

it.each([
  ['Text', 0, 0], ['Photos', 2, 110947],
] as const)('streams and reopens the %s practice backup', async (fixture, photos, bytes) => {
  const root = mkdtempSync(join(tmpdir(), 'journal-streamed-restore-'));
  const dbFile = join(root, 'restored.sqlite');
  const input = join(root, 'archive');
  const readFrames = () => {
    const [evidence, manifest, ...frames] = execFileSync(process.env.JOURNAL_SNAPSHOT_HOST!,
      ['stream', root, '12233445566778899aabbccddeeff001'], {encoding: 'utf8'}).trimEnd().split('\n');
    return {document: evidence + '\n' + manifest, frames};
  };
  try {
    copyFileSync(join(__dirname, '../../../scripts/fixtures/journal-backup/JournalRestore' + fixture + '.bin'), input);
    const {document, frames} = readFrames();
    const apply = (db: ReturnType<typeof connect>, messages: string[]) =>
      restoreStreamedSnapshot(db, document, async (_token, discard) => {
        if (discard) {return '';}
        const frame = messages.shift();
        if (!frame) {throw new Error('Interrupted read');}
        return frame;
      });
    const db = connect(dbFile);
    try {
      const interruptions = [frames.slice(0, -1)];
      if (photos) {
        interruptions.push(frames.slice(0, frames.findIndex(frame => frame.startsWith('end:')) + 1));
        interruptions.push(frames.map(frame => frame.startsWith('end:') ? frame + 'x' : frame));
      }
      for (const incomplete of interruptions) {
        await expect(apply(db, incomplete)).rejects.toThrow();
        expect((await db.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows).toEqual([]);
      }
      await db.execute('CREATE TABLE restore_kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL)');
      await db.execute('INSERT INTO restore_kv VALUES (?,?)', ['existing', 'keep this entry']);
      await expect(apply(db, [...frames])).rejects.toThrow('empty test journal');
      expect((await db.execute('SELECT v FROM restore_kv')).rows).toEqual([{v: 'keep this entry'}]);
      await db.execute('DELETE FROM restore_kv WHERE k=?', ['existing']);
      const result = await apply(db, [...frames]);
      expect(result).toMatchObject({photos, bytes});
      if (photos) {expect(result.chunks).toBeGreaterThan(photos);}
    } finally {db.close();}
    const reopened = connect(dbFile);
    try {
      await expect(apply(reopened, [...frames])).resolves.toMatchObject({photos, bytes});
      if (photos) {
        const chunks = (await reopened.execute('SELECT file,encoded FROM restore_photo_chunks ORDER BY file,part')).rows;
        const hashByFile = new Map<string, ReturnType<typeof createHash>>();
        for (const chunk of chunks) {
          const file = String(chunk.file);
          const hash = hashByFile.get(file) ?? createHash('sha256');
          const decoded = Buffer.from(String(chunk.encoded), 'base64');
          expect(decoded.length).toBeLessThanOrEqual(32768);
          hash.update(decoded);
          hashByFile.set(file, hash);
        }
        const manifest = JSON.parse(document.split('\n')[1]);
        for (const asset of manifest.assets) {
          expect(hashByFile.get('photo-' + asset.assetId.replace(/-/g, ''))?.digest('hex')).toBe(asset.sha256);
        }
      }
      await expect(apply(reopened, frames.slice(0, -1))).rejects.toThrow();
      await expect(apply(reopened, [...frames])).resolves.toMatchObject({photos, bytes});
    } finally {reopened.close();}
    const corrupted = readFileSync(input);
    corrupted[corrupted.length - 1] ^= 1;
    writeFileSync(input, corrupted);
    expect(readFrames).toThrow();
  } finally {rmSync(root, {recursive: true, force: true});}
});
