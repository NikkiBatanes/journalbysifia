import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalJournalEntry } from './journalStorage';
import { getAllLocalReflectionsByType } from './reflectionStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { MorningMoment } from './morningMomentsStorage';

export const getEveningMoments = async (): Promise<MorningMoment[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    /^journal_local_singleton:(today_win|looking_forward):/.test(key) ||
    /^journal_local:(gratitude|today_win|looking_forward):/.test(key),
  );
  const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const entries = rows.map(([, raw]) => safeJsonParse<LocalJournalEntry>(raw || '', { fallback: null }))
    .filter((entry): entry is LocalJournalEntry => !!entry && !entry.deleted);
  const moments: MorningMoment[] = [];

  for (const entry of entries) {
    const content = safeJsonParse<Record<string, any>>(entry.content, { fallback: {} }) || {};
    let title = 'Evening';
    let lines: string[] = [];
    let pluginId = 'evening';

    if (entry.content_type === 'gratitude') {
      title = 'Gratitude';
      pluginId = 'eveninggratitude';
      lines = (Array.isArray(content.items) ? content.items : []).filter((item: any) => typeof item === 'string' && item.trim());
    } else if (entry.content_type === 'today_win') {
      title = "Today's Win";
      pluginId = 'eveningwin';
      lines = [
        content.winTypeName,
        content.quietWin,
      ].filter(value => typeof value === 'string' && value.trim());
    } else if (entry.content_type === 'looking_forward') {
      title = 'Looking Forward To';
      pluginId = 'lookingforward';
      lines = [
        content.emotionName,
        content.customEmotion,
        content.entry?.text,
      ].filter(value => typeof value === 'string' && value.trim());
    }

    if (moments.some(moment => moment.id === entry.id)) {continue;}
    moments.push({
      id: entry.id,
      pluginId,
      title,
      date: entry.selected_date,
      savedAt: entry.updated_at,
      lines,
      ...(entry.content_type === 'today_win' && {
        winType: typeof content.winTypeName === 'string' ? content.winTypeName : '',
        quietWin: typeof content.quietWin === 'string' ? content.quietWin : '',
      }),
      ...(entry.content_type === 'looking_forward' && {
        emotionName: typeof content.emotionName === 'string' ? content.emotionName : '',
        emotionIcon: typeof content.emotionIcon === 'string' ? content.emotionIcon : '',
        lookingForwardText: typeof content.entry?.text === 'string' ? content.entry.text : '',
        customEmotion: typeof content.customEmotion === 'string' ? content.customEmotion : '',
      }),
    });
  }

  const proverbs = (await getAllLocalReflectionsByType('scripture')).filter(entry =>
    !entry.deleted && (entry.source === 'evening_proverbs' || entry.metadata?.source === 'evening_proverbs'),
  );
  const proverbByDate = new Map<string, typeof proverbs[0]>();
  for (const entry of proverbs) {
    const current = proverbByDate.get(entry.selected_date);
    if (!current || entry.updated_at.localeCompare(current.updated_at) > 0) {
      proverbByDate.set(entry.selected_date, entry);
    }
  }

  for (const entry of proverbByDate.values()) {
    const metadata = entry.metadata || {};
    const content = typeof entry.content === 'string' ? entry.content : '';
    const wisdomSelections = Array.isArray(metadata.selectedWisdom)
      ? metadata.selectedWisdom.map((wisdom: any) => typeof wisdom === 'string' ? {
          id: wisdom,
          label: wisdom,
          verses: '',
          prompt: '',
          application: '',
        } : {
          id: typeof wisdom?.id === 'string' ? wisdom.id : '',
          label: typeof wisdom?.label === 'string' ? wisdom.label : '',
          verses: typeof wisdom?.verses === 'string' ? wisdom.verses : '',
          prompt: typeof wisdom?.prompt === 'string' ? wisdom.prompt : '',
          application: typeof metadata.wisdomApplications?.[wisdom?.id] === 'string' ? metadata.wisdomApplications[wisdom.id] : '',
        }).filter((wisdom: any) => wisdom.label)
      : [];
    const selectedWisdom = wisdomSelections.map((wisdom: any) => wisdom.label);
    const application = typeof metadata.wisdomApplication === 'string' && metadata.wisdomApplication.trim()
      ? metadata.wisdomApplication
      : wisdomSelections.length ? '' : content;

    moments.push({
      id: entry.id,
      pluginId: 'eveningproverb',
      title: entry.title || `Proverbs ${metadata.proverbNumber || ''}`,
      date: entry.selected_date,
      savedAt: entry.updated_at,
      markedRead: metadata.proverbRead === true,
      reflection: application,
      observations: selectedWisdom,
      wisdomSelections,
      lines: [
        metadata.proverbRead === true ? 'Passage read' : '',
        ...selectedWisdom,
        content,
      ].filter(value => typeof value === 'string' && value.trim()),
    });
  }

  return moments.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
};
