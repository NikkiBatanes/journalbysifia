const mockValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, mockValues.get(key) ?? null])),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
}));

import {
  LOCAL_TIME_BLOCK_USER_ID,
  createLocalTimeBlock,
  deleteLocalTimeBlock,
  getAllLocalTimeBlocks,
  updateLocalTimeBlock,
} from '../localTimeBlockStorage';

const input = {
  user_id: LOCAL_TIME_BLOCK_USER_ID,
  selected_date: '2026-09-24',
  start_time: '2026-09-24T09:00:00.000Z',
  end_time: '2026-09-24T10:00:00.000Z',
  all_day: false,
  title: 'Write',
  category: 'Personal',
  description: 'Journal locally',
};

beforeEach(() => {
  mockValues.clear();
  jest.clearAllMocks();
});

it('creates, reads, moves, updates, and tombstones a Time Block locally', async () => {
  const created = await createLocalTimeBlock(input);

  expect(created.user_id).toBe(LOCAL_TIME_BLOCK_USER_ID);
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  expect([...mockValues.keys()][0]).toMatch(/^journal_local:time_block:2026-09-24:/);
  expect(await getAllLocalTimeBlocks()).toEqual([created]);

  const updated = await updateLocalTimeBlock(created.id, {
    title: 'Plan tomorrow',
    selected_date: '2026-09-25',
  });

  expect(updated).toMatchObject({
    id: created.id,
    title: 'Plan tomorrow',
    selected_date: '2026-09-25',
    user_id: LOCAL_TIME_BLOCK_USER_ID,
  });
  expect(await getAllLocalTimeBlocks()).toEqual([updated]);

  expect(await deleteLocalTimeBlock(created.id)).toBe(true);
  expect(await getAllLocalTimeBlocks()).toEqual([]);
  const storedRecord = JSON.parse([...mockValues.values()][0]);
  expect(storedRecord).toMatchObject({ deleted: true, sync_status: 'pending' });
});
