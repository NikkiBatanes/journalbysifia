import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {preflightJournalBackupArchiveRestore, utf8ByteLength} from '../services/journalBackupArchiveContract';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {generateSpikeEncryptionKey} from '../services/journalEncryptedStorageSpike';
import {openRestoreSession} from './journalRestoreDatabase';

const key = 'journal_local:todo:2026-11-19:fixture';
const indexKey = 'journal_local_index:todo:2026-11-19';

export async function applyTransferredFixture(session: Awaited<ReturnType<typeof openRestoreSession>>) {
  const {manifest, containerByteLength, photo} = JSON.parse(await archive.importSyntheticTransfer());
  // The native method returns only after authenticating a single final frame
  // and matching the exact synthetic manifest shape with its per-export token.
  const result = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength,
    manifestByteLength: utf8ByteLength(JSON.stringify(manifest)),
    authenticatedFinalMarkerVerified: true,
    assetByteLengths: photo ? {[photo.assetId]: photo.byteLength} : {},
  });
  if (!result.valid || !result.manifest) {
    throw new Error('The transferred manifest failed validation');
  }
  const {assets, backup} = result.manifest;
  const [entry] = backup.inventory.journalRecords;
  let photoUri: string | undefined;
  if (assets.length) {
    const [asset] = assets;
    const blocks = entry.metadata?.journalBlocks;
    if (assets.length !== 1 || asset.assetId !== photo?.assetId || asset.ownerRecordId !== entry.id ||
        !Array.isArray(blocks) || blocks.length !== 1 || blocks[0].kind !== 'photo' ||
        blocks[0].uri !== asset.path || !photo.base64) {
      throw new Error('The transferred photo does not match its journal block');
    }
    // For this tiny fixture the restored image fits in the encrypted record.
    // The executor therefore commits or rolls back both text and photo together.
    photoUri = `data:${asset.mediaType};base64,${photo.base64}`;
    entry.metadata = {...entry.metadata, journalBlocks: [{...blocks[0], uri: photoUri}]};
  }
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid) {
    throw new Error('The transferred entry failed restore planning');
  }
  await session.restore(plan, uuid());
  return {content: entry.content, photoUri};
}

export async function restoreTransferredFixture() {
  const options = {
    name: `transfer-fixture-${uuid()}.sqlite`,
    encryptionKey: generateSpikeEncryptionKey(),
  };
  const db = open(options);
  let expected: Awaited<ReturnType<typeof applyTransferredFixture>> | undefined;
  try {
    const session = await openRestoreSession(db);
    expected = await applyTransferredFixture(session);
  } finally {
    if (expected) {
      db.close();
    } else {
      db.delete();
    }
  }

  const reopened = open({...options, failOnCreate: true});
  try {
    const session = await openRestoreSession(reopened);
    const record = JSON.parse(await session.read(key) ?? 'null');
    const index = JSON.parse(await session.read(indexKey) ?? 'null');
    if (record?.content !== expected.content ||
        record?.metadata?.journalBlocks?.[0]?.uri !== expected.photoUri ||
        !/^synthetic-[a-f0-9]{32}$/.test(record?.content) ||
        !Array.isArray(index) || index.length !== 1 || index[0] !== record.id) {
      throw new Error('The transferred entry or its index failed verification');
    }
    return (record.content as string).slice('synthetic-'.length);
  } finally {
    reopened.delete();
  }
}
