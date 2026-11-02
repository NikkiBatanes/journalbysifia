/**
 * Pure initial-connection preview. This module never reads storage, uploads,
 * changes ownership, deletes duplicates, or grants consent to execute a merge.
 * Inputs are metadata prepared by audited, per-family adapters. Do not pass
 * journal bodies, block payloads, device keys, or media URIs into a preview.
 */
import {
  SHARED_JOURNAL_CAPABILITIES,
  type SharedJournalCapabilityId,
} from './capabilities';

export interface JournalMergePreviewRecord {
  id: string;
  /** Null/unknown classification is preserved for review, never guessed. */
  capabilityId: string | null;
  accountId: string | null;
  /** Verified source/ledger mapping only; must not be inferred from similar text. */
  serverId?: string | null;
  deleted?: boolean;
  /** Local, ephemeral digest of supported base fields ONLY, never extension bytes. */
  baseDigest?: string;
  /** Similarity candidate only; does not establish identity or authorize deletion. */
  duplicateCandidateKey?: string;
}

export type JournalMergePreviewAction =
  | 'upload_shared_base'
  | 'keep_in_journal'
  | 'already_linked'
  | 'review_required';

export type JournalMergePreviewReason =
  | 'new_shared_record'
  | 'journal_owned'
  | 'same_identity_and_base'
  | 'unknown_capability'
  | 'read_only_artifact'
  | 'tombstone_requires_reconciliation'
  | 'base_conflict'
  | 'possible_duplicate'
  | 'missing_remote_mapping'
  | 'identity_collision';

export interface JournalMergePreviewEntry {
  localId: string;
  capabilityId: string | null;
  action: JournalMergePreviewAction;
  reason: JournalMergePreviewReason;
  remoteId?: string;
}

export interface JournalMergePreview {
  status: 'blocked' | 'review_required' | 'ready_for_confirmation';
  /** A ready preview is not upload consent. Execution needs a fresh confirmation. */
  requiresConfirmation: true;
  issues: Array<'missing_account' | 'incomplete_local_snapshot' | 'incomplete_remote_snapshot' | 'invalid_identity' | 'duplicate_identity' | 'account_mismatch'>;
  entries: JournalMergePreviewEntry[];
  downloads: Array<{ remoteId: string; capabilityId: SharedJournalCapabilityId }>;
  remoteReview: Array<{
    remoteId: string;
    reason: 'unknown_capability' | 'unexpected_journal_cloud_record' | 'tombstone_requires_reconciliation';
  }>;
  counts: {
    localRecords: number;
    uploadSharedBase: number;
    keepInJournal: number;
    alreadyLinked: number;
    reviewRequired: number;
    downloadShared: number;
    remoteReviewRequired: number;
  };
}

const capabilities = new Map(SHARED_JOURNAL_CAPABILITIES.map(item => [item.id as string, item]));
// Scope identities to their family: legacy tables may reuse an ID across families.
const identity = (capabilityId: string | null, id: string): string => JSON.stringify([capabilityId, id]);
const validId = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0;

