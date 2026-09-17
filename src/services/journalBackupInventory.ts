/**
 * Read-only, local-only inventory for a future Journal backup/restore feature.
 * It deliberately returns persistence records unchanged and includes canonical
 * tombstones. It does not repair storage, invoke cloud APIs, or create a file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJsonParse } from '../utils/safeJsonParse';
import type { LocalJournalEntry } from '../storage/journalStorage';
import type { LocalReflectionEntry } from '../storage/reflectionStorage';
import type { LocalPrayerEntry } from '../storage/prayerStorage';
import type { BibleStudySession } from '../storage/bibleStudyStorage';
import type { RoutineState, ContentRef } from '../storage/routineStateStorage';
import type { LocalReviewEntry } from '../storage/reviewStorage';
import type { ReviewSettings } from '../storage/reviewSettingsStorage';
import type { PrayerDraft } from '../storage/prayerDraftStorage';

type LegacyRecord = { key: string; value: unknown };
type ReferenceIssue = { owner: string; reference: string; status: 'dangling' | 'legacy_unresolved' };

export interface JournalBackupIntegrityReport {
  counts: Record<string, number>;
  tombstones: { journalRecords: number; reflectionRecords: number; prayerRecords: number };
  duplicateIds: string[];
  danglingReferences: ReferenceIssue[];
  legacyOnlyRecords: { reflectionLogs: number; journalRecords: number };
}

export interface JournalBackupInventory {
  journalRecords: LocalJournalEntry[];
  reflectionRecords: LocalReflectionEntry[];
  prayerRecords: LocalPrayerEntry[];
  bibleStudySessions: BibleStudySession[];
  routineStates: RoutineState[];
  reviews: LocalReviewEntry[];
  reviewSettings: ReviewSettings | null;
  prayerDrafts: PrayerDraft[];
  /** Compatibility data that cannot be proven canonical. Never merge it with the records above. */
  legacyAuthoredContent: { reflectionLogs: LegacyRecord[]; journalRecords: LegacyRecord[] };
  integrity: JournalBackupIntegrityReport;
}

const readRecords = async <T>(predicate: (key: string) => boolean): Promise<T[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(predicate).sort();
  if (!keys.length) {return [];}
  return (await AsyncStorage.multiGet(keys))
    .map(([, raw]) => safeJsonParse<T>(raw || '', { fallback: null }))
    .filter((value): value is T => value !== null);
};

const readLegacyRecords = async (predicate: (key: string) => boolean): Promise<LegacyRecord[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(predicate).sort();
  if (!keys.length) {return [];}
  return (await AsyncStorage.multiGet(keys)).map(([key, raw]) => ({
    key,
    value: safeJsonParse<unknown>(raw || '', { fallback: raw }),
  }));
};

const sortRecords = <T extends { id: string }>(records: T[], date?: (record: T) => string, updated?: (record: T) => string): T[] =>
  [...records].sort((a, b) => `${date?.(a) || ''}|${updated?.(a) || ''}|${a.id}`.localeCompare(`${date?.(b) || ''}|${updated?.(b) || ''}|${b.id}`));

const collectRefs = (value: ContentRef | ContentRef[] | undefined): ContentRef[] =>
  !value ? [] : Array.isArray(value) ? value : [value];

