import type { LocalJournalEntry } from '../storage/journalStorage';
import { getAllLocalJournalEntries } from '../storage/journalStorage';
import type { LocalReflectionEntry } from '../storage/reflectionStorage';
import { getAllLocalReflectionsByType } from '../storage/reflectionStorage';
import type { LocalPrayerEntry } from '../storage/prayerStorage';
import { PrayerApi } from './api/prayerApi';
import { getSavedBibleStudyReflections, parseSavedBibleStudy } from '../storage/bibleStudyMomentsStorage';
import {
  hasMeaningfulCheckIn,
  hasMeaningfulFocus,
  hasMeaningfulGratitude,
  hasMeaningfulLookingForward,
  hasMeaningfulPriorities,
  hasMeaningfulScriptureReflection,
  hasMeaningfulWin,
} from './dailyRhythmCardState';
import { groupPrayerEntries, prayerMomentType } from '../utils/prayerMoments';
import { trackingStatus } from '../utils/prayerTracking';
import type { MorningMoment } from '../storage/morningMomentsStorage';
import { heartJournalClassificationLabel } from '../types/heartJournal';
import { resolveSessionNoteType, sessionNoteSearchMetadata, sessionNoteTypeLabel } from '../types/sessionNotes';
import { adaptSifiaPrayer, adaptSifiaReflection } from '../compatibility/sifiaReadCompatibility';

export type MomentTimelineKind = 'morning' | 'evening' | 'bible_study' | 'scripture_note' | 'sermon' | 'reflection' | 'prayer';
export type MomentCanonicalSource = 'journal' | 'reflection' | 'prayer';
export type RoutineSectionKind = 'check_in' | 'psalm' | 'focus' | 'priorities' | 'gratitude' | 'win' | 'proverbs' | 'looking_forward';

export interface MomentRoutineSection {
  kind: RoutineSectionKind;
  label: string;
  canonicalSource: 'journal' | 'reflection';
  canonicalIds: string[];
  lines: string[];
  journalEntries?: LocalJournalEntry[];
  reflection?: LocalReflectionEntry;
  presentation?: MorningMoment;
}

