import { eachDayOfInterval } from 'date-fns';
import { getLocalReflections } from '../storage/reflectionStorage';
import {
  getLocalJournalEntries,
  getLocalJournalSingleton,
  type LocalJournalContentType,
} from '../storage/journalStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { type ReviewMemorableItem, type ReviewType } from '../storage/reviewStorage';
import { resolveSessionNoteType, sessionNoteTypeLabel } from '../types/sessionNotes';
import { heartJournalClassificationLabel } from '../types/heartJournal';
import { parseGuidedReflection } from '../types/guidedReflection';
import {guidedQuestionTopicForPrompt} from '../data/guidedReflectionQuestions';
import { PrayerApi } from './api/prayerApi';
import { derivePrayerReview, type PrayerReviewEventType } from './prayerReviewService';
import { getScripturePassage } from './scriptureReaderService';
import {resolveSavedProverbNumber, resolveSavedPsalmNumber} from './dailyScriptureSequence';

const REFLECTION_TYPES = [
  'sermon', 'scripture', 'free', 'freeform', 'free-form', 'guided',
  'thought', 'thoughts', 'reflection', 'devotional', 'playbook',
] as const;

const JOURNAL_CONTENT_TYPES: LocalJournalContentType[] = [
  'gratitude',
  'todo',
  'todays_focus',
  'today_win',
  'looking_forward',
  'morning_check_in',
];

export type ReviewCaptureKind = ReviewMemorableItem['kind'];

export type ReviewCapturePresentation =
  | 'heart_journal'
  | 'guided_reflection'
  | 'devotional_reflection'
  | 'playbook_reflection'
  | 'prayer'
  | 'gratitude_list'
  | 'bible_study'
  | 'scripture_reflection'
  | 'session_note'
  | 'today_win'
  | 'focus'
  | 'todo'
  | 'looking_forward'
  | 'morning_check_in'
  | 'morning_psalm'
  | 'evening_proverb';

export interface ReviewCaptureItem {
  id: string;
  kind: ReviewCaptureKind;
  title: string;
  subtitle?: string;
  text?: string;
  presentation: ReviewCapturePresentation;
  /** Structured display lines retained from canonical content (for example Gratitude items). */
  lines?: string[];
  /** Secondary canonical detail such as a win type or session context. */
  detail?: string;
  /** The life area chosen before answering a single Guided Reflection question. */
  lifeArea?: string;
  scriptureText?: string;
  feelingIcon?: string;
  feelingIconType?: 'ionicons' | 'material' | 'fontawesome';
  focusIcon?: string;
  focusIconType?: 'ionicons' | 'material' | 'fontawesome';
  focusPriorities?: Array<{text: string; completed: boolean}>;
  wisdomItems?: Array<{label: string; verses?: string; response?: string}>;
  wisdomResponse?: string;
  passageRead?: boolean;
  /** Canonical completion state, retained for To-do presentation in Review. */
  completed?: boolean;
  /** Canonical priority marker retained for To-do summary counts. */
  priority?: boolean;
  /** Number of completed priorities retained by a Today's Focus record. */
  completedPriorityCount?: number;
  /** Present only when a prayer is explicitly associated with a person. */
  personName?: string;
  selectedDate: string;
  answered?: boolean;
  prayerEventType?: PrayerReviewEventType;
  prayerId?: string;
  needId?: string;
  requestId?: string;
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

  let title = entry.title?.trim() || firstLine(text, 50) || 'Untitled';

  let kind: ReviewCaptureKind = 'journal';
  let subtitle = '';
  let presentation: ReviewCapturePresentation = 'heart_journal';
  let displayText = text;
  let detail = '';
  let lifeArea = '';
  let passageRead: boolean | undefined;
  let wisdomItems: ReviewCaptureItem['wisdomItems'];
  let wisdomResponse = '';

