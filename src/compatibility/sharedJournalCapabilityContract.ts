/**
 * Product-level compatibility contract between siFia and Journal by siFia.
 *
 * This module is deliberately pure. It does not read storage, call Supabase,
 * or grant an entitlement. It defines which app may understand and mutate a
 * record family so adapters, migrations, sync, backup, and paywalls share the
 * same boundary.
 */

export const SHARED_JOURNAL_CONTRACT_VERSION = 1 as const;

export type JournalCapabilityScope =
  | 'shared_read_write'
  | 'shared_display_only'
  | 'journal_only'
  | 'journal_orchestration';

export type JournalCapabilityOperation = 'create' | 'read' | 'update' | 'delete';

export type JournalRemotePersistence =
  | 'free_sifia_account'
  | 'journal_cloud_or_manual_export'
  | 'follows_referenced_records';

export type JournalCapabilityReadiness = 'existing' | 'partial' | 'missing';

export interface SharedJournalCapability {
  id:
    | 'daily_journal'
    | 'reflection'
    | 'prayer'
    | 'time_block'
    | 'saved_devotional'
    | 'saved_playbook'
    | 'bible_study'
    | 'scripture_note'
    | 'session_note'
    | 'review'
    | 'routine_state'
    | 'prayer_draft'
    | 'journal_extension'
    | 'journal_media';
  label: string;
  scope: JournalCapabilityScope;
  /** Current persistence sources discovered in the two repositories. */
  sifiaSources: readonly string[];
  journalSources: readonly string[];
  /** Known subtype/origin discriminators. This is not a database enum. */
  variants: readonly string[];
  sifiaOperations: readonly JournalCapabilityOperation[];
  journalOperations: readonly JournalCapabilityOperation[];
  remotePersistence: JournalRemotePersistence;
  readiness: JournalCapabilityReadiness;
  notes: string;
}

const CRUD = ['create', 'read', 'update', 'delete'] as const;
const READ_ONLY = ['read'] as const;
const NO_OPERATIONS = [] as const;

