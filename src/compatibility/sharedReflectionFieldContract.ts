/**
 * Field boundary for a local Heart Journal and compatible plain reflections.
 * Pure preparation only: no database/storage writes, uploads, or account linking.
 * The supported base is an allowlisted DTO, not a Supabase insert payload.
 * Keep structured journeys private until a reversible mapping is implemented.
 */
import type { LocalReflectionEntry } from '../storage/reflectionStorage';
import type { JournalMergePreviewRecord } from './sharedJournalMergePreview';
import {
  isRecord as object, isNonemptyString as nonempty, hasOwn as own,
  isCalendarDate as validDate, isTimestamp as timestamp, isStringArray as tags,
  readStructuredTextContent as structuredContent,
} from './sharedJournalFieldValidation';

export interface SharedReflectionBase {
  title?: string;
  content: string;
  type: string;
  source?: string;
  tags?: string[];
  selected_date: string;
  prompt?: string;
  devotional_id?: string;
  devotional_title?: string;
  playbook_id?: string;
  playbook_title?: string;
  subtask_id?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  question_text?: string;
}

export type SharedReflectionReviewReason =
  | 'invalid_record'
  | 'unknown_variant'
  | 'structured_content_requires_mapping'
  | 'deleted_record_requires_reconciliation'
  | 'ambiguous_ownership';

export type SharedReflectionProjection = {
  status: 'supported';
  base: SharedReflectionBase;
  /** Presence only; the projection never contains block/media/private metadata. */
  hasJournalOnlyMetadata: boolean;
} | {
  status: 'journal_only';
  capabilityId: 'bible_study' | 'scripture_note' | 'session_note';
} | {
  status: 'review_required';
  reason: SharedReflectionReviewReason;
};

const supportedTypes = new Set(['free', 'freeform', 'free-form', 'reflection', 'thought', 'thoughts', 'guided', 'devotional', 'playbook']);
const supportedSources = new Set(['free', 'freeform', 'free-form', 'reflection', 'journal', 'thought', 'thoughts', 'guided', 'guided_prompt', 'devotional', 'playbook']);
const stringContextFields = [
  'prompt', 'devotional_id', 'devotional_title', 'playbook_id', 'playbook_title',
  'subtask_id', 'day_title', 'question_text',
] as const;
const numberContextFields = ['day_number', 'total_days', 'question_number'] as const;
const sharedMetadataFields = new Set<string>([...stringContextFields, ...numberContextFields]);
const mutableFields = new Set(['title', 'content', 'tags', 'selected_date']);

/** Exact allowlist: never spread entry or metadata into the shared base. */
export const projectLocalReflectionForSharing = (entry: LocalReflectionEntry): SharedReflectionProjection => {
  const review = (reason: SharedReflectionReviewReason): SharedReflectionProjection => ({ status: 'review_required', reason });
  if (!object(entry) || !nonempty(entry.id) || typeof entry.content !== 'string'
    || !nonempty(entry.type) || !validDate(entry.selected_date)
    || !timestamp(entry.created_at) || !timestamp(entry.updated_at)
    || (entry.metadata !== undefined && !object(entry.metadata))
    || (entry.title !== undefined && typeof entry.title !== 'string')
    || (entry.source !== undefined && typeof entry.source !== 'string')
    || (entry.tags !== undefined && !tags(entry.tags))
    || (entry.deleted !== undefined && typeof entry.deleted !== 'boolean')
    || (entry.linked_account_id != null && !nonempty(entry.linked_account_id))
    || (entry.server_id != null && !nonempty(entry.server_id))) {
    return review('invalid_record');
  }
  // Some legacy copies carry user_id outside the current local interface. Never
  // treat a record with an unexplained owner/server mapping as anonymous guest data.
  if ((entry.user_id != null && entry.user_id !== ''
      && (!nonempty(entry.user_id) || entry.user_id !== entry.linked_account_id))
    || (entry.server_id && !entry.linked_account_id)) {
    return review('ambiguous_ownership');
  }
  if (entry.deleted) { return review('deleted_record_requires_reconciliation'); }

  const metadata = entry.metadata || {};
  const structured = structuredContent(entry.content);
  if (entry.source === 'bible_study' || (object(structured) && structured.format === 'bible_study_v1')
    || own(metadata, 'bibleStudySessionId')) {
    return { status: 'journal_only', capabilityId: 'bible_study' };
  }
  if (entry.type === 'sermon' || entry.source === 'sermon_notes'
    || own(metadata, 'sessionNoteType')
    || (object(structured) && structured.format === 'sermon_notes_v1')) {
    return { status: 'journal_only', capabilityId: 'session_note' };
  }
  if (entry.source === 'scripture_note') {
    return { status: 'journal_only', capabilityId: 'scripture_note' };
  }
  if (!supportedTypes.has(entry.type) || (entry.source && !supportedSources.has(entry.source))) {
    return review('unknown_variant');
  }
  if (structured || ['guidedJourney', 'guided_journey', 'guidedReflection'].some(key => own(metadata, key))
    || own(entry, 'guided_journey')) {
    return review('structured_content_requires_mapping');
  }

  const base: SharedReflectionBase = {
    content: entry.content, type: entry.type, selected_date: entry.selected_date,
    ...(entry.title !== undefined ? { title: entry.title } : {}),
    ...(entry.source !== undefined ? { source: entry.source } : {}),
    ...(entry.tags !== undefined ? { tags: [...entry.tags] } : {}),
  };
  for (const key of stringContextFields) {
    const value = metadata[key];
    if (value !== undefined) {
      if (typeof value !== 'string') { return review('invalid_record'); }
      base[key] = value;
    }
  }
  for (const key of numberContextFields) {
    const value = metadata[key];
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) { return review('invalid_record'); }
      base[key] = value;
    }
  }
  return {
    status: 'supported', base,
    hasJournalOnlyMetadata: Object.keys(metadata).some(key => !sharedMetadataFields.has(key))
      || own(entry, 'journal_blocks'),
  };
};

