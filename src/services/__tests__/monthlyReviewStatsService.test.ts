import {gospelStorage} from '../../storage/gospelStorage';
import {getCarryForwardReferences} from '../reviewMemoryService';
import {getWeeklyRhythm} from '../weeklyRhythmService';
import {getMonthlyReviewStats} from '../monthlyReviewStatsService';

jest.mock('../weeklyRhythmService', () => ({getWeeklyRhythm: jest.fn()}));
jest.mock('../reviewMemoryService', () => ({getCarryForwardReferences: jest.fn()}));
jest.mock('../../storage/gospelStorage', () => ({gospelStorage: {getShareEvents: jest.fn()}}));

it('combines monthly activity, weekly memories, answered prayers, and confirmed Gospel shares', async () => {
  jest.mocked(getWeeklyRhythm).mockResolvedValue({
    activeDays: 18,
    morning: 12,
    evening: 9,
    prayers: 14,
    journal: 11,
    answeredPrayers: 2,
    days: [],
  });
  jest.mocked(getCarryForwardReferences).mockResolvedValue([
    {id: 'one', kind: 'journal', selectedDate: '2026-08-04', reviewId: 'week-1', reviewType: 'weekly', reviewStatus: 'completed'},
    {id: 'two', kind: 'prayer', selectedDate: '2026-08-18', reviewId: 'week-2', reviewType: 'weekly', reviewStatus: 'completed'},
  ]);
  jest.mocked(gospelStorage.getShareEvents).mockResolvedValue([
    {id: 'before', sharedAt: '2026-07-31T08:00:00.000Z', method: 'link'},
    {id: 'inside', sharedAt: '2026-08-12T08:00:00.000Z', method: 'in_person'},
    {id: 'future', sharedAt: '2026-08-29T08:00:00.000Z', method: 'phone'},
  ]);

  await expect(getMonthlyReviewStats('2026-08-01', '2026-08-31', '2026-08-20')).resolves.toEqual({
    activeDays: 18,
    morning: 12,
    evening: 9,
    prayers: 14,
    journal: 11,
    answeredPrayers: 2,
    rememberedFromWeeks: 2,
    gospelShares: 1,
  });
  expect(getWeeklyRhythm).toHaveBeenCalledWith('2026-08-01', '2026-08-31', '2026-08-20');
  expect(getCarryForwardReferences).toHaveBeenCalledWith('monthly', '2026-08-01', '2026-08-31');
});
