import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMorningMoments } from '../morningMomentsStorage';
import { getAllLocalReflectionsByType } from '../reflectionStorage';

jest.mock('../reflectionStorage', () => ({ getAllLocalReflectionsByType: jest.fn() }));
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

it('discovers individual local cards and keeps Psalm read status and reflection together', async () => {
  const record = (id: string, content_type: string, content: object, deleted = false) => JSON.stringify({ id, content_type, content: JSON.stringify(content), selected_date: '2026-09-15', updated_at: '2026-09-15T01:00:00Z', deleted });
  const rows: [string, string][] = [
    ['journal_local_singleton:morning_check_in:2026-09-15', record('check', 'morning_check_in', { feeling: 'Hopeful', underneathIt: 'A fresh start' })],
    ['journal_local_singleton:todays_focus:2026-09-15', record('focus', 'todays_focus', { focus: 'Family', personalText: 'Be present', priorities: [{ text: 'Call Mom' }] })],
    ['journal_local:todo:2026-09-15:task1', record('task1', 'todo', { text: 'Walk' })],
    ['journal_local:todo:2026-09-15:task2', record('task2', 'todo', { text: 'Read' })],
    ['journal_local:todo:2026-09-15:deleted', record('deleted', 'todo', { text: 'Hidden' }, true)],
  ];
  storage.getAllKeys.mockResolvedValue(rows.map(([key]) => key));
  storage.multiGet.mockResolvedValue(rows);
  (getAllLocalReflectionsByType as jest.Mock).mockResolvedValue([
    { id: 'psalm', title: 'Psalm 23', source: 'morning_psalm', selected_date: '2026-09-15', updated_at: '2026-09-15T02:00:00Z', content: 'God leads me', metadata: { psalmRead: true, selectedAttributes: ['Faithful'] } },
    { id: 'bible', source: 'bible_study' },
  ]);
  const moments = await getMorningMoments();
  expect(moments.map(moment => moment.pluginId)).toEqual(['morningpsalm', 'morningcheckin', 'focus', 'todos']);
  expect(moments[0].lines).toEqual(['Passage read', 'Faithful', 'God leads me']);
  expect(moments[0].markedRead).toBe(true);
  expect(moments[0].reflection).toBe('God leads me');
  expect(moments[0].observations).toEqual(['Faithful']);
  expect(moments[1].title).toBe('How are you feeling?');
  expect(moments[1].underneathIt).toBe('A fresh start');
  expect(moments[2].lines).toEqual(['Family', 'Be present', 'Call Mom']);
  expect(moments[3].lines).toEqual(['○ Walk', '○ Read']);
});
