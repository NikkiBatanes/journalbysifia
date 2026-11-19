import {JOURNAL_BACKUP_ARCHIVE_LIMITS} from '../services/journalBackupArchiveContract';
import type {JournalBackupInventory} from '../services/journalBackupInventory';

type InspectPhoto = (uri: string, remainingBytes: number) => Promise<number>;

export async function inspectJournalPhotoReferences(inventory: JournalBackupInventory, inspect: InspectPhoto) {
  const counts = {entries: 0, references: 0, readable: 0, missing: 0, unsupported: 0, unreadable: 0, overLimit: 0};
  const checked = new Set<string>();
  let remaining = JOURNAL_BACKUP_ARCHIVE_LIMITS.maxTotalAssetBytes;
  for (const records of [inventory.journalRecords, inventory.reflectionRecords, inventory.prayerRecords]) {
    for (const entry of records) {
      if (entry.deleted) {continue;}
      counts.entries++;
      const blocks = entry.metadata?.journalBlocks;
      if (!Array.isArray(blocks)) {continue;}
      for (const block of blocks) {
        if (block?.kind !== 'photo') {continue;}
        counts.references++;
        const uri = block.uri;
        if (typeof uri !== 'string' || !uri) {
          counts.missing++;
          continue;
        }
        if (checked.has(uri)) {continue;}
        if (checked.size >= JOURNAL_BACKUP_ARCHIVE_LIMITS.maxAssetCount) {
          throw new Error('Photo count exceeds the archive limit');
        }
        checked.add(uri);
        if (uri.length > 4096 || !uri.startsWith('file:///')) {
          counts.unsupported++;
          continue;
        }
        const size = await inspect(uri, remaining);
        if (Number.isSafeInteger(size) && size > 0 && size <= remaining && size <= JOURNAL_BACKUP_ARCHIVE_LIMITS.maxAssetBytes) {
          counts.readable++;
          remaining -= size;
        } else if (size === -1) {counts.missing++;}
        else if (size === -2) {counts.unsupported++;}
        else if (size === -4) {counts.overLimit++;}
        else {counts.unreadable++;}
      }
    }
  }
  return counts;
}