/** Storage-free adapter into preflight. Review-only content cannot become an upload. */
export const toLocalReflectionMergePreview = (entry: LocalReflectionEntry): JournalMergePreviewRecord => {
  const projection = projectLocalReflectionForSharing(entry);
  return {
    id: entry.id,
    capabilityId: projection.status === 'supported' ? 'reflection'
      : projection.status === 'journal_only' ? projection.capabilityId : null,
    accountId: entry.linked_account_id ?? null,
    serverId: entry.server_id ?? null,
    deleted: entry.deleted,
  };
};

export type SharedReflectionPatchResult = {
  status: 'prepared';
  /** Future executor must commit atomically with its cursor/ledger; no writes here. */
  nextEntry: LocalReflectionEntry;
} | {
  status: 'rejected';
  reason: 'invalid_context' | 'account_mismatch' | 'identity_mismatch' | 'revision_conflict'
    | 'pending_local_changes' | 'unsupported_record' | 'unsupported_patch_fields' | 'invalid_patch';
};

/**
 * Pure incoming-patch preparation. Restricts edits to supported base fields and
 * preserves every private/unknown field. Does not acknowledge pending uploads.
 * Persist through a future transactional writer, not updateLocalReflection
 * (which would increment the prepared version again and cannot atomically move dates).
 */
export const prepareSharedReflectionPatch = (
  entry: LocalReflectionEntry,
  patch: unknown,
  context: { accountId: string; remoteId: string; expectedLocalVersion: number; appliedAt: string },
): SharedReflectionPatchResult => {
  const rejected = (reason: Extract<SharedReflectionPatchResult, { status: 'rejected' }>['reason']): SharedReflectionPatchResult =>
    ({ status: 'rejected', reason });
  if (!nonempty(context.accountId) || !nonempty(context.remoteId) || !timestamp(context.appliedAt)
    || !Number.isSafeInteger(context.expectedLocalVersion) || context.expectedLocalVersion < 1) {
    return rejected('invalid_context');
  }
  if (entry.linked_account_id !== context.accountId) { return rejected('account_mismatch'); }
  if ((entry.server_id || entry.id) !== context.remoteId) { return rejected('identity_mismatch'); }
  if (!Number.isSafeInteger(entry.version) || entry.version !== context.expectedLocalVersion
    || entry.version! >= Number.MAX_SAFE_INTEGER) {
    return rejected('revision_conflict');
  }
  // Legacy storage has one dirty flag for base and extensions. Until split
  // revisions exist, hold ALL unsynced changes rather than guessing their scope.
  if (entry.sync_status !== 'synced') { return rejected('pending_local_changes'); }
  if (projectLocalReflectionForSharing(entry).status !== 'supported') { return rejected('unsupported_record'); }
  if (!object(patch) || Object.keys(patch).length === 0) { return rejected('invalid_patch'); }
  if (Object.keys(patch).some(key => !mutableFields.has(key))) { return rejected('unsupported_patch_fields'); }
  if ((own(patch, 'title') && typeof patch.title !== 'string')
    || (own(patch, 'content') && (typeof patch.content !== 'string' || structuredContent(patch.content)))
    || (own(patch, 'tags') && !tags(patch.tags))
    || (own(patch, 'selected_date') && !validDate(patch.selected_date))) {
    return rejected('invalid_patch');
  }
  return {
    status: 'prepared',
    nextEntry: {
      ...entry,
      ...(own(patch, 'title') ? { title: patch.title as string } : {}),
      ...(own(patch, 'content') ? { content: patch.content as string } : {}),
      ...(own(patch, 'tags') ? { tags: [...patch.tags as string[]] } : {}),
      ...(own(patch, 'selected_date') ? { selected_date: patch.selected_date as string } : {}),
      version: entry.version! + 1, updated_at: context.appliedAt,
    },
  };
};
