import {DeviceEventEmitter} from 'react-native';

import {PrayerApi, type PrayerApiEntry} from './api/prayerApi';

export interface SaveWeeklyReviewPrayerInput {
  text: string;
  periodStart: string;
  periodEnd: string;
  reviewId: string;
}

const writeQueues = new Map<string, Promise<PrayerApiEntry | null>>();

const isWeeklyReviewPrayer = (
  prayer: PrayerApiEntry,
  input: SaveWeeklyReviewPrayerInput,
): boolean => {
  const metadata = prayer.metadata || {};
  if (metadata.source !== 'weekly_review') {return false;}
  return metadata.weeklyReviewId === input.reviewId
    || metadata.reviewId === input.reviewId
    || (metadata.periodStart === input.periodStart && metadata.periodEnd === input.periodEnd);
};

const weeklyTags = (prayer?: PrayerApiEntry): string[] => {
  const savedTags = prayer?.metadata?.tags;
  const existing = Array.isArray(savedTags)
    ? savedTags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
  return [...new Set([...existing, 'weekly'])];
};

/**
 * Persists the Weekly Review's closing prayer as one canonical Open Prayer.
 * Calls for the same review are serialized so autosave cannot create duplicates.
 */
export const saveWeeklyReviewPrayer = (
  input: SaveWeeklyReviewPrayerInput,
): Promise<PrayerApiEntry | null> => {
  const previous = writeQueues.get(input.reviewId) ?? Promise.resolve(null);
  const operation = previous.catch(() => null).then(async () => {
    const cleanText = input.text.trim();
    const prayers = await PrayerApi.getAllPrayers('local');
    const matches = prayers.filter(prayer => isWeeklyReviewPrayer(prayer, input));
    const existing = matches[0];

    if (!cleanText) {
      if (matches.length === 0) {return null;}
      await Promise.all(matches.map(prayer => PrayerApi.deletePrayer(prayer.id)));
      DeviceEventEmitter.emit('prayerSaved');
      return null;
    }

    const identityMetadata = {
      prayer_style: 'open',
      source: 'weekly_review',
      origin: 'weekly_review',
      review_type: 'weekly',
      reviewId: input.reviewId,
      weeklyReviewId: input.reviewId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      tags: weeklyTags(existing),
    };

    if (existing) {
      const metadata = {...existing.metadata, ...identityMetadata};
      const unchanged = existing.content === cleanText
        && existing.selected_date === input.periodEnd
        && existing.metadata?.weeklyReviewId === input.reviewId
        && existing.metadata?.periodStart === input.periodStart
        && existing.metadata?.periodEnd === input.periodEnd
        && existing.metadata?.prayer_style === 'open'
        && existing.metadata?.tags?.includes?.('weekly');
      if (unchanged) {return existing;}

      const updated = await PrayerApi.updatePrayer(existing.id, {
        content: cleanText,
        selected_date: input.periodEnd,
        metadata,
      });
      DeviceEventEmitter.emit('prayerSaved');
      return updated;
    }

    const created = await PrayerApi.createPrayer({
      user_id: 'local',
      selected_date: input.periodEnd,
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
