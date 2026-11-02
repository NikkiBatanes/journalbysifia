/** Pure validators shared by field adapters. No storage, networking, or logging. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const isNonemptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
export const isCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
export const isTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
/** Known persisted date forms only; Date.parse alone normalizes impossible dates. */
export const isDateOrTimestamp = (value: unknown): value is string => {
  if (isCalendarDate(value)) { return true; }
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && isCalendarDate(value.slice(0, 10)) && isTimestamp(value);
};
export const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

export const readStructuredTextContent = (content: string): Record<string, unknown> | unknown[] | null => {
  let candidate = content;
  for (let depth = 0; depth < 4; depth++) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed) || Array.isArray(parsed)) { return parsed; }
      if (typeof parsed !== 'string') { return null; }
      candidate = parsed;
    } catch {
      const first = candidate.trimStart()[0];
      return first === '{' || first === '[' ? {} : null;
    }
  }
  // Deeper encoding is ambiguous; do not guess it is harmless plain text.
  return {};
};

export type LocalSharedRecord = {
  id: string;
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  linked_account_id?: string | null;
  server_id?: string | null;
  deleted?: boolean;
  version?: number;
  sync_status?: string;
};

/** Copy only known scalar context. Never recurse into/spread private metadata. */
export const projectScalarMetadata = (
  metadata: Record<string, unknown>,
  stringKeys: readonly string[],
  numberKeys: readonly string[] = [],
): { valid: boolean; fields: Record<string, string | number | null>; hasUnmapped: boolean } => {
  const fields: Record<string, string | number | null> = {};
  for (const key of stringKeys) {
    if (!hasOwn(metadata, key)) { continue; }
    const value = metadata[key];
    if (value === undefined) { continue; }
    if (value !== null && typeof value !== 'string') { return { valid: false, fields: {}, hasUnmapped: true }; }
    fields[key] = value;
  }
  for (const key of numberKeys) {
    if (!hasOwn(metadata, key)) { continue; }
    const value = metadata[key];
    if (value === undefined) { continue; }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) { return { valid: false, fields: {}, hasUnmapped: true }; }
    fields[key] = value;
  }
  return { valid: true, fields, hasUnmapped: Object.keys(metadata).some(key => !stringKeys.includes(key) && !numberKeys.includes(key)) };
};

export const validateLocalSharedRecord = (value: unknown): 'invalid_record' | 'ambiguous_ownership' | null => {
  if (!isRecord(value) || !isNonemptyString(value.id) || typeof value.content !== 'string'
    || !isCalendarDate(value.selected_date) || !isTimestamp(value.created_at) || !isTimestamp(value.updated_at)
    || (value.metadata !== undefined && !isRecord(value.metadata))
    || (value.deleted !== undefined && typeof value.deleted !== 'boolean')
    || (value.linked_account_id != null && !isNonemptyString(value.linked_account_id))
    || (value.server_id != null && !isNonemptyString(value.server_id))) {
    return 'invalid_record';
  }
  if ((value.user_id != null && value.user_id !== ''
      && (!isNonemptyString(value.user_id) || value.user_id !== value.linked_account_id))
    || (value.server_id && !value.linked_account_id)) {
    return 'ambiguous_ownership';
  }
  return null;
};

export interface SharedPatchContext {
  accountId: string;
  remoteId: string;
  expectedLocalVersion: number;
  appliedAt: string;
}

export const validateSharedPatchTarget = (entry: LocalSharedRecord, context: SharedPatchContext):
  'invalid_context' | 'account_mismatch' | 'identity_mismatch' | 'revision_conflict' | 'pending_local_changes' | null => {
  if (!isNonemptyString(context.accountId) || !isNonemptyString(context.remoteId) || !isTimestamp(context.appliedAt)
    || !Number.isSafeInteger(context.expectedLocalVersion) || context.expectedLocalVersion < 1) { return 'invalid_context'; }
  if (entry.linked_account_id !== context.accountId) { return 'account_mismatch'; }
  if ((entry.server_id || entry.id) !== context.remoteId) { return 'identity_mismatch'; }
  if (!Number.isSafeInteger(entry.version) || entry.version !== context.expectedLocalVersion
    || entry.version! >= Number.MAX_SAFE_INTEGER) { return 'revision_conflict'; }
  if (entry.sync_status !== 'synced') { return 'pending_local_changes'; }
  return null;
};

export type SharedPatchPreparationIssue = NonNullable<ReturnType<typeof validateSharedPatchTarget>>
  | 'unsupported_record' | 'unsupported_patch_fields' | 'invalid_patch';
