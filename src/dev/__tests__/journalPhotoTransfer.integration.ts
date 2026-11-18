import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyTransferredFixture} from '../journalArchiveTransferProbe';
import {openRestoreSession} from '../journalRestoreDatabase';
import archive from '../../native/NativeJournalArchiveCrypto';
import {connect} from './restoreTestDatabase';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({importSyntheticTransfer: jest.fn()}));
jest.mock('../../services/journalEncryptedStorageSpike', () => ({}));
jest.mock('uuid', () => ({v4: jest.requireActual('node:crypto').randomUUID}));
jest.mock('@op-engineering/op-sqlite', () => ({}));

it('restores the native photo, preserves prior contents on invalid imports, and accepts older text backups', async () => {
  const executable = process.env.JOURNAL_TRANSFER_HOST;
  if (!executable) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled synthetic transfer test');}
  const root = mkdtempSync(join(tmpdir(), 'journal-photo-integration-'));
  const file = join(root, 'destination.sqlite');
  function selectArchive(name: string) {
    jest.mocked(archive.importSyntheticTransfer).mockImplementation(async () =>
      execFileSync(executable!, ['--read', join(root, name)], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  }
  let db = connect(file);
  try {
    const token = execFileSync(executable, ['--samples', root], {encoding: 'utf8'}).trim();
    let session = await openRestoreSession(db);
    selectArchive('valid');
    await applyTransferredFixture(session);
    db.close();
    db = connect(file);
    session = await openRestoreSession(db);
    const key = 'journal_local:todo:2026-11-19:fixture';
    const record = JSON.parse((await session.read(key))!);
    expect(record.content).toBe('synthetic-' + token);
    const [prefix, image] = record.metadata.journalBlocks[0].uri.split(',');
    expect(prefix).toBe('data:image/png;base64');
    expect(createHash('sha256').update(Buffer.from(image, 'base64')).digest('hex'))
      .toBe('2761c10bfda1b80b82c2200d6791c35f6936e79bd89efa40fdddb0772af0d174');
    expect(JSON.parse((await session.read('journal_local_index:todo:2026-11-19'))!)).toEqual(['fixture']);

    await db.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', ['review_settings_v1', '{"existing":true}']);
    const snapshot = () => db.execute('SELECT k,v FROM restore_kv ORDER BY k');
    const before = await snapshot();
    for (const variant of ['missing', 'damaged']) {
      selectArchive(variant);
      await expect(applyTransferredFixture(session)).rejects.toThrow(/Synthetic transfer fixture failed verification/);
      db.close();
      db = connect(file);
      session = await openRestoreSession(db);
      expect(await snapshot()).toEqual(before);
    }

    selectArchive('text');
    await applyTransferredFixture(session);
    const oldRecord = JSON.parse((await session.read(key))!);
    expect(oldRecord.content).toBe('synthetic-' + token);
    expect(oldRecord.metadata?.journalBlocks).toBeUndefined();
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});