export interface MomentTimelineItem {
  key: string;
  kind: MomentTimelineKind;
  selectedDate: string;
  canonicalSource: MomentCanonicalSource;
  canonicalIds: string[];
  searchText: string;
  savedAt: string;
  preview: { title: string; lines: string[]; sections?: MomentRoutineSection[] };
  navigation?: { screen: string; params?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  reflection?: LocalReflectionEntry;
  prayers?: any[];
}

export interface MomentTimelineInput {
  journalEntries: LocalJournalEntry[];
  reflections: LocalReflectionEntry[];
  bibleStudies: LocalReflectionEntry[];
  prayers: LocalPrayerEntry[];
}

const parseJournalContent = (entry: LocalJournalEntry | null | undefined): Record<string, any> => {
  if (!entry?.content) return {};
  try { return typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content; }
  catch { return {}; }
};

const text = (...values: unknown[]): string[] => values.flatMap(value => Array.isArray(value) ? value : [value])
  .map(value => typeof value === 'string' ? value.trim() : value && typeof value === 'object' ? Object.values(value).flat(Infinity).filter(part => typeof part === 'string').join(' ').trim() : '')
  .filter(Boolean);

const newest = <T extends { updated_at: string }>(entries: T[]): T | undefined =>
  [...entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

const itemSearchText = (title: string, lines: string[]): string => `${title} ${lines.join(' ')}`.replace(/\s+/g, ' ').trim().toLowerCase();
const serverIds = (records: Array<{ server_id?: string | null }>): string[] => records.map(record => record.server_id).filter((id): id is string => !!id);

export const buildMomentTimeline = ({ journalEntries, reflections, bibleStudies, prayers }: MomentTimelineInput): MomentTimelineItem[] => {
  const result: MomentTimelineItem[] = [];
  const journalsByDate = new Map<string, LocalJournalEntry[]>();
  journalEntries.filter(entry => !entry.deleted).forEach(entry => {
    const group = journalsByDate.get(entry.selected_date) || [];
    group.push(entry); journalsByDate.set(entry.selected_date, group);
  });
  const scriptureByDate = new Map<string, LocalReflectionEntry[]>();
  reflections.filter(entry => !entry.deleted && entry.type === 'scripture').forEach(entry => {
    const group = scriptureByDate.get(entry.selected_date) || [];
    group.push(entry); scriptureByDate.set(entry.selected_date, group);
  });

  const routineDates = new Set([...journalsByDate.keys(), ...scriptureByDate.keys()]);
  routineDates.forEach(selectedDate => {
    const dayJournal = journalsByDate.get(selectedDate) || [];
    const dayScripture = scriptureByDate.get(selectedDate) || [];
    const checkIn = newest(dayJournal.filter(entry => entry.content_type === 'morning_check_in')) || null;
    const focus = newest(dayJournal.filter(entry => entry.content_type === 'todays_focus')) || null;
    const todos = dayJournal.filter(entry => entry.content_type === 'todo');
    const psalm = newest(dayScripture.filter(entry => entry.source === 'morning_psalm' || entry.metadata?.source === 'morning_psalm'));
    const gratitude = dayJournal.filter(entry => entry.content_type === 'gratitude');
    const win = newest(dayJournal.filter(entry => entry.content_type === 'today_win')) || null;
    const lookingForward = newest(dayJournal.filter(entry => entry.content_type === 'looking_forward')) || null;
    const proverbs = newest(dayScripture.filter(entry => entry.source === 'evening_proverbs' || entry.metadata?.source === 'evening_proverbs'));

    const morningSections: MomentRoutineSection[] = [];
    if (hasMeaningfulCheckIn(checkIn)) {
      const content = parseJournalContent(checkIn);
      const lines = text(content.feeling, content.underneathIt);
      morningSections.push({ kind: 'check_in', label: 'Check-In', canonicalSource: 'journal', canonicalIds: [checkIn!.id], journalEntries: [checkIn!], lines, presentation: { id: checkIn!.id, pluginId: 'morningcheckin', title: 'How are you feeling?', date: selectedDate, savedAt: checkIn!.updated_at, lines, feeling: content.feeling, feelingIcon: content.feelingIcon, feelingIconType: content.feelingIconType, underneathIt: content.underneathIt, scripture: content.scripture } });
    }
    if (hasMeaningfulScriptureReflection(psalm, 'psalmRead')) {
      const observations = text(psalm?.metadata?.selectedAttributes, psalm?.metadata?.customAttribute);
      const lines = text(psalm?.metadata?.psalmRead ? 'Passage read' : '', observations, psalm?.content, psalm?.metadata?.carry);
      morningSections.push({ kind: 'psalm', label: psalm?.title || 'Psalm', canonicalSource: 'reflection', canonicalIds: [psalm!.id], reflection: psalm, lines, presentation: { id: psalm!.id, pluginId: 'morningpsalm', title: psalm?.title || `Psalm ${psalm?.metadata?.psalmNumber || ''}`, date: selectedDate, savedAt: psalm!.updated_at, lines, markedRead: psalm?.metadata?.psalmRead === true, reflection: psalm?.content || psalm?.metadata?.carry || '', observations } });
    }
    if (hasMeaningfulFocus(focus)) {
      const content = parseJournalContent(focus);
      morningSections.push({ kind: 'focus', label: 'Set Focus', canonicalSource: 'journal', canonicalIds: [focus!.id], journalEntries: [focus!], lines: text(content.customFocus, content.focus, content.categoryName, content.focusCategory, content.personalText) });
    }
    if (hasMeaningfulPriorities(focus, todos)) {
      const priorities = Array.isArray(parseJournalContent(focus).priorities) ? parseJournalContent(focus).priorities : [];
      morningSections.push({ kind: 'priorities', label: 'Priorities', canonicalSource: 'journal', canonicalIds: [...(focus ? [focus.id] : []), ...todos.map(todo => todo.id)], journalEntries: [...(focus ? [focus] : []), ...todos], lines: text(priorities.map((priority: any) => priority?.text), todos.map(todo => parseJournalContent(todo).text)) });
    }
    if (morningSections.length) {
      const ids = Array.from(new Set(morningSections.flatMap(section => section.canonicalIds)));
      const lines = morningSections.flatMap(section => section.lines);
      const savedAt = newest([...dayJournal, ...dayScripture])?.updated_at || `${selectedDate}T00:00:00.000Z`;
      result.push({ key: `morning:${selectedDate}`, kind: 'morning', selectedDate, canonicalSource: 'journal', canonicalIds: ids, savedAt, preview: { title: 'Morning', lines, sections: morningSections }, searchText: itemSearchText('Morning', lines), metadata: { sectionKinds: morningSections.map(section => section.kind), serverIds: serverIds([...dayJournal, ...dayScripture]) } });
    }

    const eveningSections: MomentRoutineSection[] = [];
    if (hasMeaningfulGratitude(gratitude)) {
      const lines = gratitude.flatMap(entry => text(parseJournalContent(entry).items));
      eveningSections.push({ kind: 'gratitude', label: 'Gratitude', canonicalSource: 'journal', canonicalIds: gratitude.map(entry => entry.id), journalEntries: gratitude, lines });
    }
    if (hasMeaningfulWin(win)) {
      const content = parseJournalContent(win);
      const lines = text(content.winTypeName, content.quietWin);
      eveningSections.push({ kind: 'win', label: "Today's Win", canonicalSource: 'journal', canonicalIds: [win!.id], journalEntries: [win!], lines, presentation: { id: win!.id, pluginId: 'eveningwin', title: "Today's Win", date: selectedDate, savedAt: win!.updated_at, lines, winType: content.winTypeName, quietWin: content.quietWin } });
    }
    if (hasMeaningfulScriptureReflection(proverbs, 'proverbRead')) {
      const wisdomSelections = Array.isArray(proverbs?.metadata?.selectedWisdom)
        ? proverbs!.metadata!.selectedWisdom.map((wisdom: any) => typeof wisdom === 'string' ? { id: wisdom, label: wisdom, verses: '', prompt: '', application: '' } : {
          id: wisdom?.id || wisdom?.label || '', label: wisdom?.label || '', verses: wisdom?.verses || '', prompt: wisdom?.prompt || '', application: proverbs?.metadata?.wisdomApplications?.[wisdom?.id] || '',
        }).filter((wisdom: any) => wisdom.label)
        : [];
      const observations = text(wisdomSelections.map((wisdom: any) => wisdom.label), proverbs?.metadata?.customWisdom);
      const lines = text(proverbs?.metadata?.proverbRead ? 'Passage read' : '', observations, proverbs?.metadata?.wisdomApplication, proverbs?.metadata?.wisdomApplications, proverbs?.content);
      eveningSections.push({ kind: 'proverbs', label: proverbs?.title || 'Proverbs', canonicalSource: 'reflection', canonicalIds: [proverbs!.id], reflection: proverbs, lines, presentation: { id: proverbs!.id, pluginId: 'eveningproverb', title: proverbs?.title || `Proverbs ${proverbs?.metadata?.proverbNumber || ''}`, date: selectedDate, savedAt: proverbs!.updated_at, lines, markedRead: proverbs?.metadata?.proverbRead === true, reflection: proverbs?.metadata?.wisdomApplication || proverbs?.content || '', observations, wisdomSelections } });
    }
    if (hasMeaningfulLookingForward(lookingForward)) {
      const content = parseJournalContent(lookingForward);
      const lines = text(content.emotionName, content.customEmotion, content.entry?.text);
      eveningSections.push({ kind: 'looking_forward', label: 'Looking Forward', canonicalSource: 'journal', canonicalIds: [lookingForward!.id], journalEntries: [lookingForward!], lines, presentation: { id: lookingForward!.id, pluginId: 'lookingforward', title: 'Looking Forward To', date: selectedDate, savedAt: lookingForward!.updated_at, lines, emotionName: content.emotionName, emotionIcon: content.emotionIcon, lookingForwardText: content.entry?.text, customEmotion: content.customEmotion } });
    }
    if (eveningSections.length) {
      const ids = Array.from(new Set(eveningSections.flatMap(section => section.canonicalIds)));
      const lines = eveningSections.flatMap(section => section.lines);
      const savedAt = newest([...dayJournal, ...dayScripture])?.updated_at || `${selectedDate}T00:00:00.000Z`;
      result.push({ key: `evening:${selectedDate}`, kind: 'evening', selectedDate, canonicalSource: 'journal', canonicalIds: ids, savedAt, preview: { title: 'Evening', lines, sections: eveningSections }, searchText: itemSearchText('Evening', lines), metadata: { sectionKinds: eveningSections.map(section => section.kind), serverIds: serverIds([...dayJournal, ...dayScripture]) } });
    }
  });

  const bibleIds = new Set(bibleStudies.map(entry => entry.id));
  bibleStudies.forEach(reflection => {
    const content = parseSavedBibleStudy(reflection);
    if (!content) return;
    const lines = text(reflection.title, content.observation.text, content.understanding.text, content.response.text, content.prayer.text, content.highlights.map(highlight => highlight.text));
    result.push({ key: `reflection:bible-study:${reflection.id}`, kind: 'bible_study', selectedDate: reflection.selected_date, canonicalSource: 'reflection', canonicalIds: [reflection.id], savedAt: reflection.updated_at, preview: { title: reflection.title || 'Bible Study', lines }, searchText: itemSearchText('Bible Study', lines), reflection, metadata: { serverIds: serverIds([reflection]) }, navigation: { screen: 'BibleStudy', params: { reflectionId: reflection.id, selectedDate: reflection.selected_date } } });
  });

  reflections
    .filter(entry => !entry.deleted && entry.type === 'scripture' && entry.source === 'scripture_note' && !bibleIds.has(entry.id))
    .forEach(reflection => {
      const lines = text(reflection.title, reflection.content, reflection.metadata?.book, reflection.metadata?.chapter_verse);
      result.push({
        key: `reflection:scripture-note:${reflection.id}`,
        kind: 'scripture_note',
        selectedDate: reflection.selected_date,
        canonicalSource: 'reflection',
        canonicalIds: [reflection.id],
        savedAt: reflection.updated_at,
        preview: { title: reflection.title || 'Scripture Note', lines },
        searchText: itemSearchText('Scripture Note', lines),
        reflection,
        metadata: { serverIds: serverIds([reflection]) },
        navigation: { screen: 'ScriptureNoteEditor', params: { reflectionId: reflection.id, selectedDate: reflection.selected_date } },
      });
    });

  reflections.filter(entry => !entry.deleted && entry.type !== 'scripture' && !bibleIds.has(entry.id)).forEach(reflection => {
    const isSermon = reflection.type === 'sermon' || reflection.source === 'sermon_notes';
    const compatibility = adaptSifiaReflection(reflection);
    const documentLabel = isSermon ? sessionNoteTypeLabel(resolveSessionNoteType(reflection)) : 'Reflection';
    const lines = isSermon
      ? text(reflection.title, reflection.content, sessionNoteSearchMetadata(reflection.metadata))
      : text(heartJournalClassificationLabel(reflection.metadata?.journalClassification), compatibility.title, compatibility.content, compatibility.contextLines, reflection.metadata);
    result.push({ key: `reflection:${isSermon ? 'sermon' : compatibility.origin}:${reflection.id}`, kind: isSermon ? 'sermon' : 'reflection', selectedDate: reflection.selected_date, canonicalSource: 'reflection', canonicalIds: [reflection.id], savedAt: reflection.updated_at, preview: { title: reflection.title || (isSermon ? documentLabel : compatibility.title), lines }, searchText: itemSearchText(isSermon ? documentLabel : compatibility.title, lines), reflection, metadata: { serverIds: serverIds([reflection]), compatibilityOrigin: compatibility.origin, originalType: compatibility.originalType, originalSource: compatibility.originalSource, relationships: compatibility.relationships }, navigation: { screen: isSermon ? 'SermonNotes' : 'ReflectionEditor', params: { reflectionId: reflection.id, selectedDate: reflection.selected_date, readCompatibilityOrigin: compatibility.origin } } });
  });

  groupPrayerEntries(prayers.filter(prayer => !prayer.deleted) as any).forEach(prayer => {
    const underlying = Array.isArray((prayer as any).groupedEntries) ? (prayer as any).groupedEntries : [prayer];
    const ids = underlying.map((entry: any) => entry.id).filter(Boolean);
    const selectedDate = (prayer as any).selected_date;
    if (!selectedDate || !ids.length) return;
    const compatibility = adaptSifiaPrayer(prayer as any);
    const lines = text((prayer as any).title, (prayer as any).person_name, compatibility.content, (prayer as any).notes, (prayer as any).metadata?.topics, compatibility.contextLines);
    result.push({ key: ids.length > 1 ? `prayer:cast:${(prayer as any).metadata?.prayer_session_id || ids.join(':')}` : `prayer:${ids[0]}`, kind: 'prayer', selectedDate, canonicalSource: 'prayer', canonicalIds: ids, savedAt: (prayer as any).updated_at || (prayer as any).created_at, preview: { title: prayerMomentType(prayer), lines }, searchText: compatibility.searchText || itemSearchText('Prayer', lines), prayers: [prayer], metadata: { answered: trackingStatus(prayer) === 'answered', isPrayerRequest: (prayer as any).is_prayer_request === true, status: trackingStatus(prayer), serverIds: serverIds(underlying), compatibilityOrigin: compatibility.origin, relationships: compatibility.relationships } });
  });

  const seen = new Set<string>();
  return result.filter(item => !seen.has(item.key) && !!seen.add(item.key))
    .sort((a, b) => b.selectedDate.localeCompare(a.selectedDate) || b.savedAt.localeCompare(a.savedAt));
};

export const getCanonicalMomentTimeline = async (): Promise<MomentTimelineItem[]> => {
  const reflectionTypes = ['scripture', 'sermon', 'free', 'freeform', 'free-form', 'guided', 'thought', 'thoughts', 'devotional', 'playbook', 'reflection', 'gospel_anniversary'];
  const [journalEntries, bibleStudies, prayers, ...reflectionGroups] = await Promise.all([
    getAllLocalJournalEntries(),
    getSavedBibleStudyReflections(),
    PrayerApi.getAllPrayers('local') as Promise<LocalPrayerEntry[]>,
    ...reflectionTypes.map(type => getAllLocalReflectionsByType(type)),
  ]);
  const byId = new Map<string, LocalReflectionEntry>();
  reflectionGroups.flat().forEach(entry => byId.set(entry.id, entry));
  return buildMomentTimeline({ journalEntries, bibleStudies, prayers, reflections: [...byId.values()] });
};
