import {open} from '@op-engineering/op-sqlite';
import {v4 as uuid} from 'uuid';
import archive from '../native/NativeJournalArchiveCrypto';
import {JOURNAL_BACKUP_ARCHIVE_LIMITS, preflightJournalBackupArchiveRestore, utf8ByteLength} from '../services/journalBackupArchiveContract';
import {resolveJournalBackupPhotoBlocks} from '../services/journalBackupPhotoBlocks';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {generateSpikeEncryptionKey} from '../services/journalEncryptedStorageSpike';
import {openRestoreSession, type RestoreDatabase} from './journalRestoreDatabase';
import type {LocalJournalEntry} from '../storage/journalStorage';

type Session = Awaited<ReturnType<typeof openRestoreSession>>;
const prefix = 'journal_local:todo:2026-11-19:';
const indexKey = 'journal_local_index:todo:2026-11-19';
const sharedId = 'cf890a91-410a-4526-9d47-8aa7085ec351';
const otherId = '91470c9f-7d1d-49aa-9644-8961d590b5ab';

type SampleComparison = {deviceEntries: LocalJournalEntry[]; backupText: string};

// This database belongs exclusively to the sample exercise. Seed a conflicting
// entry and an unrelated entry so a replace-all restore cannot silently pass.
export async function prepareSampleComparison(db: RestoreDatabase, backupText: string): Promise<SampleComparison> {
  if (backupText !== 'Call Mom.' && !/^first-[a-f0-9]{32}$/.test(backupText)) {throw new Error('Invalid sample comparison');}
  const session = await openRestoreSession(db);
  const common = {content_type: 'todo' as const, selected_date: '2026-11-19',
    created_at: '2026-11-19T00:00:00Z', updated_at: '2026-11-19T00:00:00Z'};
  const seeds = [
    {...common, id: 'first', content: 'Call Mom after dinner.'},
    {...common, id: 'device-only', content: 'Bring her the journal.'},
  ];
  await db.transaction(async tx => {
    for (const entry of seeds) {
      await tx.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', [prefix + entry.id, JSON.stringify(entry)]);
    }
    await tx.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', [indexKey, JSON.stringify(seeds.map(e => e.id).sort())]);
  });
  const deviceEntries = await Promise.all(seeds.map(async entry => {
    const stored = await session.read(prefix + entry.id);
    if (stored !== JSON.stringify(entry)) {throw new Error('Sample journal could not be read');}
    return JSON.parse(stored) as LocalJournalEntry;
  }));
  return {deviceEntries, backupText};
}

type NativeStagedPhoto = {assetId: string; file: string; byteLength: number; sha256: string};

// Native returns this document only after authenticating the archive and reopening
// each staged image. Use the stable asset ID to match its evidence to the manifest.
function readStagedSample(document: string) {
  const {manifest, token, containerByteLength, stagedPhotos, archiveDigest} = JSON.parse(document);
  if (typeof token !== 'string' || !/^[a-f0-9]{32}$/.test(token) ||
      typeof archiveDigest !== 'string' || !/^[a-f0-9]{64}$/.test(archiveDigest) ||
      !Array.isArray(stagedPhotos) || stagedPhotos.length > JOURNAL_BACKUP_ARCHIVE_LIMITS.maxAssetCount) {
    throw new Error('Invalid staged photo inventory');
  }
  const byId = new Map<string, NativeStagedPhoto>();
  const lengths: Record<string, number> = Object.create(null);
  for (const photo of stagedPhotos) {
    if (!photo || typeof photo.assetId !== 'string' || byId.has(photo.assetId)) {
      throw new Error('Invalid staged photo identity');
    }
    byId.set(photo.assetId, photo);
    lengths[photo.assetId] = photo.byteLength;
  }
  const validated = preflightJournalBackupArchiveRestore(manifest, {
    containerByteLength, manifestByteLength: utf8ByteLength(JSON.stringify(manifest)),
    authenticatedFinalMarkerVerified: true, assetByteLengths: lengths,
  });
  if (!validated.valid || !validated.manifest) {throw new Error('Staged photo manifest failed validation');}
  const {assets, backup} = validated.manifest;
  if (assets.some(asset => byId.get(asset.assetId)?.sha256 !== asset.sha256)) {
    throw new Error('Staged photo digest mismatch');
  }
  const entries = resolveJournalBackupPhotoBlocks(backup.inventory.journalRecords, assets, stagedPhotos);
  return {assets, backup, entries, token: token as string, archiveDigest: archiveDigest as string};
}

