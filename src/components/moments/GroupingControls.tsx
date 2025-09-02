import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

export type GroupingType = 'date' | 'week' | 'month' | 'year' | 'category' | 'type' | 'none';
export type SortType = 'newest' | 'oldest' | 'category' | 'type';
export type PrayerAnswerFilter = 'all' | 'answered' | 'unanswered';

interface GroupingControlsProps {
  groupBy: GroupingType;
  onGroupByChange: (groupBy: GroupingType) => void;
  sortBy: SortType;
  onSortByChange: (sortBy: SortType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  prayerAnswerFilter?: PrayerAnswerFilter;
  onPrayerAnswerFilterChange?: (filter: PrayerAnswerFilter) => void;
}

const GROUPING_OPTIONS: { value: GroupingType; label: string; icon: string }[] = [
  { value: 'none', label: 'No Grouping', icon: 'list-outline' },
  { value: 'date', label: 'By Date', icon: 'calendar-outline' },
  { value: 'month', label: 'By Month', icon: 'calendar' },
  { value: 'year', label: 'By Year', icon: 'calendar-number-outline' },
  { value: 'category', label: 'By Category', icon: 'folder-outline' },
  { value: 'type', label: 'By Type', icon: 'grid-outline' },
];

const SORT_OPTIONS: { value: SortType; label: string; icon: string }[] = [
  { value: 'newest', label: 'Newest First', icon: 'arrow-down' },
  { value: 'oldest', label: 'Oldest First', icon: 'arrow-up' },
  { value: 'category', label: 'By Category', icon: 'folder' },
  { value: 'type', label: 'By Type', icon: 'grid' },
];

export const GroupingControls: React.FC<GroupingControlsProps> = ({
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  searchQuery,
  onSearchChange,
  showSearch,
  onToggleSearch,
  prayerAnswerFilter = 'all',
  onPrayerAnswerFilterChange,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const fontMedium = getFontFamily(fontKey, 'medium');
  const fontSemiBold = getFontFamily(fontKey, 'semiBold');
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={[styles.searchToggle, showSearch && styles.searchToggleActive]}
          onPress={onToggleSearch}
        >
          <Ionicons
            name={showSearch ? 'search' : 'search-outline'}
            size={20}
            color={showSearch ? Colors.hopeWhite : Colors.mediumGray}
          />
        </TouchableOpacity>

        {showSearch && (
          <TextInput
            style={[styles.searchInput, { fontFamily: fontRegular }]}
            placeholder="Search moments..."
            placeholderTextColor={Colors.mediumGray}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
          />
        )}
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Group By */}
        <View style={styles.controlGroup}>
          <ThemedText weight="semiBold" style={[styles.controlLabel, { fontFamily: fontSemiBold }]}>Group By</ThemedText>
          <View style={styles.optionsContainer}>
            {GROUPING_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  groupBy === option.value && styles.activeOption,
                ]}
                onPress={() => onGroupByChange(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={16}
                  color={groupBy === option.value ? Colors.hopeWhite : Colors.mediumGray}
                />
                <ThemedText
                  style={[
                    styles.optionText,
                    { fontFamily: fontMedium },
                    groupBy === option.value && styles.activeOptionText,
                  ]}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sort By */}
        <View style={styles.controlGroup}>
          <ThemedText weight="semiBold" style={[styles.controlLabel, { fontFamily: fontSemiBold }]}>Sort By</ThemedText>
          <View style={styles.optionsContainer}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  sortBy === option.value && styles.activeOption,
                ]}
                onPress={() => onSortByChange(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={16}
                  color={sortBy === option.value ? Colors.hopeWhite : Colors.mediumGray}
                />
                <ThemedText
                  style={[
                    styles.optionText,
                    { fontFamily: fontMedium },
                    sortBy === option.value && styles.activeOptionText,
                  ]}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Prayer Status Filter */}
        {onPrayerAnswerFilterChange && (
          <View style={styles.controlGroup}>
            <ThemedText weight="semiBold" style={[styles.controlLabel, { fontFamily: fontSemiBold }]}>Prayer Status</ThemedText>
            <View style={styles.optionsContainer}>
              {([
                { value: 'all', label: 'All' },
                { value: 'answered', label: 'Answered' },
                { value: 'unanswered', label: 'Unanswered' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    prayerAnswerFilter === opt.value && styles.activeOption,
                  ]}
                  onPress={() => onPrayerAnswerFilterChange(opt.value)}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      { fontFamily: fontMedium },
                      prayerAnswerFilter === opt.value && styles.activeOptionText,
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchToggleActive: {
    backgroundColor: Colors.alertCoral,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  controlsRow: {
    gap: 16,
  },
  controlGroup: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  activeOption: {
    backgroundColor: Colors.alertCoral,
  },
  optionText: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  activeOptionText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
});
