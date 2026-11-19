import {v4 as uuid} from 'uuid';
import {JOURNAL_BACKUP_APP_IDENTIFIER, type JournalBackupEnvelopeV1} from '../services/journalBackupContract';
import {
  countJournalBackupRecords, JOURNAL_BACKUP_ARCHIVE_FORMAT, JOURNAL_BACKUP_ARCHIVE_LIMITS as limits,
  validateJournalBackupArchiveManifest, type JournalBackupArchiveAssetV1, type JournalBackupArchiveManifestV1,
} from '../services/journalBackupArchiveContract';

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
