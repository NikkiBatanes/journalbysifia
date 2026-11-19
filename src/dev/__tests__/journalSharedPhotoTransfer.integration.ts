import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import archive from '../../native/NativeJournalArchiveCrypto';
import {applySharedPhotoTransfer, prepareSampleComparison, verifySharedPhotoTransfer} from '../journalSharedPhotoTransferProbe';
import {openRestoreSession} from '../journalRestoreDatabase';
import {connect} from './restoreTestDatabase';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({
  importSharedPhotoTransfer: jest.fn(), verifyTransferredPhotos: jest.fn(),
}));
jest.mock('../../services/journalEncryptedStorageSpike', () => ({}));
jest.mock('uuid', () => ({v4: jest.requireActual('node:crypto').randomUUID}));
jest.mock('@op-engineering/op-sqlite', () => ({}));

it('restores both entries from one encrypted file and rejects a damaged second photo before changing the journal', async () => {
  const {JOURNAL_TRANSFER_HOST: host} = process.env;
  if (!host) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled transfer diagnostic');}
  const root = mkdtempSync(join(tmpdir(), 'journal-shared-transfer-'));
  const source = join(root, 'source'), target = join(root, 'target');
  mkdirSync(source);
  mkdirSync(target);
  const file = 'journal-shared-transfer-test.bin';
  const dbFile = join(target, 'journal.sqlite');
  const run = (args: string[], input?: Buffer) => execFileSync(host, args, {
    input, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  jest.mocked(archive.importSharedPhotoTransfer).mockImplementation(async () => run(['--read-shared', target]).toString());
  jest.mocked(archive.verifyTransferredPhotos).mockImplementation(async (...args) => {
    run(['--verify-pair', target, ...args]);
    return true;
  });
  let db = connect(dbFile);
  try {
    const token = run(['--export-shared', source]).toString().trim();
    expect(readdirSync(source)).toEqual([file]);
    copyFileSync(join(source, file), join(target, file));
    rmSync(source, {recursive: true});
    const destination = join(target, file);
    const ciphertext = readFileSync(destination);
    expect(ciphertext.includes(token)).toBe(false);
    let session = await openRestoreSession(db);
    const expected = await applySharedPhotoTransfer(session);
    const compareTarget = join(root, 'compare');
    mkdirSync(compareTarget);
    copyFileSync(destination, join(compareTarget, file));
    let existing = connect(join(compareTarget, 'existing.sqlite'));
    try {
      const comparison = await prepareSampleComparison(existing, 'Call Mom.');
      const existingSession = await openRestoreSession(existing);
      const snapshot = () => existing.execute('SELECT k,v FROM restore_kv ORDER BY k');
      const original = await snapshot();
      const document = run(['--read-shared', compareTarget]).toString();
      await expect(applySharedPhotoTransfer(existingSession, document, {...comparison, backupText: 'Older preview'}))
        .rejects.toThrow('no longer matches');
      expect(await snapshot()).toEqual(original);
      const indexKey = 'journal_local_index:todo:2026-11-19';
      const originalIndex = await existingSession.read(indexKey);
      if (originalIndex === null) {throw new Error('Expected the seeded sample index');}
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', ['["device-only","first","unexpected"]', indexKey]);
      const changedIndex = await snapshot();
      await expect(applySharedPhotoTransfer(existingSession, document, comparison)).rejects.toThrow('changed during preview');
      expect(await snapshot()).toEqual(changedIndex);
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', [originalIndex, indexKey]);
      await existing.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', ['journal:local-profile', '{}']);
      const withProfile = await snapshot();
      await expect(applySharedPhotoTransfer(existingSession, document, comparison)).rejects.toThrow('Unexpected sample journal');
      expect(await snapshot()).toEqual(withProfile);
      await existing.execute('DELETE FROM restore_kv WHERE k=?', ['journal:local-profile']);
      const kept = await applySharedPhotoTransfer(existingSession, document, comparison);
      expect(kept.entries[0].id).not.toBe('first');
      existing.close();
      existing = connect(join(compareTarget, 'existing.sqlite'));
      jest.mocked(archive.verifyTransferredPhotos).mockImplementationOnce(async (...args) => {
        run(['--verify-pair', compareTarget, ...args]);
        return true;
      });
      expect(await verifySharedPhotoTransfer(await openRestoreSession(existing), kept)).toBe(token);
    } finally {
      existing.close();
    }
    rmSync(destination);
    db.close();
    db = connect(dbFile);
    session = await openRestoreSession(db);
    expect(await verifySharedPhotoTransfer(session, expected)).toBe(token);
    const before = await db.execute('SELECT k,v FROM restore_kv ORDER BY k');
    const imageDir = join(target, 'journal-shared-transfer-images');
    const originalFiles = readdirSync(imageDir).sort();
    expect(originalFiles.length).toBe(2);
    const payload = run(['--open-photo'], ciphertext);
    const last = payload.length - 1;
    payload[last] = (payload[last] + 1) % 256;
    for (const damaged of [ciphertext.subarray(0, -64), run(['--seal-photo'], payload)]) {
      writeFileSync(destination, damaged);
      await expect(applySharedPhotoTransfer(session)).rejects.toThrow();
      expect(await db.execute('SELECT k,v FROM restore_kv ORDER BY k')).toEqual(before);
      expect(readdirSync(imageDir).sort()).toEqual(originalFiles);
      expect(await verifySharedPhotoTransfer(session, expected)).toBe(token);
    }
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
}, 90000);