export const SHARED_JOURNAL_CAPABILITIES: readonly SharedJournalCapability[] = [
  {
    id: 'daily_journal',
    label: 'Daily journal and planning moments',
    scope: 'shared_read_write',
    sifiaSources: ['journal_entries'],
    journalSources: ['LocalJournalEntry'],
    variants: [
      'morning_check_in',
      'todays_focus',
      'todo',
      'gratitude',
      'today_win',
      'looking_forward',
    ],
    sifiaOperations: CRUD,
    journalOperations: CRUD,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Both apps model these records, but Journal local-first writes and siFia cloud writes are not yet one bidirectional repository.',
  },
  {
    id: 'reflection',
    label: 'Heart Journal and compatible reflections',
    scope: 'shared_read_write',
    sifiaSources: ['reflection_entries'],
    journalSources: ['LocalReflectionEntry', 'sifiaReadCompatibility'],
    variants: ['free', 'guided', 'thought', 'devotional', 'playbook'],
    sifiaOperations: CRUD,
    journalOperations: CRUD,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Journal has a read adapter for siFia origins. Stable two-way IDs, conflict handling, and tombstone propagation are still missing.',
  },
  {
    id: 'prayer',
    label: 'Prayers, prayer needs, and prayer responses',
    scope: 'shared_read_write',
    sifiaSources: ['prayers'],
    journalSources: ['LocalPrayerEntry', 'sifiaReadCompatibility'],
    variants: ['journal', 'people', 'devotional', 'guided_playbook', 'prayer_request'],
    sifiaOperations: CRUD,
    journalOperations: CRUD,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Base prayer fields and lifecycle metadata must remain round-trippable even when Journal adds unsupported presentation or attachment blocks.',
  },
  {
    id: 'time_block',
    label: 'Time blocks shown in Moments',
    scope: 'shared_read_write',
    sifiaSources: ['time_blocks'],
    journalSources: ['LocalJournalEntry:time_block', 'LocalTimeBlockRecord'],
    variants: ['time_block'],
    sifiaOperations: CRUD,
    journalOperations: CRUD,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Both repositories contain time-block persistence, but the canonical implementation and recurrence contract must be consolidated.',
  },
  {
    id: 'saved_devotional',
    label: 'Saved devotional artifact',
    scope: 'shared_display_only',
    sifiaSources: ['devotionals', 'devotional-derived prayers and reflections'],
    journalSources: ['sifiaReadCompatibility'],
    variants: ['devotional', 'devotional_prayer', 'devotional_reflection'],
    sifiaOperations: CRUD,
    journalOperations: READ_ONLY,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Journal adapts devotional-derived authored records today; a complete saved-devotional display adapter still requires an inventory of the devotional payload.',
  },
  {
    id: 'saved_playbook',
    label: 'Saved playbook artifact and faithful actions',
    scope: 'shared_display_only',
    sifiaSources: ['playbooks', 'faithful actions', 'playbook-derived prayers and reflections'],
    journalSources: ['sifiaReadCompatibility'],
    variants: ['playbook', 'faithful_action', 'playbook_prayer', 'playbook_reflection'],
    sifiaOperations: CRUD,
    journalOperations: READ_ONLY,
    remotePersistence: 'free_sifia_account',
    readiness: 'partial',
    notes: 'Journal has compatibility models for playbook-derived records and faithful actions, not a complete editable playbook client.',
  },
  {
    id: 'bible_study',
    label: 'Bible Study',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['BibleStudySession', 'LocalReflectionEntry:bible_study'],
    variants: ['bible_study_v1'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'existing',
    notes: 'Bible Study stays out of siFia. A prayer explicitly saved from a Bible Study may create a separate shared prayer record.',
  },
  {
    id: 'scripture_note',
    label: 'Scripture Note',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['LocalReflectionEntry:scripture_note'],
    variants: ['scripture_note'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'existing',
    notes: 'Scripture Notes are composed and displayed only in Journal.',
  },
  {
    id: 'session_note',
    label: 'Session Notes',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['LocalReflectionEntry:sermon_notes'],
    variants: ['sermon', 'conference', 'speaking', 'meeting', 'workshop', 'other'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'existing',
    notes: 'Session Notes share one Journal editor and remain distinct from Heart Journal notes.',
  },
  {
    id: 'review',
    label: 'Weekly, monthly, seasonal, and annual reviews',
    scope: 'journal_orchestration',
    sifiaSources: [],
    journalSources: ['LocalReviewEntry'],
    variants: ['weekly', 'monthly', 'quarterly', 'year_end', 'begin_year'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'follows_referenced_records',
    readiness: 'existing',
    notes: 'Reviews store answers and stable references to canonical content. Sync and restore must never replace source records with review snapshots.',
  },
  {
    id: 'routine_state',
    label: 'Morning and evening routine state',
    scope: 'journal_orchestration',
    sifiaSources: [],
    journalSources: ['RoutineState'],
    variants: ['morning', 'evening'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'follows_referenced_records',
    readiness: 'existing',
    notes: 'Routine state references journal, reflection, and prayer records and does not duplicate their authored bodies.',
  },
  {
    id: 'prayer_draft',
    label: 'Prayer draft',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['PrayerDraft'],
    variants: ['prayer-editor'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'existing',
    notes: 'Drafts are private Journal state and must never appear as completed prayers in siFia.',
  },
  {
    id: 'journal_extension',
    label: 'Journal-only extension on a shared record',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['JournalBlock[] attached to a shared parent record'],
    variants: ['advanced_block', 'table', 'column', 'scripture', 'photo', 'voice'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'partial',
    notes: 'The shared base fields sync to siFia; unsupported blocks stay local or in Journal Cloud and retain parent_record_id.',
  },
  {
    id: 'journal_media',
    label: 'Journal photo or voice media',
    scope: 'journal_only',
    sifiaSources: [],
    journalSources: ['JournalBlock:photo', 'JournalBlock:voice'],
    variants: ['photo', 'voice'],
    sifiaOperations: NO_OPERATIONS,
    journalOperations: CRUD,
    remotePersistence: 'journal_cloud_or_manual_export',
    readiness: 'partial',
    notes: 'Current URI-based blocks require a durable app media vault before export or cloud backup can be reliable.',
  },
] as const;

export type SharedJournalCapabilityId = SharedJournalCapability['id'];

export const getSharedJournalCapability = (
  id: SharedJournalCapabilityId,
): SharedJournalCapability => {
  const capability = SHARED_JOURNAL_CAPABILITIES.find(item => item.id === id);
  if (!capability) {
    throw new Error(`Unknown shared journal capability: ${id}`);
  }
  return capability;
};

export const isFreeSharedCapability = (id: SharedJournalCapabilityId): boolean =>
  getSharedJournalCapability(id).remotePersistence === 'free_sifia_account';

export const canJournalMutateSharedBase = (id: SharedJournalCapabilityId): boolean => {
  const capability = getSharedJournalCapability(id);
  return capability.scope === 'shared_read_write'
    && capability.journalOperations.includes('update');
};

export const requiresJournalCloudForAutomaticRemotePersistence = (
  id: SharedJournalCapabilityId,
): boolean =>
  getSharedJournalCapability(id).remotePersistence === 'journal_cloud_or_manual_export';

export const validateSharedJournalCapabilityContract = (): string[] => {
  const issues: string[] = [];
  const ids = new Set<string>();

  SHARED_JOURNAL_CAPABILITIES.forEach(capability => {
    if (ids.has(capability.id)) {
      issues.push(`duplicate capability id: ${capability.id}`);
    }
    ids.add(capability.id);

    if (capability.scope === 'shared_read_write') {
      if (capability.remotePersistence !== 'free_sifia_account') {
        issues.push(`${capability.id}: shared read/write records must remain free siFia account data`);
      }
      for (const operation of CRUD) {
        if (!capability.sifiaOperations.includes(operation) || !capability.journalOperations.includes(operation)) {
          issues.push(`${capability.id}: shared read/write records require ${operation} in both apps`);
        }
      }
    }

    if (capability.scope === 'shared_display_only') {
      if (!capability.journalOperations.includes('read') || capability.journalOperations.some(operation => operation !== 'read')) {
        issues.push(`${capability.id}: display-only records must be read-only in Journal`);
      }
    }

    if ((capability.scope === 'journal_only' || capability.scope === 'journal_orchestration') && capability.sifiaOperations.length > 0) {
      issues.push(`${capability.id}: Journal-only records cannot expose siFia operations`);
    }
  });

  return issues;
};

