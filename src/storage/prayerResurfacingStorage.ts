import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRAYER_INTELLIGENCE_TIMING, type PrayerIntelligenceCandidate, type PrayerResurfacingState } from '../services/prayerIntelligenceService';

type StoredState = { items: Record<string, PrayerResurfacingState>; recentIds: string[] };
const key = (userId: string) => `prayer-intelligence:${userId}`;
const empty = (): StoredState => ({ items: {}, recentIds: [] });

export async function getPrayerResurfacingState(userId: string): Promise<StoredState> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(key(userId)) || 'null');
    return value && typeof value.items === 'object' ? { items: value.items, recentIds: Array.isArray(value.recentIds) ? value.recentIds : [] } : empty();
  } catch { return empty(); }
}

export async function recordPrayerResurfaced(userId: string, candidate: PrayerIntelligenceCandidate, date = new Date()) {
  const state = await getPrayerResurfacingState(userId);
  state.items[candidate.id] = { ...state.items[candidate.id], lastResurfacedAt: date.toISOString(), lastResurfacedPurpose: candidate.purpose };
  state.recentIds = [candidate.id, ...state.recentIds.filter(id => id !== candidate.id)].slice(0, 7);
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
}

export async function dismissPrayerResurfacing(userId: string, candidate: PrayerIntelligenceCandidate, date = new Date()) {
  const state = await getPrayerResurfacingState(userId);
  state.items[candidate.id] = { ...state.items[candidate.id], dismissedUntil: new Date(date.getTime() + PRAYER_INTELLIGENCE_TIMING.notNowSuppressionDays * 86_400_000).toISOString() };
  state.recentIds = [candidate.id, ...state.recentIds.filter(id => id !== candidate.id)].slice(0, 7);
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
}
