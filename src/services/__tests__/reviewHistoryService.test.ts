import AsyncStorage from '@react-native-async-storage/async-storage';
import { getValidJournalHistoryStart } from '../reviewHistoryService';

jest.mock('@react-native-async-storage/async-storage', () => ({getAllKeys: jest.fn(), multiGet: jest.fn()}));

it('derives earliest canonical activity and excludes Review/index/Prayer DEV records', async () => {
  (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
    'review_local:weekly:r', 'journal_local_index:gratitude:2025-01-01',
    'prayer_local:2024-01-01:dev-prayer-v2:old', 'reflection_local:sermon:2026-03-04:real',
    'reflection_local:free:2023-01-01:dev-review-v2:old',
    'routine_state:morning:2026-02-03', 'bible_study_session:real-study',
  ]);
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) => keys.map(key => [key,
    key.includes('dev-prayer') ? JSON.stringify({id: 'dev-prayer-v2:old', selected_date: '2024-01-01'})
      : key.includes('dev-review') ? JSON.stringify({id: 'dev-review-v2:old', selected_date: '2023-01-01'})
      : key.includes('routine_state') ? JSON.stringify({id: 'routine', selected_date: '2026-02-03'})
      : key.includes('bible_study') ? JSON.stringify({id: 'study', selected_date: '2026-01-02'})
      : JSON.stringify({id: 'reflection', selected_date: '2026-03-04'}),
  ]));
  expect(await getValidJournalHistoryStart()).toBe('2026-01-02');
});