export async function applySharedPhotoTransfer(session: Session, document?: string, comparison?: SampleComparison) {
  const {assets, backup, entries, token, archiveDigest} = readStagedSample(document ?? await archive.importSharedPhotoTransfer());
  const [shared, other] = assets;
  if (assets.length !== 2 || shared.assetId !== sharedId || other.assetId !== otherId ||
      assets.some(asset => asset.ownerRecordId !== 'first' || asset.mediaType !== 'image/png')) {
    throw new Error('Unexpected photo inventory');
  }
  const archiveEntries = backup.inventory.journalRecords;
  const expected = [
    {id: 'first', assets: [shared, other]},
    {id: 'second', assets: [shared]},
  ];
  if (archiveEntries.length !== expected.length) {throw new Error('Unexpected entry count');}
  archiveEntries.forEach((entry, i) => {
    const row = expected[i];
    const blocks = entry.metadata?.journalBlocks;
    const supportedText = entry.content === row.id + '-' + token || (row.id === 'first' && entry.content === 'Call Mom.');
    if (entry.id !== row.id || !supportedText ||
        !Array.isArray(blocks) || blocks.length !== row.assets.length) {
      throw new Error('Unexpected transferred record');
    }
    blocks.forEach((block, j) => {
      if (block.kind !== 'photo' || block.id !== row.assets[j].assetId || block.uri !== row.assets[j].path) {
        throw new Error('Transferred record references an unexpected photo');
      }
    });
  });
  backup.inventory.journalRecords = entries;
  const deviceEntries = comparison?.deviceEntries ?? [];
  if (comparison) {
    if (entries[0].content !== comparison.backupText) {throw new Error('Sample no longer matches preview');}
    for (const entry of deviceEntries) {
      if (await session.read(prefix + entry.id) !== JSON.stringify(entry)) {
        throw new Error('The sample journal changed during preview');
      }
    }
    const previewedIndex = JSON.stringify(deviceEntries.map(entry => entry.id).sort());
    if (await session.read(indexKey) !== previewedIndex) {
      throw new Error('The sample journal changed during preview');
    }
    // Only the two validated fixture records may enter this path. Re-key the
    // backup copy; its photo blocks still point to the same verified objects.
    const copyId = uuid();
    if ([...entries, ...deviceEntries].some(e => e.id === copyId)) {throw new Error('Sample copy ID collision');}
    const location = backup.inventory.recordLocations.journalRecords.find(row => row.id === 'first');
    if (location?.key !== prefix + 'first') {throw new Error('Invalid sample entry location');}
    entries[0] = {...entries[0], id: copyId};
    location.id = copyId;
    location.key = prefix + copyId;
    backup.inventory.journalRecords = [...entries, ...deviceEntries];
    backup.inventory.recordLocations.journalRecords.push(...deviceEntries.map(e => ({id: e.id, key: prefix + e.id})));
  }
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid) {throw new Error('Two-photo restore plan failed validation');}
  if (comparison) {
    const counts = await session.preview(plan);
    // Both device rows must match, and only the rebuilt date index may change.
    if (counts.localOnlyKeys || counts.matchingKeys !== deviceEntries.length || counts.changedKeys !== 1 ||
        counts.newKeys !== entries.length) {throw new Error('Unexpected sample journal contents');}
  }
  await session.restore(plan, uuid());
  return {entries, deviceEntries, token, archiveDigest, sharedDigest: shared.sha256, otherDigest: other.sha256};
}

