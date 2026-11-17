/**
 * Pure V1 restore planner. It validates a backup and produces deterministic
 * AsyncStorage operations, but deliberately imports no storage API and writes
 * nothing. A future executor must stage a rollback snapshot/recovery marker
 * before applying this plan.
 */
import {
  JOURNAL_BACKUP_RESTORE_POLICY,
  validateJournalBackup,
  type JournalBackupValidationIssue,
} from './journalBackupContract';
import type {
  BackupRecordLocation,
  JournalBackupInventory,
  KeyedBackupRecord,
} from './journalBackupInventory';

export type JournalBackupRestoreOperation = {
  key: string;
  value: string;
  section: string;
  kind: 'record' | 'setting' | 'index' | 'derived';
};

export type JournalBackupRestorePlan = {
  valid: boolean;
  fatal: JournalBackupValidationIssue[];
  warnings: JournalBackupValidationIssue[];
  operations: JournalBackupRestoreOperation[];
  operationCounts: Record<string, number>;
  clearOwnedKeysMatching: readonly string[];
  requiresRollbackSnapshot: true;
  interruptionHandling: typeof JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling;
};

type LocatedSection =
  | 'journalRecords'
  | 'reflectionRecords'
  | 'prayerRecords'
  | 'bibleStudySessions'
  | 'routineStates'
  | 'reviews';

const GOSPEL_KEYS = new Set([
  'journal:gospel:people:v1',
  'journal:gospel:self-response:v1',
  'journal:gospel:for-me-day-settings:v1',
  'journal:gospel:share-events:v1',
]);

const PREFERENCE_KEYS = new Set([
  'journal:local-profile',
  'journal:local-preferences',
  'journal:review-week-start',
  'journal:onboarding:setup:v1',
  'journal:scripture-sequence-start:v1',
  'prefs:noteBlocks:v1',
  'prefs:noteBlocks:v2',
  'prefs:hapticsEnabled',
  'prefs:soundsEnabled',
  'prefs:showTabLabelsEnabled',
]);

const sectionOrder = new Map<string, number>([
  'journalRecords',
  'reflectionRecords',
  'prayerRecords',
  'bibleStudySessions',
  'routineStates',
  'reviews',
  'reviewSettings',
  'prayerDrafts',
  'authoredDrafts.sessionNotes',
  'authoredDrafts.guidedReflections',
  'authoredDrafts.routines',
  'gospelAuthoredContent',
  'preferences',
  'rebuildIndexes',
  'derivedPointers',
].map((section, index) => [section, index]));

const issue = (
  severity: 'fatal' | 'warning',
  code: string,
  path: string,
  message: string,
): JournalBackupValidationIssue => ({ severity, code, path, message });

const emptyPlan = (
  fatal: JournalBackupValidationIssue[],
  warnings: JournalBackupValidationIssue[],
): JournalBackupRestorePlan => ({
  valid: false,
  fatal,
  warnings,
  operations: [],
  operationCounts: {},
  clearOwnedKeysMatching: JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes,
  requiresRollbackSnapshot: true,
  interruptionHandling: JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling,
});

const expectedKey = (section: LocatedSection, record: any): string[] => {
  switch (section) {
    case 'journalRecords':
      return [
        `journal_local:${record.content_type}:${record.selected_date}:${record.id}`,
        `journal_local_singleton:${record.content_type}:${record.selected_date}`,
      ];
    case 'reflectionRecords':
      return [`reflection_local:${record.type}:${record.selected_date}:${record.id}`];
    case 'prayerRecords':
      return [`prayer_local:${record.selected_date}:${record.id}`];
    case 'bibleStudySessions':
      return [`bible_study_session:${record.id}`];
    case 'routineStates':
      return [`routine_state:${record.routine}:${record.selected_date}`];
    case 'reviews':
      return [`review_local:${record.type}:${record.id}`];
  }
};

