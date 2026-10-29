import type {ScriptureTextSegment, ScriptureVerse} from './scriptureReaderService';

export interface ScriptureTextRange {
  start: number;
  end: number;
}

export interface FormattedScripturePassage {
  text: string;
  verseNumberRanges: ScriptureTextRange[];
  wordsOfJesusRanges: ScriptureTextRange[];
  verseGapRanges: ScriptureTextRange[];
  poetryLayout: boolean;
}

export const usesPoetryLayout = (reference: string): boolean =>
  /^(?:psalms?|proverbs)\b/i.test(reference.trim());

const segmentsMatchLine = (
  line: string,
  segments: ScriptureTextSegment[] | undefined,
): segments is ScriptureTextSegment[] =>
  !!segments?.length && segments.map(segment => segment.text).join('') === line;

export const formatScripturePassage = (
  verses: ScriptureVerse[] | undefined,
  reference: string,
  fallbackText = '',
): FormattedScripturePassage => {
  const poetryLayout = usesPoetryLayout(reference);
  const verseSeparator = poetryLayout ? '\n' : ' ';
  const lineSeparator = ' ';
  const verseNumberRanges: ScriptureTextRange[] = [];
  const wordsOfJesusRanges: ScriptureTextRange[] = [];
  const verseGapRanges: ScriptureTextRange[] = [];
  let text = '';

  if (!verses?.length) {
    return {
      text: fallbackText,
      verseNumberRanges,
      wordsOfJesusRanges,
      verseGapRanges,
      poetryLayout,
    };
  }

  verses.forEach((verse, verseIndex) => {
    if (verseIndex > 0) {
      text += verseSeparator;
      // Short spacer line between verses: rendered tiny so the gap stays tight.
      if (poetryLayout) {
        const gapStart = text.length;
        text += ' \n';
        verseGapRanges.push({start: gapStart, end: text.length});
      }
    }

    if (verse.number) {
      const start = text.length;
      text += verse.number;
      verseNumberRanges.push({start, end: text.length});
      if (verse.lines.length) { text += ' '; }
    }

    verse.lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) { text += lineSeparator; }
      const segments = verse.segments?.[lineIndex];

      if (!segmentsMatchLine(line, segments)) {
        text += line;
        return;
      }

      segments.forEach(segment => {
        const start = text.length;
        text += segment.text;
        if (segment.wordsOfJesus && text.length > start) {
          wordsOfJesusRanges.push({start, end: text.length});
        }
      });
    });
  });

  return {text, verseNumberRanges, wordsOfJesusRanges, verseGapRanges, poetryLayout};
};
