import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from '../utils/date';
import { safeJsonParse } from '../utils/safeJsonParse';
import {
  queuePrayerAnsweredImpact,
  queuePrayerCreatedImpact,
  queuePrayerImpactRetraction,
} from '../services/journalImpactQueue';

export type PrayerType = 'journal' | 'people' | 'devotional' | 'guided_playbook';
export type JournalCategory = 'adoration' | 'confession' | 'thanksgiving' | 'supplication' | 'personal_prayer';
export type PrayerStatus = 'pending' | 'answered';

export interface LocalPrayerEntry {
  id: string;
  server_id?: string | null;
  user_id?: string;
  title?: string;
  content: string;
  prayer_type: PrayerType;
  journal_category?: JournalCategory;
  selected_date: string;
  person_name?: string;
  is_prayer_request?: boolean;
  requested_by?: string;
  prayed?: boolean;
  prayer_count?: number;
  last_prayed_at?: string;
  status?: PrayerStatus;
  answered_date?: string;
  notes?: string;
  day_number?: number;
  day_title?: string;
  total_days?: number;
  question_number?: number;
  created_at: string;
  updated_at: string;
  deleted?: boolean;
  version?: number;
  sync_status?: 'local' | 'pending' | 'synced' | 'error';
  metadata?: Record<string, any>;
  linked_account_id?: string | null;
}

const generateLocalUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

const LOCAL_PRAYER_PREFIX = 'prayer_local';
const LOCAL_PRAYER_INDEX_PREFIX = 'prayer_local_index';

const formatLocalDate = (date: string | Date): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  if (typeof date === 'string' && date.includes('T')) {
    return date.split('T')[0];
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return toLocalDateString(date);
  }
  return toLocalDateString(new Date(date));
};

const getPrayerKey = (date: string, id: string): string =>
  `${LOCAL_PRAYER_PREFIX}:${date}:${id}`;

const getPrayerIndexKey = (date: string): string =>
  `${LOCAL_PRAYER_INDEX_PREFIX}:${date}`;

const readPrayerIndex = async (date: string): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(getPrayerIndexKey(date));
  if (!raw) {return [];}
  return safeJsonParse<string[]>(raw, { fallback: [] }) ?? [];
};

const writePrayerIndex = async (date: string, ids: string[]): Promise<void> => {
  await AsyncStorage.setItem(getPrayerIndexKey(date), JSON.stringify(ids));
};

export const createLocalPrayer = async (
  data: Omit<LocalPrayerEntry, 'id' | 'created_at' | 'updated_at' | 'version' | 'sync_status'>
): Promise<LocalPrayerEntry> => {
  const now = new Date().toISOString();
  const selectedDate = formatLocalDate(data.selected_date);
  const id = generateLocalUUID();
  const entry: LocalPrayerEntry = {
    ...data,
    id,
    selected_date: selectedDate,
    server_id: data.server_id ?? null,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: 'local',
    deleted: false,
  };

  const key = getPrayerKey(selectedDate, id);
  await AsyncStorage.setItem(key, JSON.stringify(entry));

  const index = await readPrayerIndex(selectedDate);
  if (!index.includes(id)) {
    index.push(id);
    await writePrayerIndex(selectedDate, index);
  }

  await queuePrayerCreatedImpact(entry).catch(() => {});

  return entry;
};

export const getLocalPrayer = async (
  id: string,
  date: string | Date
): Promise<LocalPrayerEntry | null> => {
  const selectedDate = formatLocalDate(date);
  const raw = await AsyncStorage.getItem(getPrayerKey(selectedDate, id));
  if (!raw) {return null;}
  const parsed = safeJsonParse<LocalPrayerEntry>(raw, { fallback: null });
  if (parsed && parsed.deleted) {return null;}
  return parsed;
};

export const getLocalPrayers = async (date: string | Date): Promise<LocalPrayerEntry[]> => {
  const selectedDate = formatLocalDate(date);
  const index = await readPrayerIndex(selectedDate);
  const entries: LocalPrayerEntry[] = [];
  for (const id of index) {
    const raw = await AsyncStorage.getItem(getPrayerKey(selectedDate, id));
    if (!raw) {continue;}
    const parsed = safeJsonParse<LocalPrayerEntry>(raw, { fallback: null });
    if (parsed && !parsed.deleted) {
      entries.push(parsed);
    }
  }
  return entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
};

export const getLocalPrayersByType = async (
  date: string | Date,
  prayerType: PrayerType
): Promise<LocalPrayerEntry[]> => {
  const prayers = await getLocalPrayers(date);
  return prayers.filter(prayer => prayer.prayer_type === prayerType);
};

export const getLocalPrayersByCategory = async (
  date: string | Date,
  category: JournalCategory
): Promise<LocalPrayerEntry[]> => {
  const prayers = await getLocalPrayers(date);
  return prayers.filter(
    prayer => prayer.prayer_type === 'journal' && prayer.journal_category === category
  );
};

export const getLocalPeoplePrayers = async (
  date: string | Date,
  isRequest?: boolean
): Promise<LocalPrayerEntry[]> => {
  const prayers = await getLocalPrayersByType(date, 'people');
  if (isRequest !== undefined) {
    return prayers.filter(prayer => prayer.is_prayer_request === isRequest);
  }
  return prayers;
};

export const updateLocalPrayer = async (
  entry: LocalPrayerEntry
): Promise<LocalPrayerEntry> => {
  const now = new Date().toISOString();
  const selectedDate = formatLocalDate(entry.selected_date);
  const updated: LocalPrayerEntry = {
    ...entry,
    selected_date: selectedDate,
    updated_at: now,
    version: (entry.version || 1) + 1,
    sync_status: 'pending',
  };
  const key = getPrayerKey(selectedDate, updated.id);
  const existingRaw = await AsyncStorage.getItem(key);
  const existing = existingRaw
    ? safeJsonParse<LocalPrayerEntry>(existingRaw, {fallback: null})
    : null;
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  if (updated.status === 'answered' && existing?.status !== 'answered') {
    await queuePrayerAnsweredImpact(updated).catch(() => {});
  }
  return updated;
};

export const deleteLocalPrayer = async (
  id: string,
  date: string | Date
): Promise<void> => {
  const selectedDate = formatLocalDate(date);
  const raw = await AsyncStorage.getItem(getPrayerKey(selectedDate, id));
  if (!raw) {return;}
  const parsed = safeJsonParse<LocalPrayerEntry>(raw, { fallback: null });
  if (!parsed) {return;}

  const tombstone: LocalPrayerEntry = {
    ...parsed,
    updated_at: new Date().toISOString(),
    deleted: true,
    sync_status: 'pending',
  };
  await AsyncStorage.setItem(getPrayerKey(selectedDate, id), JSON.stringify(tombstone));

  const index = await readPrayerIndex(selectedDate);
  const nextIndex = index.filter(itemId => itemId !== id);
  await writePrayerIndex(selectedDate, nextIndex);
  await queuePrayerImpactRetraction(id).catch(() => {});
};
