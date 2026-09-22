import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../../../theme/colors';

export const JOURNAL_BLOCK_GAP = 12;

export type JournalBlockKind =
  | 'text'
  | 'section'
  | 'action'
  | 'bullets'
  | 'numbered'
  | 'photo'
  | 'voice'
  | 'scripture'
  | 'key'
  | 'quote'
  | 'song'
  | 'outline'
  | 'character'
  | 'language'
  | 'link'
  | 'table'
  | 'history'
  | 'remember'
  | 'response'
  | 'question'
  | 'reflection_question'
  | 'revisit'
  | 'prayer'
  | 'book';
export type JournalOutlineStyle = 'numbered' | 'acronym' | 'simple';
export type JournalHistoryType =
  | 'era'
  | 'place'
  | 'culture'
  | 'custom'
  | 'politics';
export type JournalLanguageKind = 'hebrew' | 'greek' | 'aramaic' | 'latin';
export type JournalLanguageDetail =
  | 'meaning'
  | 'transliteration'
  | 'origin'
  | 'scripture';

export interface JournalBlock {
  id: string;
  kind: JournalBlockKind;
  text: string;
  secondary?: string;
  note?: string;
  reference?: string;
  scriptureText?: string;
  scriptureReference?: string;
  scriptureVersion?: string;
  outlineStyle?: JournalOutlineStyle;
  points?: string[];
  historyTypes?: JournalHistoryType[];
  eraPeriod?: 'BC' | 'AD';
  languageKind?: JournalLanguageKind;
  languageDetails?: JournalLanguageDetail[];
  meaning?: string;
  origin?: string;
  tableRows?: string[][];
  tableEditing?: boolean;
  uri?: string;
  durationMillis?: number;
  completed?: boolean;
}

export interface JournalBlockConfig {
  label: string;
  action: string;
  placeholder: string;
  icon: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
}

export type JournalBlockContent = {
  kind: string;
  text?: string;
  secondary?: string;
  note?: string;
  reference?: string;
  scriptureText?: string;
  scriptureReference?: string;
  meaning?: string;
  origin?: string;
  points?: string[];
  tableRows?: string[][];
  uri?: string;
};

export const hasMeaningfulJournalBlock = (block: JournalBlockContent) =>
  Boolean(
    block.text?.trim() ||
      block.secondary?.trim() ||
      block.note?.trim() ||
      block.reference?.trim() ||
      block.scriptureText?.trim() ||
      block.scriptureReference?.trim() ||
      block.meaning?.trim() ||
      block.origin?.trim() ||
      block.points?.some(point => point.trim()) ||
      block.tableRows?.some(row => row.some(cell => cell.trim())) ||
      block.uri,
  );

export const prepareJournalBlocksForSave = <T extends JournalBlockContent>(
  blocks: T[],
): T[] =>
  blocks
    .map(block => {
      if (block.kind !== 'bullets' && block.kind !== 'numbered') {
        return block;
      }
      return {
        ...block,
        points: (block.points || []).filter(point => point.trim()),
      } as T;
    })
    .filter(block => hasMeaningfulJournalBlock(block));

export const formatJournalAttribution = (value = '') => {
  if (!value) {
    return '';
  }
  return value.startsWith('—') ? value : `— ${value}`;
};

export const JOURNAL_BLOCKS: Record<
  Exclude<JournalBlockKind, 'text'>,
  JournalBlockConfig
