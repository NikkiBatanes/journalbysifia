import React, { useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';

export type FilterKey =
  | 'upcoming'
  | 'unansweredPrayers'
  | 'answeredPrayers'
  | 'reflectionJournals'
  | 'prayers'
  | 'gratitude'
  | 'todaysWin'
  | 'planCarousel';

export const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'unansweredPrayers', label: 'Unanswered Prayers' },
  { key: 'answeredPrayers', label: 'Answered Prayers' },
  { key: 'reflectionJournals', label: 'Reflection Journals' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'todaysWin', label: 'Wins' },
  { key: 'planCarousel', label: 'Planner' },
];

interface FilterSelectProps {
  values: FilterKey[];
  onChange: (values: FilterKey[]) => void;
  compact?: boolean;
}

export type FilterSelectHandle = { open: () => void };

const FilterSelect = forwardRef<FilterSelectHandle, FilterSelectProps>(({ values, onChange, compact = false }, ref) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const fontMedium = getFontFamily(fontKey, 'medium');
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  const count = values.length;
  const buttonLabel = useMemo(() => (count > 0 ? `Filter (${count})` : 'Filter'), [count]);

  const toggle = (key: FilterKey) => {
    triggerLightHaptic();
    const exists = values.includes(key);
    const next = exists ? values.filter(k => k !== key) : [...values, key];
    // If both answered+unanswered selected, treat as all prayers -> allow both; renderer will interpret
    onChange(next);
  };

  const clearAll = () => { triggerLightHaptic(); onChange([]); };

  return (
    <View>
      <TouchableOpacity style={[styles.button, compact && styles.buttonCompact]} onPress={() => { triggerLightHaptic(); setOpen(true); }}>
        <Ionicons name="options-outline" size={compact ? 14 : 16} color={Colors.hopeWhite} />
        <ThemedText style={[styles.buttonText, compact && styles.buttonTextCompact, { fontFamily: fontMedium }]}>{buttonLabel}</ThemedText>
        <Ionicons name="chevron-down" size={compact ? 14 : 16} color={Colors.hopeWhite} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText weight="semiBold" style={[styles.sheetTitle, { fontFamily: fontMedium }]}>Select Filters</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {count > 0 && (
                  <TouchableOpacity onPress={clearAll}>
                    <ThemedText style={[styles.clearText, { fontFamily: fontMedium }]}>Clear</ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { triggerLightHaptic(); setOpen(false); }}>
                  <Ionicons name="close" size={22} color={Colors.hopeWhite} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={FILTER_OPTIONS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const active = values.includes(item.key);
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.activeOption]}
                    onPress={() => toggle(item.key)}
                  >
                    <ThemedText style={[styles.optionText, { fontFamily: fontRegular }]}>{item.label}</ThemedText>
                    {active && <Ionicons name="checkmark" size={18} color={Colors.hopeWhite} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  buttonCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    borderRadius: 6,
  },
  buttonText: { color: Colors.hopeWhite, fontSize: 13 },
  buttonTextCompact: { fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '88%', maxHeight: '70%', backgroundColor: Colors.anchorBlue, borderRadius: 30, padding: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, color: Colors.hopeWhite },
  clearText: { color: Colors.hopeWhite, opacity: 0.8 },
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeOption: { backgroundColor: Colors.alertCoral },
  optionText: { color: Colors.hopeWhite, fontSize: 14 },
});

export default FilterSelect;
