import {v4 as uuid} from 'uuid';
import {practiceAdditionsDatabase} from './readPracticePhotoReflection';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';
import {buildJournalBackupInventory} from '../services/journalBackupInventory';
import {planMissingLocalEntries, planStagedLocalSnapshot} from './prepareJournalPhotoManifest';

type NextFrame = (token: string, discard: boolean) => Promise<string>;
type StagedPhoto = {file: string; byteLength: number; sha256: string};

export function localSnapshotToken(document: string): string | undefined {
  const end = document.indexOf('\n');
  if (end <= 0) {return undefined;}
  const token = JSON.parse(document.slice(0, end)).restoreToken;
  return typeof token === 'string' && /^[0-9a-f]{32}$/.test(token) ? token : undefined;
}

async function transferPhoto(tx: Pick<RestoreDatabase, 'execute'>, photo: StagedPhoto,
  next: NextFrame, token: string, action: 'insert' | 'verify' | 'skip') {
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
    if (action === 'skip') {continue;}
    if (action === 'insert') {await tx.execute('INSERT INTO restore_photo_chunks VALUES (?,?,?)', [...key, frame]);}
    const {rows} = await tx.execute('SELECT encoded FROM restore_photo_chunks WHERE file=? AND part=?', key);
    if (rows[0]?.encoded !== frame) {throw new Error('Saved photo chunk differs');}
  }
  if (action !== 'skip') {
    const {rows} = await tx.execute('SELECT count(*) AS n FROM restore_photo_chunks WHERE file=?', [photo.file]);
    if (rows[0]?.n !== part) {throw new Error('Unexpected saved photo chunks');}
  }
  return part;
}

// Called with an exclusively owned SQLCipher test database. The outer transaction
// includes every chunk, rebuilt record/index and the completion marker.
export async function restoreStreamedSnapshot(db: RestoreDatabase, document: string, next: NextFrame, addMissing = false) {
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
    let addedEntries = 0;
    let storedPhotos = 0;
    await db.transaction(async tx => {
      await tx.execute('CREATE TABLE IF NOT EXISTS restore_photo_chunks (file TEXT NOT NULL, part INTEGER NOT NULL, encoded TEXT NOT NULL, PRIMARY KEY(file,part))');
      const session = await openRestoreSession({execute: tx.execute.bind(tx), transaction: work => work(tx)});
      if (addMissing) {
        const before = await session.captureEntries();
        const inventory = buildJournalBackupInventory(Array.from(before));
        const occupied = new Set([...inventory.journalRecords, ...inventory.reflectionRecords,
          ...inventory.prayerRecords].map(entry => entry.id));
        const additions = planMissingLocalEntries(plan, before, id => !occupied.has(id));
        const referenced = new Set<string>();
        for (const op of additions.operations) {
          if (op.kind !== 'record') {continue;}
          for (const block of JSON.parse(op.value).metadata?.journalBlocks ?? []) {
            if (block.kind === 'photo' && block.uri) {referenced.add(block.uri);}
          }
        }
        for (const photo of photos) {
          let action: 'insert' | 'verify' | 'skip' = 'skip';
          if (referenced.has('objects/' + photo.file)) {
            const existing = await tx.execute('SELECT 1 FROM restore_photo_chunks WHERE file=? LIMIT 1', [photo.file]);
            action = existing.rows.length ? 'verify' : 'insert';
            storedPhotos++;
            bytes += photo.byteLength;
          }
          chunkCount += await transferPhoto(tx, photo, next, token, action);
        }
        if (await next(token, false) !== 'final') {throw new Error('Expected authenticated end of backup');}
        addedEntries = additions.operationCounts.record;
        if (addedEntries) {await session.addEntries(additions, before, uuid());}
        return;
      }
      await tx.execute('CREATE TABLE IF NOT EXISTS restore_snapshot (slot INTEGER PRIMARY KEY CHECK(slot=1), manifest TEXT NOT NULL)');
      const saved = (await tx.execute('SELECT manifest FROM restore_snapshot WHERE slot=1')).rows;
      const replay = saved.length === 1;
      if (replay && saved[0].manifest !== document.slice(end + 1)) {throw new Error('The test journal already contains another backup');}
      if (!replay) {
        const existing = await tx.execute('SELECT 1 FROM restore_kv UNION ALL SELECT 1 FROM restore_photo_chunks LIMIT 1');
        if (existing.rows.length) {throw new Error('An empty test journal is required');}
      }
      for (const photo of photos) {
        chunkCount += await transferPhoto(tx, photo, next, token, replay ? 'verify' : 'insert');
        bytes += photo.byteLength;
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
    return {photos: addMissing ? storedPhotos : photos.length, bytes, chunks: chunkCount, addedEntries};
  } finally {
    await next(token, true);
  }
}

export async function checkStreamedDeviceSnapshot(document: string, next: NextFrame, addMissing = false) {
  const {open} = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const {getOrCreateSpikeEncryptionKey} = require('../services/journalEncryptedStorageSpike') as typeof import('../services/journalEncryptedStorageSpike');
  const snapshotId = JSON.parse(document.slice(document.indexOf('\n') + 1)).snapshotId;
  if (!/^[0-9a-f-]{36}$/.test(snapshotId) || !localSnapshotToken(document)) {throw new Error('Invalid practice snapshot');}
  const name = addMissing ? practiceAdditionsDatabase : 'journal-files-practice-' + snapshotId + '.sqlite';
  const db = open({name, encryptionKey: await getOrCreateSpikeEncryptionKey()});
  try {
    if (!(await db.execute('PRAGMA cipher_version')).rows[0]?.cipher_version) {throw new Error('Encrypted test journal unavailable');}
    return await restoreStreamedSnapshot(db, document, next, addMissing);
  } finally {db.close();}
}
