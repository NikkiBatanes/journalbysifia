import {localJournalMutations} from '../storage/journalMutationCoordinator';
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

export type KeyedBackupRecord = { key: string; value: unknown };
export type BackupRecordLocation = { id: string; key: string };
type ReferenceIssue = { owner: string; reference: string; status: 'dangling' | 'legacy_unresolved' };

const GOSPEL_AUTHORED_KEYS = new Set([
  'journal:gospel:people:v1',
  'journal:gospel:self-response:v1',
  'journal:gospel:for-me-day-settings:v1',
  'journal:gospel:share-events:v1',
]);

// These values affect the user's Journal experience and are safe to restore.
// Keep this exact allowlist narrow: broad `journal:`/`prefs:` enumeration would
// also collect auth, device, analytics, notification, or queue state.
const MEANINGFUL_PREFERENCE_KEYS = new Set([
  'journal:local-profile',
  'journal:local-preferences',
  'journal:review-week-start',
  'journal:onboarding:setup:v1',
  'journal:scripture-sequence-start:v1',
  'prefs:noteBlocks:v1',
  'prefs:noteBlocks:v2',
  'prefs:hapticsEnabled',
  'prefs:soundsEnabled',
  'prefs:showTabLabelsEnabled',
]);

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
  /**
   * Exact source keys for records whose storage shape cannot always be inferred
   * from their bodies (notably journal singleton records). A future restore must
   * validate these keys against each record before preparing any write.
   */
  recordLocations: {
    journalRecords: BackupRecordLocation[];
    reflectionRecords: BackupRecordLocation[];
    prayerRecords: BackupRecordLocation[];
    bibleStudySessions: BackupRecordLocation[];
    routineStates: BackupRecordLocation[];
    reviews: BackupRecordLocation[];
  };
  authoredDrafts: {
    sessionNotes: KeyedBackupRecord[];
    guidedReflections: KeyedBackupRecord[];
    routines: KeyedBackupRecord[];
  };
  gospelAuthoredContent: KeyedBackupRecord[];
  preferences: KeyedBackupRecord[];
  /** Compatibility data that cannot be proven canonical. Never merge it with the records above. */
  legacyAuthoredContent: { reflectionLogs: KeyedBackupRecord[]; journalRecords: KeyedBackupRecord[] };
  integrity: JournalBackupIntegrityReport;
}

// Both historical journal key orders contain a date and a content type.
const legacyJournalTypes = [
  'gratitude', 'weekly_gratitude', 'weekly_looking_forward', 'todo', 'todos',
  'todays_focus', 'today_win', 'win', 'looking_forward', 'time_block', 'timeblock',
  'morning_check_in', 'tomorrow_in_his_hands', 'morning_flow', 'evening_flow',
  'prayer', 'people_to_pray_for', 'reflection',
];
const legacyJournalKey = new RegExp(
  '^journal_(?:' + legacyJournalTypes.join('|') + ')_(?:[0-9]{4}-[0-9]{2}-[0-9]{2}_.+|.+_[0-9]{4}-[0-9]{2}-[0-9]{2})$',
);
const sections = {
  journal: (key: string) => key.startsWith('journal_local:') || key.startsWith('journal_local_singleton:'),
  reflections: (key: string) => key.startsWith('reflection_local:'),
  prayers: (key: string) => key.startsWith('prayer_local:'),
  sessions: (key: string) => key.startsWith('bible_study_session:'),
  routines: (key: string) => key.startsWith('routine_state:'),
  reviews: (key: string) => key.startsWith('review_local:'),
  prayerDrafts: (key: string) => key.startsWith('prayer_draft:'),
  sessionDrafts: (key: string) => key.startsWith('session_notes_draft_v1:'),
  reflectionDrafts: (key: string) => key.startsWith('guided_reflection_draft_v1:'),
  routineDrafts: (key: string) => key.startsWith('routine_draft:'),
  gospel: (key: string) => GOSPEL_AUTHORED_KEYS.has(key),
  preferences: (key: string) => MEANINGFUL_PREFERENCE_KEYS.has(key),
  legacyReflections: (key: string) => key.startsWith('reflection_log_'),
  legacyJournal: (key: string) => legacyJournalKey.test(key),
  reviewSettings: (key: string) => key === 'review_settings_v1',
};

