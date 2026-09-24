import {DeviceEventEmitter} from 'react-native';

import {PrayerApi, type PrayerApiEntry} from '../api/prayerApi';
import {recordGospelAcceptanceAsAnsweredPrayer} from '../gospelAcceptancePrayerService';

jest.mock('../api/prayerApi', () => ({
  PrayerApi: {
    getAllPrayers: jest.fn(),
    createPrayer: jest.fn(),
    updatePrayer: jest.fn(),
  },
}));

const input = {
  gospelPersonId: 'person-1',
  personName: 'Anna',
  prayerStartedAt: '2026-09-20T08:00:00.000Z',
  acceptedAt: '2026-09-24T10:30:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(DeviceEventEmitter, 'emit').mockImplementation(() => true);
});

afterEach(() => jest.restoreAllMocks());

it('creates one canonical answered prayer from a Gospel Track acceptance', async () => {
  jest.mocked(PrayerApi.getAllPrayers).mockResolvedValue([]);
  jest.mocked(PrayerApi.createPrayer).mockImplementation(async prayer => ({
    ...prayer,
    id: 'prayer-1',
    created_at: input.acceptedAt,
    updated_at: input.acceptedAt,
  } as PrayerApiEntry));

  await recordGospelAcceptanceAsAnsweredPrayer(input);

  expect(PrayerApi.createPrayer).toHaveBeenCalledWith(expect.objectContaining({
    prayer_type: 'people',
    person_name: 'Anna',
    content: 'That Anna would know Jesus as Lord and Savior.',
    selected_date: '2026-09-20',
    status: 'answered',
    answered_date: input.acceptedAt,
    metadata: expect.objectContaining({
      source: 'gospel_track',
      gospel_person_id: 'person-1',
      track_answered: true,
      is_active: false,
      tracking_status: 'answered',
      answer_history: [{
        id: 'gospel-acceptance-person-1',
        date: input.acceptedAt,
        note: 'Accepted Jesus as Lord and Savior.',
      }],
    }),
  }));
  expect(DeviceEventEmitter.emit).toHaveBeenCalledWith('prayerSaved');
});

it('updates the same Gospel Track prayer without duplicating its answer history', async () => {
  const existing = {
    id: 'prayer-1',
    prayer_type: 'people' as const,
    content: 'That Anna would know Jesus.',
    person_name: 'Anna',
    selected_date: '2026-09-20',
    created_at: '2026-09-20T08:00:00.000Z',
    updated_at: input.acceptedAt,
    status: 'answered' as const,
    answered_date: input.acceptedAt,
    metadata: {
      source: 'gospel_track',
      gospel_person_id: 'person-1',
      answer_history: [{
        id: 'gospel-acceptance-person-1',
        date: input.acceptedAt,
        note: 'Accepted Jesus as Lord and Savior.',
      }],
    },
  };
  jest.mocked(PrayerApi.getAllPrayers).mockResolvedValue([existing]);
  jest.mocked(PrayerApi.updatePrayer).mockResolvedValue(existing);

  await recordGospelAcceptanceAsAnsweredPrayer(input);

  expect(PrayerApi.createPrayer).not.toHaveBeenCalled();
  expect(PrayerApi.updatePrayer).toHaveBeenCalledWith('prayer-1', expect.objectContaining({
    status: 'answered',
    metadata: expect.objectContaining({
      answer_history: [existing.metadata.answer_history[0]],
    }),
  }));
});
