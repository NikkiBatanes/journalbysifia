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
