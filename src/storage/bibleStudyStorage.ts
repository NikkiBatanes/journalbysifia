import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateString } from '../utils/date';
import { safeJsonParse } from '../utils/safeJsonParse';
import { ContentRef } from './routineStateStorage';
import {
  createLocalReflection,
  getLocalReflection,
  updateLocalReflection,
  LocalReflectionEntry,
} from './reflectionStorage';
import {
  createLocalPrayer,
  getLocalPrayer,
  updateLocalPrayer,
  deleteLocalPrayer,
} from './prayerStorage';
import {
  queueBibleStudyCompletedImpact,
  queueBibleStudyCreatedImpact,
  queueBibleStudyImpactRetraction,
} from '../services/journalImpactQueue';

export interface BibleStudyHighlight {
  id: string;
  verseNumber: string;
  text: string;
  selectionStart?: number;
  selectionEnd?: number;
  color?: string;
}

export type BibleStudyStep =
  | 'passage'
  | 'read'
  | 'observe'
  | 'understand'
  | 'respond';

export type BibleStudyStage =
  | 'home'
  | 'read'
  | 'observe'
  | 'understand'
  | 'respond'
  | 'saved'
  | 'detail';

export interface BibleStudyPassage {
  reference: string;
  book?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  translation?: string;
}

export interface BibleStudyContent {
  format: 'bible_study_v1';
  passageRead?: boolean;
  highlights: BibleStudyHighlight[];
  observation: {
    text: string;
    tags: string[];
    byHighlight?: Record<string, string>;
    promptsByHighlight?: Record<string, string[]>;
    promptNotesByHighlight?: Record<string, Record<string, string>>;
  };
  understanding: {
    text: string;
    prompts?: string[];
    byPrompt?: Record<string, string>;
  };
  response: {
    text: string;
    prompts?: string[];
    byPrompt?: Record<string, string>;
  };
  prayer: { text: string; saveToPrayerJournal: boolean; trackAnswered?: boolean };
}

export interface BibleStudySession {
  id: string;
  selected_date: string;
  passage: BibleStudyPassage;
  current_stage: BibleStudyStage;
  current_step: BibleStudyStep;
  completed_steps: BibleStudyStep[];
  reflection_ref?: ContentRef;
  prayer_ref?: ContentRef;
  completed: boolean;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  version: number;
}

const BIBLE_STUDY_PREFIX = 'bible_study_session:';
const LATEST_BIBLE_STUDY_KEY = 'bible_study_latest_session';

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

const getBibleStudySessionKey = (id: string): string =>
  `${BIBLE_STUDY_PREFIX}${id}`;

export const parsePassageReference = (reference: string): BibleStudyPassage => {
  const normalized = reference.replace(/\s+/g, ' ').trim();
  // Match "Book 8", "Book 8:1", "Book 8:1-11", "Book 8:1–11", "1 Book 2:3-4"
  const match = normalized.match(
    /^((?:\d\s+)?[^\d]+?)(\d+)(?::(\d+)(?:\s*[–-]\s*(\d+))?)?$/
  );

  if (!match) {
    return { reference: normalized };
  }

  const book = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
  const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

  return {
    reference: normalized,
    book,
    chapter,
    verseStart,
    verseEnd,
  };
};

export const createEmptyBibleStudyContent = (): BibleStudyContent => ({
  format: 'bible_study_v1',
  passageRead: false,
  highlights: [],
  observation: {
    text: '',
    tags: [],
    byHighlight: {},
    promptsByHighlight: {},
    promptNotesByHighlight: {},
  },
  understanding: { text: '', prompts: [], byPrompt: {} },
  response: { text: '', prompts: [], byPrompt: {} },
  prayer: { text: '', saveToPrayerJournal: true, trackAnswered: false },
});

const createBibleStudyReflection = async (
  session: BibleStudySession,
): Promise<LocalReflectionEntry> => {
  const content = createEmptyBibleStudyContent();
  return createLocalReflection({
    server_id: null,
    title: session.passage.reference,
    content: JSON.stringify(content),
    type: 'scripture',
    source: 'bible_study',
    selected_date: session.selected_date,
    metadata: {
      bibleStudySessionId: session.id,
      passage: session.passage,
    },
  });
};

