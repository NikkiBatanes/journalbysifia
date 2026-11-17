const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockValues.get(key) ?? null])),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJournalBackupInventory } from '../journalBackupInventory';

const put = (key: string, value: unknown) => mockValues.set(key, JSON.stringify(value));
const timestamp = '2026-09-17T10:00:00.000Z';

beforeEach(() => {
  mockValues.clear();
  jest.clearAllMocks();
});

it('enumerates raw canonical records, tombstones, relationships, settings, and prayer drafts without mutating storage', async () => {
  put('journal_local:todo:2026-09-17:todo-active', { id: 'todo-active', content_type: 'todo', selected_date: '2026-09-17', content: '{"text":"Active"}', created_at: timestamp, updated_at: timestamp });
  put('journal_local_singleton:morning_check_in:2026-09-17', { id: 'morning-check', content_type: 'morning_check_in', selected_date: '2026-09-17', content: '{"feeling":"Hopeful"}', created_at: timestamp, updated_at: timestamp });
  put('journal_local:todo:2026-09-17:todo-deleted', { id: 'todo-deleted', content_type: 'todo', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp, deleted: true });
  put('journal_local:time_block:2026-09-17:time-block-local', { id: 'time-block-local', content_type: 'time_block', selected_date: '2026-09-17', content: '{"title":"Plan locally","start_time":"2026-09-17T09:00:00.000Z","end_time":"2026-09-17T10:00:00.000Z"}', created_at: timestamp, updated_at: timestamp });
  put('reflection_local:scripture:2026-09-17:study-reflection', { id: 'study-reflection', type: 'scripture', source: 'bible_study', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp });
  put('reflection_local:free:2026-09-17:classified-reflection', { id: 'classified-reflection', type: 'free', source: 'freeform', selected_date: '2026-09-17', content: 'Writing', created_at: timestamp, updated_at: timestamp, metadata: { journalClassification: 'brain_dump' } });
  put('reflection_local:free:2026-09-17:reflection-deleted', { id: 'reflection-deleted', type: 'free', selected_date: '2026-09-17', content: '{}', created_at: timestamp, updated_at: timestamp, deleted: true });
  put('reflection_local:guided:2026-09-17:guided-journey', { id: 'guided-journey', type: 'guided', source: 'guided', selected_date: '2026-09-17', content: JSON.stringify({ format: 'guided_reflection_v1', pathId: 'mind-feels-full', pathTitle: 'My mind feels full', currentStepId: 'scripture', completed: false, answers: [{ stepId: 'space', selected: ['Work'], notes: [{ id: 'note-1', kind: 'key', text: 'Stay present.' }] }, { stepId: 'scripture', text: 'God holds tomorrow.', notes: [] }] }), created_at: timestamp, updated_at: timestamp, metadata: { prompt: 'My mind feels full', guidedJourney: { format: 'guided_reflection_v1', pathId: 'mind-feels-full', currentStepId: 'scripture' } } });
  put('prayer_local:2026-09-17:study-prayer', { id: 'study-prayer', prayer_type: 'journal', selected_date: '2026-09-17', content: 'Prayer', created_at: timestamp, updated_at: timestamp, metadata: { bibleStudyReflectionId: 'study-reflection' } });
  put('prayer_local:2026-09-17:prayer-deleted', { id: 'prayer-deleted', prayer_type: 'journal', selected_date: '2026-09-17', content: 'Deleted', created_at: timestamp, updated_at: timestamp, deleted: true });
  put('bible_study_session:study-session', { id: 'study-session', selected_date: '2026-09-17', passage: { reference: 'John 1' }, current_stage: 'saved', current_step: 'respond', completed_steps: [], completed: true, started_at: timestamp, updated_at: timestamp, version: 2, reflection_ref: { domain: 'reflection', content_type: 'scripture', local_id: 'study-reflection' }, prayer_ref: { domain: 'prayer', content_type: 'prayer', local_id: 'study-prayer' } });
  put('routine_state:morning:2026-09-17', { id: 'routine', routine: 'morning', selected_date: '2026-09-17', completed: true, completed_steps: ['todos'], content_refs: { todos: { domain: 'journal', content_type: 'todo', local_id: 'todo-active' } } });
  put('review_local:weekly:review-1', { id: 'review-1', type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20', status: 'completed', memorableItems: [{ kind: 'journal', id: 'todo-active', selectedDate: '2026-09-17' }, { kind: 'journal', id: 'missing', selectedDate: '2026-09-17' }], answers: {}, createdAt: timestamp, updatedAt: timestamp });
  put('review_settings_v1', { weekEndsOn: 0, reminderTime: '19:00', enabledCadences: { weekly: true } });
  put('prayer_draft:open:2026-09-17:default', { key: 'prayer_draft:open:2026-09-17:default', type: 'open', selectedDate: '2026-09-17', updatedAt: timestamp, data: { content: 'Unfinished' } });
  put('session_notes_draft_v1:2026-09-17:new:sermon', { title: 'Unfinished sermon notes' });
  put('guided_reflection_draft_v1:2026-09-17:mind-feels-full', { answers: ['Unfinished reflection'] });
  put('routine_draft:morning:2026-09-17:todos', { text: 'Unfinished routine writing' });
  put('journal:gospel:people:v1', [{ id: 'person-1', name: 'A friend' }]);
  put('journal:gospel:self-response:v1', { testimony: 'Grace changed me' });
  put('journal:gospel:for-me-day-settings:v1', { completedDays: [1, 2] });
  put('journal:gospel:share-events:v1', [{ id: 'share-1' }]);
  put('journal:local-profile', { firstName: 'Nikki' });
  put('journal:local-preferences', { weekStart: 'monday' });
  put('journal:review-week-start', 'thursday');
  put('prefs:noteBlocks:v2', { enabledKinds: ['key'] });
  put('prefs:hapticsEnabled', true);
  put('@sifia/gospel-share-owner-key', 'device-secret');
  put('@siFia:offlineQueue', [{ secret: 'pending-network-operation' }]);
  put('journal:impact-outbox:v1', [{ event: 'private-analytics-queue' }]);
  put('supabase.auth.token', { access_token: 'never-export' });
  put('timeblock_user_2026-09-17', [{ id: 'excluded' }]);
  put('reflection_log_legacy-user_2026-09-16', { content: { entries: [{ id: 'legacy-reflection' }] } });
  put('journal_gratitude_2026-09-16_legacy-user', { id: 'legacy-journal' });
  put('journal_local_index:todo:2026-09-17', ['todo-active']);

  const first = await getJournalBackupInventory();
  const second = await getJournalBackupInventory();

  expect(first).toEqual(second);
  expect(first.journalRecords.map(record => record.id)).toEqual(['morning-check', 'time-block-local', 'todo-active', 'todo-deleted']);
  expect(first.recordLocations.journalRecords).toContainEqual({ id: 'morning-check', key: 'journal_local_singleton:morning_check_in:2026-09-17' });
  expect(first.journalRecords.find(record => record.id === 'time-block-local')?.content_type).toBe('time_block');
  expect(first.reflectionRecords.map(record => record.id)).toEqual(['classified-reflection', 'guided-journey', 'reflection-deleted', 'study-reflection']);
  expect(first.reflectionRecords.find(record => record.id === 'classified-reflection')?.metadata?.journalClassification).toBe('brain_dump');
  const guidedBackup = first.reflectionRecords.find(record => record.id === 'guided-journey');
  expect(guidedBackup?.metadata?.guidedJourney.pathId).toBe('mind-feels-full');
  expect(guidedBackup?.content).toContain('note-1');
  expect(guidedBackup?.content).toContain('God holds tomorrow.');
  expect(first.prayerRecords.map(record => record.id)).toEqual(['prayer-deleted', 'study-prayer']);
  expect(first.integrity.tombstones).toEqual({ journalRecords: 1, reflectionRecords: 1, prayerRecords: 1 });
  expect(first.bibleStudySessions[0].reflection_ref?.local_id).toBe('study-reflection');
  expect(first.bibleStudySessions[0].prayer_ref?.local_id).toBe('study-prayer');
  expect(first.routineStates[0].content_refs?.todos).toEqual({ domain: 'journal', content_type: 'todo', local_id: 'todo-active' });
  expect(first.reviews[0].id).toBe('review-1');
  expect(first.reviewSettings?.reminderTime).toBe('19:00');
  expect(first.prayerDrafts[0].data.content).toBe('Unfinished');
  expect(first.authoredDrafts.sessionNotes[0].key).toBe('session_notes_draft_v1:2026-09-17:new:sermon');
  expect(first.authoredDrafts.guidedReflections[0].key).toBe('guided_reflection_draft_v1:2026-09-17:mind-feels-full');
  expect(first.authoredDrafts.routines[0].value).toEqual({ text: 'Unfinished routine writing' });
  expect(first.gospelAuthoredContent.map(record => record.key)).toEqual([
    'journal:gospel:for-me-day-settings:v1',
    'journal:gospel:people:v1',
    'journal:gospel:self-response:v1',
    'journal:gospel:share-events:v1',
  ]);
  expect(first.preferences.map(record => record.key)).toEqual([
    'journal:local-preferences',
    'journal:local-profile',
    'journal:review-week-start',
    'prefs:hapticsEnabled',
    'prefs:noteBlocks:v2',
  ]);
  expect(first.legacyAuthoredContent.reflectionLogs).toHaveLength(1);
  expect(first.legacyAuthoredContent.journalRecords).toHaveLength(1);
  expect(first.integrity.danglingReferences).toContainEqual({ owner: 'review:review-1', reference: 'missing', status: 'legacy_unresolved' });
  expect(JSON.stringify(first)).not.toContain('timeblock_user');
  expect(JSON.stringify(first)).not.toContain('gospel-share-owner-key');
  expect(JSON.stringify(first)).not.toContain('offlineQueue');
  expect(JSON.stringify(first)).not.toContain('impact-outbox');
  expect(JSON.stringify(first)).not.toContain('access_token');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});