type RawRow = readonly [key: string, raw: string];
const selectors = Object.values(sections);
async function listBackupKeys() {
  return (await AsyncStorage.getAllKeys()).filter(key => selectors.some(matches => matches(key))).sort();
}

async function readPass(): Promise<RawRow[] | null> {
  const keys = await listBackupKeys();
  const rows: RawRow[] = [];
  for (let offset = 0; offset < keys.length; offset += 128) {
    const batch = keys.slice(offset, offset + 128);
    const pairs = await AsyncStorage.multiGet(batch);
    const values = new Map(pairs);
    if (pairs.length !== batch.length || values.size !== batch.length) {return null;}
    for (const key of batch) {
      const raw = values.get(key);
      if (typeof raw !== 'string') {return null;}
      rows.push([key, raw]);
    }
  }
  return rows;
}

// AsyncStorage has no read transaction. Require two matching observations of
// all selected keys and bytes before building an in-memory envelope.
async function readStableRows(): Promise<RawRow[]> {
  let current = await readPass();
  for (let attempt = 1; attempt < 3; attempt++) {
    const previous = current;
    current = await readPass();
    if (current && previous && current.length === previous.length &&
        current.every(([key, raw], i) => previous[i][0] === key && previous[i][1] === raw)) {
      // Detect additions that landed after the last enumeration but before
      // its final batch returned. A subsequent edit still needs a write fence.
      const keys = await listBackupKeys();
      if (keys.length === current.length && current.every(([key], i) => key === keys[i])) {
        return current;
      }
    }
  }
  throw new Error('Local journal changed while being read. Try again.');
}

function parseRecord<T extends object>(raw: string): T {
  const record = safeJsonParse<T>(raw, {logError: false});
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Could not read a local journal record.');
  }
  return record;
}

function located<T extends {id: string}>(rows: RawRow[]) {
  const locations: BackupRecordLocation[] = [];
  const records = rows.map(([key, raw]) => {
    const record = parseRecord<T>(raw);
    if (typeof record.id !== 'string' || !record.id) {throw new Error('Local record has no identifier.');}
    locations.push({id: record.id, key});
    return record;
  });
  locations.sort((a, b) => `${a.id}|${a.key}`.localeCompare(`${b.id}|${b.key}`));
  return {records, locations};
}

const keyed = (rows: RawRow[]): KeyedBackupRecord[] => rows.map(([key, raw]) => ({
  key, value: safeJsonParse<unknown>(raw, {fallback: raw, logError: false}),
}));

const sortRecords = <T extends { id: string }>(records: T[], date?: (record: T) => string, updated?: (record: T) => string): T[] =>
  [...records].sort((a, b) => `${date?.(a) || ''}|${updated?.(a) || ''}|${a.id}`.localeCompare(`${date?.(b) || ''}|${updated?.(b) || ''}|${b.id}`));

const collectRefs = (value: ContentRef | ContentRef[] | undefined): ContentRef[] =>
  !value ? [] : Array.isArray(value) ? value : [value];

