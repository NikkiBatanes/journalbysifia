import type {LocalJournalEntry} from '../storage/journalStorage';
import type {JournalBackupArchiveAssetV1} from './journalBackupArchiveContract';

type StagedPhoto = {assetId: string; file: string};

export function isStagedPhotoName(value: unknown): value is string {
  return typeof value === 'string' && value.length === 38 && /^photo-[a-f0-9]{32}$/.test(value);
}

// Both inventories must come from the same authenticated import. Native staging
// verifies the bytes. Here we bind archive paths to local names before planning writes.
export function resolveJournalBackupPhotoBlocks(
  records: readonly LocalJournalEntry[],
  assets: readonly JournalBackupArchiveAssetV1[],
  stagedPhotos: readonly StagedPhoto[],
): LocalJournalEntry[] {
  return records.map(journalBackupPhotoResolver(records, assets, stagedPhotos));
}

export function journalBackupPhotoResolver(
  records: readonly PhotoRecord[],
  assets: readonly JournalBackupArchiveAssetV1[],
  stagedPhotos: readonly StagedPhoto[],
) {
  const stagedFiles = new Map<string, string>();
  const filenames = new Set<string>();
  for (const {assetId, file} of stagedPhotos) {
    if (!isStagedPhotoName(file) || stagedFiles.has(assetId) || filenames.has(file)) {
      throw new Error('Invalid or duplicate staged photo');
    }
    stagedFiles.set(assetId, file);
    filenames.add(file);
  }

  if (assets.length !== stagedFiles.size || assets.some(asset => !stagedFiles.has(asset.assetId))) {
    throw new Error('Photo inventory does not match staged files');
  }
  validateArchivePhotoBlocks(records, assets);
  const byPath = new Map(assets.map(asset => [asset.path, stagedFiles.get(asset.assetId)!]));
  return <T extends PhotoRecord>(entry: T): T => {
    const blocks = entry.metadata?.journalBlocks;
    if (!Array.isArray(blocks)) {return entry;}
    const journalBlocks = blocks.map(block => block.kind === 'photo' && block.uri
      ? {...block, uri: 'objects/' + byPath.get(block.uri)}
      : block);
    return {...entry, metadata: {...entry.metadata, journalBlocks}};
  };
}

type PhotoRecord = {id: string; metadata?: Record<string, unknown>};

export function validateArchivePhotoBlocks(records: readonly PhotoRecord[], assets: readonly JournalBackupArchiveAssetV1[]) {
  const byPath = new Map<string, JournalBackupArchiveAssetV1>();
  for (const asset of assets) {
    if (asset.kind !== 'image' || byPath.has(asset.path) || asset.path !== 'objects/' + asset.assetId) {
      throw new Error('Invalid archive photo inventory');
    }
    byPath.set(asset.path, asset);
  }
  const ownedPaths = new Set<string>();
  for (const entry of records) {
    const blocks: unknown = entry.metadata?.journalBlocks;
    if (blocks === undefined) {continue;}
    if (!Array.isArray(blocks)) {throw new Error('Invalid journal blocks');}
    for (const block of blocks) {
      if (!block || typeof block !== 'object' || typeof block.kind !== 'string') {
        throw new Error('Invalid journal block');
      }
      if (block.kind !== 'photo' || block.uri == null || block.uri === '') {continue;}
      const photo = byPath.get(block.uri);
      if (!photo) {throw new Error('Unrecognized archive photo reference');}
      if (entry.id === photo.ownerRecordId) {ownedPaths.add(block.uri);}
    }
  }
  if (ownedPaths.size !== byPath.size) {throw new Error('Photo missing from its owning entry');}
}
