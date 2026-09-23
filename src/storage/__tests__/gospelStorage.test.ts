import AsyncStorage from '@react-native-async-storage/async-storage';
import { gospelStorage } from '../gospelStorage';

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

it('reads existing share events as link shares', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([
    {id: 'legacy-share', sharedAt: '2026-09-21T08:00:00.000Z'},
  ]));

  await expect(gospelStorage.getShareEvents()).resolves.toEqual([
    {id: 'legacy-share', sharedAt: '2026-09-21T08:00:00.000Z', method: 'link'},
  ]);
});
