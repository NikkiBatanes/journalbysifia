/**
 * V1 contract for an in-memory Journal backup. This file defines validation
 * and future restore policy only; it never writes local storage or cloud data.
 */
import { getJournalBackupInventory, type JournalBackupIntegrityReport, type JournalBackupInventory } from './journalBackupInventory';

export const JOURNAL_BACKUP_FORMAT = 'journal-by-sifia-backup';
export const JOURNAL_BACKUP_APP_IDENTIFIER = 'app.journal.sifia';
export const JOURNAL_BACKUP_SCHEMA_VERSION = 1 as const;

export interface JournalBackupEnvelopeV1 {
  format: typeof JOURNAL_BACKUP_FORMAT;
  appIdentifier: typeof JOURNAL_BACKUP_APP_IDENTIFIER;
  schemaVersion: typeof JOURNAL_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  /** Journal writing is sensitive user-authored content; never log its bodies. */
  sensitive: true;
  inventory: JournalBackupInventory;
  integrity: JournalBackupIntegrityReport;
  /** Reserved for a future transport-corruption checksum, not authentication. */
  contentChecksum?: { algorithm: 'SHA-256'; value: string };
}

export type JournalBackupValidationIssue = {
  severity: 'fatal' | 'warning';
  code: string;
  path: string;
  message: string;
};

export interface JournalBackupValidationResult {
  valid: boolean;
  backup?: JournalBackupEnvelopeV1;
  fatal: JournalBackupValidationIssue[];
  warnings: JournalBackupValidationIssue[];
}

export const JOURNAL_BACKUP_RESTORE_POLICY = {
  mode: 'replace-from-backup' as const,
  /** Never call AsyncStorage.clear(); only these Journal-owned stores may change. */
  ownedPrefixes: [
    'journal_local:', 'journal_local_singleton:', 'journal_local_index:',
    'reflection_local:', 'reflection_local_index:',
    'prayer_local:', 'prayer_local_index:',
    'bible_study_session:', 'bible_study_latest_session',
    'routine_state:', 'review_local:', 'review_local_index:',
    'review_settings_v1', 'prayer_draft:',
  ],
  excludedPrefixes: ['routine_draft:', 'timeblock_', 'time_blocks_', 'journal_cache_'],
  restoreOrder: ['journalRecords', 'reflectionRecords', 'prayerRecords', 'bibleStudySessions', 'routineStates', 'reviews', 'reviewSettings', 'prayerDrafts', 'rebuildIndexes', 'validateRelationships'],
  reconstructableIndexes: ['journal_local_index:', 'reflection_local_index:', 'prayer_local_index:', 'review_local_index:'],
  derivedPointers: ['bible_study_latest_session'],
  // AsyncStorage has no multi-key transaction. A future restore must first validate
  // fully, stage a rollback snapshot/recovery marker, then commit this order and
  // rebuild derived indexes before removing that marker.
  interruptionHandling: 'stage-rollback-snapshot-and-recovery-marker-before-any-owned-key-mutation' as const,
  snapshotConsistency: 'future-export-must-use-an-app-level-mutation-generation-or-retry-before-persisting' as const,
  // Legacy records are preserved in the envelope but have no proven V1 restore mapping.
  legacyCompatibility: 'preserve-but-do-not-destructively-restore-without-explicit-mapping' as const,
} as const;

const ymd = /^\d{4}-\d{2}-\d{2}$/;
const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const hasArray = (value: Record<string, any>, key: string) => Array.isArray(value[key]);

/** Creates an in-memory, serializable V1 envelope without writing data or files. */
export const createJournalBackup = async (exportedAt = new Date().toISOString()): Promise<JournalBackupEnvelopeV1> => {
  const inventory = await getJournalBackupInventory();
  return {
    format: JOURNAL_BACKUP_FORMAT,
    appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
    schemaVersion: JOURNAL_BACKUP_SCHEMA_VERSION,
    exportedAt,
    sensitive: true,
    inventory,
    integrity: inventory.integrity,
  };
};

const issue = (severity: 'fatal' | 'warning', code: string, path: string, message: string): JournalBackupValidationIssue => ({ severity, code, path, message });

