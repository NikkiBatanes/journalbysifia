import React, {useRef} from 'react';
import {StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../common/ThemedText';
import {useTheme} from '../../../hooks/useTheme';
import {getFontFamily} from '../../../theme/fonts';
import {Colors} from '../../../theme/colors';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
} from './journalBlocks';

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
  const onDark = tone === 'onDark';
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.48)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;
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
    <View style={[styles.block, {borderColor: border, backgroundColor: surface}]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <JournalBlockIcon config={config} size={14} color={accent} />
          <TextInput
            ref={registerInput}
            value={title || ''}
            onChangeText={onChangeTitle}
            onFocus={onFocus}
            onSubmitEditing={() => inputs.current.get(0)?.focus()}
            placeholder="Add a title…"
            placeholderTextColor={muted}
            selectionColor={accent}
            cursorColor={accent}
            returnKeyType="next"
            style={[
              styles.titleInput,
              {color: foreground, fontFamily: titleFontFamily},
            ]}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            onDelete();
          }}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="close" size={17} color={muted} />
        </TouchableOpacity>
      </View>

      {items.map((item, index) => (
        <View key={`${kind}-${index}`} style={styles.itemRow}>
          <ThemedText weight="semiBold" style={[styles.marker, {color: accent}]}>
            {kind === 'numbered' ? `${index + 1}.` : '•'}
          </ThemedText>
          <TextInput
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
            selectionColor={accent}
            cursorColor={accent}
            returnKeyType="next"
            submitBehavior="submit"
            multiline
            style={[styles.input, {color: foreground, fontFamily}]}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    marginBottom: JOURNAL_BLOCK_GAP,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
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
