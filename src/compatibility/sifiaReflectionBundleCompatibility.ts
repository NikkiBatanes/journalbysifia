/** Read-only adapter for legacy per-day reflection containers. No migration writes. */
import {
  adaptSifiaReflection,
  type SifiaReflectionReadModel,
  type SifiaReflectionRecord,
} from './sifiaReadCompatibility';

export interface SifiaReflectionBundle {
  id: string;
  user_id: string;
  content_type: string;
  content: unknown;
}

export type SifiaReflectionBundleResult = {
  status: 'supported';
  items: Array<{
    source: { table: 'reflection_entries'; rowId: string; childId: string };
    reflection: SifiaReflectionReadModel;
  }>;
} | {
  status: 'review_required';
  reason: 'unsupported_container' | 'invalid_content' | 'invalid_child' | 'duplicate_child_id' | 'account_mismatch';
  /** No partial adaptation: a bad sibling must not silently disappear. */
  items: [];
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

export const adaptSifiaReflectionBundle = (row: SifiaReflectionBundle): SifiaReflectionBundleResult => {
  const review = (reason: Extract<SifiaReflectionBundleResult, { status: 'review_required' }>['reason']): SifiaReflectionBundleResult =>
    ({ status: 'review_required', reason, items: [] });
  if (row.content_type !== 'reflection_log' || !nonempty(row.id) || !nonempty(row.user_id)) {
    return review('unsupported_container');
  }
  let content = row.content;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { return review('invalid_content'); }
  }
  if (!object(content) || !Array.isArray(content.entries)) { return review('invalid_content'); }

  const ids = new Set<string>();
  const items: Extract<SifiaReflectionBundleResult, { status: 'supported' }>['items'] = [];
  for (const child of content.entries) {
    if (!object(child) || !nonempty(child.id) || typeof child.content !== 'string'
      || !nonempty(child.type) || !validDate(child.selected_date)
      || !validTimestamp(child.created_at) || !validTimestamp(child.updated_at)
      || (child.metadata !== undefined && !object(child.metadata))
      || ['title', 'source', 'prompt', 'server_id'].some(key => child[key] !== undefined && child[key] !== null && typeof child[key] !== 'string')) {
      return review('invalid_child');
    }
    if (child.user_id !== row.user_id) { return review('account_mismatch'); }
    if (ids.has(child.id)) { return review('duplicate_child_id'); }
    ids.add(child.id);
    items.push({
      source: { table: 'reflection_entries', rowId: row.id, childId: child.id },
      reflection: adaptSifiaReflection(child as unknown as SifiaReflectionRecord),
    });
  }
  return { status: 'supported', items };
};
