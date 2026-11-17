import {
  JOURNAL_BACKUP_APP_IDENTIFIER,
  JOURNAL_BACKUP_FORMAT,
} from '../journalBackupContract';
import { planJournalBackupRestore } from '../journalBackupRestorePlan';

const timestamp = '2026-09-17T10:00:00.000Z';

const makeBackup = () => ({
  format: JOURNAL_BACKUP_FORMAT,
  appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER,
  schemaVersion: 1,
  exportedAt: '2026-09-17T12:00:00.000Z',
  sensitive: true,
  inventory: {
    journalRecords: [
      { id: 'singleton-1', content_type: 'morning_check_in', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp },
      { id: 'todo-2', content_type: 'todo', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp },
      { id: 'todo-1', content_type: 'todo', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp, deleted: true },
    ],
    reflectionRecords: [
      { id: 'reflection-1', type: 'scripture', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp },
    ],
    prayerRecords: [
      { id: 'prayer-1', prayer_type: 'journal', selected_date: '2026-09-17', content: 'Prayer', created_at: timestamp, updated_at: timestamp },
    ],
    bibleStudySessions: [
      { id: 'session-old', selected_date: '2026-09-16', passage: { reference: 'John 1' }, current_stage: 'home', current_step: 'passage', completed_steps: [], completed: false, started_at: '2026-09-16T10:00:00.000Z', updated_at: '2026-09-16T10:00:00.000Z', version: 1 },
      { id: 'session-new', selected_date: '2026-09-17', passage: { reference: 'John 2' }, current_stage: 'home', current_step: 'passage', completed_steps: [], completed: false, started_at: timestamp, updated_at: timestamp, version: 1 },
    ],
    routineStates: [
      { id: 'routine-1', routine: 'morning', selected_date: '2026-09-17', completed: false, completed_steps: [] },
    ],
    reviews: [
      { id: 'review-1', type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20', status: 'draft', memorableItems: [], answers: {}, createdAt: timestamp, updatedAt: timestamp },
    ],
    reviewSettings: { weekEndsOn: 0 },
    prayerDrafts: [
      { key: 'prayer_draft:open:2026-09-17:default', type: 'open', selectedDate: '2026-09-17', updatedAt: timestamp, data: { content: 'Draft' } },
    ],
    recordLocations: {
      journalRecords: [
        { id: 'singleton-1', key: 'journal_local_singleton:morning_check_in:2026-09-17' },
        { id: 'todo-2', key: 'journal_local:todo:2026-09-17:todo-2' },
        { id: 'todo-1', key: 'journal_local:todo:2026-09-17:todo-1' },
      ],
      reflectionRecords: [{ id: 'reflection-1', key: 'reflection_local:scripture:2026-09-17:reflection-1' }],
      prayerRecords: [{ id: 'prayer-1', key: 'prayer_local:2026-09-17:prayer-1' }],
      bibleStudySessions: [
        { id: 'session-old', key: 'bible_study_session:session-old' },
        { id: 'session-new', key: 'bible_study_session:session-new' },
      ],
      routineStates: [{ id: 'routine-1', key: 'routine_state:morning:2026-09-17' }],
      reviews: [{ id: 'review-1', key: 'review_local:weekly:review-1' }],
    },
    authoredDrafts: {
      sessionNotes: [{ key: 'session_notes_draft_v1:2026-09-17:new:sermon', value: { title: 'Draft' } }],
      guidedReflections: [],
      routines: [],
    },
    gospelAuthoredContent: [{ key: 'journal:gospel:self-response:v1', value: { testimony: 'Grace' } }],
    preferences: [{ key: 'prefs:hapticsEnabled', value: true }],
    legacyAuthoredContent: { reflectionLogs: [{ key: 'reflection_log_legacy', value: {} }], journalRecords: [] },
    integrity: { counts: {}, tombstones: { journalRecords: 1, reflectionRecords: 0, prayerRecords: 0 }, duplicateIds: [], danglingReferences: [], legacyOnlyRecords: { reflectionLogs: 1, journalRecords: 0 } },
  },
  integrity: { counts: {}, tombstones: { journalRecords: 1, reflectionRecords: 0, prayerRecords: 0 }, duplicateIds: [], danglingReferences: [], legacyOnlyRecords: { reflectionLogs: 1, journalRecords: 0 } },
});

it('builds a deterministic no-write plan, preserving singleton keys and reconstructing indexes', () => {
  const backup = makeBackup();
  const first = planJournalBackupRestore(backup);
  const second = planJournalBackupRestore(backup);

  expect(first).toEqual(second);
  expect(first.valid).toBe(true);
  expect(first.requiresRollbackSnapshot).toBe(true);
  expect(first.operations).toContainEqual(expect.objectContaining({
    key: 'journal_local_singleton:morning_check_in:2026-09-17',
    section: 'journalRecords',
  }));
  expect(first.operations.find(operation => operation.key === 'journal_local_index:todo:2026-09-17')?.value).toBe('["todo-2"]');
  expect(first.operations.some(operation => operation.key.includes('journal_local_index:morning_check_in'))).toBe(false);
  expect(first.operations.find(operation => operation.key === 'bible_study_latest_session')?.value).toBe('session-new');
  expect(first.warnings.map(entry => entry.code)).toContain('legacy_records_not_restored');
  expect(first.operations.some(operation => operation.key.startsWith('reflection_log_'))).toBe(false);
});

it('fails closed when a source key does not match its record body', () => {
  const backup = makeBackup();
  backup.inventory.recordLocations.journalRecords[1].key = 'journal_local:todo:2026-09-17:another-user-record';
  const result = planJournalBackupRestore(backup);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toContain('record_key_mismatch');
  expect(result.operations).toEqual([]);
});

it('fails closed when keyed content attempts to escape its exact owned namespace', () => {
  const backup = makeBackup();
  backup.inventory.preferences = [{ key: 'supabase.auth.token', value: { access_token: 'malicious' } }];
  const result = planJournalBackupRestore(backup);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toContain('key_outside_owned_namespace');
  expect(result.operations).toEqual([]);
});

it('returns no operations for a structurally invalid backup', () => {
  const backup = makeBackup();
  delete (backup.inventory as any).recordLocations;
  const result = planJournalBackupRestore(backup);
  expect(result.valid).toBe(false);
  expect(result.fatal.map(entry => entry.code)).toContain('missing_record_locations');
  expect(result.operations).toEqual([]);
});
