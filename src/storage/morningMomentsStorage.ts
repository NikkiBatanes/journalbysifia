import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalJournalEntry } from './journalStorage';
import { getAllLocalReflectionsByType } from './reflectionStorage';
import { safeJsonParse } from '../utils/safeJsonParse';

export interface MorningMoment {
  id: string;
  pluginId: string;
  title: string;
  date: string;
  savedAt: string;
  lines: string[];
  feeling?: string;
  feelingIcon?: string;
  feelingIconType?: string;
  underneathIt?: string;
  markedRead?: boolean;
  reflection?: string;
  observations?: string[];
  wisdomSelections?: Array<{
    id: string;
    label: string;
    verses: string;
    prompt: string;
    application: string;
  }>;
  winType?: string;
  quietWin?: string;
  emotionName?: string;
  emotionIcon?: string;
  lookingForwardText?: string;
  customEmotion?: string;
}

export const getMorningMoments = async (): Promise<MorningMoment[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    /^journal_local_singleton:(morning_check_in|todays_focus):/.test(key) || /^journal_local:(todo|morning_check_in):/.test(key),
  );
  const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const entries = rows.map(([, raw]) => safeJsonParse<LocalJournalEntry>(raw || '', { fallback: null }))
    .filter((entry): entry is LocalJournalEntry => !!entry && !entry.deleted);
  const moments: MorningMoment[] = [];
  const todos = new Map<string, LocalJournalEntry[]>();
  for (const entry of entries) {
    const content = safeJsonParse<Record<string, any>>(entry.content, { fallback: {} }) || {};
    if (entry.content_type === 'todo') {
      const group = todos.get(entry.selected_date) || [];
      group.push(entry);
      todos.set(entry.selected_date, group);
      continue;
    }
    const checkIn = entry.content_type === 'morning_check_in';
    const lines = checkIn ? [content.feeling, content.underneathIt] : [
      content.customFocus || content.focus || content.categoryName || content.category,
      content.personalText,
      ...(Array.isArray(content.priorities) ? content.priorities.map(priority => typeof priority === 'string' ? priority : priority?.text) : []),
    ];
    if (moments.some(moment => moment.id === entry.id)) {continue;}
    moments.push({ id: entry.id, pluginId: checkIn ? 'morningcheckin' : 'focus', title: checkIn ? 'How are you feeling?' : "Today's Focus", date: entry.selected_date, savedAt: entry.updated_at, lines: lines.filter(value => typeof value === 'string' && value.trim()), ...(checkIn && { feeling: content.feeling, feelingIcon: content.feelingIcon, feelingIconType: content.feelingIconType, underneathIt: content.underneathIt }) });
  }
  for (const [date, items] of todos) {
    moments.push({ id: `todos:${date}`, pluginId: 'todos', title: 'Todos', date, savedAt: items.map(item => item.updated_at).sort().reverse()[0], lines: items.map(item => {
      const content = safeJsonParse<Record<string, any>>(item.content, { fallback: {} }) || {};
      return `${item.completed ? '✓' : '○'} ${content.text || content.title || content.task || ''}`;
    }) });
  }
  const psalms = (await getAllLocalReflectionsByType('scripture')).filter(entry => !entry.deleted && (entry.source === 'morning_psalm' || entry.metadata?.source === 'morning_psalm'));
  const psalmByDate = new Map<string, typeof psalms[0]>();
  for (const entry of psalms) {
    const current = psalmByDate.get(entry.selected_date);
    if (!current || entry.updated_at.localeCompare(current.updated_at) > 0) {
      psalmByDate.set(entry.selected_date, entry);
    }
  }
  for (const entry of psalmByDate.values()) {
    const metadata = entry.metadata || {};
    moments.push({ id: entry.id, pluginId: 'morningpsalm', title: entry.title || `Psalm ${metadata.psalmNumber}`, date: entry.selected_date, savedAt: entry.updated_at, markedRead: metadata.psalmRead === true,
      reflection: entry.content || metadata.carry || '',
      observations: [...(Array.isArray(metadata.selectedAttributes) ? metadata.selectedAttributes : []), metadata.customAttribute].filter(value => typeof value === 'string' && value.trim()),
      lines: [
      metadata.psalmRead === true ? 'Passage read' : '',
      ...(Array.isArray(metadata.selectedAttributes) ? metadata.selectedAttributes : []),
      metadata.customAttribute,
      entry.content || metadata.carry,
    ].filter(value => typeof value === 'string' && value.trim()) });
  }
  return moments.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
};
