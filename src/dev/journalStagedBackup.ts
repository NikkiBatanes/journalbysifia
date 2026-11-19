import {JOURNAL_BACKUP_ARCHIVE_LIMITS, preflightJournalBackupArchiveRestore, utf8ByteLength} from '../services/journalBackupArchiveContract';
import {resolveJournalBackupPhotoBlocks} from '../services/journalBackupPhotoBlocks';
import {planJournalBackupRestore} from '../services/journalBackupRestorePlan';

function decodeInventory(hex: unknown) {
  if (typeof hex !== 'string' || hex.length > 2 * 1024 * 1024 || hex.length % 2 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error('Invalid practice manifest encoding');
  }
  const text = decodeURIComponent(hex.replace(/../g, byte => '%' + byte));
  const manifest = JSON.parse(text);
  // Compact JSON is the archive's canonical encoding. Reject ambiguous duplicate keys.
  if (JSON.stringify(manifest) !== text) {throw new Error('Invalid practice manifest serialization');}
  return manifest;
}

type NativeStagedPhoto = {assetId: string; file: string; byteLength: number; sha256: string};

// Native derives the filenames and hashes from authenticated bytes during preview.
// Confirmation also reopens and verifies the files before returning this evidence.
export function readStagedSample(document: string) {
  const received = JSON.parse(document);
  const {token, containerByteLength, stagedPhotos, archiveDigest} = received;
  const isInventory = received.inventoryManifestHex !== undefined;
  const manifest = !isInventory
    ? received.manifest : decodeInventory(received.inventoryManifestHex);
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
  if (isInventory && assets.some(asset => asset.mediaType !== 'image/png')) {
    throw new Error('Unexpected practice image format');
  }
  if (assets.some(asset => byId.get(asset.assetId)?.sha256 !== asset.sha256)) {
    throw new Error('Staged photo digest mismatch');
  }
  const entries = resolveJournalBackupPhotoBlocks(backup.inventory.journalRecords, assets, stagedPhotos);
  return {isInventory, assets, backup, entries, token: token as string, archiveDigest: archiveDigest as string};
}

export function planInventorySample(document: string) {
  const {isInventory, backup, assets, entries, archiveDigest} = readStagedSample(document);
  if (!isInventory) {throw new Error('Expected an inventory backup');}
  backup.inventory.journalRecords = entries;
  const plan = planJournalBackupRestore(backup);
  if (!plan.valid || plan.operations.some(op => op.section !== 'journalRecords' && op.section !== 'rebuildIndexes')) {
    throw new Error('Invalid journal entry restore plan');
  }
  return {plan, entries: entries.length, photos: assets.length,
    photoBytes: assets.reduce((sum, photo) => sum + photo.byteLength, 0), archiveDigest};
}
