const mockInventory = {
  journalRecords: [{ id: 'todo-1', content_type: 'todo', selected_date: '2026-09-17', content: '{"text":"Faithful task"}', created_at: '2026-09-17T10:00:00.000Z', updated_at: '2026-09-17T10:00:00.000Z', deleted: true, version: 2 }],
  reflectionRecords: [{ id: 'study-reflection', type: 'scripture', source: 'bible_study', selected_date: '2026-09-17', content: '{}', created_at: '2026-09-17T10:00:00.000Z', updated_at: '2026-09-17T10:00:00.000Z' }],
  prayerRecords: [{ id: 'study-prayer', prayer_type: 'journal', selected_date: '2026-09-17', content: 'Prayer', created_at: '2026-09-17T10:00:00.000Z', updated_at: '2026-09-17T10:00:00.000Z' }],
  bibleStudySessions: [{ id: 'study-session', selected_date: '2026-09-17', passage: { reference: 'John 1' }, current_stage: 'saved', current_step: 'respond', completed_steps: [], completed: true, started_at: '2026-09-17T10:00:00.000Z', updated_at: '2026-09-17T10:00:00.000Z', version: 1, reflection_ref: { local_id: 'study-reflection' }, prayer_ref: { local_id: 'study-prayer' } }],
  routineStates: [{ id: 'routine-1', routine: 'morning', selected_date: '2026-09-17', completed: true, completed_steps: [], content_refs: { todo: { local_id: 'todo-1' } } }],
  reviews: [{ id: 'review-1', type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20', status: 'completed', memorableItems: [{ id: 'todo-1' }], answers: {}, createdAt: '2026-09-17T10:00:00.000Z', updatedAt: '2026-09-17T10:00:00.000Z' }],
  reviewSettings: { weekEndsOn: 0, reminderTime: '19:00', enabledCadences: { weekly: true } },
  prayerDrafts: [{ key: 'prayer_draft:open:2026-09-17:default', type: 'open', selectedDate: '2026-09-17', updatedAt: '2026-09-17T10:00:00.000Z', data: { content: 'Draft' } }],
  legacyAuthoredContent: { reflectionLogs: [{ key: 'reflection_log_legacy', value: {} }], journalRecords: [] },
  integrity: { counts: {}, tombstones: { journalRecords: 1, reflectionRecords: 0, prayerRecords: 0 }, duplicateIds: [], danglingReferences: [], legacyOnlyRecords: { reflectionLogs: 1, journalRecords: 0 } },
};

jest.mock('../journalBackupInventory', () => ({ getJournalBackupInventory: jest.fn(async () => mockInventory) }));

import { createJournalBackup, JOURNAL_BACKUP_APP_IDENTIFIER, JOURNAL_BACKUP_FORMAT, JOURNAL_BACKUP_SCHEMA_VERSION, validateJournalBackup } from '../journalBackupContract';

it('creates and validates a deterministic V1 envelope without rewriting canonical records', async () => {
  const backup = await createJournalBackup('2026-09-17T12:00:00.000Z');
  const result = validateJournalBackup(backup);
  expect(result.valid).toBe(true);
  expect(backup).toMatchObject({ format: JOURNAL_BACKUP_FORMAT, appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER, schemaVersion: JOURNAL_BACKUP_SCHEMA_VERSION });
  expect(backup.inventory.journalRecords[0]).toEqual(mockInventory.journalRecords[0]);
  expect(backup.inventory.bibleStudySessions[0].reflection_ref?.local_id).toBe('study-reflection');
  expect(backup.inventory.legacyAuthoredContent.reflectionLogs).toHaveLength(1);
});

it('accepts a structurally valid empty Journal backup', () => {
  const empty = { format: JOURNAL_BACKUP_FORMAT, appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER, schemaVersion: 1, exportedAt: '2026-09-17T12:00:00.000Z', sensitive: true, inventory: { ...mockInventory, journalRecords: [], reflectionRecords: [], prayerRecords: [], bibleStudySessions: [], routineStates: [], reviews: [], prayerDrafts: [], legacyAuthoredContent: { reflectionLogs: [], journalRecords: [] } }, integrity: mockInventory.integrity };
  expect(validateJournalBackup(empty).valid).toBe(true);
});

it.each([
  [null, 'malformed_root'],
  [{ format: 'wrong', appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER, schemaVersion: 1, exportedAt: '2026-09-17T12:00:00.000Z', inventory: mockInventory }, 'wrong_application'],
  [{ format: JOURNAL_BACKUP_FORMAT, appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER, exportedAt: '2026-09-17T12:00:00.000Z', inventory: mockInventory }, 'missing_schema_version'],
  [{ format: JOURNAL_BACKUP_FORMAT, appIdentifier: JOURNAL_BACKUP_APP_IDENTIFIER, schemaVersion: 2, exportedAt: '2026-09-17T12:00:00.000Z', inventory: mockInventory }, 'unsupported_newer_schema'],
])('rejects incompatible payloads', (payload: any, code: string) => {
  expect(validateJournalBackup(payload).fatal.map(issue => issue.code)).toContain(code);
});

it('rejects duplicate canonical IDs and reports dangling references as warnings', async () => {
  const backup = await createJournalBackup('2026-09-17T12:00:00.000Z');
  const duplicate = { ...backup, inventory: { ...backup.inventory, prayerRecords: [{ ...backup.inventory.prayerRecords[0], id: 'todo-1' }] } };
  expect(validateJournalBackup(duplicate).fatal.map(issue => issue.code)).toContain('duplicate_canonical_id');
  const dangling = { ...backup, inventory: { ...backup.inventory, bibleStudySessions: [{ ...backup.inventory.bibleStudySessions[0], prayer_ref: { local_id: 'missing' } }] } };
  const result = validateJournalBackup(dangling);
  expect(result.valid).toBe(true);
  expect(result.warnings.map(issue => issue.code)).toContain('dangling_bible_study_prayer');
});
