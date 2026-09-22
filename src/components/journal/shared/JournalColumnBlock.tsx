import React from 'react';
import {Pressable, StyleSheet, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  type JournalBlock,
} from './journalBlocks';

type ColumnSide = 'left' | 'right';

export const JournalColumnBlock = ({
  leftBlocks,
  rightBlocks,
  renderBlock,
  onSelectSide,
  onDelete,
  activeSide,
  tone = 'default',
}: {
  leftBlocks: JournalBlock[];
  rightBlocks: JournalBlock[];
  renderBlock: (block: JournalBlock) => React.ReactNode;
  onSelectSide: (side: ColumnSide) => void;
  onDelete: () => void;
  activeSide?: ColumnSide | null;
  tone?: 'default' | 'onDark';
}) => {
  const onDark = tone === 'onDark';
  const muted = onDark ? 'rgba(255,255,255,0.58)' : Colors.textGray;
  const border = onDark ? 'rgba(255,255,255,0.25)' : Colors.cardBorder;
  const activeSurface = onDark
    ? 'rgba(255,255,255,0.06)'
    : Colors.anchorBlueLight;

  const renderSide = (side: ColumnSide, blocks: JournalBlock[]) => {
    const selected = activeSide === side;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${side} column`}
        accessibilityState={{selected}}
        onPress={() => {
          triggerLightHaptic();
          onSelectSide(side);
        }}
        style={[
          styles.side,
          {
            backgroundColor: selected ? activeSurface : 'transparent',
          },
        ]}>
        {blocks.length ? (
          blocks.map(renderBlock)
        ) : (
          <ThemedText style={[styles.emptyText, {color: muted}]}>Tap to select</ThemedText>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <JournalBlockIcon
            config={JOURNAL_BLOCKS.column}
            size={14}
            color={onDark ? Colors.hopeWhite : Colors.sage}
          />
          <ThemedText
            weight="bold"
            style={[styles.title, {color: onDark ? Colors.hopeWhite : Colors.sage}]}>
            COLUMN
          </ThemedText>
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
      <View style={styles.columns}>
        {renderSide('left', leftBlocks)}
        <View style={[styles.divider, {backgroundColor: border}]} />
        {renderSide('right', rightBlocks)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginBottom: JOURNAL_BLOCK_GAP},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  title: {fontSize: 10, letterSpacing: 1.1},
  columns: {flexDirection: 'row', alignItems: 'stretch', gap: 8},
  divider: {width: 1},
  side: {
    flex: 1,
    minWidth: 0,
    minHeight: 116,
    padding: 8,
    borderRadius: 14,
  },
  emptyText: {fontSize: 11, lineHeight: 16, paddingVertical: 16, textAlign: 'center'},
});

export default JournalColumnBlock;
