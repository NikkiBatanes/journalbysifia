import {v4 as uuid} from 'uuid';
import {JOURNAL_BACKUP_APP_IDENTIFIER, journalBackupFromInventory, type JournalBackupEnvelopeV1} from '../services/journalBackupContract';
import {
  countJournalBackupRecords, JOURNAL_BACKUP_ARCHIVE_FORMAT, JOURNAL_BACKUP_ARCHIVE_LIMITS as limits,
  preflightJournalBackupArchiveRestore, validateJournalBackupArchiveManifest, type JournalBackupArchiveAssetV1, type JournalBackupArchiveManifestV1,
} from '../services/journalBackupArchiveContract';

import {buildJournalBackupInventory} from '../services/journalBackupInventory';
import {captureJournalForAdditions, addReviewedJournalEntries} from '../services/journalBackupRestoreExecutor';
import {createJournalRestoreStorage} from '../storage/journalRestoreStorage';
import {localJournalMutations} from '../storage/journalMutationCoordinator';
import {reviewJournalBackupEntries} from '../services/compareJournalBackupEntries';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';
import {journalBackupPhotoResolver, validateArchivePhotoBlocks} from '../services/journalBackupPhotoBlocks';

export class LinkedBackupPhotoError extends Error {}

type Fingerprint = (uri: string, remaining: number) => Promise<string>;

// Prepares the canonical journal, reflection and prayer photo blocks in a local
// snapshot. Device paths for these blocks stay outside the serializable manifest.
export async function prepareJournalPhotoExport(backup: JournalBackupEnvelopeV1, describe: Fingerprint) {
  const byUri = new Map<string, JournalBackupArchiveAssetV1>();
  let assetBytes = 0;

  async function project<T extends {id: string; metadata?: Record<string, unknown>}>(records: T[]) {
    const projected: T[] = [];
    for (const entry of records) {
      const blocks = entry.metadata?.journalBlocks;
      if (blocks === undefined) {
        projected.push(entry);
        continue;
      }
      if (!Array.isArray(blocks)) {throw new Error('Invalid journal blocks');}
      const journalBlocks = [];
      for (const block of blocks) {
        if (!block || typeof block.kind !== 'string') {throw new Error('Invalid journal block');}
        if (block.kind !== 'photo' || block.uri == null || block.uri === '') {
          journalBlocks.push(block);
          continue;
        }
        const uri = block.uri;
        if (typeof uri === 'string' && /^https?:\/\//i.test(uri)) {
          throw new LinkedBackupPhotoError('Photo is linked from the web');
        }
        if (typeof uri !== 'string' || uri.length > 4096 || !uri.startsWith('file:///')) {
          throw new Error('Unsupported photo reference');
        }
        let asset = byUri.get(uri);
        if (!asset) {
          if (byUri.size >= limits.maxAssetCount) {throw new Error('Photo count limit exceeded');}
          const remaining = limits.maxTotalAssetBytes - assetBytes;
          const result = /^(\d{1,10}):([a-f0-9]{64})$/.exec(await describe(uri, remaining));
          const byteLength = Number(result?.[1]);
          if (!result || byteLength <= 0 || byteLength > Math.min(remaining, limits.maxAssetBytes)) {
            throw new Error('Could not verify a referenced photo');
          }
          const assetId = uuid();
          const mediaType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
          asset = {
            assetId,
            path: 'objects/' + assetId,
            ownerRecordId: entry.id,
            kind: 'image',
            byteLength,
            sha256: result[2],
            mediaType,
          };
          byUri.set(uri, asset);
          assetBytes += byteLength;
        }
        journalBlocks.push({...block, uri: asset.path});
      }
      projected.push({...entry, metadata: {...entry.metadata, journalBlocks}});
    }
    return projected;
  }
  const inventory = backup.inventory;
  const projected = {
    ...inventory,
    journalRecords: await project(inventory.journalRecords),
    reflectionRecords: await project(inventory.reflectionRecords),
    prayerRecords: await project(inventory.prayerRecords),
  };
  const manifest: JournalBackupArchiveManifestV1 = {
    format: JOURNAL_BACKUP_ARCHIVE_FORMAT,
    archiveVersion: 1,
    appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
    snapshotId: uuid(),
    createdAt: backup.exportedAt,
    backup: {...backup, inventory: projected},
    assets: Array.from(byUri.values()),
    totals: {records: countJournalBackupRecords(backup), assets: byUri.size, assetBytes},
  };
  if (!validateJournalBackupArchiveManifest(manifest).valid) {throw new Error('Invalid archive manifest');}
  const sources = Array.from(byUri, ([uri, asset]) => {
    if (/[\r\n\t]/.test(uri)) {throw new Error('Invalid picker URI');}
    return [asset.byteLength, asset.sha256, uri].join('\t');
  }).join('\n');
  return {manifest, sources};
}

