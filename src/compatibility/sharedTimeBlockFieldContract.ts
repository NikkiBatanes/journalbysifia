import type { LocalJournalEntry } from '../storage/journalStorage';
import type { JournalMergePreviewRecord } from './sharedJournalMergePreview';
import { projectLocalTimeBlockForSharing } from '@sifia/journal-contract';

export { projectLocalTimeBlockForSharing, prepareSharedTimeBlockTextPatch } from '@sifia/journal-contract';
export type { LocalTimeBlockEnvelope, SharedTimeBlockBase, TimeBlockProjection } from '@sifia/journal-contract';

/** Read persisted parent envelopes, never expanded UI occurrences. No writes. */
export const toLocalTimeBlockMergePreview = (entry: LocalJournalEntry): JournalMergePreviewRecord => ({
  id: entry.id,
  capabilityId: projectLocalTimeBlockForSharing(entry).status === 'supported' ? 'time_block' : null,
  accountId: entry.linked_account_id ?? null, serverId: entry.server_id ?? null, deleted: entry.deleted,
});