const validateLocations = (
  inventory: JournalBackupInventory,
  section: LocatedSection,
  fatal: JournalBackupValidationIssue[],
): Map<string, BackupRecordLocation> => {
  const records = inventory[section] as Array<{ id: string }>;
  const locations = inventory.recordLocations[section];
  const byId = new Map<string, BackupRecordLocation>();
  locations.forEach((location, index) => {
    if (byId.has(location.id)) {
      fatal.push(issue('fatal', 'duplicate_record_location', `$.inventory.recordLocations.${section}[${index}]`, `Multiple source keys were supplied for ${location.id}.`));
      return;
    }
    byId.set(location.id, location);
  });
  const recordIds = new Set(records.map(record => record.id));
  locations.forEach((location, index) => {
    if (!recordIds.has(location.id)) {
      fatal.push(issue('fatal', 'orphan_record_location', `$.inventory.recordLocations.${section}[${index}]`, 'Source key does not match a record in this section.'));
    }
  });
  records.forEach((record, index) => {
    const location = byId.get(record.id);
    if (!location) {
      fatal.push(issue('fatal', 'missing_record_location', `$.inventory.${section}[${index}]`, `No source key was supplied for ${record.id}.`));
      return;
    }
    if (!expectedKey(section, record).includes(location.key)) {
      fatal.push(issue('fatal', 'record_key_mismatch', `$.inventory.recordLocations.${section}`, `Source key does not match the ${section} record body.`));
    }
  });
  return byId;
};

const safeSerialize = (
  value: unknown,
  path: string,
  fatal: JournalBackupValidationIssue[],
): string | null => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      fatal.push(issue('fatal', 'unserializable_value', path, 'Restore value cannot be serialized.'));
      return null;
    }
    return serialized;
  } catch {
    fatal.push(issue('fatal', 'unserializable_value', path, 'Restore value cannot be serialized.'));
    return null;
  }
};

