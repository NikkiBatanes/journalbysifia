import {getMonthlyReviewStats} from '../../../services/monthlyReviewStatsService';
import {getReviewCapture} from '../../../services/reviewCaptureService';
import {seedMonthlyReviewData} from '../reviewQAMonthlyData';

const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockData.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockData.set(key, value);
  }),
  getAllKeys: jest.fn(async () => [...mockData.keys()]),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map(key => [key, mockData.get(key) ?? null]),
  ),
  multiRemove: jest.fn(async (keys: string[]) =>
    keys.forEach(key => mockData.delete(key)),
  ),
  removeItem: jest.fn(async (key: string) => {
    mockData.delete(key);
  }),
}));
jest.mock('../../../services/scriptureReaderService', () => ({
  getScripturePassage: jest.fn(async () => null),
}));

describe('Monthly Review QA data', () => {
  beforeEach(() => {
    mockData.clear();
    jest.clearAllMocks();
  });

  it('produces the intended August monthly card counts through production services', async () => {
    await seedMonthlyReviewData({keys: [], restores: []});

    await expect(
      getMonthlyReviewStats('2026-08-01', '2026-08-31', '2026-09-01'),
    ).resolves.toEqual({
      activeDays: 25,
      morning: 19,
      evening: 16,
      prayers: 53,
      journal: 49,
      answeredPrayers: 17,
      rememberedFromWeeks: 3,
      gospelShares: 1,
    });
  });

  it('feeds every rich weekly card family into the monthly capture', async () => {
    await seedMonthlyReviewData({keys: [], restores: []});

    const capture = await getReviewCapture(
      '2026-08-01',
      '2026-08-31',
      'monthly',
    );
    const presentations = [
      ...new Set(capture.items.map(item => item.presentation)),
    ];
    expect(presentations).toEqual(
      expect.arrayContaining([
        'morning_check_in',
        'morning_psalm',
        'focus',
        'todo',
        'gratitude_list',
        'evening_proverb',
        'today_win',
        'looking_forward',
        'prayer',
        'scripture_reflection',
        'heart_journal',
        'guided_reflection',
      ]),
    );
  });
});
