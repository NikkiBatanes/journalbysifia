import AsyncStorage from '@react-native-async-storage/async-storage';
import { gospelStorage } from '../gospelStorage';
import {queueGospelImpactForShare, queueGospelImpactRetraction} from '../../services/journalImpactAnalyticsService';

jest.mock('../../services/journalImpactAnalyticsService', () => ({
  queueGospelImpactForShare: jest.fn().mockResolvedValue(undefined),
  queueGospelImpactRetraction: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('records when prayer for a person began', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]');
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);

  const person = await gospelStorage.addPerson('Mara', 'That she will know Christ.');

  expect(person.prayerStartedAt).toBe(person.createdAt);
  expect(person.prayerStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const stored = JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]);
  expect(stored[0]).toMatchObject({
    displayName: 'Mara',
    note: 'That she will know Christ.',
    prayerStartedAt: person.createdAt,
  });
});

it('uses the original created date as prayer history for existing people', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([{
    id: 'legacy-person',
    displayName: 'Anna',
    createdAt: '2025-04-03T10:00:00.000Z',
    updatedAt: '2025-04-03T10:00:00.000Z',
  }]));

  await expect(gospelStorage.getPeople()).resolves.toEqual([
    expect.objectContaining({ prayerStartedAt: '2025-04-03T10:00:00.000Z' }),
  ]);
});

it('records confirmed Gospel share events for review counts', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]');
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);

  const event = await gospelStorage.recordShareEvent('2026-09-22T08:00:00.000Z');

  expect(event.sharedAt).toBe('2026-09-22T08:00:00.000Z');
  expect(event.method).toBe('link');
  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toEqual([event]);
  expect(queueGospelImpactForShare).toHaveBeenCalledWith(event);
});

it('records how the Gospel was shared and who it was shared with', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]');

  const event = await gospelStorage.recordShareEvent({
    sharedAt: '2026-09-22T08:00:00.000Z',
    method: 'in_person',
    personId: 'person-1',
  });

  expect(event).toMatchObject({method: 'in_person', personId: 'person-1'});
});

it('records a consented in-app response with its person and spiritual date', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]');

  const event = await gospelStorage.recordShareEvent({
    sharedAt: '2026-09-24T08:00:00.000Z',
    method: 'together',
    responderName: 'Mara',
    response: 'trusted_jesus_today',
    spiritualBirthday: '2026-09-24',
  });

  expect(event).toMatchObject({
    method: 'together',
    responderName: 'Mara',
    response: 'trusted_jesus_today',
    spiritualBirthday: '2026-09-24',
  });
  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toEqual([event]);
});

it('keeps a one-tap open share anonymous and response-free', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]');

  const event = await gospelStorage.recordShareEvent({
    sharedAt: '2026-09-24T08:00:00.000Z',
    method: 'shared_openly',
  });

  expect(event).toEqual(expect.objectContaining({method: 'shared_openly'}));
  expect(event).not.toHaveProperty('personId');
  expect(event).not.toHaveProperty('response');
  expect(event).not.toHaveProperty('spiritualBirthday');
});

it('reads existing share events as link shares', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([
    {id: 'legacy-share', sharedAt: '2026-09-21T08:00:00.000Z'},
  ]));

  await expect(gospelStorage.getShareEvents()).resolves.toEqual([
    {id: 'legacy-share', sharedAt: '2026-09-21T08:00:00.000Z', method: 'link'},
  ]);
});

it('removes a share event so an accidental count can be undone', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([
    {id: 'keep', sharedAt: '2026-09-22T08:00:00.000Z', method: 'link'},
    {id: 'remove', sharedAt: '2026-09-22T09:00:00.000Z', method: 'outside_app'},
  ]));

  await gospelStorage.removeShareEvent('remove');

  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toEqual([
    {id: 'keep', sharedAt: '2026-09-22T08:00:00.000Z', method: 'link'},
  ]);
  expect(queueGospelImpactRetraction).toHaveBeenCalledWith({
    id: 'remove',
    sharedAt: '2026-09-22T09:00:00.000Z',
    method: 'outside_app',
  });
});

it('links an in-app response to someone on the prayer list', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([
    {id: 'response-share', sharedAt: '2026-09-22T08:00:00.000Z', method: 'together', response: 'not_ready'},
    {id: 'other-share', sharedAt: '2026-09-21T08:00:00.000Z', method: 'link'},
  ]));

  await gospelStorage.linkShareEventToPerson('response-share', 'person-mara');

  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toEqual([
    expect.objectContaining({id: 'response-share', personId: 'person-mara'}),
    expect.objectContaining({id: 'other-share'}),
  ]);
});

describe('For Me Day testimony timestamp', () => {
  const existingSettings = {
    spiritualBirthday: '2018-09-18',
    originalStory: 'Jesus met me there.',
    reminderEnabled: true,
    reminderTime: '09:00',
    showInMoments: true,
    includeYearWhenSharing: true,
    updatedAt: '2026-09-20T01:00:00.000Z',
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records the date and time when testimony is first written', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T07:42:00.000Z'));
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      ...existingSettings,
      originalStory: '',
    }));

    const saved = await gospelStorage.saveForMeDaySettings({
      ...existingSettings,
      originalStory: 'Jesus met me there and gave me peace.',
    });

    expect(saved.testimonyWrittenAt).toBe('2026-09-24T07:42:00.000Z');
    expect(saved.testimonyUpdatedAt).toBeUndefined();
    expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]))
      .toMatchObject({testimonyWrittenAt: '2026-09-24T07:42:00.000Z'});
  });

  it('preserves the original written time when testimony wording changes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T07:42:00.000Z'));
    const testimonyWrittenAt = '2026-09-21T04:30:00.000Z';
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      ...existingSettings,
      testimonyWrittenAt,
    }));

    const saved = await gospelStorage.saveForMeDaySettings({
      ...existingSettings,
      originalStory: 'Jesus met me there and gave me peace.',
      testimonyWrittenAt,
    });

    expect(saved.testimonyWrittenAt).toBe(testimonyWrittenAt);
    expect(saved.testimonyUpdatedAt).toBe('2026-09-24T07:42:00.000Z');
  });

  it('preserves the testimony timestamp when only preferences change', async () => {
    const testimonyWrittenAt = '2026-09-21T04:30:00.000Z';
    const testimonyUpdatedAt = '2026-09-23T05:15:00.000Z';
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      ...existingSettings,
      testimonyWrittenAt,
      testimonyUpdatedAt,
    }));

    const saved = await gospelStorage.saveForMeDaySettings({
      ...existingSettings,
      testimonyWrittenAt,
      testimonyUpdatedAt,
      reminderEnabled: false,
    });

    expect(saved.testimonyWrittenAt).toBe(testimonyWrittenAt);
    expect(saved.testimonyUpdatedAt).toBe(testimonyUpdatedAt);
  });

  it('uses the last saved time for legacy testimony without its own timestamp', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(existingSettings));

    await expect(gospelStorage.getForMeDaySettings()).resolves.toMatchObject({
      testimonyWrittenAt: existingSettings.updatedAt,
    });
  });
});
