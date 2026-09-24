import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createLocalPrayer,
  deleteLocalPrayer,
  updateLocalPrayer,
} from '../prayerStorage';
import {
  queuePrayerAnsweredImpact,
  queuePrayerCreatedImpact,
  queuePrayerImpactRetraction,
} from '../../services/journalImpactQueue';

jest.mock('../../services/journalImpactQueue', () => ({
  queuePrayerAnsweredImpact: jest.fn().mockResolvedValue(undefined),
  queuePrayerCreatedImpact: jest.fn().mockResolvedValue(undefined),
  queuePrayerImpactRetraction: jest.fn().mockResolvedValue(undefined),
}));

const values = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  values.clear();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    values.set(key, value);
  });
});

it('counts a newly saved prayer without requiring a user account', async () => {
  const prayer = await createLocalPrayer({
    prayer_type: 'journal',
    journal_category: 'personal_prayer',
    content: 'Private prayer content',
    selected_date: '2026-09-24',
    status: 'pending',
  });

  expect(queuePrayerCreatedImpact).toHaveBeenCalledWith(prayer);
  expect(queuePrayerAnsweredImpact).not.toHaveBeenCalled();
});

it('counts a prayer only when it first transitions to answered', async () => {
  const prayer = await createLocalPrayer({
    prayer_type: 'people',
    content: 'Private prayer content',
    selected_date: '2026-09-24',
    status: 'pending',
  });

  const answered = await updateLocalPrayer({
    ...prayer,
    status: 'answered',
    answered_date: '2026-09-24T08:00:00.000Z',
  });
  await updateLocalPrayer({...answered, notes: 'Edited later'});

  expect(queuePrayerAnsweredImpact).toHaveBeenCalledTimes(1);
  expect(queuePrayerAnsweredImpact).toHaveBeenCalledWith(answered);
});

it('retracts prayer counters when the canonical prayer is deleted', async () => {
  const prayer = await createLocalPrayer({
    prayer_type: 'journal',
    content: 'Private prayer content',
    selected_date: '2026-09-24',
    status: 'pending',
  });

  await deleteLocalPrayer(prayer.id, prayer.selected_date);

  expect(queuePrayerImpactRetraction).toHaveBeenCalledWith(prayer.id);
});
