import {DeviceEventEmitter} from 'react-native';

import {PrayerApi, type PrayerApiEntry} from '../api/prayerApi';
import {saveWeeklyReviewPrayer} from '../weeklyReviewPrayerService';

jest.mock('../api/prayerApi', () => ({
  PrayerApi: {
    getAllPrayers: jest.fn(),
    createPrayer: jest.fn(),
    updatePrayer: jest.fn(),
    deletePrayer: jest.fn(),
  },
}));

const input = {
  text: '  I am still bringing my family to God.  ',
  periodStart: '2026-09-14',
  periodEnd: '2026-09-21',
  reviewId: 'review-1',
};

const entry = (overrides: Partial<PrayerApiEntry> = {}): PrayerApiEntry => ({
  id: 'prayer-1',
  prayer_type: 'journal',
  journal_category: 'personal_prayer',
  content: 'I am still bringing my family to God.',
  selected_date: '2026-09-21',
  created_at: '2026-09-21T20:00:00.000Z',
  updated_at: '2026-09-21T20:00:00.000Z',
  status: 'pending',
  metadata: {
    prayer_style: 'open',
    source: 'weekly_review',
    reviewId: 'review-1',
    weeklyReviewId: 'review-1',
    periodStart: '2026-09-14',
    periodEnd: '2026-09-21',
    tags: ['weekly'],
  },
  ...overrides,
});

const getAllPrayers = PrayerApi.getAllPrayers as jest.MockedFunction<typeof PrayerApi.getAllPrayers>;
const createPrayer = PrayerApi.createPrayer as jest.MockedFunction<typeof PrayerApi.createPrayer>;
const updatePrayer = PrayerApi.updatePrayer as jest.MockedFunction<typeof PrayerApi.updatePrayer>;
const deletePrayer = PrayerApi.deletePrayer as jest.MockedFunction<typeof PrayerApi.deletePrayer>;

describe('Weekly Review prayer persistence', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(DeviceEventEmitter, 'emit').mockImplementation(() => true);
    getAllPrayers.mockResolvedValue([]);
    createPrayer.mockResolvedValue(entry());
    updatePrayer.mockImplementation(async (_id, updates) => entry(updates as Partial<PrayerApiEntry>));
    deletePrayer.mockResolvedValue();
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  it('creates an active Open Prayer tagged to its review week', async () => {
    await saveWeeklyReviewPrayer(input);

    expect(createPrayer).toHaveBeenCalledWith(expect.objectContaining({
      selected_date: '2026-09-21',
      prayer_type: 'journal',
      journal_category: 'personal_prayer',
      content: 'I am still bringing my family to God.',
      status: 'pending',
      metadata: expect.objectContaining({
        prayer_style: 'open',
        source: 'weekly_review',
        reviewId: 'review-1',
        weeklyReviewId: 'review-1',
        periodStart: '2026-09-14',
        periodEnd: '2026-09-21',
        tags: ['weekly'],
        track_answered: true,
        is_active: true,
      }),
    }));
    expect(emitSpy).toHaveBeenCalledWith('prayerSaved');
  });

  it('updates the canonical prayer instead of creating a duplicate', async () => {
    const existing = entry({content: 'An earlier prayer'});
    getAllPrayers.mockResolvedValue([existing]);

    await saveWeeklyReviewPrayer(input);

    expect(updatePrayer).toHaveBeenCalledWith('prayer-1', expect.objectContaining({
      content: 'I am still bringing my family to God.',
      metadata: expect.objectContaining({tags: ['weekly']}),
    }));
    expect(createPrayer).not.toHaveBeenCalled();
  });

  it('removes the linked Open Prayer when the weekly answer is cleared', async () => {
    getAllPrayers.mockResolvedValue([entry()]);

    await saveWeeklyReviewPrayer({...input, text: '   '});

    expect(deletePrayer).toHaveBeenCalledWith('prayer-1');
    expect(createPrayer).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('prayerSaved');
  });
});
