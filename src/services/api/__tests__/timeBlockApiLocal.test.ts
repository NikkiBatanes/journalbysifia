const mockValues = new Map<string, string>();
const mockSupabaseFrom = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockValues.get(key) ?? null])),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
}));

jest.mock('../../supabaseClient', () => ({
  supabase: { from: mockSupabaseFrom },
}));

import { TimeBlockApi } from '../timeBlockApi';
import { LOCAL_TIME_BLOCK_USER_ID } from '../../../storage/localTimeBlockStorage';

beforeEach(() => {
  mockValues.clear();
  mockSupabaseFrom.mockClear();
});

it('keeps the complete Journal Time Block lifecycle off Supabase', async () => {
  const created = await TimeBlockApi.createTimeBlock({
    user_id: LOCAL_TIME_BLOCK_USER_ID,
    selected_date: '2026-09-24',
    start_time: '2026-09-24T09:00:00.000Z',
    end_time: '2026-09-24T10:00:00.000Z',
    all_day: false,
    title: 'Local plan',
    category: 'Personal',
    repeat_rule: { frequency: 'daily' },
  });

  expect(await TimeBlockApi.getTimeBlocks(LOCAL_TIME_BLOCK_USER_ID, '2026-09-24'))
    .toEqual([created]);
  expect(await TimeBlockApi.getTimeBlocks(LOCAL_TIME_BLOCK_USER_ID, '2026-09-25'))
    .toEqual([expect.objectContaining({ id: created.id, selected_date: '2026-09-25' })]);

  const updated = await TimeBlockApi.updateTimeBlock(created.id, { title: 'Updated locally' });
  expect(updated.title).toBe('Updated locally');

  await TimeBlockApi.deleteTimeBlock(created.id);
  expect(await TimeBlockApi.getTimeBlocks(LOCAL_TIME_BLOCK_USER_ID, '2026-09-24')).toEqual([]);
  expect(mockSupabaseFrom).not.toHaveBeenCalled();
});
