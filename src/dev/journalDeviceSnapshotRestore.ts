import {v4 as uuid} from 'uuid';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';
import {planStagedLocalSnapshot} from './prepareJournalPhotoManifest';

const databaseName = 'journal-snapshot-files-sample-v1.sqlite';
const digest = '20ea48e4aa5a9b6402a7f8a354b785ab9372b433951d64f637548803b6e8c9b8';
const expectedPng = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAHElEQVR4nGP4djgSjtzKI+CIgYoSyBxkRVSUAAB78WThsDardQAAAABJRU5ErkJggg==';
const filename = 'photo-' + digest.slice(0, 32);
const recordKey = 'reflection_local:free:2026-11-20:r1';
const indexKey = 'reflection_local_index:free:2026-11-20';

export function hasDeviceRestoreSample(document: string) {
  const end = document.indexOf('\n');
  return end > 0 && JSON.parse(document.slice(0, end)).practicePhotoBase64 === expectedPng;
}

export async function restoreDeviceSample(db: RestoreDatabase, document: string) {
  if (!hasDeviceRestoreSample(document)) {throw new Error('Expected Files test sample');}
  const encoded = JSON.parse(document.slice(0, document.indexOf('\n'))).practicePhotoBase64;
  const plan = planStagedLocalSnapshot(document, [{file: filename, sha256: digest, byteLength: 85}]);
  await db.transaction(async tx => {
    const session = await openRestoreSession({execute: tx.execute.bind(tx), transaction: work => work(tx)});
    await tx.execute('CREATE TABLE IF NOT EXISTS sample_photo (name TEXT PRIMARY KEY, encoded TEXT NOT NULL)');
    await tx.execute('INSERT OR REPLACE INTO sample_photo (name,encoded) VALUES (?,?)', [filename, encoded]);
    await session.restore(plan, uuid());
  });
}

export async function readDeviceSample(db: RestoreDatabase) {
  const session = await openRestoreSession(db);
  const entry = JSON.parse((await session.read(recordKey)) ?? 'null');
  const index = JSON.parse((await session.read(indexKey)) ?? 'null');
  const uri = entry?.metadata?.journalBlocks?.[0]?.uri;
  if (entry?.id !== 'r1' || entry.content !== 'QA fixture' || uri !== 'objects/' + filename ||
      !Array.isArray(index) || index.length !== 1 || index[0] !== entry.id) {
    throw new Error('Restored reflection or index differs');
  }
  const {rows} = await db.execute('SELECT encoded FROM sample_photo WHERE name=?', [uri.slice(8)]);
  if (rows.length !== 1 || rows[0].encoded !== expectedPng) {throw new Error('Restored photo differs');}
  return {content: String(entry.content), photoBytes: 85, photoUri: 'data:image/png;base64,' + rows[0].encoded};
}

export async function checkDeviceSnapshot(document?: string) {
  const {open} = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const keys = require('../services/journalEncryptedStorageSpike') as typeof import('../services/journalEncryptedStorageSpike');
  const encryptionKey = document ? await keys.getOrCreateSpikeEncryptionKey() : await keys.readSpikeEncryptionKey();
  if (!encryptionKey) {throw new Error('No saved sample key');}
  const db = open({name: databaseName, encryptionKey, failOnCreate: !document});
  try {
    const {rows} = await db.execute('PRAGMA cipher_version');
    if (!rows[0]?.cipher_version) {throw new Error('Encrypted test journal unavailable');}
    if (document) {await restoreDeviceSample(db, document);}
    return await readDeviceSample(db);
  } finally {db.close();}
}
