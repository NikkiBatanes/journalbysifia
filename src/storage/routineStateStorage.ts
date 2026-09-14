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

type RoutineType = 'morning' | 'evening';
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

export const saveRoutineState = async (
  routine: RoutineType,
  date: string | Date,
  updates: Partial<Omit<RoutineState, 'id' | 'routine' | 'selected_date'>>
): Promise<RoutineState> => {
  const selectedDate = formatLocalDate(date);
  const key = getRoutineStateKey(routine, selectedDate);
  const now = new Date().toISOString();

  const raw = await AsyncStorage.getItem(key);
  let state: RoutineState;

  if (raw) {
    const parsed = safeJsonParse<RoutineState>(raw, { fallback: null });
    if (parsed) {
      state = {
        ...parsed,
        ...updates,
        completed_at: updates.completed ? now : updates.completed_at ?? parsed.completed_at,
      };
    }
  }

  if (!state!) {
    state = {
      id: generateUUID(),
      routine,
      selected_date: selectedDate,
      completed: false,
      completed_steps: [],
      started_at: now,
      ...updates,
      completed_at: updates.completed ? now : undefined,
    };
  }

  await AsyncStorage.setItem(key, JSON.stringify(state));
  return state;
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

export const deleteRoutineState = async (
  routine: RoutineType,
  date: string | Date
): Promise<void> => {
  const selectedDate = formatLocalDate(date);
  await AsyncStorage.removeItem(getRoutineStateKey(routine, selectedDate));
};
