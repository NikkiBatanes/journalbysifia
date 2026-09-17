import { eachDayOfInterval } from 'date-fns';
import { getLocalReflections } from '../storage/reflectionStorage';
import {
  getLocalJournalEntries,
  getLocalJournalSingleton,
  type LocalJournalContentType,
} from '../storage/journalStorage';
import { getLocalPrayers } from '../storage/prayerStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { type ReviewMemorableItem } from '../storage/reviewStorage';
import { resolveSessionNoteType, sessionNoteTypeLabel } from '../types/sessionNotes';

const REFLECTION_TYPES = ['sermon', 'scripture', 'free', 'guided', 'playbook'] as const;

const JOURNAL_CONTENT_TYPES: LocalJournalContentType[] = [
  'gratitude',
  'todo',
  'todays_focus',
  'today_win',
  'looking_forward',
];

export type ReviewCaptureKind = ReviewMemorableItem['kind'];

export interface ReviewCaptureItem {
  id: string;
  kind: ReviewCaptureKind;
  title: string;
  subtitle?: string;
  text?: string;
  selectedDate: string;
  answered?: boolean;
}

export interface ReviewCapture {
  periodStart: string;
  periodEnd: string;
  items: ReviewCaptureItem[];
  summary: Record<ReviewCaptureKind, number>;
  prayerStats: {
    total: number;
    answered: number;
    pending: number;
  };
}

const parseYMD = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toYMD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstLine = (text: string, max = 60): string => {
  const line = text.split(/\n+/)[0].trim();
  if (line.length <= max) {return line;}
  return `${line.slice(0, max).trim()}…`;
};

const reflectionTextFromStructuredValue = (value: unknown): string => {
  if (typeof value === 'string') {return value.trim();}
  if (Array.isArray(value)) {
    return value.map(reflectionTextFromStructuredValue).filter(Boolean).join(' · ');
  }
  if (!value || typeof value !== 'object') {return '';}
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {return record.text.trim();}
  if (Array.isArray(record.blocks)) {
    const blocks = reflectionTextFromStructuredValue(record.blocks);
    if (blocks) {return blocks;}
  }
  return Object.values(record).map(reflectionTextFromStructuredValue).filter(Boolean).join(' · ');
};

/** Reflection content is a mixed-format legacy boundary: plain text is valid. */
export const getReflectionReviewText = (content: unknown): string => {
  if (content === null || content === undefined) {return '';}
  if (typeof content !== 'string') {return reflectionTextFromStructuredValue(content);}
  const trimmed = content.trim();
  if (!trimmed) {return '';}
  const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!looksLikeJson) {return content;}
  const invalidJson = {};
  const parsed = safeJsonParse<unknown>(trimmed, { fallback: invalidJson, context: 'Review reflection content' });
  return parsed === invalidJson ? content : reflectionTextFromStructuredValue(parsed);
};

export const classifyReflection = (
  entry: {
    id: string;
    title?: string;
    type: string;
    source?: string;
    content: unknown;
    selected_date: string;
    metadata?: Record<string, any>;
  },
): ReviewCaptureItem | null => {
  const text = getReflectionReviewText(entry.content);

  const title = entry.title?.trim() || firstLine(text, 50) || 'Untitled';

  let kind: ReviewCaptureKind = 'journal';
  let subtitle = '';

  if (entry.type === 'sermon') {
    kind = 'sermon';
    subtitle = sessionNoteTypeLabel(resolveSessionNoteType(entry));
  } else if (entry.type === 'scripture') {
    if (entry.source === 'morning_psalm') {
      kind = 'morning';
      subtitle = 'Morning rhythm';
    } else if (entry.source === 'evening_proverbs') {
      kind = 'evening';
      subtitle = 'Evening rhythm';
    } else {
      kind = 'scripture';
      subtitle = 'Scripture reflection';
    }
  } else if (entry.type === 'playbook') {
    kind = 'journal';
    subtitle = 'Faithful Action';
  } else if (entry.type === 'free' || entry.type === 'guided') {
    kind = 'reflection';
    subtitle = entry.type === 'guided' ? 'Guided reflection' : 'Journal';
  }

  return {
    id: entry.id,
    kind,
    title,
    subtitle,
    text,
    selectedDate: entry.selected_date,
  };
};

