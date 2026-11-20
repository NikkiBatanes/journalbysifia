import {v4 as uuid} from 'uuid';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';
import {planStagedLocalSnapshot} from './prepareJournalPhotoManifest';

type NextFrame = (token: string, discard: boolean) => Promise<string>;
type StagedPhoto = {file: string; byteLength: number; sha256: string};

export function localSnapshotToken(document: string): string | undefined {
  const end = document.indexOf('\n');
  if (end <= 0) {return undefined;}
  const token = JSON.parse(document.slice(0, end)).restoreToken;
  return typeof token === 'string' && /^[0-9a-f]{32}$/.test(token) ? token : undefined;
}

// Called with an exclusively owned SQLCipher test database. The outer transaction
// includes every chunk, rebuilt record/index and the completion marker.
export async function restoreStreamedSnapshot(db: RestoreDatabase, document: string, next: NextFrame) {
  const token = localSnapshotToken(document);
  if (!token) {throw new Error('Open the practice backup again');}
  try {
    const end = document.indexOf('\n');
    const manifest = JSON.parse(document.slice(end + 1));
    const photos: StagedPhoto[] = manifest.assets.map((asset: {assetId: string; byteLength: number; sha256: string}) => ({
      file: 'photo-' + asset.assetId.replace(/-/g, ''), byteLength: asset.byteLength, sha256: asset.sha256,
    }));
    const plan = planStagedLocalSnapshot(document, photos);
    let bytes = 0;
    let chunkCount = 0;
    await db.transaction(async tx => {
      await tx.execute('CREATE TABLE IF NOT EXISTS restore_photo_chunks (file TEXT NOT NULL, part INTEGER NOT NULL, encoded TEXT NOT NULL, PRIMARY KEY(file,part))');
      await tx.execute('CREATE TABLE IF NOT EXISTS restore_snapshot (slot INTEGER PRIMARY KEY CHECK(slot=1), manifest TEXT NOT NULL)');
      const session = await openRestoreSession({execute: tx.execute.bind(tx), transaction: work => work(tx)});
      const saved = (await tx.execute('SELECT manifest FROM restore_snapshot WHERE slot=1')).rows;
      const replay = saved.length === 1;
      if (replay && saved[0].manifest !== document.slice(end + 1)) {throw new Error('The test journal already contains another backup');}
      if (!replay) {
        const existing = await tx.execute('SELECT 1 FROM restore_kv UNION ALL SELECT 1 FROM restore_photo_chunks LIMIT 1');
        if (existing.rows.length) {throw new Error('An empty test journal is required');}
      }
      for (const photo of photos) {
        let part = 0;
        let length = 0;
        for (;;) {
          const frame = await next(token, false);
          if (frame.startsWith('end:')) {
            if (frame !== `end:${photo.byteLength}:${photo.sha256}` || length !== photo.byteLength) {
              throw new Error('Restored photo differs from the backup');
            }
            break;
          }
          if (!frame.length || frame === 'final' || frame.length > 43692 || frame.length % 4 !== 0 ||
              !/^[A-Za-z0-9+/]+={0,2}$/.test(frame)) {throw new Error('Invalid photo chunk');}
          const padding = frame.endsWith('==') ? 2 : frame.endsWith('=') ? 1 : 0;
          length += frame.length / 4 * 3 - padding;
          if (length > photo.byteLength) {throw new Error('Photo exceeds expected length');}
          const key = [photo.file, String(part++)];
          if (!replay) {await tx.execute('INSERT INTO restore_photo_chunks VALUES (?,?,?)', [...key, frame]);}
          const {rows} = await tx.execute('SELECT encoded FROM restore_photo_chunks WHERE file=? AND part=?', key);
          if (rows[0]?.encoded !== frame) {throw new Error('Saved photo chunk differs');}
        }
        bytes += length;
        chunkCount += part;
      }
      if (await next(token, false) !== 'final') {throw new Error('Expected authenticated end of backup');}
      const total = await tx.execute('SELECT count(*) AS n FROM restore_photo_chunks');
      if (total.rows[0]?.n !== chunkCount) {throw new Error('Unexpected saved photo chunks');}
      if (replay) {
        const count = await tx.execute('SELECT count(*) AS n FROM restore_kv');
        if (count.rows[0]?.n !== plan.operations.length) {throw new Error('Unexpected saved records');}
        for (const op of plan.operations) {
          if (await session.read(op.key) !== op.value) {throw new Error('Saved record differs');}
        }
      } else {
        await session.restore(plan, uuid());
        await tx.execute('INSERT INTO restore_snapshot VALUES (1,?)', [document.slice(end + 1)]);
      }
    });
    return {photos: photos.length, bytes, chunks: chunkCount};
  } finally {
    await next(token, true);
  }
}

export async function checkStreamedDeviceSnapshot(document: string, next: NextFrame) {
  const {open} = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const {getOrCreateSpikeEncryptionKey} = require('../services/journalEncryptedStorageSpike') as typeof import('../services/journalEncryptedStorageSpike');
  const snapshotId = JSON.parse(document.slice(document.indexOf('\n') + 1)).snapshotId;
  if (!/^[0-9a-f-]{36}$/.test(snapshotId) || !localSnapshotToken(document)) {throw new Error('Invalid practice snapshot');}
  const db = open({name: 'journal-files-practice-' + snapshotId + '.sqlite', encryptionKey: await getOrCreateSpikeEncryptionKey()});
  try {
    if (!(await db.execute('PRAGMA cipher_version')).rows[0]?.cipher_version) {throw new Error('Encrypted test journal unavailable');}
    return await restoreStreamedSnapshot(db, document, next);
  } finally {db.close();}
}
