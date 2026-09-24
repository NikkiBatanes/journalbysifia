import {Colors} from '../../../theme/colors';
import type {JournalBlockKind} from './noteBlockRegistry';

/** Existing editor names are accepted while screens migrate to semantic names. */
export type NoteBlockTone = 'cream' | 'sage' | 'default' | 'onDark';
export type ResolvedNoteBlockTone = 'cream' | 'sage';

export const NOTE_BLOCK_METRICS = {
  gap: 12,
  radius: 14,
  compactRadius: 12,
  padding: 12,
  compactPadding: 9,
  headerGap: 6,
  labelSize: 10,
  labelLineHeight: 14,
  labelLetterSpacing: 1.1,
  bodySize: 14,
  bodyLineHeight: 21,
  secondarySize: 12,
  secondaryLineHeight: 18,
  sectionTitleSize: 18,
  sectionDividerWidth: 32,
  sectionDividerThickness: 2,
  sectionDividerGap: 10,
} as const;

export interface NoteBlockVisuals {
  tone: ResolvedNoteBlockTone;
  foreground: string;
  muted: string;
  accent: string;
  border: string;
  surface: string;
  headerSurface: string;
  placeholder: string;
  emphasisBorder?: string;
}

export const resolveNoteBlockTone = (
  tone: NoteBlockTone = 'cream',
): ResolvedNoteBlockTone =>
  tone === 'sage' || tone === 'onDark' ? 'sage' : 'cream';

const creamSemanticSurface = (
  kind: JournalBlockKind,
): Pick<NoteBlockVisuals, 'surface' | 'border' | 'emphasisBorder'> => {
  switch (kind) {
    case 'scripture':
      return {surface: Colors.anchorBlueLight, border: '#D4DDD4'};
    case 'key':
    case 'response':
      return {
        surface: '#EDF1EC',
        border: '#D7DED7',
        emphasisBorder: Colors.sage,
      };
    case 'remember':
    case 'song':
      return {surface: '#F1F2ED', border: '#DCE1DA'};
    case 'book':
      return {surface: '#F0F2ED', border: '#D9E0D9'};
    case 'quote':
    case 'revisit':
      return {surface: '#F4F3ED', border: Colors.cardBorder};
    case 'character':
      return {surface: '#F2F1EB', border: '#DEE1D9'};
    case 'language':
      return {surface: '#EAEFEA', border: '#D5DED6'};
    case 'history':
      return {surface: '#EEF1EC', border: '#DAE0D8'};
    case 'reflection_question':
      return {surface: '#E9F0EA', border: '#D3DED4'};
    case 'prayer':
      return {surface: '#E9EEE9', border: '#D4DDD5'};
    default:
      return {surface: Colors.cardBackground, border: Colors.cardBorder};
  }
};

const sageSemanticSurface = (
  kind: JournalBlockKind,
): Pick<NoteBlockVisuals, 'surface' | 'border' | 'emphasisBorder'> => {
  switch (kind) {
    case 'scripture':
      return {
        surface: 'rgba(220,232,222,0.14)',
        border: 'rgba(229,238,230,0.34)',
      };
    case 'key':
    case 'response':
      return {
        surface: 'rgba(237,241,236,0.16)',
        border: 'rgba(226,235,227,0.34)',
        emphasisBorder: Colors.hopeWhite,
      };
    case 'remember':
      return {
        surface: 'rgba(241,242,237,0.10)',
        border: 'rgba(231,235,228,0.30)',
      };
    case 'quote':
    case 'revisit':
      return {
        surface: 'rgba(244,243,237,0.08)',
        border: 'rgba(244,243,237,0.28)',
      };
    default:
      return {
        surface: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.24)',
      };
  }
};

export const getNoteBlockVisuals = (
  kind: JournalBlockKind,
  tone: NoteBlockTone = 'cream',
): NoteBlockVisuals => {
  const resolvedTone = resolveNoteBlockTone(tone);
  const semantic =
    resolvedTone === 'sage'
      ? sageSemanticSurface(kind)
      : creamSemanticSurface(kind);

  return {
    tone: resolvedTone,
    foreground: resolvedTone === 'sage' ? Colors.hopeWhite : Colors.text,
    muted: resolvedTone === 'sage' ? 'rgba(255,255,255,0.65)' : Colors.textGray,
    accent: resolvedTone === 'sage' ? Colors.hopeWhite : Colors.sage,
    headerSurface:
      resolvedTone === 'sage'
        ? 'rgba(220,232,222,0.14)'
        : Colors.anchorBlueLight,
    placeholder:
      resolvedTone === 'sage' ? 'rgba(255,255,255,0.45)' : Colors.textGray,
    ...semantic,
  };
};
