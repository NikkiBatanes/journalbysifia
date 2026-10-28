import React, {useMemo} from 'react';
import {StyleProp, StyleSheet, Text, TextStyle} from 'react-native';

import type {FormattedScripturePassage} from '../../services/scripturePassageFormatting';

interface Props {
  passage: FormattedScripturePassage;
  textStyle?: StyleProp<TextStyle>;
  fontSize: number;
  verseNumberFontFamily?: string;
}

const ScriptureInlinePassageText: React.FC<Props> = ({passage, textStyle, fontSize, verseNumberFontFamily}) => {
  const verseNumberStyle = useMemo(() => ([
    styles.inlineVerseNumber,
    {
      fontSize: Math.max(9, fontSize * 0.52),
      letterSpacing: 0.8,
      fontFamily: verseNumberFontFamily,
    },
  ]), [fontSize, verseNumberFontFamily]);

  const parts = useMemo(() => {
    const styledRanges = [
      ...passage.verseNumberRanges.map(range => ({...range, kind: 'verse' as const})),
      ...passage.wordsOfJesusRanges.map(range => ({...range, kind: 'jesus' as const})),
    ]
      .filter(range => range.start < passage.text.length && range.end > 0)
      .sort((a, b) => a.start - b.start);

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    styledRanges.forEach(range => {
      if (range.start > cursor) {
        nodes.push(passage.text.slice(cursor, range.start));
      }
      const value = passage.text.slice(range.start, range.end);
      if (range.kind === 'verse') {
        nodes.push(
          <Text key={`verse-${range.start}`} style={verseNumberStyle}>
            {value}
          </Text>,
        );
      } else {
        nodes.push(
          <Text key={`jesus-${range.start}`} style={styles.wordsOfJesus}>
            {value}
          </Text>,
        );
      }
      cursor = Math.max(cursor, range.end);
    });
    if (cursor < passage.text.length) {
      nodes.push(passage.text.slice(cursor));
    }
    return nodes;
  }, [passage, verseNumberStyle]);

  return <Text style={textStyle}>{parts}</Text>;
};

const styles = StyleSheet.create({
  inlineVerseNumber: {
    color: 'rgba(90, 98, 93, 0.62)',
  },
  wordsOfJesus: {
    color: '#9B1C1C',
  },
});

export default ScriptureInlinePassageText;
