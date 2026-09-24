import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../../../theme/colors';
import {
  NOTE_BLOCK_REGISTRY,
  getGenericInlineBlockDefinitions,
  getNoteBlockDefinitionsForContext,
  isJournalBlockKind,
  type JournalBlockConfig,
  type JournalBlockKind,
} from './noteBlockRegistry';

export {
  JOURNAL_BLOCK_KIND_IDS,
  NOTE_BLOCK_CATEGORIES,
  NOTE_BLOCK_CONTEXTS,
  NOTE_BLOCK_REGISTRY,
  getGenericInlineBlockDefinitions,
  getNoteBlockDefinitionsForContext,
  isBlockAllowedInContext,
  isJournalBlockKind,
} from './noteBlockRegistry';
export type {
  JournalBlockConfig,
  JournalBlockKind,
  JournalBlockKindForContext,
  NoteBlockCategory,
  NoteBlockContext,
  NoteBlockDefinition,
  NoteBlockRenderMode,
  SelectableJournalBlockKind,
} from './noteBlockRegistry';
export {
  NOTE_BLOCK_METRICS,
  getNoteBlockVisuals,
  resolveNoteBlockTone,
} from './noteBlockTheme';
export type {
  NoteBlockTone,
  NoteBlockVisuals,
  ResolvedNoteBlockTone,
} from './noteBlockTheme';

export const JOURNAL_BLOCK_GAP = 12;

export type JournalOutlineStyle = 'numbered' | 'acronym' | 'simple';
export type JournalTableAlignment = 'left' | 'center' | 'right';
export type JournalTableCellAlignments =
  | JournalTableAlignment[][]
  | JournalTableAlignment[];
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
  tableCellAlignments?: JournalTableCellAlignments;
  tableEditing?: boolean;
  uri?: string;
  durationMillis?: number;
  completed?: boolean;
  sectionSource?: 'outline';
  parentColumnId?: string;
  columnSide?: 'left' | 'right';
}

export type JournalBlockContent = {
  id?: string;
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
  tableCellAlignments?: JournalTableCellAlignments;
  uri?: string;
  sectionSource?: 'outline';
  parentColumnId?: string;
  columnSide?: 'left' | 'right';
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
): T[] => {
  const sanitized = blocks
    .map(block => {
      if (block.kind !== 'bullets' && block.kind !== 'numbered') {
        return block;
      }
      return {
        ...block,
        points: (block.points || []).filter(point => point.trim()),
      } as T;
    });
  const meaningfulChildren = sanitized.filter(
    block => block.kind !== 'column' && hasMeaningfulJournalBlock(block),
  );
  const populatedColumnIds = new Set(
    meaningfulChildren
      .map(block => block.parentColumnId)
      .filter((id): id is string => Boolean(id)),
  );
  return sanitized.filter(block =>
    block.kind === 'column'
      ? Boolean(block.id && populatedColumnIds.has(block.id))
      : hasMeaningfulJournalBlock(block),
  );
};

export const formatJournalAttribution = (value = '') => {
  if (!value) {
    return '';
  }
  return value.startsWith('—') ? value : `— ${value}`;
};

export const getJournalTableCellAlignment = (
  alignments: JournalTableCellAlignments | undefined,
  rowIndex: number,
  columnIndex: number,
): JournalTableAlignment => {
  const alignmentOrRow = alignments?.[rowIndex];
  if (Array.isArray(alignmentOrRow)) {
    return alignmentOrRow[columnIndex] || 'left';
  }

  // Tables saved before per-cell alignment stored one value per column.
  const legacyColumnAlignment = alignments?.[columnIndex];
  return typeof legacyColumnAlignment === 'string'
    ? legacyColumnAlignment
    : 'left';
};

export const resolveJournalTableCellAlignments = (
  rows: string[][],
  alignments?: JournalTableCellAlignments,
): JournalTableAlignment[][] =>
  rows.map((row, rowIndex) =>
    row.map((_, columnIndex) =>
      getJournalTableCellAlignment(alignments, rowIndex, columnIndex),
    ),
  );

/**
 * Search/export fallback for structured notes. The structured block array
 * remains canonical, while this projection keeps every meaningful field
 * readable by legacy consumers that only understand journal text.
 */
export const journalBlocksToPlainText = (
  blocks: readonly JournalBlockContent[],
): string =>
  blocks
    .map(block => {
      const text = block.text?.trim();
      const secondary = block.secondary?.trim();
      const reference = block.reference?.trim();
      const label = isJournalBlockKind(block.kind)
        ? NOTE_BLOCK_REGISTRY[block.kind].label
        : block.kind.toUpperCase();

      if (block.kind === 'column') {
        return '';
      }
      if (block.kind === 'table') {
        return (block.tableRows || [])
          .map(row => row.map(cell => cell.trim()).join('\t'))
          .join('\n');
      }
      if (block.kind === 'bullets' || block.kind === 'numbered') {
        const list = (block.points || [])
          .filter(point => point.trim())
          .map((point, index) =>
            block.kind === 'numbered'
              ? `${index + 1}. ${point.trim()}`
              : `• ${point.trim()}`,
          );
        return [text, ...list].filter(Boolean).join('\n');
      }
      if (block.kind === 'text') {
        return text || '';
      }
      if (block.kind === 'scripture') {
        return [
          label,
          block.scriptureReference?.trim() || reference || text,
          block.scriptureText?.trim(),
        ]
          .filter(Boolean)
          .join('\n');
      }
      if (block.kind === 'outline') {
        return [label, text, ...(block.points || []).map(point => point.trim())]
          .filter(Boolean)
          .join('\n');
      }
      if (block.kind === 'history') {
        return [label, secondary, block.note?.trim(), reference]
          .filter(Boolean)
          .join('\n');
      }
      if (block.kind === 'language') {
        return [
          label,
          text,
          block.meaning?.trim(),
          secondary,
          block.origin?.trim(),
          reference,
        ]
          .filter(Boolean)
          .join('\n');
      }
      if (block.kind === 'character') {
        return [label, text, block.note?.trim(), secondary || reference]
          .filter(Boolean)
          .join('\n');
      }
      if (block.kind === 'reflection_question') {
        return [label, text, block.note?.trim()].filter(Boolean).join('\n');
      }
      return [label, reference, text, secondary, block.note?.trim()]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

/** Backwards-compatible name used throughout the current editor code. */
export const JOURNAL_BLOCKS = NOTE_BLOCK_REGISTRY;

export const SERMON_BLOCK_KINDS = getNoteBlockDefinitionsForContext('session')
  .map(definition => definition.kind) as Array<Exclude<JournalBlockKind, 'text'>>;

export const GENERIC_JOURNAL_BLOCK_KINDS = [
  'text' as const,
  ...getGenericInlineBlockDefinitions().map(definition => definition.kind),
];

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
        tableCellAlignments: [
          ['left', 'left'],
          ['left', 'left'],
        ] as JournalTableAlignment[][],
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
