import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Dimensions, View, Platform, StatusBar } from 'react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts } from '../theme';
import ThemedText from './common/ThemedText';

const { width } = Dimensions.get('window');

// iOS inline DateTimePicker always renders at ~350pt regardless of layout.
// When it's open, we expand the card to match rather than cropping or scaling.
const IOS_PICKER_NATIVE_WIDTH = 350;

type PickerModalProps = {
  visible: boolean;
  filter: 'ongoing' | 'completed';
  initContentView: 'all' | 'category' | 'date';
  initDateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom';
  initSelectedCategories: string[];
  initCustomDateFrom: Date;
  initCustomDateTo: Date;
  availableCategories: string[];
  onClose: () => void;
  onFilterChange: (f: 'ongoing' | 'completed') => void;
  onApply: (
    contentView: 'all' | 'category' | 'date',
    dateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom',
    selectedCategories: string[],
    customDateFrom: Date,
    customDateTo: Date,
  ) => void;
  onHaptic: () => void;
};

const PickerModal = React.memo(({
  visible, filter, initContentView, initDateViewMode, initSelectedCategories,
  initCustomDateFrom, initCustomDateTo, availableCategories,
  onClose, onFilterChange, onApply, onHaptic,
}: PickerModalProps) => {
  const [localView, setLocalView] = useState<'all' | 'category' | 'date'>(initContentView);
  const [localDateMode, setLocalDateMode] = useState<'weekly' | 'monthly' | 'yearly' | 'custom'>(initDateViewMode);
  const [localCategories, setLocalCategories] = useState<string[]>(initSelectedCategories);
  const [customFrom, setCustomFrom] = useState<Date>(initCustomDateFrom);
  const [customTo, setCustomTo] = useState<Date>(initCustomDateTo);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Sync local state whenever the modal opens so it starts from current values
  useEffect(() => {
    if (visible) {
      setLocalView(initContentView);
      setLocalDateMode(initDateViewMode);
      setLocalCategories(initSelectedCategories);
      setCustomFrom(initCustomDateFrom);
      setCustomTo(initCustomDateTo);
      setShowFromPicker(false);
      setShowToPicker(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Close + flush whatever local state is current
  const handleApplyAndClose = useCallback(() => {
    onApply(localView, localDateMode, localCategories, customFrom, customTo);
    onClose();
  }, [localView, localDateMode, localCategories, customFrom, customTo, onApply, onClose]);

  // Immediate apply helpers — used for auto-apply-and-close interactions
  const applyAndClose = useCallback((
    view: 'all' | 'category' | 'date',
    mode: 'weekly' | 'monthly' | 'yearly' | 'custom',
    cats: string[],
    from: Date,
    to: Date,
  ) => {
    onApply(view, mode, cats, from, to);
    onClose();
  }, [onApply, onClose]);

  const pickerStyles = React.useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
      justifyContent: 'flex-start',
      paddingTop: Platform.OS === 'android' ? 112 + (StatusBar.currentHeight || 0) : 112,
      alignItems: 'flex-end',
      paddingRight: 16,
    },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderRadius: 18,
      overflow: 'hidden',
      minWidth: 220,
      maxWidth: 350,
      paddingTop: 14,
      paddingBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      color: 'rgba(255, 255, 255, 0.5)',
      paddingHorizontal: 16,
      paddingTop: 0,
    },
    sectionLabelMargin: {
      marginTop: 14,
    },
    pillRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    pill: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    pillActive: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillActiveOngoing: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillActiveCompleted: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillPressed: { transform: [{ scale: 0.93 }] as any, opacity: 0.75 },
    pillText: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255, 255, 255, 0.5)' },
    pillTextActive: { color: Colors.hopeWhite },
    pillTextOngoing: { color: Colors.hopeWhite },
    pillTextCompleted: { color: Colors.hopeWhite },
    divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', marginHorizontal: 16, marginVertical: 14 },
    applyBtn: {
      marginHorizontal: 16, marginTop: 12, marginBottom: 2,
      paddingVertical: 10, borderRadius: 999,
      backgroundColor: Colors.anchorBlue, alignItems: 'center' as const,
    },
    applyBtnText: { fontSize: 13, color: Colors.hopeWhite },
    customDateRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      marginHorizontal: 16, marginTop: 10, marginBottom: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', overflow: 'hidden' as const,
    },
    customDateField: { flex: 1, alignItems: 'center' as const, paddingVertical: 10, gap: 2 },
    customDateSep: { width: 1, height: 32, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
    customDateLabel: {
      fontSize: 10, fontFamily: Fonts.regular,
      color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' as const, letterSpacing: 0.8,
    },
    customDateValue: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.hopeWhite },
    pickerHeight: { height: 390 },
  }), []); // static — only computed once

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={handleApplyAndClose}
    >
      {/* Backdrop — tap to apply current local state and close */}
      <Pressable style={pickerStyles.overlay} onPress={handleApplyAndClose}>
        <Pressable
          style={[
            pickerStyles.card,
            // Expand card to fit the picker natively — no cropping, no scaling
            (showFromPicker || showToPicker) && {
              width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
            },
          ]}
        >

          {/* ── VIEW ──────────────────────────────────── */}
          <ThemedText weight="semiBold" style={pickerStyles.sectionLabel}>View</ThemedText>
          <View style={pickerStyles.pillRow}>
            {(['all', 'category', 'date'] as const).map(v => {
              const active = localView === v;
              return (
                <Pressable key={v}
                  style={({ pressed }) => [pickerStyles.pill, active && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                  onPress={() => {
                    onHaptic();
                    if (v === 'all') {
                      // All: immediate apply + close
                      applyAndClose('all', localDateMode, [], customFrom, customTo);
                    } else {
                      // Category / Date: switch sub-section, modal stays open
                      setLocalView(v);
                    }
                  }}
                >
                  <ThemedText weight={active ? 'semiBold' : 'regular'}
                    style={[pickerStyles.pillText, active && pickerStyles.pillTextActive]}>
                    {v === 'all' ? 'All' : v === 'category' ? 'Category' : 'Date'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* ── CATEGORY sub-section ─────────────────── */}
          {localView === 'category' && availableCategories.length > 0 && (
            <>
              <ThemedText weight="semiBold" style={[pickerStyles.sectionLabel, pickerStyles.sectionLabelMargin]}>Categories</ThemedText>
              <View style={pickerStyles.pillRow}>
                {availableCategories.map(cat => {
                  const sel = localCategories.includes(cat);
                  return (
                    <Pressable key={cat}
                      style={({ pressed }) => [pickerStyles.pill, sel && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                      onPress={() => {
                        onHaptic();
                        // Toggle and immediately apply — no button needed
                        const next = sel
                          ? localCategories.filter(c => c !== cat)
                          : [...localCategories, cat];
                        setLocalCategories(next);
                        applyAndClose('category', localDateMode, next, customFrom, customTo);
                      }}
                    >
                      <ThemedText weight={sel ? 'semiBold' : 'regular'}
                        style={[pickerStyles.pillText, sel && pickerStyles.pillTextActive]}>
                        {cat}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {/* No Apply button — tap a category to select, backdrop to close */}
            </>
          )}

          {/* ── DATE VIEW sub-section ────────────────── */}
          {localView === 'date' && (
            <>
              <ThemedText weight="semiBold" style={[pickerStyles.sectionLabel, pickerStyles.sectionLabelMargin]}>Date View</ThemedText>
              <View style={pickerStyles.pillRow}>
                {(['weekly', 'monthly', 'yearly', 'custom'] as const).map(m => {
                  const active = localDateMode === m;
                  const label = m === 'weekly' ? 'Weekly' : m === 'monthly' ? 'Monthly' : m === 'yearly' ? 'Yearly' : 'Custom';
                  return (
                    <Pressable key={m}
                      style={({ pressed }) => [pickerStyles.pill, active && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                      onPress={() => {
                        onHaptic();
                        setLocalDateMode(m);
                        if (m !== 'custom') {
                          // Weekly / Monthly / Yearly: immediate apply + close
                          applyAndClose('date', m, localCategories, customFrom, customTo);
                        }
                        // Custom: stay open to pick date range
                      }}
                    >
                      <ThemedText weight={active ? 'semiBold' : 'regular'}
                        style={[pickerStyles.pillText, active && pickerStyles.pillTextActive]}>
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom only: date range pickers + Apply button */}
              {localDateMode === 'custom' && (
                <>
                  <View style={pickerStyles.customDateRow}>
                    <Pressable style={({ pressed }) => [pickerStyles.customDateField, pressed && { opacity: 0.7 }]}
                      onPress={() => { setShowFromPicker(p => !p); setShowToPicker(false); }}>
                      <ThemedText weight="regular" style={pickerStyles.customDateLabel}>From</ThemedText>
                      <ThemedText weight="semiBold" style={pickerStyles.customDateValue}>{format(customFrom, 'MMM d, yyyy')}</ThemedText>
                    </Pressable>
                    <View style={pickerStyles.customDateSep} />
                    <Pressable style={({ pressed }) => [pickerStyles.customDateField, pressed && { opacity: 0.7 }]}
                      onPress={() => { setShowToPicker(p => !p); setShowFromPicker(false); }}>
                      <ThemedText weight="regular" style={pickerStyles.customDateLabel}>To</ThemedText>
                      <ThemedText weight="semiBold" style={pickerStyles.customDateValue}>{format(customTo, 'MMM d, yyyy')}</ThemedText>
                    </Pressable>
                  </View>
                  {showFromPicker && (
                    <DateTimePicker value={customFrom} mode="date" display="inline" maximumDate={customTo}
                      onChange={(_e, d) => { if (d) { setCustomFrom(d); } }}
                      style={{
                        // Explicit dimensions tell RN layout how much space to allocate —
                        // without these the card never gets the signal to expand.
                        // Height 390 covers both the month-calendar view and the
                        // month+year scroll wheel that appears when the header is tapped.
                        width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
                      }}
                      accentColor={Colors.hopeWhite} themeVariant="dark" />
                  )}
                  {showToPicker && (
                    <DateTimePicker value={customTo} mode="date" display="inline" minimumDate={customFrom} maximumDate={new Date()}
                      onChange={(_e, d) => { if (d) { setCustomTo(d); } }}
                      style={{
                        width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
                      }}
                      accentColor={Colors.hopeWhite} themeVariant="dark" />
                  )}
                  {/* Apply only needed for Custom since date selection requires confirmation */}
                  <Pressable style={({ pressed }) => [pickerStyles.applyBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => { onHaptic(); applyAndClose('date', 'custom', localCategories, customFrom, customTo); }}>
                    <ThemedText weight="semiBold" style={pickerStyles.applyBtnText}>Apply</ThemedText>
                  </Pressable>
                </>
              )}
            </>
          )}

          {/* ── DIVIDER ──────────────────────────────── */}
          <View style={pickerStyles.divider} />

          {/* ── STATUS ───────────────────────────────── */}
          <ThemedText weight="semiBold" style={pickerStyles.sectionLabel}>Status</ThemedText>
          <View style={pickerStyles.pillRow}>
            {(['ongoing', 'completed'] as const).map(s => {
              const active = filter === s;
              const ongoing = s === 'ongoing';
              return (
                <Pressable key={s}
                  style={({ pressed }) => [
                    pickerStyles.pill,
                    active && (ongoing ? pickerStyles.pillActiveOngoing : pickerStyles.pillActiveCompleted),
                    pressed && pickerStyles.pillPressed,
                  ]}
                  onPress={() => { onHaptic(); onFilterChange(s); onClose(); }}
                >
                  <ThemedText weight={active ? 'semiBold' : 'regular'} style={[
                    pickerStyles.pillText,
                    active && (ongoing ? pickerStyles.pillTextOngoing : pickerStyles.pillTextCompleted),
                  ]}>
                    {ongoing ? 'In Progress' : 'Completed'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default PickerModal;