/** Build a deterministic, fail-closed plan. This function never writes data. */
export const planJournalBackupRestore = (candidate: unknown): JournalBackupRestorePlan => {
  const validation = validateJournalBackup(candidate);
  if (!validation.valid || !validation.backup) {
    return emptyPlan(validation.fatal, validation.warnings);
  }

  const inventory = validation.backup.inventory;
  const fatal = [...validation.fatal];
  const warnings = [...validation.warnings];
  const locatedSections: LocatedSection[] = [
    'journalRecords',
    'reflectionRecords',
    'prayerRecords',
    'bibleStudySessions',
    'routineStates',
    'reviews',
  ];
  const locations = new Map<LocatedSection, Map<string, BackupRecordLocation>>();
  locatedSections.forEach(section => locations.set(section, validateLocations(inventory, section, fatal)));

  const operations: JournalBackupRestoreOperation[] = [];
  const keys = new Set<string>();
  const add = (operation: JournalBackupRestoreOperation, path: string) => {
    if (keys.has(operation.key)) {
      fatal.push(issue('fatal', 'duplicate_restore_key', path, `Restore would write ${operation.key} more than once.`));
      return;
    }
    keys.add(operation.key);
    operations.push(operation);
  };
  const addJson = (key: string, value: unknown, section: string, kind: JournalBackupRestoreOperation['kind'], path: string) => {
    const serialized = safeSerialize(value, path, fatal);
    if (serialized !== null) {add({ key, value: serialized, section, kind }, path);}
  };

  locatedSections.forEach(section => {
    (inventory[section] as Array<{ id: string }>).forEach((record, index) => {
      const key = locations.get(section)?.get(record.id)?.key;
      if (key) {addJson(key, record, section, 'record', `$.inventory.${section}[${index}]`);}
    });
  });

  if (inventory.reviewSettings !== null) {
    addJson('review_settings_v1', inventory.reviewSettings, 'reviewSettings', 'setting', '$.inventory.reviewSettings');
  }
  inventory.prayerDrafts.forEach((draft, index) => {
    if (typeof draft.key !== 'string' || !draft.key.startsWith('prayer_draft:')) {
      fatal.push(issue('fatal', 'invalid_prayer_draft_key', `$.inventory.prayerDrafts[${index}]`, 'Prayer draft key is outside its owned namespace.'));
      return;
    }
    addJson(draft.key, draft, 'prayerDrafts', 'record', `$.inventory.prayerDrafts[${index}]`);
  });

  const addKeyed = (records: KeyedBackupRecord[], section: string, allowed: (key: string) => boolean) => records.forEach((record, index) => {
    const path = `$.inventory.${section}[${index}]`;
    if (!allowed(record.key)) {
      fatal.push(issue('fatal', 'key_outside_owned_namespace', path, 'Backup key is outside the exact Journal-owned namespace for this section.'));
      return;
    }
    addJson(record.key, record.value, section, section === 'preferences' ? 'setting' : 'record', path);
  });
  addKeyed(inventory.authoredDrafts.sessionNotes, 'authoredDrafts.sessionNotes', key => key.startsWith('session_notes_draft_v1:'));
  addKeyed(inventory.authoredDrafts.guidedReflections, 'authoredDrafts.guidedReflections', key => key.startsWith('guided_reflection_draft_v1:'));
  addKeyed(inventory.authoredDrafts.routines, 'authoredDrafts.routines', key => key.startsWith('routine_draft:'));
  addKeyed(inventory.gospelAuthoredContent, 'gospelAuthoredContent', key => GOSPEL_KEYS.has(key));
  addKeyed(inventory.preferences, 'preferences', key => PREFERENCE_KEYS.has(key));

  const indexGroups = new Map<string, string[]>();
  const index = (key: string, id: string, deleted?: boolean) => {
    if (deleted) {return;}
    const ids = indexGroups.get(key) ?? [];
    ids.push(id);
    indexGroups.set(key, ids);
  };
  inventory.journalRecords.forEach(record => {
    const key = locations.get('journalRecords')?.get(record.id)?.key;
    if (key?.startsWith('journal_local:')) {index(`journal_local_index:${record.content_type}:${record.selected_date}`, record.id, record.deleted);}
  });
  inventory.reflectionRecords.forEach(record => index(`reflection_local_index:${record.type}:${record.selected_date}`, record.id, record.deleted));
  inventory.prayerRecords.forEach(record => index(`prayer_local_index:${record.selected_date}`, record.id, record.deleted));
  inventory.reviews.forEach(record => index(`review_local_index:${record.type}`, record.id));
  [...indexGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([key, ids]) => {
    addJson(key, [...new Set(ids)].sort(), 'rebuildIndexes', 'index', `$.derived.${key}`);
  });

  const latestSession = [...inventory.bibleStudySessions]
    .sort((a, b) => `${b.updated_at}|${b.id}`.localeCompare(`${a.updated_at}|${a.id}`))[0];
  if (latestSession) {
    add({ key: 'bible_study_latest_session', value: latestSession.id, section: 'derivedPointers', kind: 'derived' }, '$.derived.bible_study_latest_session');
  }

  const legacyCount = inventory.legacyAuthoredContent.reflectionLogs.length + inventory.legacyAuthoredContent.journalRecords.length;
  if (legacyCount > 0) {
    warnings.push(issue('warning', 'legacy_records_not_restored', '$.inventory.legacyAuthoredContent', `${legacyCount} legacy record(s) are preserved in the backup but intentionally excluded from the V1 restore plan.`));
  }

  if (fatal.length) {return emptyPlan(fatal, warnings);}
  operations.sort((a, b) => {
    const rank = (sectionOrder.get(a.section) ?? Number.MAX_SAFE_INTEGER) - (sectionOrder.get(b.section) ?? Number.MAX_SAFE_INTEGER);
    return rank || a.key.localeCompare(b.key);
  });
  const operationCounts = operations.reduce<Record<string, number>>((counts, operation) => {
    counts[operation.kind] = (counts[operation.kind] ?? 0) + 1;
    return counts;
  }, {});
  return {
    valid: true,
    fatal,
    warnings,
    operations,
    operationCounts,
    clearOwnedKeysMatching: JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes,
    requiresRollbackSnapshot: true,
    interruptionHandling: JOURNAL_BACKUP_RESTORE_POLICY.interruptionHandling,
  };
};
