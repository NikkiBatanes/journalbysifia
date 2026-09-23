import {deleteLocalJournalSingleton, saveLocalJournalSingleton, type LocalJournalEntry} from '../storage/journalStorage';
import {getWeeklyLookingForwardContent} from '../utils/weeklyLookingForwardAnswers';
import {emitMomentsStructuralRefresh} from '../utils/momentsRefresh';

export interface SaveWeeklyLookingForwardInput {
  answers: Record<string, string>;
  periodStart: string;
  periodEnd: string;
  reviewId: string;
}

let writeQueue = Promise.resolve<LocalJournalEntry | null>(null);

/** A separate weekly Moment; daily Looking Forward records and routine progress are untouched. */
export const saveWeeklyLookingForwardMoment = (input: SaveWeeklyLookingForwardInput): Promise<LocalJournalEntry | null> => {
  const content = getWeeklyLookingForwardContent(input.answers);
  const operation = writeQueue.catch(() => null).then(async () => {
    if (!content.entry.text && !content.emotionName) {
      await deleteLocalJournalSingleton('weekly_looking_forward', input.periodEnd);
      emitMomentsStructuralRefresh('weekly_looking_forward_deleted', input.periodEnd);
      return null;
    }
    const record = await saveLocalJournalSingleton(
      'weekly_looking_forward', input.periodEnd,
      JSON.stringify({...content, periodStart: input.periodStart, periodEnd: input.periodEnd}),
      {source: 'weekly_review', reviewId: input.reviewId, periodStart: input.periodStart, periodEnd: input.periodEnd},
    );
    emitMomentsStructuralRefresh('weekly_looking_forward', input.periodEnd, [record.id]);
    return record;
  });
  writeQueue = operation;
  return operation;
};
