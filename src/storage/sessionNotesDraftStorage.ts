import AsyncStorage from '@react-native-async-storage/async-storage';

import type {JournalBlock} from '../components/journal/shared/journalBlocks';
import {
  isSessionNoteType,
  type SessionNoteType,
} from '../types/sessionNotes';
import {safeJsonParse} from '../utils/safeJsonParse';

export const SESSION_NOTES_DRAFT_FORMAT = 'session_notes_draft_v1' as const;

export interface SessionNotesDraft {
  format: typeof SESSION_NOTES_DRAFT_FORMAT;
  selectedDate: string;
  reflectionId: string | null;
  sessionNoteType: SessionNoteType;
  title: string;
  mainScripture: string;
  mainScriptureInput: string;
  series: string;
  part: string;
  speaker: string;
  church: string;
  blocks: JournalBlock[];
  notice: string;
  carry: string;
  prayer: string;
  prayerAnswer: string;
  showDetails: boolean;
  stage: 1 | 2 | 3 | 4;
  reflectionStep: number;
  updatedAt: string;
}

export type SessionNotesDraftInput = Omit<
  SessionNotesDraft,
  'format' | 'updatedAt'
>;

const PREFIX = 'session_notes_draft_v1';

export const sessionNotesDraftKey = (
  selectedDate: string,
  sessionNoteType: SessionNoteType,
  reflectionId?: string | null,
): string =>
  reflectionId
    ? `${PREFIX}:${selectedDate}:record:${reflectionId}`
    : `${PREFIX}:${selectedDate}:new:${sessionNoteType}`;

const isSessionNotesDraft = (value: unknown): value is SessionNotesDraft => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const draft = value as Partial<SessionNotesDraft>;
  const stringFields: Array<keyof SessionNotesDraft> = [
    'selectedDate',
    'title',
    'mainScripture',
    'mainScriptureInput',
    'series',
    'part',
    'speaker',
    'church',
    'notice',
    'carry',
    'prayer',
    'prayerAnswer',
    'updatedAt',
  ];
  return (
    draft.format === SESSION_NOTES_DRAFT_FORMAT &&
    isSessionNoteType(draft.sessionNoteType) &&
    stringFields.every(field => typeof draft[field] === 'string') &&
    (draft.reflectionId === null || typeof draft.reflectionId === 'string') &&
    Array.isArray(draft.blocks) &&
    typeof draft.showDetails === 'boolean' &&
    Number.isInteger(draft.reflectionStep) &&
    Number(draft.reflectionStep) >= 0 &&
    Number(draft.reflectionStep) <= 3 &&
    [1, 2, 3, 4].includes(Number(draft.stage))
  );
};

export const saveSessionNotesDraft = async (
  input: SessionNotesDraftInput,
): Promise<SessionNotesDraft> => {
  const draft: SessionNotesDraft = {
    ...input,
    format: SESSION_NOTES_DRAFT_FORMAT,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    sessionNotesDraftKey(
      input.selectedDate,
      input.sessionNoteType,
      input.reflectionId,
    ),
    JSON.stringify(draft),
  );
  return draft;
};

export const loadSessionNotesDraft = async (
  selectedDate: string,
  sessionNoteType: SessionNoteType,
  reflectionId?: string | null,
): Promise<SessionNotesDraft | null> => {
  const raw = await AsyncStorage.getItem(
    sessionNotesDraftKey(selectedDate, sessionNoteType, reflectionId),
  );
  const parsed = safeJsonParse<unknown>(raw || '', {fallback: null});
  return isSessionNotesDraft(parsed) ? parsed : null;
};

export const clearSessionNotesDraft = async (
  selectedDate: string,
  sessionNoteType: SessionNoteType,
  reflectionId?: string | null,
): Promise<void> => {
  await AsyncStorage.removeItem(
    sessionNotesDraftKey(selectedDate, sessionNoteType, reflectionId),
  );
};
