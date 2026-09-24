import {DeviceEventEmitter} from 'react-native';

import {PrayerApi, type PrayerApiEntry} from './api/prayerApi';

export interface SaveMonthlyReviewPrayerInput {
  text: string;
  periodStart: string;
  periodEnd: string;
  reviewId: string;
}

const writeQueues = new Map<string, Promise<PrayerApiEntry | null>>();

const isMonthlyReviewPrayer = (
  prayer: PrayerApiEntry,
  input: SaveMonthlyReviewPrayerInput,
): boolean => {
  const metadata = prayer.metadata || {};
  if (metadata.source !== 'monthly_review') {
    return false;
  }
  return (
    metadata.monthlyReviewId === input.reviewId ||
    metadata.reviewId === input.reviewId ||
    (metadata.periodStart === input.periodStart &&
      metadata.periodEnd === input.periodEnd)
  );
};

const monthlyTags = (prayer?: PrayerApiEntry): string[] => {
  const savedTags = prayer?.metadata?.tags;
  const existing = Array.isArray(savedTags)
    ? savedTags.filter(
        (tag: unknown): tag is string =>
          typeof tag === 'string' && tag.trim().length > 0,
      )
    : [];
  return [...new Set([...existing, 'monthly'])];
};

const firstDayOfMonthAhead = (periodEnd: string): string => {
  const [year, month] = periodEnd.split('-').map(Number);
  const next = new Date(year, month, 1, 12);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(
    2,
    '0',
  )}-01`;
};

/** Persists the Monthly Review's closing prayer as one canonical Moments prayer. */
export const saveMonthlyReviewPrayer = (
  input: SaveMonthlyReviewPrayerInput,
): Promise<PrayerApiEntry | null> => {
  const previous = writeQueues.get(input.reviewId) ?? Promise.resolve(null);
  const operation = previous.catch(() => null).then(async () => {
    const cleanText = input.text.trim();
    const selectedDate = firstDayOfMonthAhead(input.periodEnd);
    const prayers = await PrayerApi.getAllPrayers('local');
    const matches = prayers.filter(prayer =>
      isMonthlyReviewPrayer(prayer, input),
    );
    const existing = matches[0];

    if (!cleanText) {
      if (matches.length === 0) {
        return null;
      }
      await Promise.all(matches.map(prayer => PrayerApi.deletePrayer(prayer.id)));
      DeviceEventEmitter.emit('prayerSaved');
      return null;
    }

    const identityMetadata = {
      prayer_style: 'open',
      source: 'monthly_review',
      origin: 'monthly_review',
      review_type: 'monthly',
      reviewId: input.reviewId,
      monthlyReviewId: input.reviewId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      tags: monthlyTags(existing),
    };

    if (existing) {
      const metadata = {...existing.metadata, ...identityMetadata};
      const unchanged =
        existing.content === cleanText &&
        existing.selected_date === selectedDate &&
        existing.metadata?.monthlyReviewId === input.reviewId &&
        existing.metadata?.prayer_style === 'open' &&
        existing.metadata?.tags?.includes?.('monthly');
      if (unchanged) {
        return existing;
      }
      const updated = await PrayerApi.updatePrayer(existing.id, {
        content: cleanText,
        selected_date: selectedDate,
        metadata,
      });
      DeviceEventEmitter.emit('prayerSaved');
      return updated;
    }

    const created = await PrayerApi.createPrayer({
      user_id: 'local',
      selected_date: selectedDate,
      prayer_type: 'journal',
      journal_category: 'personal_prayer',
      content: cleanText,
      prayed: true,
      prayer_count: 1,
      last_prayed_at: new Date().toISOString(),
      status: 'pending',
      metadata: {
        ...identityMetadata,
        track_answered: true,
        is_active: true,
        tracking_status: 'pending',
      },
    });
    DeviceEventEmitter.emit('prayerSaved');
    return created;
  });

  writeQueues.set(input.reviewId, operation);
  const clearQueue = () => {
    if (writeQueues.get(input.reviewId) === operation) {
      writeQueues.delete(input.reviewId);
    }
  };
  operation.then(clearQueue, clearQueue);
  return operation;
};
