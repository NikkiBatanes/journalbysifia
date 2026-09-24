import type {LocalPrayerEntry} from '../storage/prayerStorage';
import type {RoutineState} from '../storage/routineStateStorage';
import type {BibleStudySession} from '../storage/bibleStudyStorage';
import type {LocalJournalEntry} from '../storage/journalStorage';

// Keep canonical local storage independent from native networking at module load.
// The sync implementation is loaded only after a successful local write.
export const queueRoutineCompletedImpact = async (state: RoutineState): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueRoutineCompletedImpact(state);
};

export const queuePrayerCreatedImpact = async (prayer: LocalPrayerEntry): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queuePrayerCreatedImpact(prayer);
};

export const queuePrayerAnsweredImpact = async (prayer: LocalPrayerEntry): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queuePrayerAnsweredImpact(prayer);
};

export const queuePrayerImpactRetraction = async (prayerId: string): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queuePrayerImpactRetraction(prayerId);
};

export const queueBibleStudyCreatedImpact = async (session: BibleStudySession): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueBibleStudyCreatedImpact(session);
};

export const queueBibleStudyCompletedImpact = async (session: BibleStudySession): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueBibleStudyCompletedImpact(session);
};

export const queueBibleStudyImpactRetraction = async (sessionId: string): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueBibleStudyImpactRetraction(sessionId);
};

export const queueGratitudeSavedImpact = async (entry: LocalJournalEntry): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueGratitudeSavedImpact(entry);
};

export const queueWinSavedImpact = async (entry: LocalJournalEntry): Promise<void> => {
  const impact = await import('./journalImpactAnalyticsService');
  return impact.queueWinSavedImpact(entry);
};
