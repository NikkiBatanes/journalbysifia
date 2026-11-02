/** Pure Time Block boundary. Never expands recurring series or reads a calendar. */
import {
  isRecord, isNonemptyString, isDateOrTimestamp, hasOwn, readStructuredTextContent,
  validateLocalSharedRecord, validateSharedPatchTarget, projectScalarMetadata,
  type LocalSharedRecord, type SharedPatchContext, type SharedPatchPreparationIssue,
} from './validation';

export type LocalTimeBlockEnvelope = LocalSharedRecord & { content_type: string; completed?: boolean };
export interface SharedTimeBlockBase {
  selected_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  all_day: boolean;
  title: string;
  category: string;
  location?: string;
  description?: string;
  is_completed?: boolean;
  completed_at?: string;
  metadata?: Record<string, string | number | null>;
}
export type TimeBlockProjection = { status: 'supported'; base: SharedTimeBlockBase; hasJournalOnlyMetadata: boolean; hasDeviceOnlyFields: boolean } | {
  status: 'review_required';
  reason: 'invalid_record' | 'ambiguous_ownership' | 'unknown_variant' | 'invalid_content'
    | 'deleted_record_requires_reconciliation' | 'virtual_instance' | 'recurrence_requires_mapping'
    | 'unmapped_content_fields' | 'timezone_requires_mapping' | 'invalid_time_range'
    | 'selected_date_mismatch' | 'invalid_completion_state' | 'structured_content_requires_mapping' | 'conflicting_context';
};

const allowedFields = new Set([
  'start_time', 'end_time', 'all_day', 'title', 'location', 'category', 'description',
  'alert', 'alarm_minutes', 'repeat_rule', 'repeat_until', 'repeat_frequency', 'repeat_end_date',
  'repeat_custom_frequency', 'timezone', 'is_completed', 'completed_at', 'calendar_event_id', 'version', 'metadata',
]);
const awareInstant = (value: unknown): value is string => typeof value === 'string' && value.includes('T') && isDateOrTimestamp(value);

