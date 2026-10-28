import AsyncStorage from '@react-native-async-storage/async-storage';
import {getOrCreateScriptureSequenceAnchor, SCRIPTURE_SEQUENCE_START_KEY} from '../scriptureSequenceAnchor';
import {getDailyPsalmNumber, getDailyProverbNumber, resolveSavedPsalmNumber, resolveSavedProverbNumber} from '../dailyScriptureSequence';
import {markJournalOnboardingComplete} from '../journalOnboardingState';

const storage = new Map<string, string>();

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-24T12:00:00Z'));
  storage.clear();
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => storage.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {storage.set(key, value);});
  (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [...storage.keys()]);
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(async keys => keys.map((key: string) => [key, storage.get(key) ?? null]));
});

afterEach(() => jest.useRealTimers());

it('advances a signed-out user across days and keeps the start after reopening', async () => {
  await markJournalOnboardingComplete();
  expect(storage.get(SCRIPTURE_SEQUENCE_START_KEY)).toBe('2026-09-24');
  jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  const start = await getOrCreateScriptureSequenceAnchor();
  expect(start).toBe('2026-09-24');
  expect(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'].map(date => [
    getDailyPsalmNumber(date, start), getDailyProverbNumber(date, start),
  ])).toEqual([[150, 31], [1, 1], [2, 2], [3, 3]]);
});

it('recovers an existing installation from creation times instead of backdated calendar dates', async () => {
  storage.set('journal_local_singleton:morning_check_in:2026-08-01', JSON.stringify({
    id: 'real', selected_date: '2026-08-01', created_at: '2026-09-20T12:00:00Z',
  }));
  storage.set('routine_state:morning:2026-07-01', JSON.stringify({
    id: 'routine', selected_date: '2026-07-01', started_at: '2026-09-19T12:00:00Z',
  }));
  storage.set('reflection_local:scripture:dev-review-v2:seed', JSON.stringify({created_at: '2026-01-01'}));
  storage.set('journal_local:bad', '{broken');
  expect(await getOrCreateScriptureSequenceAnchor()).toBe('2026-09-19');
});

it('honors account signup and retains it after signing out', async () => {
  expect(await getOrCreateScriptureSequenceAnchor('2026-09-10')).toBe('2026-09-10');
  expect(await getOrCreateScriptureSequenceAnchor()).toBe('2026-09-10');
});

it('does not replace a local start when an account with another signup date is used', async () => {
  storage.set(SCRIPTURE_SEQUENCE_START_KEY, '2026-09-12');
  expect(await getOrCreateScriptureSequenceAnchor('2026-09-10')).toBe('2026-09-10');
  expect(await getOrCreateScriptureSequenceAnchor()).toBe('2026-09-12');
});

it('shares one persisted start across simultaneous morning and evening readers', async () => {
  expect(await Promise.all([getOrCreateScriptureSequenceAnchor(), getOrCreateScriptureSequenceAnchor()]))
    .toEqual(['2026-09-24', '2026-09-24']);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
});

it('replaces invalid dates and ignores inactive QA overrides', async () => {
  storage.set(SCRIPTURE_SEQUENCE_START_KEY, '2026-02-31');
  storage.set('dev-review-v2:scripture-sequence-anchor', '2026-01-01');
  expect(await getOrCreateScriptureSequenceAnchor('invalid')).toBe('2026-09-24');
});

it('propagates persistence failure and allows a later retry', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(getOrCreateScriptureSequenceAnchor()).rejects.toThrow('disk unavailable');
  expect(await getOrCreateScriptureSequenceAnchor()).toBe('2026-09-24');
});

it('recalculates only empty unread legacy chapter-1 drafts', () => {
  expect(resolveSavedPsalmNumber({title: 'Psalm 1', content: '', metadata: {psalmNumber: 1}}, 3)).toBe(3);
  expect(resolveSavedProverbNumber({title: 'Proverbs 1', content: '', metadata: {proverbNumber: 1}}, 3)).toBe(3);
  for (const metadata of [{psalmRead: true}, {customAttribute: 'My response'}, {scriptureSequenceVersion: 2}]) {
    expect(resolveSavedPsalmNumber({title: 'Psalm 1', metadata}, 3)).toBe(1);
  }
  for (const metadata of [{proverbRead: true}, {wisdomApplications: {'1-1': 'My response'}}, {scriptureSequenceVersion: 2}]) {
    expect(resolveSavedProverbNumber({title: 'Proverbs 1', metadata}, 3)).toBe(1);
  }
  expect(resolveSavedPsalmNumber({title: 'Psalm 1', content: 'My reflection'}, 3)).toBe(1);
  expect(resolveSavedProverbNumber({title: 'Proverbs 1', content: 'My reflection'}, 3)).toBe(1);
});
