/**
 * routineStateStorage.ts
 *
 * Auth-independent, local-only persistence for Morning/Evening routine
 * completion and progress metadata.
 *
 * This is NOT a journal content store. It references canonical journal,
 * prayer, and reflection records by local id, but it does not duplicate
 * their content.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from '../utils/date';
import { safeJsonParse } from '../utils/safeJsonParse';
import {queueRoutineCompletedImpact} from '../services/journalImpactQueue';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

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

const ROUTINE_STATE_PREFIX = 'routine_state';

export type RoutineType = 'morning' | 'evening';
type ContentDomain = 'journal' | 'prayer' | 'reflection';

export interface ContentRef {
  domain: ContentDomain;
  content_type?: string;
  local_id: string;
}

export interface RoutineState {
  id: string;
  routine: RoutineType;
  selected_date: string;
  completed: boolean;
  completed_steps: string[];
  started_at?: string;
  completed_at?: string;
  content_refs?: Record<string, ContentRef | ContentRef[]>;
}

const getRoutineStateKey = (routine: RoutineType, date: string): string =>
  `${ROUTINE_STATE_PREFIX}:${routine}:${date}`;

const writeQueues = new Map<string, Promise<void>>();

const serializeWrite = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => current);
  writeQueues.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (writeQueues.get(key) === tail) {
      writeQueues.delete(key);
    }
  }
};

const buildRoutineState = (
  routine: RoutineType,
  selectedDate: string,
  existing: RoutineState | null,
  updates: Partial<Omit<RoutineState, 'id' | 'routine' | 'selected_date'>>,
): RoutineState => {
  const now = new Date().toISOString();
  if (existing) {
    return {
      ...existing,
      ...updates,
      completed_at: updates.completed && !existing.completed
        ? now
        : updates.completed_at ?? existing.completed_at,
    };
  }

  return {
    id: generateUUID(),
    routine,
    selected_date: selectedDate,
    completed: false,
    completed_steps: [],
    started_at: now,
    ...updates,
    completed_at: updates.completed ? now : undefined,
  };
};

export const saveRoutineState = async (
  routine: RoutineType,
  date: string | Date,
  updates: Partial<Omit<RoutineState, 'id' | 'routine' | 'selected_date'>>
): Promise<RoutineState> => {
  const selectedDate = formatLocalDate(date);
  const key = getRoutineStateKey(routine, selectedDate);
  return serializeWrite(key, async () => {
    const raw = await AsyncStorage.getItem(key);
    const existing = raw ? safeJsonParse<RoutineState>(raw, { fallback: null }) : null;
    const state = buildRoutineState(routine, selectedDate, existing, updates);
    await AsyncStorage.setItem(key, JSON.stringify(state));
    if (state.completed && !existing?.completed) {
      await queueRoutineCompletedImpact(state).catch(() => {});
    }
    return state;
  });
};

export const updateRoutineState = async (
  routine: RoutineType,
  date: string | Date,
  updater: (current: RoutineState | null) => Partial<Omit<RoutineState, 'id' | 'routine' | 'selected_date'>>,
): Promise<RoutineState> => {
  const selectedDate = formatLocalDate(date);
  const key = getRoutineStateKey(routine, selectedDate);
  return serializeWrite(key, async () => {
    const raw = await AsyncStorage.getItem(key);
    const existing = raw ? safeJsonParse<RoutineState>(raw, { fallback: null }) : null;
    const state = buildRoutineState(routine, selectedDate, existing, updater(existing));
    await AsyncStorage.setItem(key, JSON.stringify(state));
    if (state.completed && !existing?.completed) {
      await queueRoutineCompletedImpact(state).catch(() => {});
    }
    return state;
  });
};

export const getRoutineState = async (
  routine: RoutineType,
  date: string | Date
): Promise<RoutineState | null> => {
  const selectedDate = formatLocalDate(date);
  const key = getRoutineStateKey(routine, selectedDate);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {return null;}
  return safeJsonParse<RoutineState>(raw, { fallback: null });
};

/**
 * Returns the canonical local routine history used by rhythm summaries.
 * Routine content remains in its own stores; these records only describe
 * progress and completion for a local calendar day.
 */
export const getAllRoutineStates = async (
  routine?: RoutineType,
): Promise<RoutineState[]> => {
  const prefix = routine
    ? `${ROUTINE_STATE_PREFIX}:${routine}:`
    : `${ROUTINE_STATE_PREFIX}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
  if (!keys.length) {return [];}

  const rows = await AsyncStorage.multiGet(keys);
  return rows
    .map(([, raw]) => raw ? safeJsonParse<RoutineState>(raw, { fallback: null }) : null)
    .filter((state): state is RoutineState => Boolean(
      state
      && (state.routine === 'morning' || state.routine === 'evening')
      && /^\d{4}-\d{2}-\d{2}$/.test(state.selected_date),
    ))
    .sort((a, b) => a.selected_date.localeCompare(b.selected_date));
};

export const deleteRoutineState = async (
  routine: RoutineType,
  date: string | Date
): Promise<void> => {
  const selectedDate = formatLocalDate(date);
  const key = getRoutineStateKey(routine, selectedDate);
  await serializeWrite(key, () => AsyncStorage.removeItem(key));
};
