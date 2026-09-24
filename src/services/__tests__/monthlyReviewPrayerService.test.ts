import {DeviceEventEmitter} from 'react-native';

import {PrayerApi, type PrayerApiEntry} from '../api/prayerApi';
import {saveMonthlyReviewPrayer} from '../monthlyReviewPrayerService';

jest.mock('../api/prayerApi', () => ({
  PrayerApi: {
    getAllPrayers: jest.fn(),
    createPrayer: jest.fn(),
    updatePrayer: jest.fn(),
    deletePrayer: jest.fn(),
  },
}));

const input = {
  text: '  Give me wisdom for the month ahead.  ',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  reviewId: 'monthly-review-1',
};

const entry = (overrides: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id: 'prayer-1',
  prayer_type: 'journal',
  journal_category: 'personal_prayer',
  content: 'Give me wisdom for the month ahead.',
  selected_date: '2026-09-01',
  created_at: '2026-08-31T20:00:00.000Z',
  updated_at: '2026-08-31T20:00:00.000Z',
  status: 'pending',
  metadata: {
    prayer_style: 'open',
    source: 'monthly_review',
    reviewId: 'monthly-review-1',
    monthlyReviewId: 'monthly-review-1',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    tags: ['monthly'],
  },
  ...overrides,
});

const getAllPrayers = PrayerApi.getAllPrayers as jest.MockedFunction<
  typeof PrayerApi.getAllPrayers
>;
const createPrayer = PrayerApi.createPrayer as jest.MockedFunction<
  typeof PrayerApi.createPrayer
>;
const updatePrayer = PrayerApi.updatePrayer as jest.MockedFunction<
  typeof PrayerApi.updatePrayer
>;

describe('Monthly Review prayer persistence', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest
      .spyOn(DeviceEventEmitter, 'emit')
      .mockImplementation(() => true);
    getAllPrayers.mockResolvedValue([]);
    createPrayer.mockResolvedValue(entry());
    updatePrayer.mockImplementation(async (_id, updates) =>
      entry(updates as Partial<PrayerApiEntry>),
    );
  });

  afterEach(() => emitSpy.mockRestore());

  it('creates one active Open Prayer linked to the monthly review', async () => {
    await saveMonthlyReviewPrayer(input);

    expect(createPrayer).toHaveBeenCalledWith(
      expect.objectContaining({
        selected_date: '2026-09-01',
        content: 'Give me wisdom for the month ahead.',
        status: 'pending',
        metadata: expect.objectContaining({
          source: 'monthly_review',
          monthlyReviewId: 'monthly-review-1',
          tags: ['monthly'],
          track_answered: true,
          is_active: true,
        }),
      }),
    );
  });

  it('updates the linked prayer instead of creating a duplicate', async () => {
    getAllPrayers.mockResolvedValue([entry({content: 'Earlier words'})]);

    await saveMonthlyReviewPrayer(input);

    expect(updatePrayer).toHaveBeenCalledWith(
      'prayer-1',
      expect.objectContaining({
        content: 'Give me wisdom for the month ahead.',
      }),
    );
    expect(createPrayer).not.toHaveBeenCalled();
  });
});
