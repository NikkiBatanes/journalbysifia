import React, { useMemo, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from 'date-fns';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { useAuth } from '../../context/IndustryStandardAuthContext';

export type DateRange = {
  startDate: Date;
  endDate: Date;
  label: string;
};

export type FilterType = 'single' | 'range' | 'preset';

interface DateFilterBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDateRangeChange: (range: DateRange) => void;
  filterType: FilterType;
  onFilterTypeChange: (type: FilterType) => void;
  selectedRange?: DateRange;
}

const PRESET_RANGES: DateRange[] = [
  {
    startDate: new Date(),
    endDate: new Date(),
    label: 'Today',
  },
  {
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    label: 'Last 7 Days',
  },
  {
    startDate: subWeeks(new Date(), 2),
    endDate: new Date(),
    label: 'Last 2 Weeks',
  },
  {
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    label: 'This Month',
  },
  {
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(subMonths(new Date(), 1)),
    label: 'Last Month',
  },
  {
    startDate: startOfYear(new Date()),
    endDate: endOfYear(new Date()),
    label: 'This Year',
  },
];

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  selectedDate,
  onDateChange,
  onDateRangeChange,
  filterType,
  onFilterTypeChange,
  selectedRange,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const fontMedium = getFontFamily(fontKey, 'medium');
  const fontSemiBold = getFontFamily(fontKey, 'semiBold');
  const { user } = useAuth();
  const weekStartPreference = (user as any)?.user_metadata?.preferences?.weekStart as
    | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | undefined;
  const weekStartsOn = useMemo(() => {
    const key = weekStartPreference;
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return key ? map[key] ?? 0 : 0;
  }, [weekStartPreference]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [tempRange, setTempRange] = useState<{ start?: Date; end?: Date }>({});

  const handleDateSelect = (day: any) => {
    if (filterType === 'single') {
      onDateChange(new Date(day.dateString));
      setShowCalendar(false);
    } else if (filterType === 'range') {
      const clickedDate = new Date(day.dateString);

      if (!tempRange.start || (tempRange.start && tempRange.end)) {
        // Start new range
        setTempRange({ start: clickedDate });
      } else if (tempRange.start && !tempRange.end) {
        // Complete range
        const start = tempRange.start;
        const end = selectedDate;
        const range: DateRange = {
          startDate: start < end ? start : end,
          endDate: start < end ? end : start,
          label: `${format(start < end ? start : end, 'MMM d')} - ${format(start < end ? end : start, 'MMM d, yyyy')}`,
        };
        onDateRangeChange(range);
        setTempRange({});
        setShowCalendar(false);
      }
    }
  };

  const handlePresetSelect = (preset: DateRange) => {
    onDateRangeChange(preset);
    setShowPresets(false);
  };

  const getDisplayText = () => {
    switch (filterType) {
      case 'single':
        return format(selectedDate, 'MMM d, yyyy');
      case 'range':
        return selectedRange ? selectedRange.label : 'Select Range';
      case 'preset':
        return selectedRange ? selectedRange.label : 'Select Period';
      default:
        return 'Select Date';
    }
  };

  const getMarkedDates = () => {
    if (filterType === 'single') {
      return {
        [format(selectedDate, 'yyyy-MM-dd')]: {
          selected: true,
          selectedColor: Colors.alertCoral,
        },
      };
    } else if (filterType === 'range' && tempRange.start) {
      const marked: any = {
        [format(tempRange.start, 'yyyy-MM-dd')]: {
          selected: true,
          selectedColor: Colors.alertCoral,
        },
      };

      if (tempRange.end) {
        marked[format(tempRange.end, 'yyyy-MM-dd')] = {
          selected: true,
          selectedColor: Colors.alertCoral,
        };
      }

      return marked;
    }

    return {};
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterTypeContainer}>
        <TouchableOpacity
          style={[styles.filterTypeButton, filterType === 'single' && styles.activeFilterType]}
          onPress={() => onFilterTypeChange('single')}
        >
          <ThemedText style={[styles.filterTypeText, { fontFamily: fontMedium }, filterType === 'single' && styles.activeFilterTypeText]}>
            Single Date
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTypeButton, filterType === 'range' && styles.activeFilterType]}
          onPress={() => onFilterTypeChange('range')}
        >
          <ThemedText style={[styles.filterTypeText, { fontFamily: fontMedium }, filterType === 'range' && styles.activeFilterTypeText]}>
            Date Range
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTypeButton, filterType === 'preset' && styles.activeFilterType]}
          onPress={() => onFilterTypeChange('preset')}
        >
          <ThemedText style={[styles.filterTypeText, { fontFamily: fontMedium }, filterType === 'preset' && styles.activeFilterTypeText]}>
            Quick Filter
          </ThemedText>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.dateSelector}
        onPress={() => {
          if (filterType === 'preset') {
            setShowPresets(true);
          } else {
            setShowCalendar(true);
          }
        }}
      >
        <ThemedText style={[styles.dateText, { fontFamily: fontMedium }]}>{getDisplayText()}</ThemedText>
        <Ionicons name="chevron-down" size={20} color={Colors.hopeWhite} />
      </TouchableOpacity>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText weight="semiBold" style={[styles.modalTitle, { fontFamily: fontSemiBold }]}>
                {filterType === 'single' ? 'Select Date' : 'Select Date Range'}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </View>

            <Calendar
              onDayPress={handleDateSelect}
              markedDates={getMarkedDates()}
              firstDay={weekStartsOn}
              theme={{
                backgroundColor: Colors.anchorBlue,
                calendarBackground: Colors.anchorBlue,
                textSectionTitleColor: Colors.hopeWhite,
                dayTextColor: Colors.hopeWhite,
                todayTextColor: Colors.alertCoral,
                selectedDayTextColor: Colors.hopeWhite,
                monthTextColor: Colors.hopeWhite,
                arrowColor: Colors.alertCoral,
                textDisabledColor: Colors.mediumGray,
              }}
            />

            {filterType === 'range' && tempRange.start && !tempRange.end && (
              <ThemedText style={[styles.rangeHint, { fontFamily: fontRegular }]}>
                Select end date for range
              </ThemedText>
            )}
          </View>
        </View>
      </Modal>

      {/* Presets Modal */}
      <Modal
        visible={showPresets}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPresets(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText weight="semiBold" style={[styles.modalTitle, { fontFamily: fontSemiBold }]}>Quick Filters</ThemedText>
              <TouchableOpacity onPress={() => setShowPresets(false)}>
                <Ionicons name="close" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.presetsList}>
              {PRESET_RANGES.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetItem,
                    selectedRange?.label === preset.label && styles.selectedPreset,
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                >
                  <ThemedText style={[
                    styles.presetText,
                    { fontFamily: fontMedium },
                    selectedRange?.label === preset.label && styles.selectedPresetText,
                  ]}>
                    {preset.label}
                  </ThemedText>
                  <ThemedText style={[styles.presetSubtext, { fontFamily: fontRegular }]}>
                    {format(preset.startDate, 'MMM d')} - {format(preset.endDate, 'MMM d, yyyy')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  filterTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 4,
  },
  filterTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeFilterType: {
    backgroundColor: Colors.alertCoral,
  },
  filterTypeText: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  activeFilterTypeText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  rangeHint: {
    textAlign: 'center',
    color: Colors.mediumGray,
    fontSize: 14,
    marginTop: 12,
    fontStyle: 'italic',
  },
  presetsList: {
    maxHeight: 400,
  },
  presetItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedPreset: {
    backgroundColor: Colors.alertCoral,
  },
  presetText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  selectedPresetText: {
    fontWeight: '600',
  },
  presetSubtext: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
});
