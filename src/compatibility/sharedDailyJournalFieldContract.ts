/** Daily Moments field mapping. Preparation only; no storage or remote writes. */
import type { LocalJournalEntry } from '../storage/journalStorage';
import type { JournalMergePreviewRecord } from './sharedJournalMergePreview';
import {
  isRecord, isNonemptyString, isDateOrTimestamp, hasOwn,
  validateLocalSharedRecord, validateSharedPatchTarget, projectScalarMetadata, type SharedPatchContext, type SharedPatchPreparationIssue,
} from './sharedJournalFieldValidation';

type SharedDailyType = 'gratitude' | 'todo' | 'todays_focus' | 'today_win' | 'looking_forward';
export interface SharedDailyJournalBase {
  content_type: SharedDailyType;
  /** Original supported JSON bytes, validated recursively before inclusion. */
  content: string;
  selected_date: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, string | number | null>;
}
export type DailyJournalProjection = {
  status: 'supported'; base: SharedDailyJournalBase; hasJournalOnlyMetadata: boolean;
} | {
  status: 'journal_only'; capabilityId: 'journal_only_moment';
} | {
  status: 'review_required';
  reason: 'invalid_record' | 'ambiguous_ownership' | 'unknown_variant' | 'requires_time_block_adapter'
    | 'invalid_content' | 'unmapped_content_fields' | 'conflicting_base_fields' | 'deleted_record_requires_reconciliation';
};

const dailyTypes = new Set(['gratitude', 'todo', 'todays_focus', 'today_win', 'looking_forward']);
const journalOnlyTypes = new Set(['morning_check_in', 'weekly_gratitude', 'weekly_looking_forward']);
const priority = (value: unknown): value is 'high' | 'medium' | 'low' => ['high', 'medium', 'low'].includes(value as string);
const only = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every(key => keys.includes(key));
const optionalStrings = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every(key => !hasOwn(value, key) || typeof value[key] === 'string');

const textItems = (value: unknown, completed = false): boolean => {
  if (!Array.isArray(value)) { return false; }
  const ids = new Set<string>();
  return value.every(item => {
    if (typeof item === 'string') { return !completed; }
    if (!isRecord(item) || !isNonemptyString(item.id) || typeof item.text !== 'string'
      || !only(item, completed ? ['id', 'text', 'completed'] : ['id', 'text'])
      || (hasOwn(item, 'completed') && typeof item.completed !== 'boolean') || ids.has(item.id)) { return false; }
    ids.add(item.id);
    return true;
  });
};

/** Unknown nested properties are held for mapping, never dropped or forwarded. */
const supportedContent = (type: SharedDailyType, value: Record<string, unknown>): boolean => {
  if (type === 'gratitude') { return only(value, ['items']) && textItems(value.items); }
  if (type === 'todo') {
    return only(value, ['text', 'completed', 'priority']) && typeof value.text === 'string'
      && (!hasOwn(value, 'completed') || typeof value.completed === 'boolean')
      && (!hasOwn(value, 'priority') || typeof value.priority === 'boolean' || priority(value.priority));
  }
  if (type === 'todays_focus') {
    return only(value, ['focus', 'focusCategory', 'customFocus', 'personalText', 'priorities'])
      && typeof value.focus === 'string' && optionalStrings(value, ['focusCategory', 'customFocus', 'personalText'])
      && (!hasOwn(value, 'priorities') || textItems(value.priorities, true));
  }
  if (type === 'today_win') {
    if (hasOwn(value, 'win')) { return only(value, ['win']) && typeof value.win === 'string'; }
    if (hasOwn(value, 'wins')) { return only(value, ['wins']) && textItems(value.wins); }
    return only(value, ['winType', 'winTypeName', 'quietWin']) && typeof value.winType === 'string'
      && typeof value.winTypeName === 'string' && typeof value.quietWin === 'string';
  }
  if (hasOwn(value, 'items')) { return only(value, ['items']) && textItems(value.items); }
  if (!only(value, ['entry', 'emotionId', 'emotionName', 'customEmotion'])
    || !optionalStrings(value, ['emotionId', 'emotionName', 'customEmotion'])) { return false; }
  if (typeof value.entry === 'string') { return true; }
  return isRecord(value.entry) && only(value.entry, ['id', 'text', 'date'])
    && isNonemptyString(value.entry.id) && typeof value.entry.text === 'string'
    && isDateOrTimestamp(value.entry.date);
};

