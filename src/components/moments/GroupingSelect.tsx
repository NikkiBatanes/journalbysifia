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
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText weight="semiBold" style={[styles.sheetTitle, { fontFamily: fontMedium }]}>Select View</ThemedText>
              <TouchableOpacity onPress={() => { triggerLightHaptic(); setOpen(false); }}><Ionicons name="close" size={22} color={Colors.hopeWhite} /></TouchableOpacity>
            </View>
            <FlatList
              data={OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.activeOption]}
                  onPress={() => { triggerLightHaptic(); onChange(item.value); setOpen(false); }}
                >
                  <ThemedText style={[styles.optionText, { fontFamily: fontRegular }]}>{item.label}</ThemedText>
                </TouchableOpacity>
              )}
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
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 4 },
  activeOption: { backgroundColor: Colors.alertCoral },
  optionText: { color: Colors.hopeWhite, fontSize: 14 },
});

export default GroupingSelect;