export const getJournalBackupInventory = async (): Promise<JournalBackupInventory> => {
  // Prefix enumeration intentionally reads records, not indexes. Index updates are
  // separate writes and must not determine backup completeness.
  const [journal, reflections, prayers, bibleStudySessions, routineStates, reviews, prayerDrafts, legacyReflectionLogs, legacyJournalRecords, reviewSettingsRaw] = await Promise.all([
    readRecords<LocalJournalEntry>(key => key.startsWith('journal_local:') || key.startsWith('journal_local_singleton:')),
    readRecords<LocalReflectionEntry>(key => key.startsWith('reflection_local:')),
    readRecords<LocalPrayerEntry>(key => key.startsWith('prayer_local:')),
    readRecords<BibleStudySession>(key => key.startsWith('bible_study_session:')),
    readRecords<RoutineState>(key => key.startsWith('routine_state:')),
    readRecords<LocalReviewEntry>(key => key.startsWith('review_local:')),
    readRecords<PrayerDraft>(key => key.startsWith('prayer_draft:')),
    readLegacyRecords(key => key.startsWith('reflection_log_')),
    readLegacyRecords(key => key.startsWith('journal_') && !key.startsWith('journal_local') && !key.startsWith('journal_cache')),
    AsyncStorage.getItem('review_settings_v1'),
  ]);

  const journalRecords = sortRecords(journal, item => item.selected_date, item => item.updated_at);
  const reflectionRecords = sortRecords(reflections, item => item.selected_date, item => item.updated_at);
  const prayerRecords = sortRecords(prayers, item => item.selected_date, item => item.updated_at);
  const sortedSessions = sortRecords(bibleStudySessions, item => item.selected_date, item => item.updated_at);
  const sortedRoutineStates = sortRecords(routineStates, item => item.selected_date, item => item.completed_at || item.started_at || '');
  const sortedReviews = sortRecords(reviews, item => item.periodStart, item => item.updatedAt);
  const sortedPrayerDrafts = [...prayerDrafts].sort((a, b) => `${a.key}|${a.updatedAt}`.localeCompare(`${b.key}|${b.updatedAt}`));
  const reviewSettings = safeJsonParse<ReviewSettings>(reviewSettingsRaw || '', { fallback: null });

  const journalIds = new Set(journalRecords.filter(item => !item.deleted).map(item => item.id));
  const reflectionIds = new Set(reflectionRecords.filter(item => !item.deleted).map(item => item.id));
  const prayerIds = new Set(prayerRecords.filter(item => !item.deleted).map(item => item.id));
  const allActiveIds = new Set([...journalIds, ...reflectionIds, ...prayerIds]);
  const allIds = [...journalRecords, ...reflectionRecords, ...prayerRecords, ...sortedSessions, ...sortedRoutineStates, ...sortedReviews].map(item => item.id);
  const duplicates = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))].sort();

  const danglingReferences: ReferenceIssue[] = [];
  sortedRoutineStates.forEach(state => Object.entries(state.content_refs || {}).flatMap(([, ref]) => collectRefs(ref)).forEach(ref => {
    const ids = ref.domain === 'journal' ? journalIds : ref.domain === 'reflection' ? reflectionIds : prayerIds;
    if (!ids.has(ref.local_id)) {danglingReferences.push({ owner: `routine:${state.id}`, reference: ref.local_id, status: 'dangling' });}
  }));
  sortedSessions.forEach(session => {
    if (session.reflection_ref && !reflectionIds.has(session.reflection_ref.local_id)) {
      danglingReferences.push({ owner: `bibleStudy:${session.id}`, reference: session.reflection_ref.local_id, status: 'dangling' });
    }
    if (session.prayer_ref && !prayerIds.has(session.prayer_ref.local_id)) {
      danglingReferences.push({ owner: `bibleStudy:${session.id}`, reference: session.prayer_ref.local_id, status: 'dangling' });
    }
  });
  sortedReviews.forEach(review => review.memorableItems.forEach(item => {
    if (!allActiveIds.has(item.id)) {
      danglingReferences.push({ owner: `review:${review.id}`, reference: item.id, status: 'legacy_unresolved' });
    }
  }));

  const legacyAuthoredContent = { reflectionLogs: legacyReflectionLogs, journalRecords: legacyJournalRecords };
  return {
    journalRecords,
    reflectionRecords,
    prayerRecords,
    bibleStudySessions: sortedSessions,
    routineStates: sortedRoutineStates,
    reviews: sortedReviews,
    reviewSettings,
    prayerDrafts: sortedPrayerDrafts,
    legacyAuthoredContent,
    integrity: {
      counts: {
        journalRecords: journalRecords.length,
        reflectionRecords: reflectionRecords.length,
        prayerRecords: prayerRecords.length,
        bibleStudySessions: sortedSessions.length,
        routineStates: sortedRoutineStates.length,
        reviews: sortedReviews.length,
        prayerDrafts: sortedPrayerDrafts.length,
      },
      tombstones: {
        journalRecords: journalRecords.filter(item => item.deleted).length,
        reflectionRecords: reflectionRecords.filter(item => item.deleted).length,
        prayerRecords: prayerRecords.filter(item => item.deleted).length,
      },
      duplicateIds: duplicates,
      danglingReferences: danglingReferences.sort((a, b) => `${a.owner}|${a.reference}`.localeCompare(`${b.owner}|${b.reference}`)),
      legacyOnlyRecords: { reflectionLogs: legacyReflectionLogs.length, journalRecords: legacyJournalRecords.length },
    },
  };
};
