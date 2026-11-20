import type {JournalBackupArchiveManifestV1} from './journalBackupArchiveContract';
import {validateArchivePhotoBlocks} from './journalBackupPhotoBlocks';
import {planJournalBackupRestore} from './journalBackupRestorePlan';

const sections = ['journalRecords', 'reflectionRecords', 'prayerRecords'] as const;

type Section = typeof sections[number];
type Entry = JournalBackupArchiveManifestV1['backup']['inventory'][Section][number];
type LocatedEntry = {entry: Entry; key: string; section: Section};
type EntrySummary = {kind: string; date: string; title: string; excerpt: string; deleted: boolean; photos: number};
export type ReviewItem = {id: string; reason: string; backup?: EntrySummary; device: EntrySummary[]};
export type ReviewGroup = 'matching' | 'backupOnly' | 'deviceOnly' | 'review' | 'backupOnlyDeletions';

function firstAuthoredLine(value: unknown): string | undefined {
  if (!Array.isArray(value)) {return undefined;}
  for (const item of value) {
    const line = typeof item === 'string' ? item : item?.text;
    if (typeof line === 'string' && line.trim()) {return line;}
  }
  return undefined;
}

function summarize({entry, section}: LocatedEntry): EntrySummary {
  let title = '';
  let excerpt = '';
  if (!entry.deleted) {
    title = 'title' in entry && typeof entry.title === 'string' ? entry.title.trim() : '';
    let body: unknown = entry.content;
    // Structured entries can include internal IDs and URLs. Display only authored text.
    if (typeof body === 'string' && ['[', '{', '"'].includes(body.trimStart()[0])) {
      try {
        const parsed = JSON.parse(body);
        body = typeof parsed === 'string' ? parsed : parsed?.text ?? parsed?.title ??
          firstAuthoredLine(parsed?.blocks) ?? firstAuthoredLine(parsed?.items) ?? firstAuthoredLine(parsed?.answers);
      } catch { body = ''; }
    }
    title = title.length > 100 ? title.slice(0, 99) + '…' : title;
    const label = (typeof body === 'string' && body.trim()) || firstAuthoredLine(entry.metadata?.journalBlocks)?.trim() || '';
    excerpt = label.length > 100 ? label.slice(0, 99) + '…' : label;
  }
  const blocks = entry.metadata?.journalBlocks;
  const photos = Array.isArray(blocks) ? blocks.filter(block => block.kind === 'photo' && block.uri).length : 0;
  const kind = {journalRecords: 'Journal entry', reflectionRecords: 'Reflection', prayerRecords: 'Prayer'}[section];
  return {kind, date: entry.selected_date, title, excerpt, deleted: !!entry.deleted, photos};
}

function indexEntries(manifest: JournalBackupArchiveManifestV1) {
  if (!planJournalBackupRestore(manifest.backup).valid) {
    throw new Error('Invalid entry locations');
  }
  const {inventory} = manifest.backup;
  validateArchivePhotoBlocks([...inventory.journalRecords, ...inventory.reflectionRecords,
    ...inventory.prayerRecords], manifest.assets);
  const photos = new Map(manifest.assets.map(photo => [photo.path, photo]));
  const byId = new Map<string, LocatedEntry>();
  const byKey = new Map<string, LocatedEntry>();
  for (const section of sections) {
    const locations = new Map(inventory.recordLocations[section].map(location => [location.id, location.key]));
    for (const entry of inventory[section]) {
      const key = locations.get(entry.id)!;
      const record = {entry, key, section};
      byId.set(entry.id, record);
      byKey.set(key, record);
    }
  }

  function photoIdentity(block: {uri: string}) {
    const photo = photos.get(block.uri)!;
    return [photo.sha256, photo.byteLength, photo.mediaType];
  }
  function photoList(entry: Entry) {
    const blocks = entry.metadata?.journalBlocks;
    return Array.isArray(blocks) ? blocks.filter(block => block.kind === 'photo' && block.uri).map(photoIdentity) : [];
  }
  function content(entry: Entry) {
    const blocks: unknown = entry.metadata?.journalBlocks;
    const normalized = Array.isArray(blocks) ? {
      ...entry, metadata: {...entry.metadata, journalBlocks: blocks.map(block => {
        if (block.kind !== 'photo' || !block.uri) {return block;}
        // Archive object names can change on every export, even for the same photo.
        return {...block, uri: photoIdentity(block)};
      })},
    } : entry;
    return JSON.stringify(normalized, (_key, value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {return value;}
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    });
  }
  return {byId, byKey, content, photoList};
}

// An occupied singleton and an entry moved elsewhere may point to two separate device records.
export function reviewJournalBackupEntries(backup: JournalBackupArchiveManifestV1, device: JournalBackupArchiveManifestV1) {
  const incoming = indexEntries(backup);
  const local = indexEntries(device);
  const groups: Record<ReviewGroup, ReviewItem[]> = {matching: [], backupOnly: [], deviceOnly: [], review: [], backupOnlyDeletions: []};
  incoming.byId.forEach((record, id) => {
    const sameId = local.byId.get(id);
    const occupant = local.byKey.get(record.key);
    const counterparts = sameId ? [sameId] : [];
    if (occupant && occupant !== sameId) {counterparts.push(occupant);}
    const item: ReviewItem = {id, backup: summarize(record), device: counterparts.map(summarize), reason: ''};
    if (!counterparts.length) {
      groups[record.entry.deleted ? 'backupOnlyDeletions' : 'backupOnly'].push(item);
    } else if (sameId && sameId === occupant && incoming.content(record.entry) === local.content(sameId.entry)) {
      groups.matching.push(item);
    } else {
      const reasons: string[] = [];
      if (sameId && sameId.key !== record.key) {reasons.push('This entry is saved in a different location on this device.');}
      if (occupant && occupant !== sameId) {reasons.push('Another device entry occupies this spot.');}
      if (sameId) {
        if (!!sameId.entry.deleted !== !!record.entry.deleted) {reasons.push('One version is marked deleted.');}
        if (!record.entry.deleted && !sameId.entry.deleted) {
          if (item.backup?.title !== item.device[0].title) {reasons.push('The title differs.');}
          if (record.entry.content !== sameId.entry.content || item.backup?.excerpt !== item.device[0].excerpt) {
            reasons.push('The entry content differs.');
          }
        }
        if (JSON.stringify(incoming.photoList(record.entry)) !== JSON.stringify(local.photoList(sameId.entry))) {
          reasons.push('The attached photos differ.');
        }
      }
      item.reason = reasons.join(' ') || 'The saved entry details differ.';
      groups.review.push(item);
    }
  });
  local.byId.forEach((record, id) => {
    if (!incoming.byId.has(id) && !incoming.byKey.has(record.key)) {
      groups.deviceOnly.push({id, device: [summarize(record)], reason: ''});
    }
  });
  return groups;
}

export function compareJournalBackupEntries(backup: JournalBackupArchiveManifestV1, device: JournalBackupArchiveManifestV1) {
  const groups = reviewJournalBackupEntries(backup, device);
  return {
    matching: groups.matching.length, backupOnly: groups.backupOnly.length,
    deviceOnly: groups.deviceOnly.length, review: groups.review.length,
    backupOnlyDeletions: groups.backupOnlyDeletions.length,
  };
}
