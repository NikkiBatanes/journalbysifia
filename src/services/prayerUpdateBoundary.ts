import { PrayerApi, PrayerApiEntry } from './api/prayerApi';
import type { CanonicalPrayerLifecycleUpdate } from '../utils/prayerTracking';

export type PrayerUpdatePayload = Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'>> & {
  metadata?: Record<string, any>;
  __canonicalPrayerLifecycle?: CanonicalPrayerLifecycleUpdate['__canonicalPrayerLifecycle'];
};

/**
 * The single persistence boundary for hook-based Prayer updates.
 *
 * A bare legacy status write has no action context, so retain the historic
 * conversion to durable answer history. Canonical V2 helpers carry an
 * operation-only flag instead; it is removed before storage, so derived
 * aggregate status can never be treated as a new whole-Prayer answer.
 */
export const persistPrayerUpdate = (
  id: string,
  updates: PrayerUpdatePayload,
  api: Pick<typeof PrayerApi, 'markSupplicationAnswered' | 'updatePrayer'> = PrayerApi,
) => {
  const { __canonicalPrayerLifecycle, ...persistedUpdates } = updates;
  if (!__canonicalPrayerLifecycle && persistedUpdates.status === 'answered' && !persistedUpdates.metadata?.answer_history) {
    return api.markSupplicationAnswered(id, true);
  }
  if (!__canonicalPrayerLifecycle && persistedUpdates.status === 'pending' && persistedUpdates.answered_date === null && !persistedUpdates.metadata?.answer_history) {
    return api.markSupplicationAnswered(id, false);
  }
  return api.updatePrayer(id, persistedUpdates);
};
