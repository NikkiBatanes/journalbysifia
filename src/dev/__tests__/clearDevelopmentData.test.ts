import AsyncStorage from '@react-native-async-storage/async-storage';
import {clearJournalDevelopmentDataOnce} from '../clearDevelopmentData';

const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(async () => mockData.clear()),
  getItem: jest.fn(async (key: string) => mockData.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {mockData.set(key, value);}),
  getAllKeys: jest.fn(async () => [...mockData.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockData.get(key) ?? null])),
  multiSet: jest.fn(async (entries: Array<[string, string]>) => {
    entries.forEach(([key, value]) => mockData.set(key, value));
  }),
  multiRemove: jest.fn(async (keys: string[]) => keys.forEach(key => mockData.delete(key))),
}));

describe('development data reset', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('removes every local content domain, including prayers, and preserves app state', async () => {
    const contentKeys = [
      'journal_local:gratitude:2026-09-20:journal-1',
      'journal_local_index:gratitude:2026-09-20',
      'journal_local_singleton:todays_focus:2026-09-20',
      'reflection_local:free:2026-09-20:reflection-1',
      'reflection_local_index:free:2026-09-20',
      'prayer_local:2026-09-20:prayer-1',
      'prayer_local_index:2026-09-20',
      'prayer_draft:new',
      'prayer-intelligence:local',
      'routine_state:morning:2026-09-20',
      'review_local:weekly:review-1',
      'review_local_index:weekly',
      'dev-prayer-v2:reference-date',
      'dev-review-v2:manifest',
      'journal_preview_data:v1',
      'journal_preview_data:weekly-review:v4:2026-09-14',
    ];
    await AsyncStorage.multiSet(contentKeys.map(key => [key, '{}']));
    await AsyncStorage.setItem('journal:local-preferences', '{"weekStart":"monday"}');

    await expect(clearJournalDevelopmentDataOnce()).resolves.toBe(contentKeys.length);
    await expect(AsyncStorage.multiGet(contentKeys)).resolves.toEqual(
      contentKeys.map(key => [key, null]),
    );
    await expect(AsyncStorage.getItem('journal:local-preferences'))
      .resolves.toBe('{"weekStart":"monday"}');
  });

  it('runs once so newly created content survives later launches', async () => {
    await clearJournalDevelopmentDataOnce();
    await AsyncStorage.setItem('prayer_local:2026-09-21:new-prayer', '{"id":"new-prayer"}');

    await expect(clearJournalDevelopmentDataOnce()).resolves.toBe(0);
    await expect(AsyncStorage.getItem('prayer_local:2026-09-21:new-prayer'))
      .resolves.toBe('{"id":"new-prayer"}');
  });
});
