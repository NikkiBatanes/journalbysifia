import React from 'react';
import {StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../common/ThemedText';
import JournalTextInput from './JournalTextInput';
import ReflectionSpecialBlock from '../ReflectionSpecialBlock';
import {Colors} from '../../../theme/colors';
import {
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  formatJournalAttribution,
  type JournalBlock,
} from './journalBlocks';
import JournalListBlock from './JournalListBlock';
import {JournalTableBlock} from './JournalTableBlock';

export const JournalNestedBlockEditor = ({
  block,
  onChange,
  onDelete,
  onFocus,
  registerInput,
  tone = 'default',
}: {
  block: JournalBlock;
  onChange: (changes: Partial<JournalBlock>) => void;
  onDelete: () => void;
  onFocus: () => void;
  registerInput?: (input: TextInput | null) => void;
  tone?: 'default' | 'onDark';
}) => {
  if (block.kind === 'bullets' || block.kind === 'numbered') {
    return (
      <JournalListBlock
        kind={block.kind}
        title={block.text}
        points={block.points}
        tone={tone}
        onFocus={onFocus}
        onChangeTitle={text => onChange({text})}
        onChangePoints={points => onChange({points})}
        onDelete={onDelete}
        registerInput={registerInput}
      />
    );
  }
  if (block.kind === 'table') {
    return (
      <JournalTableBlock
        rows={block.tableRows}
        cellAlignments={block.tableCellAlignments}
        editing={block.tableEditing}
        tone={tone}
        onFocus={onFocus}
        onChangeRows={(tableRows, tableCellAlignments) =>
          onChange({
            tableRows,
            ...(tableCellAlignments ? {tableCellAlignments} : {}),
          })
        }
        onChangeCellAlignments={tableCellAlignments =>
          onChange({tableCellAlignments})
        }
        onChangeEditing={tableEditing => onChange({tableEditing})}
        onDelete={onDelete}
        registerInput={registerInput}
      />
    );
  }
  if (['section', 'action', 'photo', 'voice'].includes(block.kind)) {
    return (
      <ReflectionSpecialBlock
        block={block}
        tone={tone}
        onFocus={onFocus}
        onChange={onChange}
        onDelete={onDelete}
        registerInput={registerInput || (() => undefined)}
      />
    );
  }

  const onDark = tone === 'onDark';
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.48)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;

  if (block.kind === 'text') {
    return (
      <View style={styles.textRow}>
        <JournalTextInput themed
          ref={registerInput}
          value={block.text}
          onChangeText={text => onChange({text})}
          onFocus={onFocus}
          multiline
          placeholder="Write…"
          placeholderTextColor={muted}
          accentColor={accent}
          style={[styles.textInput, {color: foreground}]}
        />
        <TouchableOpacity onPress={onDelete} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Ionicons name="close" size={15} color={muted} />
        </TouchableOpacity>
      </View>
    );
  }

  const config = JOURNAL_BLOCKS[block.kind];
  return (
    <View style={[styles.block, {borderColor: border, backgroundColor: surface}]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <JournalBlockIcon config={config} size={12} color={accent} />
          <ThemedText weight="bold" style={[styles.label, {color: accent}]}>
            {config.label}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Ionicons name="close" size={15} color={muted} />
        </TouchableOpacity>
      </View>
      <JournalTextInput themed
        ref={registerInput}
        value={block.text}
        onChangeText={text => onChange({text})}
        onFocus={onFocus}
        multiline
        placeholder={config.placeholder || 'Write…'}
        placeholderTextColor={muted}
        accentColor={accent}
        style={[
          styles.input,
          {color: foreground},
          block.kind === 'quote' && styles.quoteInput,
        ]}
      />
      {block.kind === 'quote' && (
        <JournalTextInput themed
          value={formatJournalAttribution(block.secondary)}
          onChangeText={secondary =>
            onChange({secondary: formatJournalAttribution(secondary)})
          }
          onFocus={onFocus}
          placeholder="— Speaker / Author"
          placeholderTextColor={muted}
          accentColor={accent}
          style={[styles.secondaryInput, {color: foreground}]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  textRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 10},
  textInput: {flex: 1, minHeight: 46, fontSize: 13, lineHeight: 19, paddingVertical: 5},
  block: {borderWidth: 1, borderRadius: 12, padding: 9, marginBottom: 10},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  labelRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5},
  label: {fontSize: 8, letterSpacing: 0.8},
  input: {minHeight: 48, paddingTop: 7, fontSize: 12, lineHeight: 18, textAlignVertical: 'top'},
  quoteInput: {fontSize: 14, lineHeight: 20},
  secondaryInput: {paddingTop: 5, fontSize: 10, lineHeight: 15},
});

export default JournalNestedBlockEditor;
