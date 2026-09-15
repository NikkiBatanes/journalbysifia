import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import type { PrayerApiEntry } from './api/prayerApi';
import { groupPrayerEntries } from '../utils/prayerMoments';
import { isTrackedPrayer, prayerNeeds, trackingStatus } from '../utils/prayerTracking';

export type PrayerRevisit = { prayerId: string; needId?: string };
export const revisitKey = (item: PrayerRevisit) => JSON.stringify([item.prayerId, item.needId || '']);
export function revisitCandidates(prayers: PrayerApiEntry[], today: string): PrayerRevisit[] {
  return groupPrayerEntries(prayers).flatMap(group => {
    const p = group.groupedEntries?.find(e => e.journal_category === 'supplication') || group;
    if (p.is_prayer_request || !isTrackedPrayer(p) || trackingStatus(p) !== 'pending' || p.selected_date.slice(0, 10) > today) return [];
    const needs = prayerNeeds(p);
    return needs.length ? needs.filter(n => n.status === 'pending').map(n => ({ prayerId: p.id, needId: n.id })) : [{ prayerId: p.id }];
  }).sort((a, b) => {
    const last = (item: PrayerRevisit) => {
      const p = prayers.find(entry => entry.id === item.prayerId)!;
      const date = item.needId ? p.metadata?.need_last_prayed?.[item.needId] : p.last_prayed_at;
      const stamp = new Date(date || p.created_at).getTime();
      return Number.isFinite(stamp) ? stamp : 0;
    };
    const created = (item: PrayerRevisit) => {
      const stamp = new Date(prayers.find(p => p.id === item.prayerId)!.created_at).getTime();
      return Number.isFinite(stamp) ? stamp : 0;
    };
    return created(a) - created(b) || last(a) - last(b) || revisitKey(a).localeCompare(revisitKey(b));
  });
}
const storageKey = (userId: string) => `prayer-revisit:${userId}`;
export async function selectPrayerRevisit(userId: string, prayers: PrayerApiEntry[], date: Date, previous?: PrayerRevisit): Promise<PrayerRevisit | null> {
  const today = format(date, 'yyyy-MM-dd');
  const candidates = revisitCandidates(prayers, today);
  if (!candidates.length) return null;
  let saved: { day?: string; selection?: PrayerRevisit } | null = null;
  try { saved = JSON.parse(await AsyncStorage.getItem(storageKey(userId)) || 'null'); } catch { /* Recover from an invalid saved preference. */ }
  const current = saved?.day === today && saved?.selection ? candidates.find(c => revisitKey(c) === revisitKey(saved!.selection!)) : undefined;
  const previousIndex = previous ? candidates.findIndex(c => revisitKey(c) === revisitKey(previous)) : -1;
  const chosen = previous ? candidates[(previousIndex + 1) % candidates.length] : current || candidates[0];
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ day: today, selection: chosen }));
  return chosen;
}
