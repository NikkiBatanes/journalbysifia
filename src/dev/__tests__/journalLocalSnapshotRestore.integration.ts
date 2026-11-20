import AsyncStorage from '@react-native-async-storage/async-storage';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJournalBackup} from '../../services/journalBackupContract';
import {openRestoreSession} from '../journalRestoreDatabase';
import {planStagedLocalSnapshot, prepareJournalPhotoExport} from '../prepareJournalPhotoManifest';
import {hasDeviceRestoreSample, readDeviceSample, restoreDeviceSample} from '../journalDeviceSnapshotRestore';
import {readPracticePhotoReflection} from '../readPracticePhotoReflection';
import {restoreStreamedSnapshot} from '../journalStreamingSnapshotRestore';
import {connect} from './restoreTestDatabase';
import {loadLocalReflectionData, saveLocalReflectionEdit} from '../../services/hooks/useReflectionData';
import {ensureJournalBlockIds, journalBlocksToPlainText, prepareJournalBlocksForSave} from '../../components/journal/shared/journalBlocks';

jest.mock('../../context/IndustryStandardAuthContext', () => ({useAuth: () => ({user: null})}));

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

it('adds a missing reflection and both photos atomically to an existing practice journal', async () => {
  const {env} = process;
  const worker = env.JOURNAL_ADDITION_INTERRUPT;
  const root = worker ? env.JOURNAL_ADDITION_ROOT : mkdtempSync(join(tmpdir(), 'journal-photo-add-'));
  if (!root) {throw new Error('Missing test database directory');}
  const file = join(root, 'device.sqlite');
  const day = '2026-11-20';
  const original = {id: 'device', selected_date: day, type: 'free', created_at: day + 'T12:00:00Z',
    updated_at: day + 'T12:00:00Z', content: 'Keep my reflection'};
  const originalKey = 'reflection_local:free:' + day + ':device';
  if (!worker) {
    copyFileSync(join(__dirname, '../../../scripts/fixtures/journal-backup/JournalRestorePhotos.bin'), join(root, 'archive'));
  }
  const [header, manifest, ...frames] = execFileSync(env.JOURNAL_SNAPSHOT_HOST!,
    ['stream', root, '12233445566778899aabbccddeeff001'], {encoding: 'utf8'}).trimEnd().split('\n');
  const document = header + '\n' + manifest;
  const inventory = JSON.parse(manifest).backup.inventory;
  const restoredKey = inventory.recordLocations.reflectionRecords[0].key;
  const id = inventory.reflectionRecords[0].id;
  const index = 'reflection_local_index:free:' + inventory.reflectionRecords[0].selected_date;
  const db = connect(file);
  const apply = async (cut?: string) => {
    let cursor = 0;
    return restoreStreamedSnapshot({
      execute: db.execute,
      transaction: work => db.transaction(tx => work({async execute(sql, params) {
        const result = await tx.execute(sql, params);
        if ((cut === 'photo' && sql.startsWith('INSERT INTO restore_photo_chunks')) ||
            (cut === 'entry' && sql.startsWith('INSERT OR REPLACE INTO restore_kv') && params?.[0] === restoredKey)) {
          process.kill(process.pid, 'SIGKILL');
        }
        return result;
      }})),
    }, document, async (_token, discard) => discard ? '' : frames[cursor++], true);
  };
  if (worker) {
    await apply(worker);
    throw new Error('Did not reach the interruption');
  }
  try {
    await openRestoreSession(db);
    await db.execute('INSERT INTO restore_kv VALUES (?,?)', [originalKey, JSON.stringify(original)]);
    await db.execute('INSERT INTO restore_kv VALUES (?,?)', [index, JSON.stringify([original.id])]);
    for (const cut of ['photo', 'entry']) {
      const child = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--watchman=false',
        '--testMatch', '**/journalLocalSnapshotRestore.integration.ts', '-t', 'adds a missing reflection'],
        {env: {...env, JOURNAL_ADDITION_ROOT: root, JOURNAL_ADDITION_INTERRUPT: cut}, timeout: 45000});
      if (child.signal !== 'SIGKILL') {throw new Error('Missing interruption: ' + String(child.error ?? child.stderr));}
      expect((await db.execute('SELECT v FROM restore_kv WHERE k=?', [originalKey])).rows[0]?.v).toBe(JSON.stringify(original));
      expect((await db.execute('SELECT v FROM restore_kv WHERE k=?', [index])).rows[0]?.v).toBe('["device"]');
      expect((await db.execute('SELECT k FROM restore_kv WHERE k=?', [restoredKey])).rows).toHaveLength(0);
      expect((await db.execute("SELECT name FROM sqlite_master WHERE name='restore_photo_chunks'")).rows).toHaveLength(0);
    }
    await expect(apply()).resolves.toMatchObject({addedEntries: 1, photos: 2, bytes: 110947});
    const record = JSON.parse(String((await db.execute('SELECT v FROM restore_kv WHERE k=?', [restoredKey])).rows[0].v));
    const assets = JSON.parse(manifest).assets;
    const refs = record.metadata.journalBlocks.filter((block: {kind: string}) => block.kind === 'photo');
    expect(refs).toHaveLength(2);
    for (const [i, block] of refs.entries()) {
      const chunks = (await db.execute('SELECT encoded FROM restore_photo_chunks WHERE file=? ORDER BY part', [block.uri.slice(8)])).rows;
      const hash = createHash('sha256');
      chunks.forEach(chunk => hash.update(Buffer.from(String(chunk.encoded), 'base64')));
      expect(hash.digest('hex')).toBe(assets[i].sha256);
    }
    const reopened = connect(file);
    try {
      const view = await readPracticePhotoReflection(reopened);
      expect(view.content).toBe(record.content);
      expect(view.photos.map(photo => {
        expect(photo.uri).toMatch(/^data:image\/png;base64,/);
        return createHash('sha256').update(Buffer.from(photo.uri.split(',')[1], 'base64')).digest('hex');
      })).toEqual(assets.map((asset: {sha256: string}) => asset.sha256));
    } finally {reopened.close();}
    // Back the normal reflection repository with the practice database for this edit.
    // Only its AsyncStorage transport is substituted. Exercise the editor's block
    // preparation, mutation, and subsequent read through a fresh SQLite connection.
    const editorDb = connect(file);
    let savedValue: string;
    const getKeys = jest.spyOn(AsyncStorage, 'getAllKeys').mockImplementation(async () =>
      (await editorDb.execute('SELECT k FROM restore_kv')).rows.map(row => String(row.k)));
    const multiGet = jest.spyOn(AsyncStorage, 'multiGet').mockImplementation(async keys =>
      Promise.all(keys.map(async (key): Promise<[string, string | null]> => {
        const {rows} = await editorDb.execute('SELECT v FROM restore_kv WHERE k=?', [key]);
        return [key, rows.length ? String(rows[0].v) : null];
      })));
    const setItem = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      await editorDb.execute('INSERT OR REPLACE INTO restore_kv(k,v) VALUES (?,?)', [key, value]);
    });
    try {
      const [entry] = await loadLocalReflectionData(day, [id]);
      const editorBlocks = ensureJournalBlockIds(entry.journal_blocks!);
      const photos = editorBlocks.filter(block => block.kind === 'photo');
      expect(new Set(photos.map(photo => photo.id)).size).toBe(2);
      const blocks = prepareJournalBlocksForSave(editorBlocks.map(block =>
        block.id === photos[0].id ? {...block, text: 'Edited caption'} : block));
      const content = journalBlocksToPlainText(blocks);
      await Promise.all([
        saveLocalReflectionEdit({id, updates: {content, journal_blocks: blocks}}),
        saveLocalReflectionEdit({id, updates: {title: 'Edited title'}}),
      ]);
      savedValue = String((await editorDb.execute('SELECT v FROM restore_kv WHERE k=?', [restoredKey])).rows[0].v);
      expect(savedValue).not.toContain('data:image');
      expect(JSON.parse(savedValue)).toMatchObject({id, selected_date: day, title: 'Edited title', content,
        version: (record.version || 1) + 2, metadata: {journalBlocks: blocks}});
    } finally {
      getKeys.mockRestore();
      multiGet.mockRestore();
      setItem.mockRestore();
      editorDb.close();
    }
    await expect(apply()).resolves.toMatchObject({addedEntries: 0, photos: 0});
    const afterEdit = connect(file);
    try {
      expect((await afterEdit.execute('SELECT v FROM restore_kv WHERE k=?', [restoredKey])).rows[0].v).toBe(savedValue);
      const view = await readPracticePhotoReflection(afterEdit);
      expect(view.photos.map(photo => photo.caption)).toEqual(['Edited caption', '']);
      expect(view.photos.map(photo =>
        createHash('sha256').update(Buffer.from(photo.uri.split(',')[1], 'base64')).digest('hex'),
      )).toEqual(assets.map((asset: {sha256: string}) => asset.sha256));
    } finally {afterEdit.close();}
    expect(JSON.parse(String((await db.execute('SELECT v FROM restore_kv WHERE k=?', [index])).rows[0].v))).toEqual(['device', id]);
    expect((await db.execute('SELECT v FROM restore_kv WHERE k=?', [originalKey])).rows[0].v).toBe(JSON.stringify(original));
    await db.execute('DELETE FROM restore_photo_chunks WHERE file=? AND part=1', [refs[1].uri.slice(8)]);
    await expect(readPracticePhotoReflection(db)).rejects.toThrow();
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
}, 120000);