const zonedDate = (instant: string, timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const projectLocalTimeBlockForSharing = (entry: LocalTimeBlockEnvelope): TimeBlockProjection => {
  const review = (reason: Extract<TimeBlockProjection, { status: 'review_required' }>['reason']): TimeBlockProjection => ({ status: 'review_required', reason });
  const issue = validateLocalSharedRecord(entry);
  if (issue) { return review(issue); }
  if (entry.content_type !== 'time_block') { return review('unknown_variant'); }
  if (entry.deleted) { return review('deleted_record_requires_reconciliation'); }
  let value: unknown;
  try { value = JSON.parse(entry.content); } catch { return review('invalid_content'); }
  if (!isRecord(value)) { return review('invalid_content'); }
  const data = value;
  if (Object.keys(data).some(key => !allowedFields.has(key))) { return review('unmapped_content_fields'); }
  if ((data.metadata != null && !isRecord(data.metadata))
    || !isNonemptyString(data.title) || !isNonemptyString(data.category) || typeof data.all_day !== 'boolean'
    || ['location', 'description'].some(key => data[key] !== undefined && typeof data[key] !== 'string')) { return review('invalid_content'); }
  const innerMetadata = isRecord(data.metadata) ? data.metadata : {};
  const outerMetadata = entry.metadata || {};
  if ([innerMetadata, outerMetadata].some(meta => ['_virtualInstance', '_virtualDate', '_originalDate'].some(key => hasOwn(meta, key)))) {
    return review('virtual_instance');
  }
  // UI aliases/custom days and legacy recurrence expansion do not yet share a
  // verified zone-aware occurrence contract. Never import virtual dates as parents.
  if (data.category === 'exception'
    || (data.repeat_frequency != null && data.repeat_frequency !== 'never')
    || (data.repeat_rule != null && (!isRecord(data.repeat_rule)
      || data.repeat_rule.frequency !== 'never' || Object.keys(data.repeat_rule).some(key => key !== 'frequency')))
    || ['repeat_until', 'repeat_end_date', 'repeat_custom_frequency'].some(key => data[key] != null)
    || [innerMetadata, outerMetadata].some(meta => hasOwn(meta, 'exceptions') || hasOwn(meta, 'endDate'))) {
    return review('recurrence_requires_mapping');
  }
  if (!awareInstant(data.start_time) || !awareInstant(data.end_time) || Date.parse(data.end_time) <= Date.parse(data.start_time)) {
    return review('invalid_time_range');
  }
  if (!isNonemptyString(data.timezone)) { return review('timezone_requires_mapping'); }
  let startDate: string;
  let endDate: string;
  try {
    startDate = zonedDate(data.start_time, data.timezone);
    endDate = zonedDate(data.end_time, data.timezone);
  } catch { return review('timezone_requires_mapping'); }
  if (startDate !== entry.selected_date || (data.all_day && endDate !== entry.selected_date)) {
    return review('selected_date_mismatch');
  }
  if ((data.is_completed !== undefined && typeof data.is_completed !== 'boolean')
    || (data.completed_at != null && (!awareInstant(data.completed_at) || data.is_completed !== true))
    || (entry.completed !== undefined && entry.completed !== data.is_completed)) { return review('invalid_completion_state'); }
  if (typeof data.description === 'string' && readStructuredTextContent(data.description)) { return review('structured_content_requires_mapping'); }
  const contextKeys = ['subtaskTitle', 'subtaskId', 'stepId', 'playbookId', 'playbookTitle', 'actionStepTitle', 'source'];
  const innerContext = projectScalarMetadata(innerMetadata, contextKeys, ['actionStepNumber']);
  const outerContext = projectScalarMetadata(outerMetadata, contextKeys, ['actionStepNumber']);
  if (!innerContext.valid || !outerContext.valid) { return review('invalid_content'); }
  if (Object.keys(innerContext.fields).some(key => hasOwn(outerContext.fields, key)
    && innerContext.fields[key] !== outerContext.fields[key])) { return review('conflicting_context'); }
  const sharedContext = { ...outerContext.fields, ...innerContext.fields };
  return {
    status: 'supported',
    base: { selected_date: entry.selected_date, start_time: data.start_time, end_time: data.end_time,
      timezone: data.timezone, all_day: data.all_day, title: data.title, category: data.category,
      ...(typeof data.location === 'string' ? { location: data.location } : {}),
      ...(typeof data.description === 'string' ? { description: data.description } : {}),
      ...(typeof data.is_completed === 'boolean' ? { is_completed: data.is_completed } : {}),
      ...(typeof data.completed_at === 'string' ? { completed_at: data.completed_at } : {}),
      ...(Object.keys(sharedContext).length ? { metadata: sharedContext } : {}) },
    hasJournalOnlyMetadata: innerContext.hasUnmapped || outerContext.hasUnmapped,
    hasDeviceOnlyFields: ['calendar_event_id', 'alarm_minutes', 'alert'].some(key => hasOwn(data, key)),
  };
};

/** Text-only preparation; scheduling edits require the future series/transaction protocol. */
export const prepareSharedTimeBlockTextPatch = <T extends LocalTimeBlockEnvelope>(entry: T, patch: unknown, context: SharedPatchContext):
  { status: 'prepared'; nextEntry: T } | { status: 'rejected'; reason: SharedPatchPreparationIssue } => {
  const issue = validateSharedPatchTarget(entry, context);
  if (issue) { return { status: 'rejected', reason: issue }; }
  if (projectLocalTimeBlockForSharing(entry).status !== 'supported') { return { status: 'rejected', reason: 'unsupported_record' }; }
  if (!isRecord(patch) || Object.keys(patch).length === 0) { return { status: 'rejected', reason: 'invalid_patch' }; }
  if (Object.keys(patch).some(key => !['title', 'location', 'description'].includes(key))) { return { status: 'rejected', reason: 'unsupported_patch_fields' }; }
  const nextEntry = { ...entry, content: JSON.stringify({ ...JSON.parse(entry.content), ...patch }), version: entry.version! + 1, updated_at: context.appliedAt };
  if (projectLocalTimeBlockForSharing(nextEntry).status !== 'supported') { return { status: 'rejected', reason: 'invalid_patch' }; }
  return { status: 'prepared', nextEntry };
};