  if (entry.type === 'sermon') {
    kind = 'sermon';
    subtitle = sessionNoteTypeLabel(resolveSessionNoteType(entry));
    presentation = 'session_note';
    const sessionContent = safeJsonParse<{blocks?: Array<{text?: string; note?: string; secondary?: string; points?: string[]}>}>(
      typeof entry.content === 'string' ? entry.content : '',
      {fallback: {}},
    ) ?? {};
    const blocks = sessionContent.blocks || [];
    displayText = blocks.flatMap(block => [block.text, block.note, block.secondary, ...(block.points || [])]).find(value => value?.trim())?.trim() || text;
    const sessionDetails = entry.metadata?.sessionNoteDetails?.[resolveSessionNoteType(entry)] || {};
    detail = [entry.metadata?.series || sessionDetails.event, entry.metadata?.speaker || sessionDetails.person]
      .filter(value => typeof value === 'string' && value.trim()).join(' · ');
  } else if (entry.type === 'scripture') {
    if (entry.source === 'morning_psalm') {
      kind = 'morning';
      subtitle = 'Morning rhythm';
      presentation = 'morning_psalm';
      title = `Psalm ${resolveSavedPsalmNumber(entry, Number(entry.metadata?.psalmNumber) || 1)}`;
      passageRead = typeof entry.metadata?.psalmRead === 'boolean' ? entry.metadata.psalmRead : undefined;
    } else if (entry.source === 'evening_proverbs') {
      kind = 'evening';
      subtitle = 'Evening rhythm';
      presentation = 'evening_proverb';
      const metadata = entry.metadata ?? {};
      title = `Proverbs ${resolveSavedProverbNumber(entry, Number(metadata.proverbNumber) || 1)}`;
      passageRead = typeof metadata.proverbRead === 'boolean' ? metadata.proverbRead : undefined;
      const applications = metadata.wisdomApplications && typeof metadata.wisdomApplications === 'object'
        ? metadata.wisdomApplications as Record<string, unknown>
        : {};
      const selectedWisdom = Array.isArray(metadata.selectedWisdom) ? metadata.selectedWisdom : [];
      wisdomItems = selectedWisdom.map((wisdom: unknown) => {
        const value = wisdom && typeof wisdom === 'object' ? wisdom as Record<string, unknown> : {};
        const id = typeof value.id === 'string' ? value.id : '';
        const response = applications[id];
        return {
          label: typeof value.label === 'string' ? value.label.trim() : '',
          verses: typeof value.verses === 'string' ? value.verses.trim() || undefined : undefined,
          response: typeof response === 'string' ? response.trim() || undefined : undefined,
        };
      }).filter((wisdom: {label: string}) => wisdom.label);
      const customWisdom = typeof metadata.customWisdom === 'string' ? metadata.customWisdom.trim() : '';
      if (customWisdom) {wisdomItems.push({label: customWisdom});}
      wisdomResponse = typeof metadata.wisdomApplication === 'string' ? metadata.wisdomApplication.trim() : '';
    } else if (entry.source === 'bible_study') {
      kind = 'scripture';
      subtitle = 'Bible Study';
      presentation = 'bible_study';
      const study = safeJsonParse<any>(typeof entry.content === 'string' ? entry.content : '', {fallback: null});
      if (study?.format === 'bible_study_v1') {
        displayText = [study.observation?.text, study.understanding?.text, study.response?.text, study.highlights?.[0]?.text]
          .find(value => typeof value === 'string' && value.trim())?.trim() || '';
        detail = entry.metadata?.passage?.translation || 'NASB';
      }
    } else {
      kind = 'scripture';
      subtitle = 'Scripture reflection';
      presentation = 'scripture_reflection';
    }
  } else if (entry.type === 'playbook' || entry.source === 'playbook' || entry.source === 'playbook_reflection') {
    kind = 'journal';
    subtitle = 'Faithful Action';
    presentation = 'playbook_reflection';
    detail = typeof entry.metadata?.playbookTitle === 'string' ? entry.metadata.playbookTitle.trim() : '';
  } else if (entry.type === 'devotional' || entry.source === 'devotional') {
    kind = 'reflection';
    subtitle = 'Devotional reflection';
    presentation = 'devotional_reflection';
    detail = [entry.metadata?.devotional_title, entry.metadata?.day_title]
      .filter(value => typeof value === 'string' && value.trim()).join(' · ');
  } else if (entry.type === 'guided' || entry.source === 'guided' || entry.source === 'guided_prompt') {
    kind = 'reflection';
    presentation = 'guided_reflection';
    subtitle = entry.source === 'guided_prompt' ? 'Guided prompt' : 'Guided reflection';
    const journey = parseGuidedReflection(entry.content);
    if (journey) {
      detail = journey.pathTitle;
      displayText = journey.answers.flatMap(answer => [
        ...(answer.selected || []), answer.text || '', answer.optionalText || '',
        ...Object.values(answer.fields || {}), ...answer.notes.map(note => note.text),
      ]).find(value => value.trim()) || '';
    } else {
      lifeArea = typeof entry.metadata?.questionTopic === 'string'
        ? entry.metadata.questionTopic.trim()
        : guidedQuestionTopicForPrompt(entry.metadata?.prompt || entry.title) || '';
    }
  } else {
    kind = 'reflection';
    presentation = 'heart_journal';
    subtitle = heartJournalClassificationLabel(entry.metadata?.journalClassification) || 'Thoughts';
  }

