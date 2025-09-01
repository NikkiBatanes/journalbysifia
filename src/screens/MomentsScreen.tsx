import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { DateFilterBar, DateRange, FilterType } from '../components/moments/DateFilterBar';
import { GroupingControls, GroupingType, SortType } from '../components/moments/GroupingControls';
import { EnhancedMomentsRenderer } from '../systems/journal/renderers/EnhancedMomentsRenderer';
import { getAllPlugins } from '../systems/journal/plugins/registry';

export const MomentsScreen: React.FC = () => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontBold = getFontFamily(fontKey, 'bold');
  const fontRegular = getFontFamily(fontKey, 'regular');
  // Date filtering state - Default to show all dates
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    startDate: new Date(2000, 0, 1), // Start from a very early date to show all entries
    endDate: new Date(2030, 11, 31), // End date far in the future to catch all entries
    label: 'All Time',
  });
  const [filterType, setFilterType] = useState<FilterType>('range');
  const [showFilters, setShowFilters] = useState(false);

  // Grouping and search state
  const [groupBy, setGroupBy] = useState<GroupingType>('date');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get all available plugins
  const plugins = getAllPlugins();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Add refresh logic here if needed
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedRange({
      startDate: date,
      endDate: date,
      label: 'Selected Date',
    });
  };

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedRange(range);
  };

  const handleFilterTypeChange = (type: FilterType) => {
    setFilterType(type);
    if (type === 'single') {
      setSelectedRange({
        startDate: selectedDate,
        endDate: selectedDate,
        label: 'Selected Date',
      });
    }
  };

  const getCurrentDateRange = (): DateRange => {
    if (filterType === 'single') {
      return {
        startDate: selectedDate,
        endDate: selectedDate,
        label: 'Selected Date',
      };
    }
    return selectedRange;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <ThemedText weight="extraBold" style={[styles.headerTitle, { fontFamily: fontBold }]}>Moments</ThemedText>
          {/* Single filter toggle icon on same row as title */}
          <TouchableOpacity
            style={[styles.filterToggleButton, showFilters && styles.filterToggleButtonActive]}
            onPress={() => setShowFilters(prev => !prev)}
            accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
            accessibilityRole="button"
          >
            <Ionicons
              name="options"
              size={20}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.headerSubtitle, { fontFamily: fontRegular }]}>Your journal entries and memories</ThemedText>
      </View>

      {/* Fixed inline filters panel (does not scroll) */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <DateFilterBar
            key="date-filter"
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onDateRangeChange={handleDateRangeChange}
            filterType={filterType}
            onFilterTypeChange={handleFilterTypeChange}
            selectedRange={selectedRange}
          />
          <GroupingControls
            key="grouping-controls"
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={showSearch}
            onToggleSearch={() => setShowSearch(!showSearch)}
          />
        </View>
      )}

      {/* Enhanced Moments Renderer - now handles its own scrolling */}
      <EnhancedMomentsRenderer
        plugins={plugins}
        dateRange={getCurrentDateRange()}
        groupBy={groupBy}
        sortBy={sortBy}
        searchQuery={searchQuery}
        style={styles.momentsRenderer}
        headerComponents={[]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.alertCoral}
            colors={[Colors.alertCoral]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.hopeWhite,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  momentsRenderer: {
    flex: 1,
    minHeight: 400,
  },
  filterPanel: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  // New single-toggle styles
  filterToggle: {
    alignSelf: 'flex-end',
    marginTop: 16,
  },
  filterToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  filterTabs: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterTab: {
    backgroundColor: Colors.hopeWhite,
  },
});
