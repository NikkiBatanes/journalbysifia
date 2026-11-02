/** Simple prayer field boundary. Rich lifecycle histories require a separate mapping. */
import type { LocalPrayerEntry } from '../storage/prayerStorage';
import type { JournalMergePreviewRecord } from './sharedJournalMergePreview';
import {
  isRecord, isDateOrTimestamp, hasOwn, readStructuredTextContent,
  validateLocalSharedRecord, validateSharedPatchTarget, projectScalarMetadata, type SharedPatchContext, type SharedPatchPreparationIssue,
} from './sharedJournalFieldValidation';

export interface SharedPrayerBase {
  prayer_type: LocalPrayerEntry['prayer_type'];
  content: string;
  selected_date: string;
  title?: string;
  journal_category?: LocalPrayerEntry['journal_category'];
  status?: 'pending' | 'answered';
  answered_date?: string | null;
  person_name?: string;
  is_prayer_request?: boolean;
  requested_by?: string;
  prayed?: boolean;
  notes?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  devotional_title?: string;
  metadata?: Record<string, string | number | null>;
}
export type PrayerProjection = { status: 'supported'; base: SharedPrayerBase; hasJournalOnlyMetadata: boolean } | {
  status: 'review_required';
  reason: 'invalid_record' | 'ambiguous_ownership' | 'unknown_variant' | 'structured_content_requires_mapping'
    | 'lifecycle_requires_mapping' | 'deleted_record_requires_reconciliation';
};

const prayerTypes = new Set(['journal', 'people', 'devotional', 'guided_playbook']);
const categories = new Set(['adoration', 'confession', 'thanksgiving', 'supplication', 'personal_prayer']);
const strings = ['title', 'person_name', 'requested_by', 'notes', 'day_title', 'devotional_title'] as const;
const numbers = ['day_number', 'total_days', 'question_number'] as const;
// These are state/history, not disposable presentation metadata. No lossy
// status/answered_date summary may be uploaded in place of the full lifecycle.
const lifecycleKeys = ['prayer_needs', 'answer_history', 'prayer_updates', 'lifecycle_history', 'tracking_status', 'track_answered', 'is_active'];

export const projectLocalPrayerForSharing = (entry: LocalPrayerEntry): PrayerProjection => {
  const review = (reason: Extract<PrayerProjection, { status: 'review_required' }>['reason']): PrayerProjection => ({ status: 'review_required', reason });
  const issue = validateLocalSharedRecord(entry);
  if (issue) { return review(issue); }
  if (entry.deleted) { return review('deleted_record_requires_reconciliation'); }
  if (!prayerTypes.has(entry.prayer_type) || (entry.journal_category !== undefined && !categories.has(entry.journal_category))) {
    return review('unknown_variant');
  }
  const row = entry as LocalPrayerEntry & Record<string, unknown>;
  if (strings.some(key => row[key] !== undefined && typeof row[key] !== 'string')
    || numbers.some(key => row[key] !== undefined && (typeof row[key] !== 'number' || !Number.isSafeInteger(row[key]) || Number(row[key]) < 0))
    || ['is_prayer_request', 'prayed'].some(key => row[key] !== undefined && typeof row[key] !== 'boolean')
    || (entry.status !== undefined && entry.status !== 'pending' && entry.status !== 'answered')
    || (row.answered_date != null && !isDateOrTimestamp(row.answered_date))) {
    return review('invalid_record');
  }
  const metadata = entry.metadata || {};
  if (lifecycleKeys.some(key => hasOwn(metadata, key))
    || (entry.status === 'pending' && row.answered_date != null)) { return review('lifecycle_requires_mapping'); }
  if (readStructuredTextContent(entry.content) || (entry.notes !== undefined && readStructuredTextContent(entry.notes))) {
    return review('structured_content_requires_mapping');
  }
  const context = projectScalarMetadata(metadata, [
    'source', 'devotional_id', 'devotional_title', 'playbook_id', 'playbook_title',
    'step_id', 'subtask_id', 'prompt', 'question',
  ]);
  if (!context.valid) { return review('invalid_record'); }
  const base: SharedPrayerBase = {
    prayer_type: entry.prayer_type, content: entry.content, selected_date: entry.selected_date,
    ...(entry.journal_category !== undefined ? { journal_category: entry.journal_category } : {}),
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(hasOwn(row, 'answered_date') ? { answered_date: row.answered_date as string | null } : {}),
    ...(entry.is_prayer_request !== undefined ? { is_prayer_request: entry.is_prayer_request } : {}),
    ...(entry.prayed !== undefined ? { prayed: entry.prayed } : {}),
    ...(Object.keys(context.fields).length ? { metadata: context.fields } : {}),
  };
  for (const key of strings) { if (typeof row[key] === 'string') { base[key] = row[key] as string; } }
  for (const key of numbers) { if (typeof row[key] === 'number') { base[key] = row[key] as number; } }
  return { status: 'supported', base,
    hasJournalOnlyMetadata: context.hasUnmapped || ['prayer_count', 'last_prayed_at', 'journal_blocks'].some(key => hasOwn(row, key)) };
};

export const toLocalPrayerMergePreview = (entry: LocalPrayerEntry): JournalMergePreviewRecord => ({
  id: entry.id, capabilityId: projectLocalPrayerForSharing(entry).status === 'supported' ? 'prayer' : null,
  accountId: entry.linked_account_id ?? null, serverId: entry.server_id ?? null, deleted: entry.deleted,
});

export const prepareSharedPrayerTextPatch = (entry: LocalPrayerEntry, patch: unknown, context: SharedPatchContext):
  { status: 'prepared'; nextEntry: LocalPrayerEntry } | { status: 'rejected'; reason: SharedPatchPreparationIssue } => {
  const issue = validateSharedPatchTarget(entry, context);
  if (issue) { return { status: 'rejected', reason: issue }; }
  if (projectLocalPrayerForSharing(entry).status !== 'supported') { return { status: 'rejected', reason: 'unsupported_record' }; }
  if (!isRecord(patch) || Object.keys(patch).length === 0) { return { status: 'rejected', reason: 'invalid_patch' }; }
  if (Object.keys(patch).some(key => !['title', 'content', 'person_name', 'notes', 'selected_date'].includes(key))) {
    return { status: 'rejected', reason: 'unsupported_patch_fields' };
  }
  const nextEntry = { ...entry, ...patch, version: entry.version! + 1, updated_at: context.appliedAt };
  if (projectLocalPrayerForSharing(nextEntry).status !== 'supported') { return { status: 'rejected', reason: 'invalid_patch' }; }
  return { status: 'prepared', nextEntry };
};