  return {
    id: entry.id,
    kind,
    title,
    subtitle,
    text: displayText,
    presentation,
    detail: detail || undefined,
    lifeArea: lifeArea || undefined,
    passageRead,
    wisdomItems,
    wisdomResponse: wisdomResponse || undefined,
    selectedDate: entry.selected_date,
  };
};

const classifyJournal = async (entry: {
  id: string;
  content_type: LocalJournalContentType;
  content: string;
  selected_date: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
}): Promise<ReviewCaptureItem | null> => {
  const parsed = safeJsonParse<Record<string, unknown>>(entry.content, {
    fallback: {},
  }) ?? {};

  let kind: ReviewCaptureKind = 'journal';
  let title = '';
  let subtitle = '';
  let presentation: ReviewCapturePresentation = 'todo';
  let lines: string[] | undefined;
  let detail = '';
  let scriptureText = '';
  let feelingIcon = '';
  let feelingIconType: ReviewCaptureItem['feelingIconType'];
  let focusIcon = '';
  let focusIconType: ReviewCaptureItem['focusIconType'];
  let focusPriorities: ReviewCaptureItem['focusPriorities'];
  let text = '';
  let completedPriorityCount: number | undefined;

  const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

  switch (entry.content_type) {
    case 'gratitude':
      kind = 'gratitude';
      subtitle = 'Gratitude';
      presentation = 'gratitude_list';
      lines = Array.isArray(parsed?.items)
        ? parsed.items.map(item => typeof item === 'string' ? item : stringValue((item as any)?.text)).filter(Boolean)
        : [stringValue(parsed?.gratitude) || stringValue(parsed?.text)].filter(Boolean);
      title = firstLine(lines[0] || '', 50);
      text = lines.join(' · ');
      break;
    case 'today_win':
      kind = 'win';
      subtitle = "Today's win";
      presentation = 'today_win';
      text = stringValue(parsed?.quietWin) || stringValue(parsed?.win) || stringValue(parsed?.text) || stringValue(parsed?.winTypeName);
      title = firstLine(text, 50);
      detail = stringValue(parsed?.winTypeName) || stringValue(parsed?.winType);
      break;
    case 'todays_focus':
      kind = 'journal';
      subtitle = "Today's focus";
      presentation = 'focus';
      title = stringValue(parsed?.focus) || stringValue(parsed?.focusCategory);
      text = stringValue(parsed?.personalText) || title;
      title = title || firstLine(text, 50);
      focusIcon = stringValue(parsed?.focusIcon);
      const savedFocusIconType = stringValue(parsed?.focusIconType);
      focusIconType = savedFocusIconType === 'material' || savedFocusIconType === 'fontawesome'
        ? savedFocusIconType
        : 'ionicons';
      focusPriorities = Array.isArray(parsed?.priorities)
        ? parsed.priorities.map(priority => {
          const value = priority && typeof priority === 'object' ? priority as Record<string, unknown> : {};
          return {text: stringValue(value.text), completed: Boolean(value.completed)};
        }).filter(priority => priority.text)
        : [];
      completedPriorityCount = focusPriorities.filter(priority => priority.completed).length;
      break;
    case 'looking_forward': {
      kind = 'journal';
      subtitle = 'Looking forward';
      presentation = 'looking_forward';
      const lookingForwardEntry = parsed?.entry && typeof parsed.entry === 'object'
        ? parsed.entry as Record<string, unknown>
        : {};
      text = stringValue(parsed?.looking_forward) || stringValue(parsed?.text) || stringValue(lookingForwardEntry.text);
      title = firstLine(text, 50);
      detail = stringValue(parsed?.emotionName);
      feelingIcon = stringValue(parsed?.emotionIcon);
      feelingIconType = feelingIcon ? 'material' : undefined;
      break;
    }
    case 'morning_check_in': {
      kind = 'morning';
      subtitle = 'Morning check-in';
      presentation = 'morning_check_in';
      title = stringValue(parsed?.feeling) || 'Morning check-in';
      text = stringValue(parsed?.underneathIt) || title;
      feelingIcon = stringValue(parsed?.feelingIcon);
      const iconType = stringValue(parsed?.feelingIconType);
      feelingIconType = iconType === 'material' || iconType === 'fontawesome' ? iconType : 'ionicons';
      const scripture = parsed?.scripture && typeof parsed.scripture === 'object'
        ? parsed.scripture as Record<string, unknown>
        : {};
      detail = stringValue(scripture.reference);
      if (detail) {
        const passage = await getScripturePassage(detail, stringValue(scripture.translation) || 'NASB').catch(() => null);
        scriptureText = passage?.verses?.length
          ? passage.verses.map(verse => verse.lines.join('\n')).join('\n')
          : passage?.text?.trim() || '';
      }
      break;
    }
    case 'todo':
    default:
      kind = 'journal';
      subtitle = 'Journal';
      presentation = 'todo';
      text = stringValue(parsed?.text);
      title = firstLine(text, 50);
      break;
  }

  if (!title) {return null;}

  return {
    id: entry.id,
    kind,
    title,
    subtitle,
    text,
    presentation,
    lines,
    detail: detail || undefined,
    scriptureText: scriptureText || undefined,
    feelingIcon: feelingIcon || undefined,
    feelingIconType: feelingIcon ? feelingIconType : undefined,
    focusIcon: focusIcon || undefined,
    focusIconType: focusIcon ? focusIconType : undefined,
    focusPriorities,
    completed: entry.content_type === 'todo'
      ? Boolean(parsed?.completed ?? entry.completed)
      : undefined,
    priority: entry.content_type === 'todo'
      ? Boolean(parsed?.priority || entry.priority === 'high')
      : undefined,
    completedPriorityCount,
    selectedDate: entry.selected_date,
  };
};