export async function verifySharedPhotoTransfer(session: Session, expected: Awaited<ReturnType<typeof applySharedPhotoTransfer>>) {
  const ids = [...expected.entries, ...expected.deviceEntries].map(e => e.id).sort();
  if (await session.read(indexKey) !== JSON.stringify(ids)) {
    throw new Error('The sample entry index did not survive reopen');
  }
  for (const entry of expected.deviceEntries) {
    if (await session.read(prefix + entry.id) !== JSON.stringify(entry)) {throw new Error('A device entry changed');}
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

type ComparedRestoreResult = Awaited<ReturnType<typeof applySharedPhotoTransfer>> | null;

// The native manifest identifies the entries and photos. Commit its receipt with the entries
// and keep it outside the exported key/value namespace.
export async function restoreComparedSampleOnce(
  db: RestoreDatabase, document: string, comparison: SampleComparison, digest: string,
): Promise<ComparedRestoreResult> {
  if (!/^[a-f0-9]{64}$/.test(digest) || JSON.parse(document).archiveDigest !== digest) {
    throw new Error('Sample no longer matches preview');
  }
  let restored: ComparedRestoreResult = null;
  await db.transaction(async tx => {
    await tx.execute('CREATE TABLE IF NOT EXISTS sample_restore_receipts (digest TEXT PRIMARY KEY NOT NULL)');
    if (await hasSampleReceipt(tx, digest)) {return;}
    // The executor's batches share this transaction so an interruption rolls back the receipt too.
    const session = await openRestoreSession({execute: tx.execute.bind(tx), transaction: work => work(tx)});
    restored = await applySharedPhotoTransfer(session, document, comparison);
    await tx.execute('INSERT INTO sample_restore_receipts (digest) VALUES (?)', [digest]);
  });
  return restored;
}

async function hasSampleReceipt(db: Pick<RestoreDatabase, 'execute'>, digest: string) {
  const {rows} = await db.execute('SELECT digest FROM sample_restore_receipts WHERE digest=?', [digest]);
  return rows.length === 1;
}

// Native supplies the base digest only for a verified revision whose second entry
// and the authenticated source images identify the original sample manifest.
export type SampleRevision = {baseDigest: string; archiveDigest: string; firstContent: string; updatedAt: string; photoChange?: 'added' | 'replaced'};

export async function previewSampleRevision(
  db: RestoreDatabase, revision: SampleRevision,
  original: NonNullable<ComparedRestoreResult>,
) {
  const {baseDigest, archiveDigest: digest, firstContent, updatedAt} = revision;
  if (baseDigest !== original.archiveDigest || !/^[a-f0-9]{64}$/.test(digest) || digest === baseDigest || !await hasSampleReceipt(db, baseDigest)) {
    throw new Error('Restore the matching original sample first');
  }
  const deviceKey = prefix + 'first';
  const {rows} = await db.execute('SELECT v FROM restore_kv WHERE k=?', [deviceKey]);
  const before = rows[0]?.v;
  if (typeof before !== 'string') {throw new Error('Sample device entry is missing');}
  const device = JSON.parse(before) as LocalJournalEntry;
  if (device.id !== 'first' || typeof device.content !== 'string') {throw new Error('Invalid device entry');}
  const source = original.entries[0];
  return {
    deviceText: device.content,
    async keepBoth(stagePhoto?: () => Promise<string>) {
      const photos = source.metadata?.journalBlocks;
      if (!photos || photos.length !== 2 || photos[0].kind !== 'photo' || photos[1].kind !== 'photo') {
        throw new Error('Missing sample photos');
      }
      const shared = photos[0].uri.slice('objects/'.length);
      const other = photos[1].uri.slice('objects/'.length);
      if (!await archive.checkRestoredPhotos(shared, original.sharedDigest, other, original.otherDigest)) {
        throw new Error('The original sample photos could not be verified');
      }
      await db.transaction(async tx => {
        if (await hasSampleReceipt(tx, digest)) {return;}
        const {rows} = await tx.execute('SELECT k,v FROM restore_kv WHERE k IN (?,?)', [deviceKey, indexKey]);
        if (rows.find(row => row.k === deviceKey)?.v !== before) {throw new Error('Device entry changed during preview');}
        const index = rows.find(row => row.k === indexKey)?.v;
        const ids: unknown = typeof index === 'string' && JSON.parse(index);
        if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string') ||
            new Set(ids).size !== ids.length || !ids.includes(device.id) || !ids.includes(source.id)) {
          throw new Error('Invalid practice journal index');
        }
        const copy = {...source, id: uuid(), content: firstContent, updated_at: updatedAt};
        if (ids.includes(copy.id)) {throw new Error('Sample copy ID collision');}
        if (revision.photoChange) {
          if (!stagePhoto) {throw new Error('Missing revised photo snapshot');}
          const staged = readStagedSample(await stagePhoto());
          const revisedEntry = staged.entries.find(entry => entry.id === device.id);
          if (staged.archiveDigest !== digest || revisedEntry?.content !== firstContent ||
              revisedEntry.updated_at !== updatedAt || !revisedEntry.metadata) {
            throw new Error('Revised photo snapshot no longer matches preview');
          }
          copy.metadata = revisedEntry.metadata;
        }
        await tx.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', [prefix + copy.id, JSON.stringify(copy)]);
        await tx.execute('UPDATE restore_kv SET v=? WHERE k=?', [JSON.stringify([...ids, copy.id].sort()), indexKey]);
        await tx.execute('INSERT INTO sample_restore_receipts (digest) VALUES (?)', [digest]);
      });
    },
  };
}

export async function beginSampleComparison(backupText: string, digest?: string) {
  const options = {name: 'compare-sample-' + uuid() + '.sqlite', encryptionKey: generateSpikeEncryptionKey()};
  let db = open(options);
  let closed = false;
  const discard = () => {
    if (!closed) {closed = true; db.delete();}
  };
  try {
    const {rows} = await db.execute('PRAGMA cipher_version');
    if (!rows[0]?.cipher_version) {throw new Error('Encrypted storage unavailable');}
    const comparison = await prepareSampleComparison(db, backupText);
    let restored: ComparedRestoreResult = null;
    return {
      async reviewRevision(revision: SampleRevision) {
        if (!restored) {throw new Error('Original sample does not match');}
        return previewSampleRevision(db, revision, restored);
      },
      deviceText: comparison.deviceEntries[0].content,
      discard,
      alreadyRestored: (candidate: string) => hasSampleReceipt(db, candidate),
      async keepBoth(document: string) {
        try {
          const expected = digest
            ? await restoreComparedSampleOnce(db, document, comparison, digest)
            : await applySharedPhotoTransfer(await openRestoreSession(db), document, comparison);
          if (!expected) {throw new Error('Sample was already restored');}
          db.close();
          closed = true;
          db = open({...options, failOnCreate: true});
          closed = false;
          await verifySharedPhotoTransfer(await openRestoreSession(db), expected);
          restored = expected;
        } catch (error) {
          discard();
          throw error;
        }
      },
    };
  } catch (error) {
    discard();
    throw error;
  }
}
