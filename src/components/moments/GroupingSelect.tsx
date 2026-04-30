import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';

export type GroupingMode = 'day' | 'week' | 'month' | 'year';
export type GroupingSelectHandle = { open: () => void };

interface GroupingSelectProps {
  value: GroupingMode;
  onChange: (mode: GroupingMode) => void;
  compact?: boolean;
}

const OPTIONS: { value: GroupingMode; label: string }[] = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

const GroupingSelect = forwardRef<GroupingSelectHandle, GroupingSelectProps>(({ value, onChange, compact = false }, ref) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const fontMedium = getFontFamily(fontKey, 'medium');
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  return (
    <View>
      <TouchableOpacity style={[styles.button, compact && styles.buttonCompact]} onPress={() => { triggerLightHaptic(); setOpen(true); }}>
        <Ionicons name="calendar-outline" size={compact ? 14 : 16} color={Colors.hopeWhite} />
        <ThemedText style={[styles.buttonText, compact && styles.buttonTextCompact, { fontFamily: fontMedium }]}>{OPTIONS.find(o => o.value === value)?.label}</ThemedText>
        <Ionicons name="chevron-down" size={compact ? 14 : 16} color={Colors.hopeWhite} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <ThemedText weight="medium" style={[styles.sheetTitle, { fontFamily: fontMedium }]}>SELECT VIEW</ThemedText>
            <View style={styles.optionsGrid}>
              {OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.optionPill, item.value === value && styles.activeOptionPill]}
                  onPress={() => { triggerLightHaptic(); onChange(item.value); setOpen(false); }}
                >
                  <ThemedText weight={item.value === value ? 'semiBold' : 'medium'} style={[styles.optionPillText, item.value === value && styles.activeOptionPillText, { fontFamily: fontMedium }]}>
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
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
  sheet: { backgroundColor: Colors.anchorBlue, borderRadius: 24, padding: 20, maxWidth: 280, alignSelf: 'center' },
  sheetTitle: { fontSize: 16, color: Colors.hopeWhite, marginBottom: 16, textTransform: 'uppercase' },
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

export default GroupingSelect;
