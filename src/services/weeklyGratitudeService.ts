import type {LocalJournalEntry} from '../storage/journalStorage';
import {
  deleteLocalJournalSingleton,
  saveLocalJournalSingleton,
} from '../storage/journalStorage';
import {emitMomentsStructuralRefresh} from '../utils/momentsRefresh';

export interface SaveWeeklyGratitudeInput {
  items: string[];
  periodStart: string;
  periodEnd: string;
  reviewId: string;
}

let writeQueue = Promise.resolve<LocalJournalEntry | null>(null);

/**
 * Keeps the distilled Weekly Review gratitude as its own canonical Moment.
 * The review period end is its timeline date; period metadata supplies the card subtitle.
 */
export const saveWeeklyGratitudeMoment = (
  input: SaveWeeklyGratitudeInput,
): Promise<LocalJournalEntry | null> => {
  const operation = writeQueue.catch(() => null).then(async () => {
    const cleanItems = input.items.map(item => item.trim()).filter(Boolean);
    if (cleanItems.length === 0) {
      await deleteLocalJournalSingleton('weekly_gratitude', input.periodEnd);
      emitMomentsStructuralRefresh('weekly_gratitude_deleted', input.periodEnd);
      return null;
    }

    const entry = await saveLocalJournalSingleton(
      'weekly_gratitude',
      input.periodEnd,
      JSON.stringify({
        // Retained for older readers while all current surfaces use `items`.
        text: cleanItems[0],
        items: cleanItems,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      }),
      {
        source: 'weekly_review',
        reviewId: input.reviewId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    );
    emitMomentsStructuralRefresh('weekly_gratitude', input.periodEnd, [entry.id]);
    return entry;
  });
  writeQueue = operation;
  return operation;
};