const classifyJournal = (entry: {
  id: string;
  content_type: LocalJournalContentType;
  content: string;
  selected_date: string;
}): ReviewCaptureItem | null => {
  const parsed = safeJsonParse<Record<string, string>>(entry.content, {
    fallback: {},
  });

  let kind: ReviewCaptureKind = 'journal';
  let title = '';
  let subtitle = '';

  switch (entry.content_type) {
    case 'gratitude':
      kind = 'gratitude';
      subtitle = 'Gratitude';
      title = firstLine(parsed?.gratitude || parsed?.text || '', 50);
      break;
    case 'today_win':
      kind = 'win';
      subtitle = "Today's win";
      title = firstLine(parsed?.win || parsed?.text || '', 50);
      break;
    case 'todays_focus':
      kind = 'journal';
      subtitle = "Today's focus";
      title = firstLine(parsed?.text || '', 50);
      break;
    case 'looking_forward':
      kind = 'journal';
      subtitle = 'Looking forward';
      title = firstLine(parsed?.looking_forward || parsed?.text || '', 50);
      break;
    case 'todo':
    default:
      kind = 'journal';
      subtitle = 'Journal';
      title = firstLine(parsed?.text || '', 50);
      break;
  }

  if (!title) {return null;}

  return {
    id: entry.id,
    kind,
    title,
    subtitle,
    selectedDate: entry.selected_date,
  };
};

const classifyPrayer = (entry: {
  id: string;
  title?: string;
  content: string;
  status?: 'pending' | 'answered';
  selected_date: string;
}): ReviewCaptureItem => ({
  id: entry.id,
  kind: 'prayer',
  title: entry.title?.trim() || firstLine(entry.content, 50) || 'Prayer',
  subtitle: entry.status === 'answered' ? 'Answered' : 'Praying',
  text: entry.content,
  selectedDate: entry.selected_date,
  answered: entry.status === 'answered',
});

export const getReviewCapture = async (
  periodStart: string,
  periodEnd: string,
): Promise<ReviewCapture> => {
  const start = parseYMD(periodStart);
  const end = parseYMD(periodEnd);
  const days = eachDayOfInterval({ start, end });

  const items: ReviewCaptureItem[] = [];
  const summary: Record<ReviewCaptureKind, number> = {
    sermon: 0,
    prayer: 0,
    reflection: 0,
    scripture: 0,
    journal: 0,
    gratitude: 0,
    win: 0,
    morning: 0,
    evening: 0,
  };
  let totalPrayers = 0;
  let answeredPrayers = 0;

  for (const day of days) {
    const date = toYMD(day);

    for (const type of REFLECTION_TYPES) {
      const entries = await getLocalReflections(type, date);
      for (const e of entries) {
        const item = classifyReflection(e);
        if (!item) {continue;}
        items.push(item);
        summary[item.kind] += 1;
      }
    }

    for (const contentType of JOURNAL_CONTENT_TYPES) {
      const singleton = await getLocalJournalSingleton(contentType, date);
      if (singleton) {
        const item = classifyJournal(singleton);
        if (item) {
          items.push(item);
          summary[item.kind] += 1;
        }
      }
      const list = await getLocalJournalEntries(contentType, date);
      for (const e of list) {
        if (e.id === singleton?.id) {continue;}
        const item = classifyJournal(e);
        if (item) {
          items.push(item);
          summary[item.kind] += 1;
        }
      }
    }

    const prayers = await getLocalPrayers(date);
    for (const p of prayers) {
      const item = classifyPrayer(p);
      items.push(item);
      summary.prayer += 1;
      totalPrayers += 1;
      if (item.answered) {
        answeredPrayers += 1;
      }
    }
  }

  return {
    periodStart,
    periodEnd,
    items,
    summary,
    prayerStats: {
      total: totalPrayers,
      answered: answeredPrayers,
      pending: totalPrayers - answeredPrayers,
    },
  };
};
