import type { LocalJournalEntry } from '../storage/journalStorage';
import { getLocalJournalEntries, getLocalJournalSingleton } from '../storage/journalStorage';
import type { LocalReflectionEntry } from '../storage/reflectionStorage';
import { getLocalReflections } from '../storage/reflectionStorage';

export type DailyRhythmRelation = 'past' | 'today' | 'future';
export type DailyRhythmPeriod = 'morning' | 'evening';

interface DailyRhythmCardInput {
  relation: DailyRhythmRelation;
  period: DailyRhythmPeriod;
  dayOffset: number;
  hasContent: boolean;
  started: boolean;
  completed: boolean;
  hasFocusPlan: boolean;
  hasTodoPlan: boolean;
  allDisplayedContent?: boolean;
}

export interface DailyRhythmCardState {
  title: string;
  cta: 'Begin' | 'Continue' | 'View' | 'Reflect' | 'Revisit' | 'Plan' | 'Edit';
  hasPlan: boolean;
}

export const getDailyRhythmCardState = ({
  relation,
  period,
  dayOffset,
  hasContent,
  started,
  completed,
  hasFocusPlan,
  hasTodoPlan,
  allDisplayedContent = false,
}: DailyRhythmCardInput): DailyRhythmCardState => {
  const hasPlan = hasFocusPlan || hasTodoPlan;

  if (relation === 'future') {
    return {
      title: hasPlan
        ? (dayOffset === 1 ? 'Tomorrow is planned.' : 'This day is planned.')
        : (dayOffset === 1 ? 'Plan tomorrow.' : 'Plan ahead.'),
      cta: hasPlan ? 'Edit' : 'Plan',
      hasPlan,
    };
  }

  if (relation === 'past') {
    return {
      title: hasContent
        ? `Revisit this ${period}.`
        : `Reflect on this ${period}.`,
      cta: hasContent ? 'Revisit' : 'Reflect',
      hasPlan,
    };
  }

  if (completed) {
    return { title: period === 'evening' ? 'Your evening is saved.' : 'Your morning is saved.', cta: allDisplayedContent ? 'View' : 'Continue', hasPlan };
  }
  return {
    title: period === 'evening' ? 'Close your day.' : 'Begin your day.',
    cta: started ? 'Continue' : 'Begin',
    hasPlan,
  };
};

export interface MorningContentState {
  checkIn: boolean;
  psalm: boolean;
  focus: boolean;
  priorities: boolean;
}

export interface EveningContentState {
  gratitude: boolean;
  win: boolean;
  proverbs: boolean;
  reflection: boolean;
}

export interface DailyRhythmContentState {
  morning: MorningContentState;
  evening: EveningContentState;
}

const parseContent = (entry: LocalJournalEntry | null): Record<string, any> => {
  if (!entry?.content) { return {}; }
  try { return typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content; }
  catch { return {}; }
};

const meaningfulText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().toLowerCase() !== 'nothing selected';

export const hasMeaningfulCheckIn = (entry: LocalJournalEntry | null): boolean => {
  const content = parseContent(entry);
  return meaningfulText(content.feeling) || meaningfulText(content.underneathIt);
};

export const hasMeaningfulFocus = (entry: LocalJournalEntry | null): boolean => {
  const content = parseContent(entry);
  const category = typeof content.focusCategory === 'string' ? content.focusCategory.trim() : '';
  const validCategory = category.length > 0 && (category !== 'other' || meaningfulText(content.customFocus));
  return validCategory || meaningfulText(content.focus) || meaningfulText(content.personalText);
};

export const hasMeaningfulPriorities = (focus: LocalJournalEntry | null, todos: LocalJournalEntry[]): boolean => {
  const content = parseContent(focus);
  const focusPriorities = Array.isArray(content.priorities) ? content.priorities : [];
  return focusPriorities.some((priority: any) => meaningfulText(priority?.text))
    || todos.some(todo => meaningfulText(parseContent(todo).text));
};

export const hasMeaningfulScriptureReflection = (
  entry: LocalReflectionEntry | undefined,
  readField: 'psalmRead' | 'proverbRead',
): boolean => {
  if (!entry) { return false; }
  const metadata = entry.metadata ?? {};
  const selections = readField === 'psalmRead'
    ? metadata.selectedAttributes
    : metadata.selectedWisdomIds ?? metadata.selectedWisdom;
  const applications = metadata.wisdomApplications && typeof metadata.wisdomApplications === 'object'
    ? Object.values(metadata.wisdomApplications).some(meaningfulText)
    : false;
  return metadata[readField] === true
    || (Array.isArray(selections) && selections.some((value: any) => meaningfulText(value?.label ?? value)))
    || meaningfulText(metadata.customAttribute)
    || meaningfulText(metadata.customWisdom)
    || meaningfulText(metadata.carry)
    || meaningfulText(metadata.wisdomApplication)
    || applications
    || meaningfulText(entry.content);
};

export const hasMeaningfulGratitude = (entries: LocalJournalEntry[]): boolean => entries.some(entry => {
  const content = parseContent(entry);
  return Array.isArray(content.items) && content.items.some(meaningfulText);
});

export const hasMeaningfulWin = (entry: LocalJournalEntry | null): boolean => {
  const content = parseContent(entry);
  const winType = typeof content.winType === 'string' ? content.winType.trim() : '';
  return meaningfulText(content.quietWin)
    || (winType.length > 0 && (winType !== 'other' || meaningfulText(content.winTypeName)));
};

export const hasMeaningfulLookingForward = (entry: LocalJournalEntry | null): boolean => {
  const content = parseContent(entry);
  const emotion = typeof content.emotionId === 'string' ? content.emotionId.trim() : '';
  return meaningfulText(content.entry?.text)
    || (emotion.length > 0 && (emotion !== 'other' || meaningfulText(content.customEmotion)));
};

export const getDailyRhythmContentState = async (selectedDate: string | Date): Promise<DailyRhythmContentState> => {
  const [checkIn, focus, todos, gratitude, win, lookingForward, scripture] = await Promise.all([
    getLocalJournalSingleton('morning_check_in', selectedDate),
    getLocalJournalSingleton('todays_focus', selectedDate),
    getLocalJournalEntries('todo', selectedDate),
    getLocalJournalEntries('gratitude', selectedDate),
    getLocalJournalSingleton('today_win', selectedDate),
    getLocalJournalSingleton('looking_forward', selectedDate),
    getLocalReflections('scripture', selectedDate),
  ]);
  const morningPsalm = [...scripture].reverse().find(entry => entry.source === 'morning_psalm' || entry.metadata?.source === 'morning_psalm');
  const eveningProverbs = [...scripture].reverse().find(entry => entry.source === 'evening_proverbs' || entry.metadata?.source === 'evening_proverbs');

  return {
    morning: {
      checkIn: hasMeaningfulCheckIn(checkIn),
      psalm: hasMeaningfulScriptureReflection(morningPsalm, 'psalmRead'),
      focus: hasMeaningfulFocus(focus),
      priorities: hasMeaningfulPriorities(focus, todos),
    },
    evening: {
      gratitude: hasMeaningfulGratitude(gratitude),
      win: hasMeaningfulWin(win),
      proverbs: hasMeaningfulScriptureReflection(eveningProverbs, 'proverbRead'),
      reflection: hasMeaningfulLookingForward(lookingForward),
    },
  };
};
