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
  const stagedFiles = new Map<string, string>();
  const filenames = new Set<string>();
  for (const {assetId, file} of stagedPhotos) {
    if (!isStagedPhotoName(file) || stagedFiles.has(assetId) || filenames.has(file)) {
      throw new Error('Invalid or duplicate staged photo');
    }
    stagedFiles.set(assetId, file);
    filenames.add(file);
  }

  const byPath = new Map<string, {file: string; owner: string}>();
  for (const asset of assets) {
    const file = stagedFiles.get(asset.assetId);
    if (asset.kind !== 'image' || !file || byPath.has(asset.path) || asset.path !== 'objects/' + asset.assetId) {
      throw new Error('Photo inventory does not match staged files');
    }
    byPath.set(asset.path, {file, owner: asset.ownerRecordId});
  }
  if (byPath.size !== stagedFiles.size) {throw new Error('Unexpected staged photo');}

  const ownedPaths = new Set<string>();
  const resolved = records.map(entry => {
    const blocks: unknown = entry.metadata?.journalBlocks;
    if (blocks === undefined) {return entry;}
    if (!Array.isArray(blocks)) {throw new Error('Invalid journal blocks');}
    const journalBlocks = blocks.map(block => {
      if (!block || typeof block !== 'object' || typeof block.kind !== 'string') {
        throw new Error('Invalid journal block');
      }
      if (block.kind !== 'photo' || block.uri == null || block.uri === '') {return block;}
      const photo = byPath.get(block.uri);
      if (!photo) {throw new Error('Unrecognized archive photo reference');}
      if (entry.id === photo.owner) {ownedPaths.add(block.uri);}
      return {...block, uri: 'objects/' + photo.file};
    });
    return {...entry, metadata: {...entry.metadata, journalBlocks}};
  });
  if (ownedPaths.size !== byPath.size) {throw new Error('Photo missing from its owning entry');}
  return resolved;
}