export const createBibleStudySession = async (
  passage: BibleStudyPassage,
  date?: string | Date,
): Promise<BibleStudySession> => {
  const selectedDate = formatLocalDate(date ?? new Date());
  const now = new Date().toISOString();
  const id = generateUUID();

  const session: BibleStudySession = {
    id,
    selected_date: selectedDate,
    passage,
    current_stage: 'home',
    current_step: 'passage',
    completed_steps: [],
    completed: false,
    started_at: now,
    updated_at: now,
    version: 1,
  };

  await AsyncStorage.setItem(getBibleStudySessionKey(id), JSON.stringify(session));

  const reflection = await createBibleStudyReflection(session);
  session.reflection_ref = {
    domain: 'reflection',
    content_type: 'scripture',
    local_id: reflection.id,
  };

  await AsyncStorage.setItem(getBibleStudySessionKey(id), JSON.stringify(session));
  await AsyncStorage.setItem(LATEST_BIBLE_STUDY_KEY, id);
  await queueBibleStudyCreatedImpact(session).catch(() => {});
  return session;
};

export const getBibleStudySession = async (
  id: string,
): Promise<BibleStudySession | null> => {
  const raw = await AsyncStorage.getItem(getBibleStudySessionKey(id));
  if (!raw) {return null;}
  return safeJsonParse<BibleStudySession>(raw, { fallback: null });
};

export const getAllBibleStudySessions = async (): Promise<BibleStudySession[]> => {
  const allKeys = await AsyncStorage.getAllKeys();
  const keys = allKeys.filter(key => key.startsWith(BIBLE_STUDY_PREFIX));
  const entries: BibleStudySession[] = [];
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {continue;}
    const parsed = safeJsonParse<BibleStudySession>(raw, { fallback: null });
    if (parsed) {entries.push(parsed);}
  }
  return entries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

export const getBibleStudySessions = async (filters?: {
  selected_date?: string;
  dateRange?: { start: string; end: string };
  completed?: boolean;
}): Promise<BibleStudySession[]> => {
  const all = await getAllBibleStudySessions();
  return all.filter(session => {
    if (filters?.completed !== undefined && session.completed !== filters.completed) {
      return false;
    }
    if (filters?.selected_date && session.selected_date !== filters.selected_date) {
      return false;
    }
    if (filters?.dateRange) {
      if (
        session.selected_date < filters.dateRange.start ||
        session.selected_date > filters.dateRange.end
      ) {
        return false;
      }
    }
    return true;
  });
};

export const getActiveBibleStudySession = async (
  date?: string | Date,
): Promise<BibleStudySession | null> => {
  const dateStr = date ? formatLocalDate(date) : undefined;
  const latestId = await AsyncStorage.getItem(LATEST_BIBLE_STUDY_KEY);
  const latest = latestId
    ? await getBibleStudySession(latestId)
    : (await getAllBibleStudySessions()).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  // Only the user's latest selected study is resumable. Do not fall back to
  // older unfinished studies after this one has been saved or deleted.
  if (!latest || latest.completed || latest.completed_at || latest.current_stage === 'saved' || latest.current_stage === 'detail') {return null;}
  if (dateStr && latest.selected_date !== dateStr) {return null;}
  const reflection = latest.reflection_ref ? await getLocalReflection(
    latest.reflection_ref.local_id, 'scripture', latest.selected_date,
  ) : null;
  if (!reflection || reflection.metadata?.bibleStudyCompleted === true) {return null;}
  return latest;
};

export const updateBibleStudySession = async (
  session: BibleStudySession,
): Promise<BibleStudySession> => {
  const now = new Date().toISOString();
  const existing = await getBibleStudySession(session.id);
  const updated: BibleStudySession = {
    ...session,
    ...(existing?.completed ? {
      completed: true,
      completed_at: session.completed_at || existing.completed_at,
    } : {}),
    updated_at: now,
    version: Math.max(session.version || 1, existing?.version || 1) + 1,
  };
  await AsyncStorage.setItem(getBibleStudySessionKey(updated.id), JSON.stringify(updated));
  if (updated.completed && !existing?.completed) {
    await queueBibleStudyCompletedImpact(updated).catch(() => {});
  }
  return updated;
};

export const deleteBibleStudySession = async (id: string): Promise<void> => {
  const existing = await getBibleStudySession(id);
  await AsyncStorage.removeItem(getBibleStudySessionKey(id));
  if (existing) {
    await queueBibleStudyImpactRetraction(id).catch(() => {});
  }
};