export async function prepareJournalPhotoManifest(backup: JournalBackupEnvelopeV1, describe: Fingerprint) {
  return (await prepareJournalPhotoExport(backup, describe)).manifest;
}

// The platform returns one line of measured evidence followed by the exact decrypted JSON.
function verifiedManifest(result: string) {
  const end = result.indexOf('\n');
  if (end <= 0) {throw new Error('Missing stream evidence');}
  const evidence = JSON.parse(result.slice(0, end));
  const candidate = JSON.parse(result.slice(end + 1));
  if (!Array.isArray(evidence?.photos) || !Array.isArray(candidate?.assets) ||
      evidence.photos.length !== candidate.assets.length || evidence.photos.length > limits.maxAssetCount) {
    throw new Error('Photo count mismatch');
  }
  const assetByteLengths: Record<string, number> = Object.create(null);
  candidate.assets.forEach((asset: JournalBackupArchiveAssetV1, index: number) => {
    const photo = evidence.photos[index];
    if (!asset || !Array.isArray(photo) || photo.length !== 2 ||
        photo[0] !== asset.byteLength || photo[1] !== asset.sha256) {throw new Error('Invalid photo evidence');}
    assetByteLengths[asset.assetId] = photo[0];
  });
  const checked = preflightJournalBackupArchiveRestore(candidate, {
    containerByteLength: evidence.containerByteLength, manifestByteLength: evidence.manifestByteLength,
    authenticatedFinalMarkerVerified: true, assetByteLengths,
  });
  if (!checked.valid || !checked.manifest) {throw new Error('Invalid snapshot');}
  return checked.manifest;
}

// Both destinations append to existing indexes in their original order. The caller
// selects only absent records after applying the destination's media rules.
export function planMissingLocalEntries(plan: ReturnType<typeof planJournalBackupRestore>,
  before: ReadonlyMap<string, string>, include: (id: string) => boolean) {
  if (!plan.valid) {throw new Error('Invalid entry restore plan');}
  const sections = new Set(['journalRecords', 'prayerRecords', 'reflectionRecords']);
  const added = new Set<string>();
  const records = plan.operations.filter(op => {
    if (op.kind !== 'record' || !sections.has(op.section) || before.has(op.key)) {return false;}
    const entry = JSON.parse(op.value);
    if (entry.deleted || entry.server_id != null || entry.linked_account_id != null || entry.user_id != null ||
        (entry.sync_status != null && entry.sync_status !== 'local')) {return false;}
    if (!include(entry.id)) {return false;}
    added.add(entry.id);
    return true;
  });
  const indexes = plan.operations.flatMap(op => {
    if (op.kind !== 'index' || op.key.startsWith('review_local_index:')) {return [];}
    const ids = (JSON.parse(op.value) as string[]).filter(id => added.has(id));
    if (!ids.length) {return [];}
    const existing: unknown = JSON.parse(before.get(op.key) ?? '[]');
    if (!Array.isArray(existing) || existing.some(id => typeof id !== 'string')) {throw new Error('Invalid device index');}
    const included = new Set(existing);
    return [{...op, value: JSON.stringify([...existing, ...ids.filter(id => !included.has(id))])}];
  });
  return {...plan, operations: [...records, ...indexes], operationCounts: {record: records.length, index: indexes.length}};
}

