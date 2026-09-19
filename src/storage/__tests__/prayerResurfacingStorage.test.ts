import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismissPrayerResurfacing, getPrayerResurfacingState, recordPrayerResurfaced } from '../prayerResurfacingStorage';
import type { PrayerIntelligenceCandidate } from '../../services/prayerIntelligenceService';

const values = new Map<string, string>();
const candidate: PrayerIntelligenceCandidate = { id: 'prayer:need', purpose: 'return', prayerId: 'prayer', needId: 'need', sourceType: 'need', reason: 'test', createdAt: '2026-01-01', displayContext: 'Test', rank: 1 };
beforeEach(() => {
  values.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => values.get(key) || null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { values.set(key, value); });
});

it('records presentation state without changing canonical Prayer data', async () => {
  await recordPrayerResurfaced('user', candidate, new Date('2026-09-20T12:00:00Z'));
  await dismissPrayerResurfacing('user', candidate, new Date('2026-09-20T12:00:00Z'));
  const state = await getPrayerResurfacingState('user');
  expect(state.items[candidate.id]).toMatchObject({ lastResurfacedAt: '2026-09-20T12:00:00.000Z', lastResurfacedPurpose: 'return', dismissedUntil: '2026-09-23T12:00:00.000Z' });
  expect(state.recentIds).toEqual([candidate.id]);
  expect([...values.keys()]).toEqual(['prayer-intelligence:user']);
});
