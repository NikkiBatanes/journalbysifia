import AsyncStorage from '@react-native-async-storage/async-storage';
import {fromLocalDateString, toLocalDateString} from '../utils/date';

export const SCRIPTURE_SEQUENCE_START_KEY = 'journal:scripture-sequence-start:v1';

export const validSequenceDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {return null;}
  const date = fromLocalDateString(value);
  if (!Number.isFinite(date.getTime())) {return null;}
  const localDate = toLocalDateString(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && localDate !== value) {return null;}
  return localDate;
};

// Older local installations have no signup timestamp. Use actual record creation
// times, never selected_date: backdated reflections must not move the start date.
const findLocalStart = async (): Promise<string | null> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    /^(journal_local:|journal_local_singleton:|reflection_local:|prayer_local:|routine_state:)/.test(key)
    && !key.includes('dev-review-'),
  );
  const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const dates: string[] = [];
  for (const [, raw] of rows) {
    try {
      const record = JSON.parse(raw || 'null');
      if (!record || String(record.id || '').includes('dev-review-')) {continue;}
      const date = validSequenceDate(record.created_at || record.started_at);
      if (date && date <= toLocalDateString(new Date())) {dates.push(date);}
    } catch {
      // A malformed unrelated record must not prevent establishing the sequence.
    }
  }
  return dates.sort()[0] || null;
};

let pendingLocalStart: Promise<string> | null = null;

/** Persist once; later dates and sign-outs reuse the same local start. */
export const getOrCreateScriptureSequenceAnchor = async (accountCreatedAt?: string | null): Promise<string> => {
  const accountDate = validSequenceDate(accountCreatedAt);
  if (!pendingLocalStart) {
    pendingLocalStart = (async () => {
      const stored = validSequenceDate(await AsyncStorage.getItem(SCRIPTURE_SEQUENCE_START_KEY));
      if (stored) {return stored;}
      const start = accountDate || await findLocalStart() || toLocalDateString(new Date());
      await AsyncStorage.setItem(SCRIPTURE_SEQUENCE_START_KEY, start);
      return start;
    })();
  }
  const pending = pendingLocalStart;
  try {
    const localStart = await pending;
    return accountDate || localStart;
  } finally {
    if (pendingLocalStart === pending) {pendingLocalStart = null;}
  }
};
