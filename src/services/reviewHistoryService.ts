import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJsonParse } from '../utils/safeJsonParse';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DEV_PRAYER_PREFIX = 'dev-prayer-v2:';
const DEV_REVIEW_PREFIX = 'dev-review-v2:';
const RECORD_PREFIXES = [
  'journal_local:',
  'journal_local_singleton:',
  'reflection_local:',
  'prayer_local:',
  'routine_state:',
  'bible_study_session:',
];

type DatedLocalRecord = { id?: string; selected_date?: string; deleted?: boolean };

/** Earliest canonical local activity date. Indexes, Reviews, and DEV fixtures are excluded. */
export const getValidJournalHistoryStart = async (): Promise<string | null> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    RECORD_PREFIXES.some(prefix => key.startsWith(prefix)),
  );
  if (!keys.length) { return null; }

  const dates = (await AsyncStorage.multiGet(keys)).flatMap(([key, raw]) => {
    const record = safeJsonParse<DatedLocalRecord>(raw || '', { fallback: null });
    if (!record || record.deleted || !record.selected_date || !YMD.test(record.selected_date)) { return []; }
    if (record.id?.startsWith(DEV_PRAYER_PREFIX) || key.includes(DEV_PRAYER_PREFIX)
      || record.id?.startsWith(DEV_REVIEW_PREFIX) || key.includes(DEV_REVIEW_PREFIX)) { return []; }
    return [record.selected_date];
  });
  return dates.length ? dates.sort()[0] : null;
};