export const projectLocalDailyJournalForSharing = (entry: LocalJournalEntry): DailyJournalProjection => {
  const issue = validateLocalSharedRecord(entry);
  if (issue) { return { status: 'review_required', reason: issue }; }
  if (entry.deleted) { return { status: 'review_required', reason: 'deleted_record_requires_reconciliation' }; }
  if (journalOnlyTypes.has(entry.content_type)) { return { status: 'journal_only', capabilityId: 'journal_only_moment' }; }
  if (entry.content_type === 'time_block') { return { status: 'review_required', reason: 'requires_time_block_adapter' }; }
  if (!dailyTypes.has(entry.content_type)) { return { status: 'review_required', reason: 'unknown_variant' }; }
  if ((entry.completed !== undefined && typeof entry.completed !== 'boolean')
    || (entry.priority !== undefined && !priority(entry.priority))) { return { status: 'review_required', reason: 'invalid_record' }; }
  let content: unknown;
  try { content = JSON.parse(entry.content); } catch { return { status: 'review_required', reason: 'invalid_content' }; }
  if (!isRecord(content)) { return { status: 'review_required', reason: 'invalid_content' }; }
  if (!supportedContent(entry.content_type as SharedDailyType, content)) {
    return { status: 'review_required', reason: 'unmapped_content_fields' };
  }
  if (entry.content_type === 'todo' && entry.completed !== undefined && hasOwn(content, 'completed')
    && entry.completed !== content.completed) { return { status: 'review_required', reason: 'conflicting_base_fields' }; }
  const context = projectScalarMetadata(entry.metadata || {}, [
    'subtaskTitle', 'playbookTitle', 'actionStepTitle', 'source', 'subtask_id', 'step_id', 'playbook_id',
  ], ['actionStepNumber']);
  if (!context.valid) { return { status: 'review_required', reason: 'invalid_record' }; }
  return {
    status: 'supported',
    base: { content_type: entry.content_type as SharedDailyType, content: entry.content, selected_date: entry.selected_date,
      ...(entry.completed !== undefined ? { completed: entry.completed } : {}),
      ...(entry.priority !== undefined ? { priority: entry.priority } : {}),
      ...(Object.keys(context.fields).length ? { metadata: context.fields } : {}) },
    hasJournalOnlyMetadata: context.hasUnmapped || hasOwn(entry, 'journal_blocks'),
  };
};

export const toLocalDailyJournalMergePreview = (entry: LocalJournalEntry): JournalMergePreviewRecord => {
  const projection = projectLocalDailyJournalForSharing(entry);
  return { id: entry.id, capabilityId: projection.status === 'supported' ? 'daily_journal'
    : projection.status === 'journal_only' ? projection.capabilityId : null,
    accountId: entry.linked_account_id ?? null, serverId: entry.server_id ?? null, deleted: entry.deleted };
};

export const prepareSharedDailyJournalPatch = (entry: LocalJournalEntry, patch: unknown, context: SharedPatchContext):
  { status: 'prepared'; nextEntry: LocalJournalEntry } | { status: 'rejected'; reason: SharedPatchPreparationIssue } => {
  const issue = validateSharedPatchTarget(entry, context);
  if (issue) { return { status: 'rejected', reason: issue }; }
  if (projectLocalDailyJournalForSharing(entry).status !== 'supported') { return { status: 'rejected', reason: 'unsupported_record' }; }
  if (!isRecord(patch) || Object.keys(patch).length === 0) { return { status: 'rejected', reason: 'invalid_patch' }; }
  if (!only(patch, ['content', 'completed', 'priority', 'selected_date'])) { return { status: 'rejected', reason: 'unsupported_patch_fields' }; }
  const nextEntry = { ...entry, ...patch, version: entry.version! + 1, updated_at: context.appliedAt };
  // Revalidate the entire candidate, including JSON schema and coupled Todo state.
  if (projectLocalDailyJournalForSharing(nextEntry).status !== 'supported') { return { status: 'rejected', reason: 'invalid_patch' }; }
  return { status: 'prepared', nextEntry };
};
