import {getMonthlyReviewStats} from '../../../services/monthlyReviewStatsService';
import {getReviewCapture} from '../../../services/reviewCaptureService';
import {getLocalReviewsByType} from '../../../storage/reviewStorage';
import {
  getMonthlyCheckInFeelings,
  getMonthlyLookingForwardFeelings,
  getMonthlyWeeklyReviewFeelings,
} from '../../../services/weeklyFeelingService';
import {
  MONTHLY_QA_TESTIMONY,
  seedMonthlyReviewData,
} from '../reviewQAMonthlyData';

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
jest.mock('../../../services/journalImpactAnalyticsService', () => ({
  queueGospelImpactForShare: jest.fn(),
  queueGospelImpactRetraction: jest.fn(),
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
      activeDays: 31,
      morning: 31,
      evening: 31,
      prayers: 53,
      journal: 50,
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
        'testimony',
      ]),
    );
    expect(
      capture.items.find(item => item.presentation === 'testimony'),
    ).toMatchObject({
      id: MONTHLY_QA_TESTIMONY.id,
      title: 'My testimony',
      subtitle: 'My New Life Day',
      text: MONTHLY_QA_TESTIMONY.content,
      selectedDate: MONTHLY_QA_TESTIMONY.selectedDate,
      detail: expect.stringContaining('Written'),
    });
    expect(capture.monthlyPrayerReflection?.answered.length).toBeGreaterThan(0);
    expect(capture.monthlyPrayerReflection?.waiting.length).toBeGreaterThan(3);
    expect(
      capture.monthlyPrayerReflection?.waiting.some(item =>
        item.prayerId.endsWith(':request-unprayed'),
      ),
    ).toBe(false);
  });

  it('includes Weekly Review feeling answers in the monthly patterns data', async () => {
    await seedMonthlyReviewData({keys: [], restores: []});

    const weeklyReviews = await getLocalReviewsByType('weekly');
    expect(weeklyReviews).toHaveLength(5);
    expect(
      weeklyReviews.every(
        review =>
          review.answers.week_feelings &&
          Object.keys(review.answers).filter(key =>
            key.startsWith('week_check_in_'),
          ).length === 8,
      ),
    ).toBe(true);

    await expect(
      getMonthlyWeeklyReviewFeelings('2026-08-01', '2026-08-31'),
    ).resolves.toMatchObject({
      reviewCount: 5,
      feelings: [
        {name: 'Hopeful', count: 4},
        {name: 'Peaceful', count: 3},
        {name: 'Tired', count: 2},
        {name: 'Overwhelmed', count: 2},
        {name: 'Grateful', count: 2},
        {name: 'Growing', count: 1},
        {name: 'Faithful', count: 1},
      ],
    });
  });

  it('provides Morning and Looking Forward feeling data for all 31 days', async () => {
    await seedMonthlyReviewData({keys: [], restores: []});

    const [morning, lookingForward] = await Promise.all([
      getMonthlyCheckInFeelings('2026-08-01', '2026-08-31'),
      getMonthlyLookingForwardFeelings('2026-08-01', '2026-08-31'),
    ]);

    expect(morning.reduce((total, feeling) => total + feeling.count, 0)).toBe(
      31,
    );
    expect(
      lookingForward.reduce((total, feeling) => total + feeling.count, 0),
    ).toBe(31);
    expect(morning.flatMap(feeling => feeling.dates)).toEqual(
      expect.arrayContaining(['2026-08-01', '2026-08-31']),
    );
    expect(lookingForward.flatMap(feeling => feeling.dates)).toEqual(
      expect.arrayContaining(['2026-08-01', '2026-08-31']),
    );
  });
});
