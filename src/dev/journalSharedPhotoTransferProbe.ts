import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {preflightJournalBackupArchiveRestore, utf8ByteLength} from '../services/journalBackupArchiveContract';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {generateSpikeEncryptionKey} from '../services/journalEncryptedStorageSpike';
import {openRestoreSession} from './journalRestoreDatabase';

type Session = Awaited<ReturnType<typeof openRestoreSession>>;
const prefix = 'journal_local:todo:2026-11-19:';
const indexKey = 'journal_local_index:todo:2026-11-19';
const sharedId = 'cf890a91-410a-4526-9d47-8aa7085ec351';
const otherId = '91470c9f-7d1d-49aa-9644-8961d590b5ab';
const names = /^photo-[a-f0-9]{32}$/;

export async function applySharedPhotoTransfer(session: Session, document?: string) {
  const received = JSON.parse(document ?? await archive.importSharedPhotoTransfer());
  const {manifest, sharedFile, otherFile, token} = received;
  if (!/^[a-f0-9]{32}$/.test(token) || !names.test(sharedFile) || !names.test(otherFile) || sharedFile === otherFile) {
    throw new Error('Unexpected transferred photo identifiers');
  }
  const validated = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength: received.containerByteLength,
    manifestByteLength: utf8ByteLength(JSON.stringify(manifest)),
    authenticatedFinalMarkerVerified: true,
    assetByteLengths: {[sharedId]: received.sharedBytes, [otherId]: received.otherBytes},
  });
  if (!validated.valid || !validated.manifest) {throw new Error('Two-photo manifest failed validation');}
  const {assets, backup} = validated.manifest;
  const [shared, other] = assets;
  if (assets.length !== 2 || shared.assetId !== sharedId || other.assetId !== otherId ||
      assets.some(asset => asset.ownerRecordId !== 'first' || asset.mediaType !== 'image/png')) {
    throw new Error('Unexpected photo inventory');
  }
  const entries = backup.inventory.journalRecords;
  const expected = [
    {id: 'first', assets: [shared, other], files: [sharedFile, otherFile]},
    {id: 'second', assets: [shared], files: [sharedFile]},
  ];
  if (entries.length !== expected.length) {throw new Error('Unexpected entry count');}
  entries.forEach((entry, i) => {
    const row = expected[i];
    const blocks = entry.metadata?.journalBlocks;
    if (entry.id !== row.id || entry.content !== row.id + '-' + token ||
        !Array.isArray(blocks) || blocks.length !== row.assets.length) {
      throw new Error('Unexpected transferred record');
    }
    entry.metadata = {...entry.metadata, journalBlocks: blocks.map((block, j) => {
      if (block.kind !== 'photo' || block.id !== row.assets[j].assetId || block.uri !== row.assets[j].path) {
        throw new Error('Transferred record references an unexpected photo');
      }
      return {...block, uri: 'objects/' + row.files[j]};
    })};
  });
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid) {throw new Error('Two-photo restore plan failed validation');}
  await session.restore(plan, uuid());
  return {entries, token, sharedDigest: shared.sha256, otherDigest: other.sha256};
}

export async function verifySharedPhotoTransfer(session: Session, expected: Awaited<ReturnType<typeof applySharedPhotoTransfer>>) {
  if (await session.read(indexKey) !== JSON.stringify(['first', 'second'])) {
    throw new Error('The two-entry date index did not survive reopen');
  }
  const files: string[][] = [];
  for (const entry of expected.entries) {
    const saved = JSON.parse(await session.read(prefix + entry.id) ?? 'null');
    if (JSON.stringify(saved) !== JSON.stringify(entry)) {throw new Error('A restored entry changed after reopen');}
    files.push(saved.metadata.journalBlocks.map((block: {uri: string}) => block.uri.slice('objects/'.length)));
  }
  const [[shared, other], [secondShared]] = files;
  if (shared !== secondShared ||
      !(await archive.verifyTransferredPhotos(shared, expected.sharedDigest, other, expected.otherDigest))) {
    throw new Error('A restored photo failed its byte-for-byte digest check');
  }
  return expected.token;
}

export async function restoreSharedPhotoTransfer(document?: string) {
  const options = {name: 'shared-transfer-' + uuid() + '.sqlite', encryptionKey: generateSpikeEncryptionKey()};
  const db = open(options);
  let expected: Awaited<ReturnType<typeof applySharedPhotoTransfer>>;
  try {
    const {rows} = await db.execute('PRAGMA cipher_version');
    if (!rows[0]?.cipher_version) {throw new Error('Encrypted storage unavailable');}
    expected = await applySharedPhotoTransfer(await openRestoreSession(db), document);
  } catch (error) {
    db.delete();
    throw error;
  }
  db.close();
  const reopened = open({...options, failOnCreate: true});
  try {
    return await verifySharedPhotoTransfer(await openRestoreSession(reopened), expected);
  } finally {
    reopened.delete();
  }
}
