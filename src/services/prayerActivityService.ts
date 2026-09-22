import { PrayerApi, type PrayerApiEntry } from './api/prayerApi';

export async function prayAgainExistingPrayer(prayer: PrayerApiEntry, needId?: string) {
  const stamp = new Date().toISOString();
  return PrayerApi.updatePrayer(prayer.id, {
    prayed: true,
    prayer_count: (prayer.prayer_count ?? (prayer.prayed ? 1 : 0)) + 1,
    last_prayed_at: stamp,
    metadata: {
      ...prayer.metadata,
      ...(needId ? { need_last_prayed: { ...prayer.metadata?.need_last_prayed, [needId]: stamp } } : {}),
    },
  });
}
