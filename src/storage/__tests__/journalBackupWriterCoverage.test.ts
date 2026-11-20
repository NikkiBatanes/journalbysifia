import AsyncStorage from '@react-native-async-storage/async-storage';
import {getJournalBackupInventory} from '../../services/journalBackupInventory';
import {supabase} from '../../services/supabaseClient';
import {gospelStorage} from '../gospelStorage';
import {getJournalKey, saveLocalEntry, syncFromCloud} from '../journalStorage';
import {saveLocalReflectionEntry, syncReflectionFromCloud} from '../reflectionStorage';
import {updateRoutineState} from '../routineStateStorage';

jest.mock('../../services/supabaseClient', () => ({
  supabase: {from: jest.fn(), auth: {setSession: jest.fn(), getSession: jest.fn()}},
}));
jest.mock('../../services/journalImpactAnalyticsService', () => ({}));
jest.mock('../../services/journalImpactQueue', () => ({}));
jest.mock('../../utils/ProductionLogger', () => ({Logger: {error: jest.fn(), warn: jest.fn()}}));

const storage = jest.mocked(AsyncStorage);
const values = new Map<string, string>();
const user = '00000000-0000-4000-8000-000000000001';
const date = '2026-11-20';
const journalKey = getJournalKey(user, 'gratitude', date);
const reflectionKey = `reflection_log_${date}_${user}`;
const entry = {content_type: 'gratitude', content: 'Saved locally', user_id: user, selected_date: date};

function gate() {
  let open!: () => void;
  const wait = new Promise<void>(resolve => {open = resolve;});
  return {open, wait};
}

beforeEach(() => {
  values.clear();
  jest.clearAllMocks();
  storage.getItem.mockImplementation(async key => values.get(key) ?? null);
  storage.setItem.mockImplementation(async (key, value) => {values.set(key, value);});
  storage.removeItem.mockImplementation(async key => {values.delete(key);});
  storage.getAllKeys.mockImplementation(async () => Array.from(values.keys()));
  storage.multiGet.mockImplementation(async keys => keys.map((key): [string, string | null] => [key, values.get(key) ?? null]));
});

it.each([false, true])('queues routine, Gospel and legacy saves through a paused inventory (read fails: %s)', async fail => {
  const started = gate();
  const resume = gate();
  storage.getAllKeys.mockImplementationOnce(async () => {
    started.open();
    await resume.wait;
    if (fail) {throw new Error('Synthetic read failure');}
    return Array.from(values.keys());
  });
  const snapshot = getJournalBackupInventory();
  await started.wait;
  const edits = Promise.all([
    gospelStorage.addPerson('One'),
    gospelStorage.addPerson('Two'),
    ...['read', 'pray'].map(step => updateRoutineState('morning', date, current => ({
      completed_steps: [...(current?.completed_steps ?? []), step],
    }))),
    saveLocalEntry(journalKey, entry, user),
    saveLocalReflectionEntry(reflectionKey, [], user),
  ]);
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(storage.setItem).not.toHaveBeenCalled();
  } finally {
    resume.open();
  }
  if (fail) {
    await expect(snapshot).rejects.toThrow('Synthetic read failure');
  } else {
    expect(await snapshot).toMatchObject({
      gospelAuthoredContent: [], routineStates: [], legacyAuthoredContent: {journalRecords: [], reflectionLogs: []},
    });
  }
  await edits;
  expect(await getJournalBackupInventory()).toMatchObject({
    gospelAuthoredContent: [{value: [{displayName: 'Two'}, {displayName: 'One'}]}],
    routineStates: [{completed_steps: ['read', 'pray']}],
    legacyAuthoredContent: {
      journalRecords: [{key: journalKey, value: {content: entry.content}}],
      reflectionLogs: [{key: reflectionKey, value: {content: {entries: []}}}],
    },
  });
});

it.each(['journal', 'reflection'])('keeps a newer local %s save when an older cloud request returns', async kind => {
  const started = gate();
  const resume = gate();
  const result = async () => {
    started.open();
    await resume.wait;
    return {data: kind === 'journal' ? [{...entry, id: 'remote', content: 'Before local edit'}] : null, error: null};
  };
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: kind === 'journal' ? result : jest.fn().mockReturnThis(), maybeSingle: result,
  };
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  values.set('ACCESS_TOKEN', 'fixture');
  values.set('REFRESH_TOKEN', 'fixture');
  jest.mocked(supabase.auth.setSession).mockResolvedValue({data: {user: null, session: null}, error: null});
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {session: {user: {id: user}, expires_at: Date.now() / 1000 + 1000}}, error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  const sync = kind === 'journal' ? syncFromCloud(user, date, 'gratitude') : syncReflectionFromCloud(user, date);
  await started.wait;
  const key = kind === 'journal' ? journalKey : reflectionKey;
  try {
    if (kind === 'journal') {await saveLocalEntry(key, entry, user);}
    else {await saveLocalReflectionEntry(key, [], user);}
  } finally {
    resume.open();
  }
  const saved = values.get(key);
  await sync;
  expect(saved).toBeTruthy();
  expect(values.get(key)).toBe(saved);
});

it('preserves a legacy reflection if its remote read fails', async () => {
  await saveLocalReflectionEntry(reflectionKey, [], user);
  const saved = values.get(reflectionKey);
  jest.mocked(supabase.from).mockImplementationOnce(() => {throw new Error('synthetic connection failure');});
  await expect(syncReflectionFromCloud(user, date)).rejects.toThrow('synthetic connection failure');
  expect(values.get(reflectionKey)).toBe(saved);
});