/** Pure validation. A fatal result is a hard invariant: future restore must write nothing. */
export const validateJournalBackup = (candidate: unknown): JournalBackupValidationResult => {
  const fatal: JournalBackupValidationIssue[] = [];
  const warnings: JournalBackupValidationIssue[] = [];
  const add = (entry: JournalBackupValidationIssue) => (entry.severity === 'fatal' ? fatal : warnings).push(entry);
  if (!isObject(candidate)) {
    return { valid: false, fatal: [issue('fatal', 'malformed_root', '$', 'Backup must be an object.')], warnings };
  }
  if (candidate.format !== JOURNAL_BACKUP_FORMAT || candidate.appIdentifier !== JOURNAL_BACKUP_APP_IDENTIFIER) {
    add(issue('fatal', 'wrong_application', '$', 'Backup is not a Journal by siFia backup.'));
  }
  if (typeof candidate.schemaVersion !== 'number') {
    add(issue('fatal', 'missing_schema_version', '$.schemaVersion', 'Backup schemaVersion is required.'));
  } else if (candidate.schemaVersion !== JOURNAL_BACKUP_SCHEMA_VERSION) {
    add(issue('fatal', candidate.schemaVersion > JOURNAL_BACKUP_SCHEMA_VERSION ? 'unsupported_newer_schema' : 'unsupported_older_schema', '$.schemaVersion', 'No migration exists for this backup schema version.'));
  }
  if (typeof candidate.exportedAt !== 'string' || Number.isNaN(Date.parse(candidate.exportedAt))) {
    add(issue('fatal', 'invalid_exported_at', '$.exportedAt', 'exportedAt must be an ISO timestamp.'));
  }
  if (candidate.sensitive !== true) {
    add(issue('fatal', 'missing_sensitive_marker', '$.sensitive', 'Backup must declare its sensitive-content marker.'));
  }
  if (!isObject(candidate.integrity)) {
    add(issue('fatal', 'malformed_integrity_report', '$.integrity', 'Integrity report is required.'));
  }
  if (!isObject(candidate.inventory)) {
    add(issue('fatal', 'malformed_inventory', '$.inventory', 'inventory is required.'));
    return { valid: false, fatal, warnings };
  }
  const inventory = candidate.inventory;
  const requiredCollections = ['journalRecords', 'reflectionRecords', 'prayerRecords', 'bibleStudySessions', 'routineStates', 'reviews', 'prayerDrafts'];
  requiredCollections.forEach(key => { if (!hasArray(inventory, key)) {add(issue('fatal', 'malformed_collection', `$.inventory.${key}`, 'Required collection must be an array.'));} });
  if (!isObject(inventory.legacyAuthoredContent) || !hasArray(inventory.legacyAuthoredContent, 'reflectionLogs') || !hasArray(inventory.legacyAuthoredContent, 'journalRecords')) {
    add(issue('fatal', 'malformed_legacy_section', '$.inventory.legacyAuthoredContent', 'Legacy compatibility data must remain separated.'));
  }
  if (inventory.reviewSettings !== null && inventory.reviewSettings !== undefined && !isObject(inventory.reviewSettings)) {
    add(issue('fatal', 'malformed_review_settings', '$.inventory.reviewSettings', 'Review settings must be an object or null.'));
  }
  if (fatal.length) {return { valid: false, fatal, warnings };}

  const canonical = [...inventory.journalRecords, ...inventory.reflectionRecords, ...inventory.prayerRecords];
  const ids = new Set<string>();
  canonical.forEach((record: any, index) => {
    const path = `$.inventory.canonical[${index}]`;
    if (!isObject(record) || typeof record.id !== 'string' || !record.id) {add(issue('fatal', 'invalid_record_id', path, 'Canonical record requires an ID.')); return;}
    if (ids.has(record.id)) {add(issue('fatal', 'duplicate_canonical_id', path, `Duplicate canonical ID: ${record.id}`));}
    ids.add(record.id);
    if (typeof record.selected_date !== 'string' || !ymd.test(record.selected_date)) {add(issue('fatal', 'invalid_selected_date', path, 'Canonical selected_date must be YYYY-MM-DD.'));}
    if (typeof record.created_at !== 'string' || typeof record.updated_at !== 'string') {add(issue('fatal', 'invalid_timestamps', path, 'Canonical records require created_at and updated_at.'));}
    if (record.deleted !== undefined && typeof record.deleted !== 'boolean') {add(issue('fatal', 'invalid_tombstone', path, 'deleted must be boolean when present.'));}
  });
  inventory.bibleStudySessions.forEach((session: any, index: number) => {
    if (!isObject(session) || typeof session.id !== 'string' || !ymd.test(session.selected_date || '')) {add(issue('fatal', 'invalid_bible_study_session', `$.inventory.bibleStudySessions[${index}]`, 'Bible Study session is malformed.')); return;}
    if (session.reflection_ref && !ids.has(session.reflection_ref.local_id)) {add(issue('warning', 'dangling_bible_study_reflection', `$.inventory.bibleStudySessions[${index}]`, 'Referenced reflection is missing.'));}
    if (session.prayer_ref && !ids.has(session.prayer_ref.local_id)) {add(issue('warning', 'dangling_bible_study_prayer', `$.inventory.bibleStudySessions[${index}]`, 'Referenced prayer is missing.'));}
  });
  inventory.routineStates.forEach((state: any, index: number) => {
    if (!isObject(state) || typeof state.id !== 'string' || !ymd.test(state.selected_date || '')) {add(issue('fatal', 'invalid_routine_state', `$.inventory.routineStates[${index}]`, 'RoutineState is malformed.'));}
    Object.values(state?.content_refs || {}).flat().forEach((ref: any) => { if (ref?.local_id && !ids.has(ref.local_id)) {add(issue('warning', 'dangling_routine_reference', `$.inventory.routineStates[${index}]`, 'RoutineState references missing content.'));} });
  });
  inventory.reviews.forEach((review: any, index: number) => {
    if (!isObject(review) || typeof review.id !== 'string' || !ymd.test(review.periodStart || '') || !ymd.test(review.periodEnd || '')) {add(issue('fatal', 'invalid_review', `$.inventory.reviews[${index}]`, 'Review is malformed.'));}
    if (review?.memorableItems !== undefined && !Array.isArray(review.memorableItems)) {add(issue('fatal', 'invalid_review_items', `$.inventory.reviews[${index}]`, 'Review memorableItems must be an array.')); return;}
    (review?.memorableItems || []).forEach((item: any) => { if (item?.id && !ids.has(item.id)) {add(issue('warning', 'unresolved_review_reference', `$.inventory.reviews[${index}]`, 'Review source may be legacy or missing.'));} });
  });
  return { valid: fatal.length === 0, backup: fatal.length === 0 ? candidate as JournalBackupEnvelopeV1 : undefined, fatal, warnings };
};

/** V1 has no migrations. Unknown older/newer versions must be rejected, never guessed. */
export const migrateBackupToCurrentVersion = (candidate: unknown): JournalBackupValidationResult => validateJournalBackup(candidate);
