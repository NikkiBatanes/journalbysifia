/**
 * Read-only boundary for user-authored records persisted by siFia.
 *
 * This module deliberately has no storage, network, or generation dependencies. It
 * derives presentation data without changing the source record or its discriminators.
 */

export type SifiaCompatibilityOrigin =
  | 'journal'
  | 'sifia_thought'
  | 'sifia_guided'
  | 'sifia_devotional'
  | 'sifia_playbook';

export interface SifiaReflectionRecord {
  id: string;
  server_id?: string | null;
  user_id?: string;
  title?: string;
  content: string;
  type?: string;
  source?: string;
  prompt?: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
  devotional_title?: string;
  devotional_id?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  question_text?: string;
  playbook_title?: string;
  playbook_id?: string;
  subtask_id?: string;
}

export interface SifiaReflectionReadModel {
  id: string;
  serverId: string | null;
  origin: SifiaCompatibilityOrigin;
  originalType: string;
  originalSource: string;
  title: string;
  content: string;
  prompt?: string;
  contextLines: string[];
  searchText: string;
  selectedDate: string;
  createdAt: string;
  updatedAt: string;
  relationships: {
    devotionalId?: string;
    playbookId?: string;
    subtaskId?: string;
  };
  presentation: 'generic_reflection';
}

const normalized = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';
const firstString = (...values: unknown[]): string | undefined => values.find(value => typeof value === 'string' && value.trim()) as string | undefined;

export const deriveReflectionOrigin = (record: SifiaReflectionRecord): SifiaCompatibilityOrigin => {
  const type = normalized(record.type);
  const source = normalized(record.source);
  const metadata = record.metadata || {};
  if (['thought', 'thoughts'].includes(type) || ['thought', 'thoughts'].includes(source)) return 'sifia_thought';
  if (type === 'devotional' || source === 'devotional' || record.devotional_id || metadata.devotional_id) return 'sifia_devotional';
  if (type === 'playbook' || source === 'playbook' || record.playbook_id || metadata.playbook_id) return 'sifia_playbook';
  if ((type === 'guided' || source === 'guided') && !record.metadata?.guided_journey && !record.metadata?.guidedReflection) return 'sifia_guided';
  return 'journal';
};

export const adaptSifiaReflection = (record: SifiaReflectionRecord): SifiaReflectionReadModel => {
  const metadata = record.metadata || {};
  const origin = deriveReflectionOrigin(record);
  const devotionalTitle = firstString(record.devotional_title, metadata.devotional_title);
  const dayTitle = firstString(record.day_title, metadata.day_title);
  const playbookTitle = firstString(record.playbook_title, metadata.playbook_title);
  const prompt = firstString(record.prompt, record.question_text, metadata.prompt, metadata.question_text);
  const contextLines = [
    devotionalTitle,
    (record.day_number ?? metadata.day_number) !== undefined ? `Day ${record.day_number ?? metadata.day_number}${dayTitle ? `: ${dayTitle}` : ''}` : dayTitle,
    playbookTitle,
    prompt,
  ].filter((value): value is string => !!value);
  const defaultTitle: Record<SifiaCompatibilityOrigin, string> = {
    journal: 'Reflection',
    sifia_thought: 'Thought',
    sifia_guided: 'Guided Reflection',
    sifia_devotional: prompt ? 'Ponder' : 'Devotional Reflection',
    sifia_playbook: 'Playbook Reflection',
  };
  return {
    id: record.id,
    serverId: record.server_id || null,
    origin,
    originalType: record.type || '',
    originalSource: record.source || '',
    title: record.title || defaultTitle[origin],
    content: record.content,
    prompt,
    contextLines,
    searchText: [record.title, record.content, ...contextLines].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase(),
    selectedDate: record.selected_date,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    relationships: {
      devotionalId: firstString(record.devotional_id, metadata.devotional_id),
      playbookId: firstString(record.playbook_id, metadata.playbook_id),
      subtaskId: firstString(record.subtask_id, metadata.subtask_id),
    },
    presentation: 'generic_reflection',
  };
};

export interface SifiaPrayerRecord {
  id: string;
  server_id?: string | null;
  prayer_type?: string;
  source?: string;
  type?: string;
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  day_number?: number;
  day_title?: string;
  devotional_title?: string;
  metadata?: Record<string, any>;
}

export interface SifiaPrayerReadModel {
  id: string;
  serverId: string | null;
  origin: SifiaCompatibilityOrigin;
  originalPrayerType: string;
  originalSource: string;
  content: string;
  contextLines: string[];
  searchText: string;
  relationships: { devotionalId?: string; playbookId?: string; stepId?: string; subtaskId?: string };
}

export const derivePrayerOrigin = (record: SifiaPrayerRecord): SifiaCompatibilityOrigin => {
  const metadata = record.metadata || {};
  const markers = [record.prayer_type, record.source, record.type, metadata.source, metadata.origin].map(normalized);
  if (markers.some(value => value === 'devotional' || value === 'prayed_devotional' || value === 'prayed_devo') ||
      metadata.prayed_devo === true || metadata.is_devo === true || metadata.is_devotional === true ||
      !!record.devotional_title || !!metadata.devotional_id) return 'sifia_devotional';
  if (markers.some(value => value === 'guided_playbook' || value === 'playbook') || !!metadata.playbook_id || !!metadata.playbookId) return 'sifia_playbook';
  return 'journal';
};

export const adaptSifiaPrayer = (record: SifiaPrayerRecord): SifiaPrayerReadModel => {
  const metadata = record.metadata || {};
  const contextLines = [
    firstString(record.devotional_title, metadata.devotional_title),
    record.day_number !== undefined ? `Day ${record.day_number}${record.day_title ? `: ${record.day_title}` : ''}` : undefined,
    firstString(metadata.playbook_title, metadata.playbookTitle),
    firstString(metadata.prompt, metadata.question),
  ].filter((value): value is string => !!value);
  return {
    id: record.id,
    serverId: record.server_id || null,
    origin: derivePrayerOrigin(record),
    originalPrayerType: record.prayer_type || '',
    originalSource: record.source || '',
    content: record.content,
    contextLines,
    searchText: [record.content, ...contextLines].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase(),
    relationships: {
      devotionalId: firstString(metadata.devotional_id, metadata.devotionalId),
      playbookId: firstString(metadata.playbook_id, metadata.playbookId),
      stepId: firstString(metadata.step_id, metadata.stepId),
      subtaskId: firstString(metadata.subtask_id, metadata.subtaskId),
    },
  };
};

export interface PersistedFaithfulAction {
  id: string;
  playbook_id: string;
  text: string;
  description?: string | null;
  completed: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface FaithfulActionReadModel {
  id: string;
  playbookId: string;
  playbookTitle: string;
  title: string;
  description: string;
  completed: boolean;
  orderIndex: number;
  createdAt?: string;
  updatedAt?: string;
  origin: 'sifia_playbook';
  searchText: string;
}

export const adaptFaithfulAction = (row: PersistedFaithfulAction, playbookTitle: string): FaithfulActionReadModel => ({
  id: row.id,
  playbookId: row.playbook_id,
  playbookTitle,
  title: row.text,
  description: row.description || '',
  completed: row.completed,
  orderIndex: row.order_index,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  origin: 'sifia_playbook',
  searchText: [row.text, row.description, playbookTitle].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase(),
});
