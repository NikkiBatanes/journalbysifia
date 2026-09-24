import React, {useRef} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';

import ThemedText from '../../common/ThemedText';
import JournalTextInput from './JournalTextInput';
import {useTheme} from '../../../hooks/useTheme';
import {getFontFamily} from '../../../theme/fonts';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
} from './journalBlocks';
import {getNoteBlockVisuals} from './noteBlockTheme';
import NoteBlockFrame from './NoteBlockFrame';

type ListKind = 'bullets' | 'numbered';

export const JournalListBlock = ({
  kind,
  title,
  points,
  onChangeTitle,
  onChangePoints,
  onDelete,
  registerInput,
  onFocus,
  tone = 'default',
}: {
  kind: ListKind;
  title?: string;
  points?: string[];
  onChangeTitle: (title: string) => void;
  onChangePoints: (points: string[]) => void;
  onDelete: () => void;
  registerInput?: (input: TextInput | null) => void;
  onFocus?: () => void;
  tone?: 'default' | 'onDark';
}) => {
  const inputs = useRef(new Map<number, TextInput>());
  const {currentFont} = useTheme();
  const fontFamily = getFontFamily(currentFont || 'lexend', 'regular');
  const titleFontFamily = getFontFamily(currentFont || 'lexend', 'bold');
  const items = points?.length ? points : [''];
  const visuals = getNoteBlockVisuals(kind, tone);
  const foreground = visuals.foreground;
  const muted = visuals.muted;
  const accent = visuals.accent;
  const config = JOURNAL_BLOCKS[kind];

  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChangePoints(next);
  };

  const addAfter = (index: number) => {
    if (!items[index]?.trim()) {
      return;
    }
    const next = [...items];
    next.splice(index + 1, 0, '');
    onChangePoints(next);
    requestAnimationFrame(() => inputs.current.get(index + 1)?.focus());
  };

  const removeEmptyItem = (index: number) => {
    if (items[index] || items.length === 1) {
      return;
    }
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChangePoints(next);
    requestAnimationFrame(() => inputs.current.get(Math.max(0, index - 1))?.focus());
  };

  return (
    <NoteBlockFrame
      kind={kind}
      tone={tone}
      style={styles.block}
      onDelete={onDelete}
      headerContent={
        <View style={styles.labelRow}>
          <JournalBlockIcon config={config} size={14} color={accent} />
          <JournalTextInput
            ref={registerInput}
            value={title || ''}
            onChangeText={onChangeTitle}
            onFocus={onFocus}
            onSubmitEditing={() => inputs.current.get(0)?.focus()}
            placeholder="Add a title…"
            placeholderTextColor={muted}
            accentColor={accent}
            returnKeyType="next"
            style={[
              styles.titleInput,
              {color: foreground, fontFamily: titleFontFamily},
            ]}
          />
        </View>
      }>

      {items.map((item, index) => (
        <View key={`${kind}-${index}`} style={styles.itemRow}>
          <ThemedText weight="semiBold" style={[styles.marker, {color: accent}]}>
            {kind === 'numbered' ? `${index + 1}.` : '•'}
          </ThemedText>
          <JournalTextInput
            ref={input => {
              if (input) {
                inputs.current.set(index, input);
              } else {
                inputs.current.delete(index);
              }
            }}
            value={item}
            onChangeText={value => updateItem(index, value)}
            onSubmitEditing={() => addAfter(index)}
            onKeyPress={({nativeEvent}) => {
              if (nativeEvent.key === 'Backspace') {
                removeEmptyItem(index);
              }
            }}
            onFocus={onFocus}
            placeholder="List item"
            placeholderTextColor={muted}
            accentColor={accent}
            returnKeyType="next"
            submitBehavior="submit"
            multiline
            style={[styles.input, {color: foreground, fontFamily}]}
          />
        </View>
      ))}
    </NoteBlockFrame>
  );
};

const styles = StyleSheet.create({
  block: {
    marginBottom: JOURNAL_BLOCK_GAP,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  labelRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7},
  titleInput: {flex: 1, paddingVertical: 2, fontSize: 15, lineHeight: 21},
  itemRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  marker: {width: 23, paddingTop: 9, fontSize: 14, textAlign: 'right'},
  input: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 7,
    fontSize: 14,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
});

export default JournalListBlock;
