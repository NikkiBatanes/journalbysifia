import React, { useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
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
  | 'prayerRequests'
  | 'gratitude'
  | 'todaysWin'
  | 'planCarousel';

export const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'unansweredPrayers', label: 'Unanswered Prayers' },
  { key: 'answeredPrayers', label: 'Answered Prayers' },
  { key: 'reflectionJournals', label: 'Reflection Journals' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'prayerRequests', label: 'Prayer Requests' },
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
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText weight="medium" style={[styles.sheetTitle, { fontFamily: fontMedium }]}>SELECT FILTERS</ThemedText>
              {count > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
                  <ThemedText weight="medium" style={[styles.clearText, { fontFamily: fontMedium }]}>Clear</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.optionsGrid}>
              {FILTER_OPTIONS.map((item) => {
                const active = values.includes(item.key);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.optionPill, active && styles.activeOptionPill]}
                    onPress={() => toggle(item.key)}
                  >
                    <ThemedText weight={active ? 'semiBold' : 'medium'} style={[styles.optionPillText, active && styles.activeOptionPillText, { fontFamily: fontMedium }]}>
                      {item.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: Colors.anchorBlue, borderRadius: 24, padding: 20, maxWidth: 320, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 16, color: Colors.hopeWhite, textTransform: 'uppercase' },
  clearButton: { padding: 4 },
  clearText: { color: Colors.hopeWhite, opacity: 0.8, fontSize: 14 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeOptionPill: { backgroundColor: Colors.alertCoral, borderColor: Colors.alertCoral },
  optionPillText: { color: Colors.hopeWhite, fontSize: 14 },
  activeOptionPillText: { color: Colors.hopeWhite },
});

export default FilterSelect;
