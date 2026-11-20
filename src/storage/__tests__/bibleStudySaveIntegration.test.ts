import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeBibleStudySession, createBibleStudySession, createEmptyBibleStudyContent, deleteSavedBibleStudy, getActiveBibleStudySession, saveBibleStudyContent } from '../bibleStudyStorage';
import { getSavedBibleStudyReflections, parseSavedBibleStudy } from '../bibleStudyMomentsStorage';
import { getLocalReflection } from '../reflectionStorage';
import {getJournalBackupInventory} from '../../services/journalBackupInventory';
import { getLocalPrayer } from '../prayerStorage';
import {
  queueBibleStudyCompletedImpact,
  queueBibleStudyCreatedImpact,
} from '../../services/journalImpactQueue';

jest.mock('../../services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../journalStorage', () => ({ checkSession: jest.fn() }));
jest.mock('../../services/journalImpactQueue', () => ({
  queueBibleStudyCreatedImpact: jest.fn().mockResolvedValue(undefined),
  queueBibleStudyCompletedImpact: jest.fn().mockResolvedValue(undefined),
  queueBibleStudyImpactRetraction: jest.fn().mockResolvedValue(undefined),
  queuePrayerCreatedImpact: jest.fn().mockResolvedValue(undefined),
  queuePrayerAnsweredImpact: jest.fn().mockResolvedValue(undefined),
  queuePrayerImpactRetraction: jest.fn().mockResolvedValue(undefined),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
let persisted: Map<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  persisted = new Map();
  storage.getItem.mockImplementation(async key => persisted.get(key) ?? null);
  storage.setItem.mockImplementation(async (key, value) => { persisted.set(key, value); });
  storage.getAllKeys.mockImplementation(async () => Array.from(persisted.keys()));
  storage.multiGet.mockImplementation(async keys => keys.map((key): [string, string | null] => [key, persisted.get(key) ?? null]));
  storage.removeItem.mockImplementation(async key => { persisted.delete(key); });
});

it('discovers the actual saved reflection after completing a study, while retaining the prayer', async () => {
  const session = await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  expect(await getSavedBibleStudyReflections()).toEqual([]);
  const content = createEmptyBibleStudyContent();
  content.observation.text = 'The Lord is my shepherd.';
  content.prayer.text = 'Help me trust you today.';
  const savedSession = await completeBibleStudySession(session, content);
  expect(queueBibleStudyCreatedImpact).toHaveBeenCalledTimes(1);
  expect(queueBibleStudyCompletedImpact).toHaveBeenCalledTimes(1);
  const savedReflections = await getSavedBibleStudyReflections();
  expect(savedReflections).toHaveLength(1);
  expect(savedReflections[0].id).toBe(savedSession.reflection_ref?.local_id);
  expect(savedReflections[0].metadata?.bibleStudySessionId).toBe(session.id);
  expect(parseSavedBibleStudy(savedReflections[0])?.observation.text).toBe(content.observation.text);
  expect(await getLocalReflection(savedReflections[0].id, 'scripture', '2026-09-15')).not.toBeNull();
  const prayer = await getLocalPrayer(savedSession.prayer_ref!.local_id, session.selected_date);
  expect(prayer?.content).toBe(content.prayer.text);

  // Canonical completed reflections remain discoverable without their flow state.
  await storage.removeItem(`bible_study_session:${session.id}`);
  expect(await getSavedBibleStudyReflections()).toHaveLength(1);
});

it('keeps two completed studies on the same date as distinct canonical records', async () => {
  const first = await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  const second = await createBibleStudySession({ reference: 'John 15' }, '2026-09-15');
  await completeBibleStudySession(first, createEmptyBibleStudyContent());
  await completeBibleStudySession(second, createEmptyBibleStudyContent());
  const saved = await getSavedBibleStudyReflections();
  expect(saved).toHaveLength(2);
  expect(new Set(saved.map(entry => entry.id)).size).toBe(2);
});

it('saving edited original notes updates the same study and prayer rather than creating duplicates', async () => {
  const session = await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  const original = createEmptyBibleStudyContent();
  original.prayer.text = 'Original prayer';
  const firstSave = await completeBibleStudySession(session, original);
  const edited = { ...original, observation: { ...original.observation, text: 'Edited notes' }, prayer: { ...original.prayer, text: 'Edited prayer' } };
  const secondSave = await completeBibleStudySession(firstSave, edited);
  expect(secondSave.id).toBe(firstSave.id);
  expect(secondSave.reflection_ref?.local_id).toBe(firstSave.reflection_ref?.local_id);
  expect(secondSave.prayer_ref?.local_id).toBe(firstSave.prayer_ref?.local_id);
  const saved = await getSavedBibleStudyReflections();
  expect(saved).toHaveLength(1);
  expect(parseSavedBibleStudy(saved[0])?.observation.text).toBe('Edited notes');
  expect((await getLocalPrayer(secondSave.prayer_ref!.local_id, session.selected_date))?.content).toBe('Edited prayer');
});

it('only offers Continue for an unsaved study, even after a stale draft save', async () => {
  const session = await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  expect((await getActiveBibleStudySession())?.id).toBe(session.id);
  const content = createEmptyBibleStudyContent();
  await completeBibleStudySession(session, content);
  const staleWrite = await saveBibleStudyContent(session, content);
  expect(staleWrite.completed).toBe(true);
  expect(await getActiveBibleStudySession()).toBeNull();
});

it('does not offer Continue for an older saved reflection with a stale incomplete flow flag', async () => {
  const session = await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  await completeBibleStudySession(session, createEmptyBibleStudyContent());
  await storage.setItem(`bible_study_session:${session.id}`, JSON.stringify(session));
  expect(await getActiveBibleStudySession()).toBeNull();
});

it('resumes only the latest selected unsaved study and never cycles through older drafts', async () => {
  await createBibleStudySession({ reference: 'Psalm 23' }, '2026-09-15');
  const latest = await createBibleStudySession({ reference: 'John 15' }, '2026-09-15');
  expect((await getActiveBibleStudySession())?.id).toBe(latest.id);
  await completeBibleStudySession(latest, createEmptyBibleStudyContent());
  expect(await getActiveBibleStudySession()).toBeNull();
});

it('backs up a completed study with its linked prayer, even when the inventory starts mid-save', async () => {
  const session = await createBibleStudySession({reference: 'Psalm 23'}, '2026-09-15');
  const content = createEmptyBibleStudyContent();
  content.prayer.text = 'Synthetic prayer';
  let release!: () => void;
  let signal!: () => void;
  const paused = new Promise<void>(resolve => {release = resolve;});
  const started = new Promise<void>(resolve => {signal = resolve;});
  storage.setItem.mockImplementation(async (key, value) => {
    persisted.set(key, value);
    if (key.startsWith('prayer_local:')) {
      signal();
      await paused;
    }
  });
  const completion = completeBibleStudySession(session, content);
  await started;
  storage.getAllKeys.mockClear();
  const snapshot = getJournalBackupInventory();
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(storage.getAllKeys).not.toHaveBeenCalled();
  } finally {
    release();
  }
  const saved = await completion;
  expect(await snapshot).toMatchObject({
    bibleStudySessions: [{completed: true, prayer_ref: saved.prayer_ref, reflection_ref: saved.reflection_ref}],
    reflectionRecords: [{id: saved.reflection_ref!.local_id, metadata: {bibleStudyCompleted: true}}],
    prayerRecords: [{id: saved.prayer_ref!.local_id, content: content.prayer.text}],
    integrity: {danglingReferences: []},
  });
  const repeat = await completeBibleStudySession(session, content);
  expect(repeat.prayer_ref).toEqual(saved.prayer_ref);
  expect((await getJournalBackupInventory()).prayerRecords).toHaveLength(1);
  expect(queueBibleStudyCompletedImpact).toHaveBeenCalledTimes(1);
  await deleteSavedBibleStudy(saved.reflection_ref!.local_id, saved.selected_date, saved.id);
  await expect(completeBibleStudySession(session, content)).rejects.toThrow('no longer available');
  expect(await getJournalBackupInventory()).toMatchObject({
    bibleStudySessions: [],
    reflectionRecords: [{deleted: true}],
    prayerRecords: [{id: saved.prayer_ref!.local_id, content: content.prayer.text}],
    integrity: {danglingReferences: []},
  });
});