export const getJournalBackupInventory = async (): Promise<JournalBackupInventory> => {
  const rows = await localJournalMutations.runExclusive(readStableRows);
  const matching = (matches: (key: string) => boolean) => rows.filter(([key]) => matches(key));
  const journal = located<LocalJournalEntry>(matching(sections.journal));
  const reflections = located<LocalReflectionEntry>(matching(sections.reflections));
  const prayers = located<LocalPrayerEntry>(matching(sections.prayers));
  const bibleStudySessions = located<BibleStudySession>(matching(sections.sessions));
  const routineStates = located<RoutineState>(matching(sections.routines));
  const reviews = located<LocalReviewEntry>(matching(sections.reviews));
  const prayerDrafts = matching(sections.prayerDrafts).map(([key, raw]) => {
    const draft = parseRecord<PrayerDraft>(raw);
    if (draft.key !== key) {throw new Error('Prayer draft identity is missing or inconsistent.');}
    return draft;
  });
  const sessionNoteDrafts = keyed(matching(sections.sessionDrafts));
  const guidedReflectionDrafts = keyed(matching(sections.reflectionDrafts));
  const routineDrafts = keyed(matching(sections.routineDrafts));
  const gospelAuthoredContent = keyed(matching(sections.gospel));
  const preferences = keyed(matching(sections.preferences));
  const legacyReflectionLogs = keyed(matching(sections.legacyReflections));
  const legacyJournalRecords = keyed(matching(sections.legacyJournal));
  const settings = matching(sections.reviewSettings)[0];
  const reviewSettings = settings ? parseRecord<ReviewSettings>(settings[1]) : null;

  const journalRecords = sortRecords(journal.records, item => item.selected_date, item => item.updated_at);
  const reflectionRecords = sortRecords(reflections.records, item => item.selected_date, item => item.updated_at);
  const prayerRecords = sortRecords(prayers.records, item => item.selected_date, item => item.updated_at);
  const sortedSessions = sortRecords(bibleStudySessions.records, item => item.selected_date, item => item.updated_at);
  const sortedRoutineStates = sortRecords(routineStates.records, item => item.selected_date, item => item.completed_at || item.started_at || '');
  const sortedReviews = sortRecords(reviews.records, item => item.periodStart, item => item.updatedAt);
  const sortedPrayerDrafts = [...prayerDrafts].sort((a, b) => `${a.key}|${a.updatedAt}`.localeCompare(`${b.key}|${b.updatedAt}`));

  const journalIds = new Set(journalRecords.filter(item => !item.deleted).map(item => item.id));
  const reflectionIds = new Set(reflectionRecords.filter(item => !item.deleted).map(item => item.id));
  const prayerIds = new Set(prayerRecords.filter(item => !item.deleted).map(item => item.id));
  const allActiveIds = new Set([...Array.from(journalIds), ...Array.from(reflectionIds), ...Array.from(prayerIds)]);
  const allIds = [...journalRecords, ...reflectionRecords, ...prayerRecords, ...sortedSessions, ...sortedRoutineStates, ...sortedReviews].map(item => item.id);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {duplicates.add(id);}
    seen.add(id);
  }

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
    const sourceIds = [item.id, ...(item.canonicalIds ?? [])];
    if (!sourceIds.some(id => allActiveIds.has(id))) {
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
    recordLocations: {
      journalRecords: journal.locations,
      reflectionRecords: reflections.locations,
      prayerRecords: prayers.locations,
      bibleStudySessions: bibleStudySessions.locations,
      routineStates: routineStates.locations,
      reviews: reviews.locations,
    },
    authoredDrafts: {
      sessionNotes: sessionNoteDrafts,
      guidedReflections: guidedReflectionDrafts,
      routines: routineDrafts,
    },
    gospelAuthoredContent,
    preferences,
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
        sessionNoteDrafts: sessionNoteDrafts.length,
        guidedReflectionDrafts: guidedReflectionDrafts.length,
        routineDrafts: routineDrafts.length,
        gospelAuthoredContent: gospelAuthoredContent.length,
        preferences: preferences.length,
      },
      tombstones: {
        journalRecords: journalRecords.filter(item => item.deleted).length,
        reflectionRecords: reflectionRecords.filter(item => item.deleted).length,
        prayerRecords: prayerRecords.filter(item => item.deleted).length,
      },
      duplicateIds: Array.from(duplicates).sort(),
      danglingReferences: danglingReferences.sort((a, b) => `${a.owner}|${a.reference}`.localeCompare(`${b.owner}|${b.reference}`)),
      legacyOnlyRecords: { reflectionLogs: legacyReflectionLogs.length, journalRecords: legacyJournalRecords.length },
    },
  };
};
