import React from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../common/ThemedText';
import JournalTextInput from './JournalTextInput';
import {Colors} from '../../../theme/colors';
import {Fonts} from '../../../theme/fonts';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  resolveJournalTableCellAlignments,
  type JournalTableAlignment,
  type JournalTableCellAlignments,
} from './journalBlocks';

const EMPTY_TABLE = [
  ['', ''],
  ['', ''],
];

export const JournalTableBlock = ({
  rows,
  cellAlignments,
  editing,
  onChangeRows,
  onChangeCellAlignments,
  onChangeEditing,
  onDelete,
  registerInput,
  onFocus,
  tone = 'default',
}: {
  rows?: string[][];
  cellAlignments?: JournalTableCellAlignments;
  editing?: boolean;
  onChangeRows: (
    rows: string[][],
    cellAlignments?: JournalTableAlignment[][],
  ) => void;
  onChangeCellAlignments: (alignments: JournalTableAlignment[][]) => void;
  onChangeEditing: (editing: boolean) => void;
  onDelete: () => void;
  registerInput?: (input: TextInput | null) => void;
  onFocus?: () => void;
  tone?: 'default' | 'onDark';
}) => {
  const tableRows = rows?.length ? rows : EMPTY_TABLE;
  const columnCount = tableRows[0].length;
  const [activeCell, setActiveCell] = React.useState({
    rowIndex: 0,
    columnIndex: 0,
  });
  const selectedRowIndex = Math.min(
    activeCell.rowIndex,
    Math.max(tableRows.length - 1, 0),
  );
  const selectedColumnIndex = Math.min(
    activeCell.columnIndex,
    Math.max((tableRows[selectedRowIndex]?.length || 1) - 1, 0),
  );
  const resolvedAlignments = resolveJournalTableCellAlignments(
    tableRows,
    cellAlignments,
  );
  const fitsWidth = (columnCount === 2 || columnCount === 3) &&
    tableRows.every(row => row.length === columnCount);
  const fittedCellStyle = fitsWidth && {width: `${100 / columnCount}%` as const};
  const onDark = tone === 'onDark';
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.65)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;
  const headerSurface = onDark
    ? 'rgba(220,232,222,0.14)'
    : Colors.anchorBlueLight;
  const activeAlignmentSurface = onDark
    ? 'rgba(255,255,255,0.14)'
    : Colors.anchorBlueLight;

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const nextRows = tableRows.map(row => [...row]);
    nextRows[rowIndex][columnIndex] = value;
    onChangeRows(nextRows);
  };

  const updateCellAlignment = (alignment: JournalTableAlignment) => {
    const nextAlignments = resolvedAlignments.map(row => [...row]);
    nextAlignments[selectedRowIndex][selectedColumnIndex] = alignment;
    triggerLightHaptic();
    onChangeCellAlignments(nextAlignments);
  };

  return (
    <View style={[styles.capture, {borderColor: border, backgroundColor: surface}]}>
      <View style={styles.captureHeader}>
        <View style={styles.captureLabelRow}>
          <JournalBlockIcon
            config={JOURNAL_BLOCKS.table}
            size={14}
            color={accent}
          />
          <ThemedText weight="bold" style={[styles.captureLabel, {color: accent}]}>
            {JOURNAL_BLOCKS.table.label}
          </ThemedText>
        </View>
        {editing && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onDelete();
            }}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="close" size={17} color={muted} />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <>
          <ScrollView
            horizontal
            style={styles.horizontalScroll}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!fitsWidth}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.editingGrid,
              fitsWidth && styles.fullWidthGrid,
            ]}>
            <View style={fitsWidth && styles.fullWidthGrid}>
              {tableRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((cell, columnIndex) => (
                    <JournalTextInput
                      key={columnIndex}
                      ref={input => {
                        if (rowIndex === 0 && columnIndex === 0) {
                          registerInput?.(input);
                        }
                      }}
                      style={[
                        styles.editingCell,
                        {
                          color: foreground,
                          borderColor: border,
                          backgroundColor:
                            rowIndex === 0 ? headerSurface : 'transparent',
                          textAlign:
                            resolvedAlignments[rowIndex][columnIndex],
                        },
                        fittedCellStyle,
                        rowIndex === 0 && styles.headerCell,
                      ]}
                      placeholder={rowIndex === 0 ? 'Heading' : ''}
                      placeholderTextColor={muted}
                      accentColor={accent}
                      value={cell}
                      multiline
                      onChangeText={value =>
                        updateCell(rowIndex, columnIndex, value)
                      }
                      onFocus={() => {
                        setActiveCell({rowIndex, columnIndex});
                        onFocus?.();
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.alignmentRow}>
            <ThemedText weight="bold" style={[styles.alignmentLabel, {color: muted}]}>
              CELL {selectedRowIndex + 1}, {selectedColumnIndex + 1}
            </ThemedText>
            <View style={styles.alignmentActions}>
              {(['left', 'center', 'right'] as const).map(alignment => {
                const selected =
                  resolvedAlignments[selectedRowIndex][selectedColumnIndex] ===
                  alignment;
                return (
                  <TableAction
                    key={alignment}
                    icon={`format-align-${alignment}`}
                    label={`Align cell row ${selectedRowIndex + 1} column ${selectedColumnIndex + 1} ${alignment}`}
                    color={accent}
                    borderColor={selected ? accent : border}
                    backgroundColor={selected ? activeAlignmentSurface : surface}
                    selected={selected}
                    onPress={() => updateCellAlignment(alignment)}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.structureActions}>
            <TableAction
              icon="table-row-plus-after"
              label="Add row"
              color={accent}
              borderColor={border}
              backgroundColor={surface}
              onPress={() => {
                triggerLightHaptic();
                const emptyRow = Array(tableRows[0]?.length || 2).fill('');
                const rowAlignments = Array(
                  tableRows[0]?.length || 2,
                ).fill('left');
                onChangeRows(
                  [...tableRows, emptyRow],
                  [...resolvedAlignments, rowAlignments],
                );
              }}
            />
            <TableAction
              icon="table-column-plus-after"
              label="Add column"
              color={accent}
              borderColor={border}
              backgroundColor={surface}
              onPress={() => {
                triggerLightHaptic();
                onChangeRows(
                  tableRows.map(row => [...row, '']),
                  resolvedAlignments.map(row => [...row, 'left']),
                );
              }}
            />
            {tableRows.length > 2 && (
              <TableAction
                icon="table-row-remove"
                label="Remove last row"
                color={Colors.alertCoral}
                borderColor={border}
                backgroundColor={surface}
                onPress={() => {
                  triggerLightHaptic();
                  onChangeRows(
                    tableRows.slice(0, -1),
                    resolvedAlignments.slice(0, -1),
                  );
                }}
              />
            )}
            {(tableRows[0]?.length || 0) > 2 && (
              <TableAction
                icon="table-column-remove"
                label="Remove last column"
                color={Colors.alertCoral}
                borderColor={border}
                backgroundColor={surface}
                onPress={() => {
                  triggerLightHaptic();
                  onChangeRows(
                    tableRows.map(row => row.slice(0, -1)),
                    resolvedAlignments.map(row => row.slice(0, -1)),
                  );
                }}
              />
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Save table"
            style={[
              styles.saveButton,
              {
                borderColor: onDark ? 'rgba(255,255,255,0.28)' : border,
                backgroundColor: onDark
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.anchorBlueLight,
              },
            ]}
            onPress={() => {
              triggerLightHaptic();
              Keyboard.dismiss();
              onChangeEditing(false);
            }}>
            <Ionicons name="checkmark" size={17} color={accent} />
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Edit table"
          onPress={() => onChangeEditing(true)}>
          <ScrollView
            horizontal
            style={styles.horizontalScroll}
            scrollEnabled={!fitsWidth}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.savedGrid,
              fitsWidth && styles.fullWidthGrid,
            ]}>
            <View style={fitsWidth && styles.fullWidthGrid}>
              {tableRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((cell, columnIndex) => (
                    <ThemedText
                      key={columnIndex}
                      weight={rowIndex === 0 ? 'bold' : 'regular'}
                      style={[
                        styles.savedCell,
                        {
                          color: foreground,
                          borderColor: border,
                          backgroundColor:
                            rowIndex === 0 ? headerSurface : 'transparent',
                          textAlign:
                            resolvedAlignments[rowIndex][columnIndex],
                        },
                        fittedCellStyle,
                      ]}>
                      {cell}
                    </ThemedText>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </TouchableOpacity>
      )}
    </View>
  );
};

const TableAction = ({
  icon,
  label,
  color,
  borderColor,
  backgroundColor,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  borderColor: string;
  backgroundColor: string;
  selected?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.structureAction, {borderColor, backgroundColor}]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={selected === undefined ? undefined : {selected}}>
    <MaterialCommunityIcons name={icon as any} size={18} color={color} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  capture: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: JOURNAL_BLOCK_GAP,
  },
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  captureLabel: {fontSize: 10, letterSpacing: 1.2},
  horizontalScroll: {marginHorizontal: -12},
  editingGrid: {flexGrow: 1, paddingTop: 14},
  savedGrid: {
    flexGrow: 1,
    paddingTop: 9,
    paddingBottom: 3,
  },
  row: {flexDirection: 'row'},
  fullWidthGrid: {width: '100%'},
  editingCell: {
    width: 126,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlignVertical: 'top',
  },
  headerCell: {minHeight: 40, fontFamily: Fonts.bold},
  savedCell: {
    width: 126,
    minHeight: 34,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderWidth: 0.5,
    fontSize: 12,
    lineHeight: 17,
  },
  alignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  alignmentLabel: {fontSize: 9, letterSpacing: 0.8},
  alignmentActions: {flexDirection: 'row', alignItems: 'center', gap: 7},
  structureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    marginTop: 9,
  },
  structureAction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 17,
  },
  saveButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    marginTop: 11,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