export const buildSharedJournalMergePreview = (input: {
  targetAccountId: string;
  /** Explicit false blocks previews from an incomplete local inventory. */
  localSnapshotComplete?: boolean;
  /** All free shared families and retained tombstones must be paged before preview. */
  remoteSnapshotComplete: boolean;
  localRecords: readonly JournalMergePreviewRecord[];
  remoteRecords: readonly JournalMergePreviewRecord[];
}): JournalMergePreview => {
  const { targetAccountId, localRecords, remoteRecords } = input;
  const issues = new Set<JournalMergePreview['issues'][number]>();
  if (!validId(targetAccountId)) { issues.add('missing_account'); }
  if (input.localSnapshotComplete === false) { issues.add('incomplete_local_snapshot'); }
  if (input.remoteSnapshotComplete !== true) { issues.add('incomplete_remote_snapshot'); }

  for (const [records, remote] of [[localRecords, false], [remoteRecords, true]] as const) {
    const seen = new Set<string>();
    for (const record of records) {
      if (!validId(record.id) || (record.serverId != null && !validId(record.serverId))) {
        issues.add('invalid_identity');
      }
      const key = identity(record.capabilityId, record.id);
      if (seen.has(key)) { issues.add('duplicate_identity'); }
      seen.add(key);
      if (remote ? record.accountId !== targetAccountId
        : record.accountId !== null && record.accountId !== targetAccountId) {
        issues.add('account_mismatch');
      }
    }
  }

  const counts: JournalMergePreview['counts'] = {
    localRecords: localRecords.length,
    uploadSharedBase: 0, keepInJournal: 0, alreadyLinked: 0,
    reviewRequired: 0, downloadShared: 0, remoteReviewRequired: 0,
  };
  // Fail closed for the whole preview. Do not show a plausible partial upload plan.
  if (issues.size) {
    return { status: 'blocked', requiresConfirmation: true, issues: [...issues], entries: [], downloads: [], remoteReview: [], counts };
  }

  const remoteByIdentity = new Map(remoteRecords.map(record => [identity(record.capabilityId, record.id), record]));
  const consumedRemote = new Set<string>();
  const claimedRemote = new Set<string>();
  const entries: JournalMergePreviewEntry[] = [];
  const candidates = new Map<string, number>();
  for (const record of [...localRecords, ...remoteRecords]) {
    if (record.duplicateCandidateKey && !record.deleted) {
      const key = identity(record.capabilityId, record.duplicateCandidateKey);
      candidates.set(key, (candidates.get(key) || 0) + 1);
    }
  }

  for (const record of localRecords) {
    const entry: JournalMergePreviewEntry = {
      localId: record.id, capabilityId: record.capabilityId,
      action: 'review_required', reason: 'unknown_capability',
    };
    const capability = record.capabilityId ? capabilities.get(record.capabilityId) : undefined;
    if (capability?.scope === 'journal_only' || capability?.scope === 'journal_orchestration') {
      entry.action = 'keep_in_journal';
      entry.reason = 'journal_owned';
    } else if (capability) {
      const mappedKey = identity(record.capabilityId, record.serverId || record.id);
      const remote = remoteByIdentity.get(mappedKey);
      if (remote) {
        consumedRemote.add(mappedKey);
        entry.remoteId = remote.id;
      }
      // Any claimed identity collision requires review on ALL affected local rows.
      const collision = Boolean(remote && claimedRemote.has(mappedKey));
      if (remote) { claimedRemote.add(mappedKey); }
      if (collision) {
        entry.reason = 'identity_collision';
        for (const prior of entries) {
          if (prior.capabilityId === record.capabilityId && prior.remoteId === remote!.id) {
            prior.action = 'review_required'; prior.reason = 'identity_collision';
          }
        }
      } else if (record.deleted || remote?.deleted) {
        entry.reason = 'tombstone_requires_reconciliation';
      } else if (capability.scope === 'shared_display_only') {
        entry.reason = 'read_only_artifact';
      } else if (remote) {
        const sameBase = Boolean(record.baseDigest && remote.baseDigest && record.baseDigest === remote.baseDigest);
        entry.action = sameBase ? 'already_linked' : 'review_required';
        entry.reason = sameBase ? 'same_identity_and_base' : 'base_conflict';
      } else if (record.serverId || record.accountId !== null) {
        entry.reason = 'missing_remote_mapping';
      } else if (record.duplicateCandidateKey
        && (candidates.get(identity(record.capabilityId, record.duplicateCandidateKey)) || 0) > 1) {
        entry.reason = 'possible_duplicate';
      } else {
        entry.action = 'upload_shared_base'; entry.reason = 'new_shared_record';
      }
    }
    entries.push(entry);
  }

  const downloads: JournalMergePreview['downloads'] = [];
  const remoteReview: JournalMergePreview['remoteReview'] = [];
  for (const record of remoteRecords) {
    if (consumedRemote.has(identity(record.capabilityId, record.id))) { continue; }
    const capability = record.capabilityId ? capabilities.get(record.capabilityId) : undefined;
    if (!capability) {
      remoteReview.push({ remoteId: record.id, reason: 'unknown_capability' });
    } else if (capability.remotePersistence !== 'free_sifia_account') {
      remoteReview.push({ remoteId: record.id, reason: 'unexpected_journal_cloud_record' });
    } else if (record.deleted) {
      remoteReview.push({ remoteId: record.id, reason: 'tombstone_requires_reconciliation' });
    } else {
      downloads.push({ remoteId: record.id, capabilityId: capability.id });
    }
  }
  for (const entry of entries) {
    if (entry.action === 'upload_shared_base') { counts.uploadSharedBase++; }
    if (entry.action === 'keep_in_journal') { counts.keepInJournal++; }
    if (entry.action === 'already_linked') { counts.alreadyLinked++; }
    if (entry.action === 'review_required') { counts.reviewRequired++; }
  }
  counts.downloadShared = downloads.length;
  counts.remoteReviewRequired = remoteReview.length;
  return {
    status: counts.reviewRequired || counts.remoteReviewRequired ? 'review_required' : 'ready_for_confirmation',
    requiresConfirmation: true, issues: [], entries, downloads, remoteReview, counts,
  };
};