> = {
  section: {
    label: 'SECTION',
    action: 'Section',
    placeholder: 'Section title',
    icon: 'text-outline',
  },
  action: {
    label: 'ACTION',
    action: 'Action',
    placeholder: 'Add an action item…',
    icon: 'checkbox-outline',
  },
  bullets: {
    label: 'Bullets',
    action: 'Bullets',
    placeholder: 'List item',
    icon: 'list-outline',
  },
  numbered: {
    label: 'Numbered',
    action: 'Numbered',
    placeholder: 'List item',
    icon: 'list-circle-outline',
  },
  photo: {
    label: 'PHOTO',
    action: 'Photo',
    placeholder: 'Add a caption…',
    icon: 'image-outline',
  },
  voice: {
    label: 'VOICE NOTE',
    action: 'Voice Note',
    placeholder: 'Add a note…',
    icon: 'mic-outline',
  },
  scripture: {
    label: 'SCRIPTURE',
    action: '+ Scripture',
    placeholder: 'Romans 12:1–2',
    icon: 'book-outline',
  },
  key: {
    label: 'KEY POINT',
    action: '★ Key Point',
    placeholder: 'What is the main idea?',
    icon: 'star-outline',
  },
  quote: {
    label: 'QUOTE',
    action: '“ ” Quote',
    placeholder: 'Write the speaker’s words…',
    icon: 'chatbox-outline',
  },
  song: {
    label: 'WORSHIP SONG',
    action: '♪ Worship Song',
    placeholder: 'Song title',
    icon: 'musical-note-outline',
  },
  outline: {
    label: 'MESSAGE OUTLINE',
    action: '☷ Outline',
    placeholder: 'Outline Title',
    icon: 'list-outline',
  },
  character: {
    label: 'BIBLE CHARACTER',
    action: '♙ Bible Character',
    placeholder: 'Name',
    icon: 'person-circle-outline',
  },
  language: {
    label: 'LANGUAGE NOTE',
    action: 'א Language Note',
    placeholder: 'Original Word',
    icon: 'translate',
    iconFamily: 'MaterialCommunityIcons',
  },
  link: {
    label: 'LINK',
    action: 'Link',
    placeholder: 'Paste or type a link',
    icon: 'link-outline',
  },
  table: {
    label: 'TABLE',
    action: '▦ Table',
    placeholder: '',
    icon: 'grid-outline',
  },
  history: {
    label: 'HISTORICAL CONTEXT',
    action: 'Historical Context',
    placeholder: 'Why does this background matter?',
    icon: 'map-outline',
  },
  remember: {
    label: 'REMEMBER',
    action: '♡ Remember',
    placeholder: 'What do you not want to forget?',
    icon: 'heart-outline',
  },
  response: {
    label: 'RESPONSE',
    action: '→ Response',
    placeholder: 'What do you want to put into practice?',
    icon: 'arrow-forward-outline',
  },
  question: {
    label: 'QUESTION',
    action: '? Question',
    placeholder: 'What question came up as you listened?',
    icon: 'help-circle-outline',
  },
  reflection_question: {
    label: 'REFLECTION QUESTION',
    action: '◆ Reflection Question',
    placeholder: 'What is the reflection question?',
    icon: 'chatbubbles-outline',
  },
  revisit: {
    label: 'REVISIT',
    action: '↻ Revisit',
    placeholder: 'What do you want to come back to later?',
    icon: 'refresh-outline',
  },
  prayer: {
    label: 'PRAYER',
    action: 'Prayer',
    placeholder: 'Turn this moment into prayer…',
    icon: 'leaf-outline',
  },
  book: {
    label: 'BOOK TO READ',
    action: '📕 Book to read',
    placeholder: 'Book title',
    icon: 'book-outline',
  },
};

export const SERMON_BLOCK_KINDS = [
  'section',
  'action',
  'bullets',
  'numbered',
  'photo',
  'voice',
  'character',
  'history',
  'key',
  'language',
  'link',
  'outline',
  'prayer',
  'question',
  'quote',
  'reflection_question',
  'remember',
  'response',
  'revisit',
  'scripture',
  'song',
  'book',
  'table',
] as const;
export const GENERIC_JOURNAL_BLOCK_KINDS = [
  'text',
  'scripture',
  'quote',
  'key',
  'remember',
  'question',
  'response',
] as const;

export const createJournalBlock = (
  kind: JournalBlockKind,
  id = `${Date.now()}-${Math.random()}`,
): JournalBlock => ({
  id,
  kind,
  text: '',
  ...(kind === 'outline'
    ? {outlineStyle: 'numbered' as const, points: ['', '', '']}
    : {}),
  ...(kind === 'history'
    ? {
        historyTypes: ['place'] as JournalHistoryType[],
        eraPeriod: 'AD' as const,
      }
    : {}),
  ...(kind === 'language'
    ? {
        languageKind: 'hebrew' as const,
        languageDetails: ['meaning'] as JournalLanguageDetail[],
      }
    : {}),
  ...(kind === 'table'
    ? {
        tableRows: [
          ['', ''],
          ['', ''],
        ],
        tableEditing: true,
      }
    : {}),
  ...(kind === 'action' ? {completed: false} : {}),
  ...(kind === 'bullets' || kind === 'numbered' ? {points: ['']} : {}),
  ...(kind === 'reflection_question' ? {note: ''} : {}),
});

export const JournalBlockIcon: React.FC<{
  config: JournalBlockConfig;
  size?: number;
  color?: string;
}> = ({config, size = 14, color = Colors.sage}) =>
  config.iconFamily === 'MaterialCommunityIcons' ? (
    <MaterialCommunityIcons
      name={config.icon as any}
      size={size}
      color={color}
    />
  ) : (
    <Ionicons name={config.icon as any} size={size} color={color} />
  );
