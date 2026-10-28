import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimeBlockApiEntry } from '../services/api/timeBlockApi';
import { safeJsonParse } from '../utils/safeJsonParse';
import { generateUUID } from '../utils/uuidUtils';

/**
 * Journal-owned Time Blocks are always local. A connected siFia account must not
 * implicitly turn Journal entries into cloud-synced records.
 */
export const LOCAL_TIME_BLOCK_USER_ID = 'journal-local';

type TimeBlockCreate = Omit<TimeBlockApiEntry, 'id' | 'created_at' | 'updated_at'>;
type TimeBlockUpdate = Partial<Omit<TimeBlockApiEntry, 'id' | 'user_id' | 'created_at'>>;

interface LocalTimeBlockRecord {
  id: string;
  server_id: null;
  content_type: 'time_block';
  selected_date: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  sync_status: 'local' | 'pending';
  version: number;
  linked_account_id: null;
}

const RECORD_PREFIX = 'journal_local:time_block:';

const recordKey = (selectedDate: string, id: string): string =>
  `${RECORD_PREFIX}${selectedDate}:${id}`;

const readStoredRecords = async (): Promise<Array<{ key: string; record: LocalTimeBlockRecord }>> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(RECORD_PREFIX));
  if (!keys.length) { return []; }

  return (await AsyncStorage.multiGet(keys))
    .map(([key, raw]) => ({
      key,
      record: safeJsonParse<LocalTimeBlockRecord>(raw || '', { fallback: null }),
    }))
    .filter((item): item is { key: string; record: LocalTimeBlockRecord } =>
      !!item.record && item.record.content_type === 'time_block',
    );
};

const toApiEntry = (record: LocalTimeBlockRecord): TimeBlockApiEntry | null => {
  const content = safeJsonParse<Record<string, any>>(record.content, { fallback: null });
  if (!content) { return null; }

  return {
    ...content,
    id: record.id,
    user_id: LOCAL_TIME_BLOCK_USER_ID,
    selected_date: record.selected_date,
    created_at: record.created_at,
    updated_at: record.updated_at,
    version: record.version,
  } as TimeBlockApiEntry;
};

const contentFromEntry = (
  entry: Omit<TimeBlockApiEntry, 'id' | 'user_id' | 'selected_date' | 'created_at' | 'updated_at'>,
): string => JSON.stringify(entry);

export const getAllLocalTimeBlocks = async (): Promise<TimeBlockApiEntry[]> => {
  const stored = await readStoredRecords();
  return stored
    .filter(({ record }) => !record.deleted)
    .map(({ record }) => toApiEntry(record))
    .filter((entry): entry is TimeBlockApiEntry => !!entry)
    .sort((a, b) => `${a.selected_date}|${a.start_time}|${a.id}`.localeCompare(`${b.selected_date}|${b.start_time}|${b.id}`));
};

export const createLocalTimeBlock = async (input: TimeBlockCreate): Promise<TimeBlockApiEntry> => {
  const now = new Date().toISOString();
  const id = generateUUID();
  const {
    user_id: _ignoredUserId,
    selected_date,
    ...content
  } = input;
  const record: LocalTimeBlockRecord = {
    id,
    server_id: null,
    content_type: 'time_block',
    selected_date,
    content: contentFromEntry(content as any),
    created_at: now,
    updated_at: now,
    deleted: false,
    sync_status: 'local',
    version: 1,
    linked_account_id: null,
  };

  await AsyncStorage.setItem(recordKey(selected_date, id), JSON.stringify(record));
  return toApiEntry(record)!;
};

export const updateLocalTimeBlock = async (
  id: string,
  updates: TimeBlockUpdate,
): Promise<TimeBlockApiEntry | null> => {
  const stored = await readStoredRecords();
  const match = stored.find(({ record }) => record.id === id && !record.deleted);
  if (!match) { return null; }

  const current = toApiEntry(match.record);
  if (!current) { return null; }

  const updatedAt = new Date().toISOString();
  const merged: TimeBlockApiEntry = {
    ...current,
    ...updates,
    id,
    user_id: LOCAL_TIME_BLOCK_USER_ID,
    created_at: current.created_at,
    updated_at: updatedAt,
    version: (current.version || 1) + 1,
  };
  const {
    user_id: _ignoredUserId,
    selected_date,
    created_at: _ignoredCreatedAt,
    updated_at: _ignoredUpdatedAt,
    id: _ignoredId,
    ...content
  } = merged;
  const record: LocalTimeBlockRecord = {
    ...match.record,
    selected_date,
    content: contentFromEntry(content),
    updated_at: updatedAt,
    sync_status: 'pending',
    version: merged.version || match.record.version + 1,
  };

  // Keep the original storage key stable. Backup and reads use the record's
  // selected_date, so moving a Time Block never creates duplicate records.
  await AsyncStorage.setItem(match.key, JSON.stringify(record));
  return toApiEntry(record);
};

export const deleteLocalTimeBlock = async (id: string): Promise<boolean> => {
  const stored = await readStoredRecords();
  const match = stored.find(({ record }) => record.id === id && !record.deleted);
  if (!match) { return false; }

  const tombstone: LocalTimeBlockRecord = {
    ...match.record,
    deleted: true,
    sync_status: 'pending',
    updated_at: new Date().toISOString(),
    version: match.record.version + 1,
  };
  await AsyncStorage.setItem(match.key, JSON.stringify(tombstone));
  return true;
};
