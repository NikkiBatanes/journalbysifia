import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalReviewsByType, getOrCreateLocalReviewForPeriod, updateLocalReview, type LocalReviewEntry } from '../reviewStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(), setItem: jest.fn()}));

it('serializes writes so a newer autosave remains authoritative', async () => {
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const firstStarted = new Promise<void>(resolve => { markFirstStarted = resolve; });
  const writes: string[] = [];
  (AsyncStorage.setItem as jest.Mock)
    .mockImplementationOnce(async (_key, value) => { markFirstStarted(); await firstBlocked; writes.push(value); })
    .mockImplementationOnce(async (_key, value) => { writes.push(value); });
  const base: LocalReviewEntry = {
    id: 'review', type: 'weekly', periodStart: '2026-09-14', periodEnd: '2026-09-20',
    status: 'draft', memorableItems: [], answers: {}, createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
  };
  const writeA = updateLocalReview({...base, answers: {notice: 'A'}});
  const writeB = updateLocalReview({...base, answers: {notice: 'B'}});
  await firstStarted;
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  releaseFirst();
  await Promise.all([writeA, writeB]);
  expect(JSON.parse(writes[1]).answers.notice).toBe('B');
});

it('returns one weekly review per period and keeps both weeks in the index during overlapping saves', async () => {
  const rows = new Map<string, string>();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => rows.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {rows.set(key, value);});
  const first = {type: 'weekly' as const, periodStart: '2026-11-09', periodEnd: '2026-11-15'};
  const second = {...first, periodStart: '2026-11-16', periodEnd: '2026-11-22'};
  const [a, repeated, b] = await Promise.all([first, first, second].map(getOrCreateLocalReviewForPeriod));
  expect(repeated.id).toBe(a.id);
  expect((await getLocalReviewsByType('weekly')).map(review => review.id).sort()).toEqual([a.id, b.id].sort());
});
