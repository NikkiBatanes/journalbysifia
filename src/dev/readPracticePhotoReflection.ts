import {fromByteArray, toByteArray} from 'base64-js';
import type {RestoreDatabase} from './journalRestoreDatabase';

export const practiceAdditionsDatabase = 'journal-files-practice-additions-v1.sqlite';
const practiceRecordKey = 'reflection_local:free:2026-11-20:r1';

// This viewer only opens the two PNGs in the authenticated Files practice fixture.
// Keep the working set bounded and never write a decoded photo back to storage.
const fixturePhotoSizes = new Map([
  ['objects/photo-85c36812617142c3a7186aba135514b0', 85],
  ['objects/photo-85c36812617142c3a7186aba135514b1', 110862],
]);

export async function readPracticePhotoReflection(db: RestoreDatabase) {
  let content = '';
  const photos: {uri: string; caption: string}[] = [];
  await db.transaction(async tx => {
    const {rows} = await tx.execute('SELECT v FROM restore_kv WHERE k=?', [practiceRecordKey]);
    const record = JSON.parse(String(rows[0]?.v ?? 'null'));
    if (record?.id !== 'r1' || typeof record.content !== 'string' ||
        !Array.isArray(record.metadata?.journalBlocks)) {
      throw new Error('Practice reflection unavailable');
    }
    content = record.content;
    const blocks = record.metadata.journalBlocks.filter((block: {kind: string}) => block?.kind === 'photo');
    if (blocks.length !== 2 || blocks[0].uri === blocks[1].uri) {
      throw new Error('Practice photo references differ');
    }
    for (const block of blocks) {
      const size = fixturePhotoSizes.get(block.uri);
      if (!size) {throw new Error('Unexpected practice photo reference');}
      const chunks = await tx.execute(
        'SELECT part, CASE WHEN length(encoded) <= 43692 THEN encoded END AS chunk ' +
        'FROM restore_photo_chunks WHERE file=? ORDER BY part LIMIT 5', [block.uri.slice(8)],
      );
      if (chunks.rows.length >= 5) {throw new Error('Too many practice photo chunks');}
      const image = new Uint8Array(size);
      let offset = 0;
      for (const [index, row] of chunks.rows.entries()) {
        if (row.part !== index || typeof row.chunk !== 'string' || !row.chunk.length ||
            row.chunk.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(row.chunk)) {
          throw new Error('Invalid stored practice photo chunk');
        }
        const bytes = toByteArray(row.chunk);
        if (offset + bytes.length > size) {throw new Error('Unexpected practice photo size');}
        image.set(bytes, offset);
        offset += bytes.length;
      }
      if (offset !== size) {throw new Error('Incomplete stored practice photo');}
      photos.push({uri: 'data:image/png;base64,' + fromByteArray(image),
        caption: typeof block.text === 'string' ? block.text : ''});
    }
  });
  return {content, photos};
}

export async function reopenPracticePhotoReflection() {
  const {open} = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const {readSpikeEncryptionKey} = require('../services/journalEncryptedStorageSpike') as typeof import('../services/journalEncryptedStorageSpike');
  const encryptionKey = await readSpikeEncryptionKey();
  if (!encryptionKey) {throw new Error('Practice journal key unavailable');}
  const db = open({name: practiceAdditionsDatabase, encryptionKey, failOnCreate: true});
  try {
    if (!(await db.execute('PRAGMA cipher_version')).rows[0]?.cipher_version) {
      throw new Error('Encrypted practice journal unavailable');
    }
    return await readPracticePhotoReflection(db);
  } finally {db.close();}
}
