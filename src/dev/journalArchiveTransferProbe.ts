import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {preflightJournalBackupArchiveRestore, utf8ByteLength} from '../services/journalBackupArchiveContract';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {generateSpikeEncryptionKey} from '../services/journalEncryptedStorageSpike';
import {openRestoreSession} from './journalRestoreDatabase';

const key = 'journal_local:todo:2026-11-19:fixture';
const indexKey = 'journal_local_index:todo:2026-11-19';

export async function restoreTransferredFixture() {
  const {manifest, containerByteLength} = JSON.parse(await archive.importSyntheticTransfer());
  // The native method returns only after authenticating a single final frame
  // and matching the exact synthetic manifest shape with its per-export token.
  const result = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength,
    manifestByteLength: utf8ByteLength(JSON.stringify(manifest)),
    authenticatedFinalMarkerVerified: true,
    assetByteLengths: {},
  });
  if (!result.valid || !result.manifest) {
    throw new Error('The transferred manifest failed validation');
  }
  const plan = planJournalBackupRestore(result.manifest.backup);
  if (!plan.valid) {
    throw new Error('The transferred entry failed restore planning');
  }
  const options = {
    name: `transfer-fixture-${uuid()}.sqlite`,
    encryptionKey: generateSpikeEncryptionKey(),
  };
  const db = open(options);
  let restored = false;
  try {
    const session = await openRestoreSession(db);
    await session.restore(plan, uuid());
    restored = true;
  } finally {
    if (restored) {
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
    if (record?.content !== manifest.backup.inventory.journalRecords[0].content ||
        !/^synthetic-[a-f0-9]{32}$/.test(record?.content) ||
        !Array.isArray(index) || index.length !== 1 || index[0] !== record.id) {
      throw new Error('The transferred entry or its index failed verification');
    }
    return (record.content as string).slice('synthetic-'.length);
  } finally {
    reopened.delete();
  }
}
