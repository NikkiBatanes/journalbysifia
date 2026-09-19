import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/ProductionLogger';
import { safeJsonParse } from '../utils/safeJsonParse';
import { toLocalDateString } from '../utils/date';

const formatLocalDate = (date: string | Date): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return toLocalDateString(date);
  }
  return toLocalDateString(new Date(date));
};

// ===================================================================
// LOCAL REVIEW STORAGE
// -------------------------------------------------------------------
// Reviews are orchestration: they reference canonical journal, sermon,
// Scripture, reflection, and prayer records. They never copy or move
// those canonical records into review storage.
// ===================================================================

export type ReviewType =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'year_end'
  | 'begin_year';

export type ReviewStatus = 'draft' | 'completed';

export interface ReviewMemorableItem {
  kind:
    | 'sermon'
    | 'prayer'
    | 'reflection'
    | 'scripture'
    | 'journal'
    | 'gratitude'
    | 'win'
    | 'morning'
    | 'evening';
  id: string;
  selectedDate: string; // YYYY-MM-DD
}

export interface ReviewPrayerSnapshotItem {
  id: string;
  prayerId: string;
  needId?: string;
  requestId?: string;
  eventType: string;
  eventDate: string;
  title: string;
  subtitle: string;
  text?: string;
}

export interface ReviewAnswers {
  [beat: string]: string;
}

export interface LocalReviewEntry {
  id: string;
  type: ReviewType;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  status: ReviewStatus;
  memorableItems: ReviewMemorableItem[];
  /** Additive V2 snapshot. Legacy reviews omit it and remain valid. */
  prayerSnapshot?: ReviewPrayerSnapshotItem[];
  answers: ReviewAnswers;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

type CreateReviewData = Omit<
  LocalReviewEntry,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'status'
> & {
  status?: ReviewStatus;
};

const LOCAL_REVIEW_PREFIX = 'review_local';
const LOCAL_REVIEW_INDEX_PREFIX = 'review_local_index';

const generateLocalUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

const getReviewIndexKey = (type: ReviewType): string =>
  `${LOCAL_REVIEW_INDEX_PREFIX}:${type}`;

const getReviewKey = (type: ReviewType, id: string): string =>
  `${LOCAL_REVIEW_PREFIX}:${type}:${id}`;

const readReviewIndex = async (type: ReviewType): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(getReviewIndexKey(type));
  if (!raw) {return [];}
  return safeJsonParse<string[]>(raw, {fallback: []}) ?? [];
};

const writeReviewIndex = async (type: ReviewType, ids: string[]): Promise<void> => {
  await AsyncStorage.setItem(getReviewIndexKey(type), JSON.stringify(ids));
};

export const createLocalReview = async (
  data: CreateReviewData,
): Promise<LocalReviewEntry> => {
  const now = new Date().toISOString();
  const id = generateLocalUUID();
  const entry: LocalReviewEntry = {
    ...data,
    id,
    status: data.status ?? 'draft',
    memorableItems: data.memorableItems ?? [],
    answers: data.answers ?? {},
    createdAt: now,
    updatedAt: now,
  };

  const key = getReviewKey(data.type, id);
  await AsyncStorage.setItem(key, JSON.stringify(entry));

  const index = await readReviewIndex(data.type);
  if (!index.includes(id)) {
    index.push(id);
    await writeReviewIndex(data.type, index);
  }

  return entry;
};

export const getLocalReview = async (
  type: ReviewType,
  id: string,
): Promise<LocalReviewEntry | null> => {
  const raw = await AsyncStorage.getItem(getReviewKey(type, id));
  if (!raw) {return null;}
  const parsed = safeJsonParse<LocalReviewEntry>(raw, {fallback: null});
  return parsed;
};

export const getLocalReviewsByType = async (
  type: ReviewType,
): Promise<LocalReviewEntry[]> => {
  const index = await readReviewIndex(type);
  const entries: LocalReviewEntry[] = [];
  for (const id of index) {
    const raw = await AsyncStorage.getItem(getReviewKey(type, id));
    if (!raw) {continue;}
    const parsed = safeJsonParse<LocalReviewEntry>(raw, {fallback: null});
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const getLocalReviewForPeriod = async (
  type: ReviewType,
  periodStart: string | Date,
  periodEnd: string | Date,
): Promise<LocalReviewEntry | null> => {
  const start = formatLocalDate(periodStart);
  const end = formatLocalDate(periodEnd);
  const entries = await getLocalReviewsByType(type);
  return (
    entries.find(e => e.periodStart === start && e.periodEnd === end) ?? null
  );
};

export const getOrCreateLocalReviewForPeriod = async (
  data: Omit<CreateReviewData, 'status' | 'memorableItems' | 'answers'> & {
    status?: ReviewStatus;
    memorableItems?: ReviewMemorableItem[];
    answers?: ReviewAnswers;
  },
): Promise<LocalReviewEntry> => {
  const start = formatLocalDate(data.periodStart);
  const end = formatLocalDate(data.periodEnd);
  const existing = await getLocalReviewForPeriod(data.type, start, end);
  if (existing) {return existing;}
  return createLocalReview({
    ...data,
    periodStart: start,
    periodEnd: end,
    memorableItems: data.memorableItems ?? [],
    answers: data.answers ?? {},
  });
};

export const updateLocalReview = async (
  entry: LocalReviewEntry,
): Promise<LocalReviewEntry> => {
  const now = new Date().toISOString();
  const updated: LocalReviewEntry = {
    ...entry,
    updatedAt: now,
  };
  const key = getReviewKey(entry.type, entry.id);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
};

export const completeLocalReview = async (
  entry: LocalReviewEntry,
  answers?: ReviewAnswers,
  memorableItems?: ReviewMemorableItem[],
  prayerSnapshot?: ReviewPrayerSnapshotItem[],
): Promise<LocalReviewEntry> => {
  const now = new Date().toISOString();
  const updated: LocalReviewEntry = {
    ...entry,
    status: 'completed',
    completedAt: now,
    updatedAt: now,
    answers: answers ?? entry.answers,
    memorableItems: memorableItems ?? entry.memorableItems,
    prayerSnapshot: prayerSnapshot ?? entry.prayerSnapshot,
  };
  return updateLocalReview(updated);
};

export const deleteLocalReview = async (
  type: ReviewType,
  id: string,
): Promise<void> => {
  await AsyncStorage.removeItem(getReviewKey(type, id));
  const index = await readReviewIndex(type);
  const nextIndex = index.filter(itemId => itemId !== id);
  await writeReviewIndex(type, nextIndex);
};