export async function compareLocalSnapshotResult(document: string, describe: Fingerprint) {
  const saved = verifiedManifest(document);
  const storage = createJournalRestoreStorage('');
  const before = await captureJournalForAdditions(storage, localJournalMutations);
  const device = journalBackupFromInventory(buildJournalBackupInventory(Array.from(before)));
  const current = await prepareJournalPhotoManifest(device, describe);
  const groups = reviewJournalBackupEntries(saved, current);
  const missing = new Map(groups.backupOnly.map(item => [item.id, item]));
  const plan = planJournalBackupRestore(saved.backup);
  for (const item of missing.values()) {item.reason = 'Held for account verification.';}
  const additions = planMissingLocalEntries(plan, before, id => {
    const item = missing.get(id);
    if (!item) {return false;}
    item.reason = item.backup?.photos ? 'Held for photo restore.' : 'Ready to add to this device.';
    return !item.backup?.photos;
  });
  const count = additions.operationCounts.record;
  let available = count > 0;
  return {groups, count, held: missing.size - count, async confirm() {
    if (!available) {throw new Error('Compare this backup again.');}
    available = false;
    try {
      return await addReviewedJournalEntries(storage, localJournalMutations, additions, before, uuid());
    } finally {
      before.clear();
    }
  }};
}

export function planStagedLocalSnapshot(result: string, staged: readonly {file: string; byteLength: number; sha256: string}[]) {
  const {backup, assets} = verifiedManifest(result);
  if (assets.length !== staged.length) {throw new Error('Staged photo count mismatch');}
  const files = assets.map((asset, index) => {
    const photo = staged[index];
    if (photo.byteLength !== asset.byteLength || photo.sha256 !== asset.sha256) {
      throw new Error('Staged photo content mismatch');
    }
    return {assetId: asset.assetId, file: photo.file};
  });
  const {inventory} = backup;
  const resolve = journalBackupPhotoResolver([...inventory.journalRecords, ...inventory.reflectionRecords,
    ...inventory.prayerRecords], assets, files);
  const plan = planJournalBackupRestore({...backup, inventory: {...inventory,
    journalRecords: inventory.journalRecords.map(resolve),
    reflectionRecords: inventory.reflectionRecords.map(resolve),
    prayerRecords: inventory.prayerRecords.map(resolve),
  }});
  if (!plan.valid) {throw new Error('Invalid restore mapping');}
  return plan;
}

export function inspectLocalSnapshotResult(result: string) {
  const {backup, assets, totals, createdAt} = verifiedManifest(result);
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid) {throw new Error('Invalid restore mapping');}
  const inventory = backup.inventory;
  validateArchivePhotoBlocks([...inventory.journalRecords, ...inventory.reflectionRecords, ...inventory.prayerRecords], assets);
  const sections: Record<string, number> = {
    'Journal records': inventory.journalRecords.length,
    'Reflections': inventory.reflectionRecords.length,
    'Prayers': inventory.prayerRecords.length,
    'Bible studies': inventory.bibleStudySessions.length,
    'Routine records': inventory.routineStates.length,
    'Reviews': inventory.reviews.length,
    'Drafts': inventory.prayerDrafts.length + inventory.authoredDrafts.sessionNotes.length +
      inventory.authoredDrafts.guidedReflections.length + inventory.authoredDrafts.routines.length,
    'Gospel records': inventory.gospelAuthoredContent.length,
    'Settings': inventory.preferences.length + (inventory.reviewSettings === null ? 0 : 1),
  };
  const legacyCount = inventory.legacyAuthoredContent.journalRecords.length + inventory.legacyAuthoredContent.reflectionLogs.length;
  return {createdAt, sections: Object.entries(sections).filter(([, count]) => count > 0),
    legacyCount, photos: totals.assets, photoBytes: totals.assetBytes, records: totals.records};
}
