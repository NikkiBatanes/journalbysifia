import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../common/ThemedText';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  NOTE_BLOCK_REGISTRY,
  type JournalBlockKind,
} from './noteBlockRegistry';
import {
  NOTE_BLOCK_METRICS,
  getNoteBlockVisuals,
  type NoteBlockTone,
} from './noteBlockTheme';
import {JournalBlockIcon} from './journalBlocks';

export const NoteBlockFrame = ({
  kind,
  tone = 'cream',
  compact = false,
  headerContent,
  onDelete,
  onLayout,
  style,
  children,
}: {
  kind: JournalBlockKind;
  tone?: NoteBlockTone;
  compact?: boolean;
  headerContent?: React.ReactNode;
  onDelete?: () => void;
  onLayout?: (layout: {y: number; height: number}) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) => {
  const definition = NOTE_BLOCK_REGISTRY[kind];
  const visuals = getNoteBlockVisuals(kind, tone);

  return (
    <View
      style={[
        styles.frame,
        compact && styles.compactFrame,
        style,
        {backgroundColor: visuals.surface, borderColor: visuals.border},
        visuals.emphasisBorder && {
          borderLeftWidth: 3,
          borderLeftColor: visuals.emphasisBorder,
        },
      ]}
      onLayout={event => onLayout?.(event.nativeEvent.layout)}>
      <View style={[styles.header, compact && styles.compactHeader]}>
        {headerContent || (
          <View style={styles.labelRow}>
            <JournalBlockIcon
              config={definition}
              size={compact ? 12 : 14}
              color={visuals.accent}
            />
            <ThemedText
              weight="bold"
              style={[
                styles.label,
                compact && styles.compactLabel,
                {color: visuals.accent},
              ]}>
              {definition.label}
            </ThemedText>
          </View>
        )}
        {onDelete ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${definition.pickerLabel} block`}
            onPress={() => {
              triggerLightHaptic();
              onDelete();
            }}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons
              name="close"
              size={compact ? 15 : 17}
              color={visuals.muted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: NOTE_BLOCK_METRICS.radius,
    padding: NOTE_BLOCK_METRICS.padding,
    marginBottom: NOTE_BLOCK_METRICS.gap,
  },
  compactFrame: {
    borderRadius: NOTE_BLOCK_METRICS.compactRadius,
    padding: NOTE_BLOCK_METRICS.compactPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactHeader: {minHeight: 18},
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: NOTE_BLOCK_METRICS.headerGap,
  },
  label: {
    fontSize: NOTE_BLOCK_METRICS.labelSize,
    lineHeight: NOTE_BLOCK_METRICS.labelLineHeight,
    letterSpacing: NOTE_BLOCK_METRICS.labelLetterSpacing,
  },
  compactLabel: {fontSize: 8, lineHeight: 11, letterSpacing: 0.8},
});

export default NoteBlockFrame;