export const getReviewCapture = async (
  periodStart: string,
  periodEnd: string,
  reviewType: ReviewType = 'weekly',
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
        const item = await classifyJournal(singleton);
        if (item) {
          items.push(item);
          summary[item.kind] += 1;
        }
      }
      const list = await getLocalJournalEntries(contentType, date);
      for (const e of list) {
        if (e.id === singleton?.id) {continue;}
        const item = await classifyJournal(e);
        if (item) {
          items.push(item);
          summary[item.kind] += 1;
        }
      }
    }

  }

  const prayers = await PrayerApi.getAllPrayers('local');
  const prayerReview = derivePrayerReview(prayers, periodStart, periodEnd, reviewType);
  const prayerById = new Map(prayers.map(prayer => [prayer.id, prayer]));
  for (const event of prayerReview.items) {
    const personPrayer = prayerById.get(event.requestId || event.prayerId)
      || prayerById.get(event.prayerId);
    items.push({
      id: event.id,
      kind: 'prayer',
      title: event.title,
      subtitle: event.subtitle,
      text: event.text,
      presentation: 'prayer',
      selectedDate: event.eventDate,
      answered: event.eventType === 'answer_recorded' || event.eventType === 'need_answer_recorded',
      prayerEventType: event.eventType,
      prayerId: event.prayerId,
      needId: event.needId,
      requestId: event.requestId,
      personName: personPrayer?.person_name?.trim() || undefined,
    });
    summary.prayer += 1;
  }
  answeredPrayers = (prayerReview.counts.answer_recorded || 0) + (prayerReview.counts.need_answer_recorded || 0);
  totalPrayers = summary.prayer;

  return {
    periodStart,
    periodEnd,
    items,
    summary,
    prayerStats: {
      total: totalPrayers,
      answered: answeredPrayers,
      pending: prayerReview.counts.still_carrying || 0,
    },
  };
};
