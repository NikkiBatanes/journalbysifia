import type {JournalBackupArchiveManifestV1} from './journalBackupArchiveContract';
import {validateArchivePhotoBlocks} from './journalBackupPhotoBlocks';
import {planJournalBackupRestore} from './journalBackupRestorePlan';

const sections = ['journalRecords', 'reflectionRecords', 'prayerRecords'] as const;

function indexEntries(manifest: JournalBackupArchiveManifestV1) {
  if (!planJournalBackupRestore(manifest.backup).valid) {
    throw new Error('Invalid entry locations');
  }
  const {inventory} = manifest.backup;
  validateArchivePhotoBlocks([...inventory.journalRecords, ...inventory.reflectionRecords,
    ...inventory.prayerRecords], manifest.assets);
  const photos = new Map(manifest.assets.map(photo => [photo.path, photo]));
  type Entry = (typeof inventory)[typeof sections[number]][number];
  const byId = new Map<string, {entry: Entry; key: string}>();
  const keys = new Set<string>();
  for (const section of sections) {
    const locations = new Map(inventory.recordLocations[section].map(location => [location.id, location.key]));
    for (const entry of inventory[section]) {
      const key = locations.get(entry.id)!;
      byId.set(entry.id, {entry, key});
      keys.add(key);
    }
  }

  function content(entry: Entry) {
    const blocks: unknown = entry.metadata?.journalBlocks;
    const normalized = Array.isArray(blocks) ? {
      ...entry, metadata: {...entry.metadata, journalBlocks: blocks.map(block => {
        if (block.kind !== 'photo' || !block.uri) {return block;}
        // Archive object names can change on every export, even for the same photo.
        const photo = photos.get(block.uri)!;
        return {...block, uri: [photo.sha256, photo.byteLength, photo.mediaType]};
      })},
    } : entry;
    return JSON.stringify(normalized, (_key, value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {return value;}
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    });
  }
  return {byId, keys, content};
}

// A point-in-time preview. Counts describe incoming records, plus unmatched device records.
// A matching ID at another location or a singleton location held by another ID needs review.
export function compareJournalBackupEntries(backup: JournalBackupArchiveManifestV1, device: JournalBackupArchiveManifestV1) {
  const incoming = indexEntries(backup);
  const local = indexEntries(device);
  const counts = {matching: 0, backupOnly: 0, deviceOnly: 0, review: 0, backupOnlyDeletions: 0};
  incoming.byId.forEach(({entry, key}, id) => {
    const other = local.byId.get(id);
    if (!other && !local.keys.has(key)) {
      if (entry.deleted) {counts.backupOnlyDeletions++;} else {counts.backupOnly++;}
    } else if (other && other.key === key && incoming.content(entry) === local.content(other.entry)) {
      counts.matching++;
    } else {
      counts.review++;
    }
  });
  local.byId.forEach(({key}, id) => {
    if (!incoming.byId.has(id) && !incoming.keys.has(key)) {counts.deviceOnly++;}
  });
  return counts;
}