export const loadBibleStudyContent = async (
  session: BibleStudySession,
): Promise<BibleStudyContent> => {
  if (!session.reflection_ref) {return createEmptyBibleStudyContent();}
  const reflection = await getLocalReflection(
    session.reflection_ref.local_id,
    'scripture',
    session.selected_date,
  );
  if (!reflection) {return createEmptyBibleStudyContent();}
  const parsed = safeJsonParse<BibleStudyContent>(reflection.content, { fallback: null });
  if (parsed && parsed.format === 'bible_study_v1') {return parsed;}
  return createEmptyBibleStudyContent();
};

export const saveBibleStudyContent = async (
  session: BibleStudySession,
  content: BibleStudyContent,
): Promise<BibleStudySession> => {
  if (!session.reflection_ref) {return session;}
  const reflection = await getLocalReflection(
    session.reflection_ref.local_id,
    'scripture',
    session.selected_date,
  );
  if (!reflection) {return session;}

  const updatedReflection = await updateLocalReflection({
    ...reflection,
    title: session.passage.reference,
    content: JSON.stringify(content),
    metadata: {
      ...reflection.metadata,
      bibleStudySessionId: session.id,
      passage: session.passage,
    },
  });

  return updateBibleStudySession({
    ...session,
    reflection_ref: {
      domain: 'reflection',
      content_type: 'scripture',
      local_id: updatedReflection.id,
    },
  });
};

export const saveBibleStudyPrayer = async (
  session: BibleStudySession,
  prayerText: string,
  saveToJournal: boolean,
  trackAnswered = false,
): Promise<BibleStudySession> => {
  if (saveToJournal && prayerText.trim()) {
    if (session.prayer_ref) {
      const existing = await getLocalPrayer(
        session.prayer_ref.local_id,
        session.selected_date,
      );
      if (existing) {
        const updated = await updateLocalPrayer({
          ...existing,
          content: prayerText.trim(),
          metadata: {
            ...existing.metadata,
            source: 'bible_study',
            bibleStudySessionId: session.id,
            bibleStudyReflectionId: session.reflection_ref?.local_id,
            passage: session.passage.reference,
            track_answered: trackAnswered,
          },
        });
        return updateBibleStudySession({
          ...session,
          prayer_ref: {
            domain: 'prayer',
            content_type: 'prayer',
            local_id: updated.id,
          },
        });
      }
    }

    const prayer = await createLocalPrayer({
      server_id: null,
      user_id: undefined,
      title: `Prayer from ${session.passage.reference}`,
      content: prayerText.trim(),
      prayer_type: 'journal',
      journal_category: 'supplication',
      selected_date: session.selected_date,
      prayed: false,
      metadata: {
        source: 'bible_study',
        bibleStudySessionId: session.id,
        bibleStudyReflectionId: session.reflection_ref?.local_id,
        passage: session.passage.reference,
        track_answered: trackAnswered,
      },
    });

    return updateBibleStudySession({
      ...session,
      prayer_ref: {
        domain: 'prayer',
        content_type: 'prayer',
        local_id: prayer.id,
      },
    });
  }

  if (session.prayer_ref) {
    const existing = await getLocalPrayer(
      session.prayer_ref.local_id,
      session.selected_date,
    );
    if (existing) {
      await deleteLocalPrayer(existing.id, session.selected_date);
    }
    const next = { ...session, prayer_ref: undefined };
    return updateBibleStudySession(next);
  }

  return session;
};

export const completeBibleStudySession = async (
  session: BibleStudySession,
  finalContent: BibleStudyContent,
): Promise<BibleStudySession> => {
  let updated = await saveBibleStudyContent(session, finalContent);
  updated = await saveBibleStudyPrayer(
    updated,
    finalContent.prayer.text,
    finalContent.prayer.saveToPrayerJournal,
    finalContent.prayer.trackAnswered ?? false,
  );

  const now = new Date().toISOString();
  const completed: BibleStudySession = {
    ...updated,
    current_stage: 'saved',
    current_step: 'respond',
    completed_steps: ['passage', 'read', 'observe', 'understand', 'respond'],
    completed: true,
    completed_at: now,
  };
  const saved = await updateBibleStudySession(completed);
  if (saved.reflection_ref) {
    const reflection = await getLocalReflection(saved.reflection_ref.local_id, 'scripture', saved.selected_date);
    if (reflection) {
      await updateLocalReflection({
        ...reflection,
        metadata: { ...reflection.metadata, bibleStudyCompleted: true, bibleStudyCompletedAt: now },
      });
    }
  }
  return saved;
};
