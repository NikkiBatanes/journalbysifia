import React, {useMemo} from 'react';
import {Animated, StyleProp, StyleSheet, Text, TextStyle, View} from 'react-native';

import type {FormattedScripturePassage} from '../../services/scripturePassageFormatting';

interface Props {
  passage: FormattedScripturePassage;
  textStyle?: StyleProp<TextStyle>;
  fontSize: number;
  verseNumberFontFamily?: string;
  verseNumberColor?: string;
  // Poetry only: render each verse as its own animated block (bouncy entrance
  // staggered verse-by-verse). Only safe outside a parent Text — selectable
  // passages must keep the single-text layout.
  staggeredEntrance?: boolean;
  verseSpacing?: number;
}

const ScriptureInlinePassageText: React.FC<Props> = ({passage, textStyle, fontSize, verseNumberFontFamily, verseNumberColor, staggeredEntrance, verseSpacing}) => {
  const verseNumberStyle = useMemo(() => ([
    styles.inlineVerseNumber,
    verseNumberColor ? {color: verseNumberColor} : null,
    {
      fontSize: Math.max(9, fontSize * 0.52),
      letterSpacing: 0.8,
      fontFamily: verseNumberFontFamily,
    },
  ]), [fontSize, verseNumberFontFamily, verseNumberColor]);

  const verseGapStyle = useMemo(() => ([
    {
      fontSize: Math.max(5, fontSize * 0.3),
      lineHeight: Math.max(6, fontSize * 0.35),
    },
  ]), [fontSize]);

  const parts = useMemo(() => {
    const styledRanges = [
      ...passage.verseNumberRanges.map(range => ({...range, kind: 'verse' as const})),
      ...passage.wordsOfJesusRanges.map(range => ({...range, kind: 'jesus' as const})),
      ...(passage.verseGapRanges ?? []).map(range => ({...range, kind: 'gap' as const})),
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
      } else if (range.kind === 'gap') {
        nodes.push(
          <Text key={`gap-${range.start}`} style={verseGapStyle}>
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
  }, [passage, verseNumberStyle, verseGapStyle]);

  const verseBlocks = useMemo(() => {
    if (!passage.poetryLayout || !staggeredEntrance) { return null; }
    const groups: React.ReactNode[][] = [[]];
    let key = 0;
    parts.forEach(node => {
      const isElement = React.isValidElement(node);
      const style = isElement ? (node.props as { style?: StyleProp<TextStyle> }).style : undefined;
      const value = String(isElement ? (node.props as { children?: React.ReactNode }).children : node);
      value.split('\n').forEach((piece, index) => {
        if (index > 0) { groups.push([]); }
        if (!piece) { return; }
        groups[groups.length - 1].push(
          style ? <Text key={key++} style={style}>{piece}</Text> : piece,
        );
      });
    });
    // Drop spacer-only groups (' \n' verse gaps) — spacing comes from margins.
    return groups.filter(group =>
      group.some(node => typeof node !== 'string' || node.trim().length > 0),
    );
  }, [parts, passage.poetryLayout, staggeredEntrance]);

  if (verseBlocks) {
    return (
      <View>
        {verseBlocks.map((nodes, index) => (
          <VerseBlockPop key={index} delay={index * 90}>
            <Text
              style={[
                textStyle,
                index < verseBlocks.length - 1 && verseSpacing ? {marginBottom: verseSpacing} : null,
              ]}
            >
              {nodes}
            </Text>
          </VerseBlockPop>
        ))}
      </View>
    );
  }

  return <Text style={textStyle}>{parts}</Text>;
};

const VerseBlockPop: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.spring(anim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    });
    const timer = setTimeout(() => animation.start(), delay);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
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
