import React from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {Fonts} from '../../../theme/fonts';
import {triggerLightHaptic} from '../../../utils/haptics';
import {
  JOURNAL_BLOCK_GAP,
  JOURNAL_BLOCKS,
  JournalBlockIcon,
} from './journalBlocks';

const EMPTY_TABLE = [
  ['', ''],
  ['', ''],
];

export const JournalTableBlock = ({
  rows,
  editing,
  onChangeRows,
  onChangeEditing,
  onDelete,
  registerInput,
  onFocus,
  tone = 'default',
}: {
  rows?: string[][];
  editing?: boolean;
  onChangeRows: (rows: string[][]) => void;
  onChangeEditing: (editing: boolean) => void;
  onDelete: () => void;
  registerInput?: (input: TextInput | null) => void;
  onFocus?: () => void;
  tone?: 'default' | 'onDark';
}) => {
  const {width: screenWidth} = useWindowDimensions();
  const tableRows = rows?.length ? rows : EMPTY_TABLE;
  const onDark = tone === 'onDark';
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.65)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;
  const headerSurface = onDark
    ? 'rgba(220,232,222,0.14)'
    : Colors.anchorBlueLight;

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const nextRows = tableRows.map(row => [...row]);
    nextRows[rowIndex][columnIndex] = value;
    onChangeRows(nextRows);
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
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.editingGrid}>
            <View>
              {tableRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((cell, columnIndex) => (
                    <TextInput
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
                        },
                        row.length === 2 && {width: (screenWidth - 92) / 2},
                        rowIndex === 0 && styles.headerCell,
                      ]}
                      placeholder={rowIndex === 0 ? 'Heading' : ''}
                      placeholderTextColor={muted}
                      value={cell}
                      multiline
                      onChangeText={value =>
                        updateCell(rowIndex, columnIndex, value)
                      }
                      onFocus={onFocus}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.structureActions}>
            <TableAction
              icon="table-row-plus-after"
              label="Add row"
              color={accent}
              borderColor={border}
              backgroundColor={surface}
              onPress={() =>
                onChangeRows([
                  ...tableRows,
                  Array(tableRows[0]?.length || 2).fill(''),
                ])
              }
            />
            <TableAction
              icon="table-column-plus-after"
              label="Add column"
              color={accent}
              borderColor={border}
              backgroundColor={surface}
              onPress={() => onChangeRows(tableRows.map(row => [...row, '']))}
            />
            {tableRows.length > 2 && (
              <TableAction
                icon="table-row-remove"
                label="Remove last row"
                color={Colors.alertCoral}
                borderColor={border}
                backgroundColor={surface}
                onPress={() => onChangeRows(tableRows.slice(0, -1))}
              />
            )}
            {(tableRows[0]?.length || 0) > 2 && (
              <TableAction
                icon="table-column-remove"
                label="Remove last column"
                color={Colors.alertCoral}
                borderColor={border}
                backgroundColor={surface}
                onPress={() =>
                  onChangeRows(tableRows.map(row => row.slice(0, -1)))
                }
              />
            )}
          </View>
          <TouchableOpacity
            style={[styles.saveButton, {backgroundColor: accent}]}
            onPress={() => {
              triggerLightHaptic();
              Keyboard.dismiss();
              onChangeEditing(false);
            }}>
            <ThemedText
              weight="bold"
              style={[
                styles.saveButtonText,
                {color: onDark ? Colors.sage : Colors.hopeWhite},
              ]}>
              Save table
            </ThemedText>
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
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedGrid}>
            <View>
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
                        },
                        row.length === 2 && {width: (screenWidth - 92) / 2},
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
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  borderColor: string;
  backgroundColor: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.structureAction, {borderColor, backgroundColor}]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}>
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
  editingGrid: {flexGrow: 1, justifyContent: 'center', paddingTop: 14},
  savedGrid: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 9,
    paddingBottom: 3,
  },
  row: {flexDirection: 'row'},
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
    marginTop: 11,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
  },
  saveButtonText: {fontSize: 11},
});
