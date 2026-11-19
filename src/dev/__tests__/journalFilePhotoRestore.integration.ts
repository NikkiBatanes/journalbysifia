import {execFileSync, spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {crc32, deflateSync} from 'node:zlib';
import {planJournalBackupRestore} from '../../services/journalBackupRestorePlan';
import {openRestoreSession} from '../journalRestoreDatabase';
import {connect} from './restoreTestDatabase';

const host = process.env.JOURNAL_TRANSFER_HOST!;
const entryKey = 'journal_local:todo:2026-11-19:fixture';
const indexKey = 'journal_local_index:todo:2026-11-19';
const workerRoot = process.env.JOURNAL_PHOTO_WORKER_DIR;

function run(args: string[], input?: Buffer) {
  return execFileSync(host, args, {input, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']});
}

// A reproducible 1600 x 1200 grayscale PNG with enough detail to span many writes.
function makePhoto(seed: number) {
  const width = 1600;
  const height = 1200;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) {
    for (let x = 1; x <= width; x++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      scanlines[row * (width + 1) + x] = seed & 255;
    }
  }
  function chunk(type: string, data: Buffer) {
    const payload = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(payload));
    return Buffer.concat([length, payload, checksum]);
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

function stageArgs(root: string, label: string, cut: string) {
  const file = join(root, label + '.sealed');
  const bytes = readFileSync(file);
  return ['--stage-photo', file, join(root, 'objects'), String(bytes.length),
    createHash('sha256').update(bytes).digest('hex'), cut];
}

function photoPlan(root: string, label: string, name: string) {
  const backup = JSON.parse(readFileSync(join(root, 'template.json'), 'utf8'));
  const entry = backup.inventory.journalRecords[0];
  entry.content = label;
  entry.metadata.journalBlocks[0].uri = 'objects/' + name;
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid) {throw new Error('Invalid test photo restore plan');}
  return plan;
}

if (workerRoot) {
  it('stops the process after committing the replacement record, before completing restore', async () => {
    const db = connect(join(workerRoot, 'journal.sqlite'));
    const name = run(stageArgs(workerRoot, 'replacement', 'finish')).toString().trim();
    const session = await openRestoreSession({
      execute: db.execute,
      async transaction(work) {
        await db.transaction(work);
        const {rows} = await db.execute('SELECT v FROM restore_kv WHERE k=?', [entryKey]);
        if (rows.length && JSON.parse(String(rows[0].v)).content === 'replacement') {
          process.kill(process.pid, 'SIGKILL');
        }
      },
    });
    await session.restore(photoPlan(workerRoot, 'replacement', name), randomUUID());
    throw new Error('Restore never reached the expected interruption');
  });
} else {
  it('recovers the matching journal and encrypted photo at each interruption, then retries', async () => {
    if (!host) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled synthetic transfer test');}
    const root = mkdtempSync(join(tmpdir(), 'journal-file-photo-'));
    const objects = join(root, 'objects');
    const file = join(root, 'journal.sqlite');
    const original = makePhoto(123);
    const replacement = makePhoto(321);
    let db = connect(file);
    try {
      mkdirSync(objects, {mode: 0o700});
      writeFileSync(join(objects, 'keep.txt'), 'unmanaged');
      run(['--samples', root]);
      const {manifest} = JSON.parse(run(['--read', join(root, 'valid')]).toString());
      writeFileSync(join(root, 'template.json'), JSON.stringify(manifest.backup));
      for (const [label, png] of [['original', original], ['replacement', replacement]] as const) {
        expect(png.length).toBeGreaterThan(1024 * 1024);
        writeFileSync(join(root, label + '.sealed'), run(['--seal-photo'], png));
      }
      let session = await openRestoreSession(db);
      const oldName = run(stageArgs(root, 'original', 'finish')).toString().trim();
      await session.restore(photoPlan(root, 'original', oldName), randomUUID());

      const reopenAndCheck = async (label: string, png: Buffer, rollback: boolean) => {
        db.close();
        db = connect(file);
        session = await openRestoreSession(db);
        expect(session.recovered !== null).toBe(rollback);
        const entry = JSON.parse((await session.read(entryKey))!);
        expect(entry.content).toBe(label);
        expect(JSON.parse((await session.read(indexKey))!)).toEqual([entry.id]);
        const uri = entry.metadata.journalBlocks[0].uri;
        expect(uri).toMatch(/^objects\/photo-[0-9a-f]{32}$/);
        expect(run(['--open-photo'], readFileSync(join(root, uri))).equals(png)).toBe(true);
        return uri.slice('objects/'.length) as string;
      };

      for (const cut of ['halfway', 'published', 'entry-written']) {
        const child = cut === 'entry-written'
          ? spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--coverage=false',
              '--testMatch', '**/journalFilePhotoRestore.integration.ts'],
              {env: {...process.env, JOURNAL_PHOTO_WORKER_DIR: root}, timeout: 45000})
          : spawnSync(host, stageArgs(root, 'replacement', cut), {timeout: 10000});
        if (child.signal !== 'SIGKILL') {
          throw new Error('Expected forced interruption at ' + cut + ': ' + String(child.error ?? child.stderr));
        }
        if (cut === 'halfway') {
          const partial = readdirSync(objects).filter(name => name.startsWith('partial-'));
          expect(partial).toHaveLength(1);
          const size = statSync(join(objects, partial[0])).size;
          expect(size).toBeGreaterThan(0);
          expect(size).toBeLessThan(statSync(join(root, 'replacement.sealed')).size);
        } else {
          expect(readdirSync(objects).filter(name => name.startsWith('photo-'))).toHaveLength(2);
        }
        if (cut === 'entry-written') {
          const {rows} = await db.execute('SELECT v FROM restore_kv WHERE k=?', [entryKey]);
          expect(JSON.parse(String(rows[0].v)).content).toBe('replacement');
        }
        expect(await reopenAndCheck('original', original, cut === 'entry-written')).toBe(oldName);
        run(['--collect-photo', objects, oldName]);
        expect(readdirSync(objects).sort()).toEqual(['keep.txt', oldName].sort());
      }

      const invalid = stageArgs(root, 'replacement', 'finish');
      invalid[4] = '0'.repeat(64);
      expect(() => run(invalid)).toThrow();
      expect(readdirSync(objects).sort()).toEqual(['keep.txt', oldName].sort());

      const newName = run(stageArgs(root, 'replacement', 'finish')).toString().trim();
      await session.restore(photoPlan(root, 'replacement', newName), randomUUID());
      expect(await reopenAndCheck('replacement', replacement, false)).toBe(newName);
      run(['--collect-photo', objects, newName]);
      expect(readdirSync(objects).sort()).toEqual(['keep.txt', newName].sort());
      expect(await reopenAndCheck('replacement', replacement, false)).toBe(newName);
    } finally {
      db.close();
      rmSync(root, {recursive: true, force: true});
    }
  }, 90000);
}
