import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { DateFilterBar, DateRange, FilterType } from '../components/moments/DateFilterBar';
import { GroupingControls, GroupingType, SortType } from '../components/moments/GroupingControls';
import { EnhancedMomentsRenderer } from '../systems/journal/renderers/EnhancedMomentsRenderer';
import { getAllPlugins } from '../systems/journal/plugins/registry';

export const MomentsScreen: React.FC = () => {
  // Date filtering state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    startDate: new Date(),
    endDate: new Date(),
    label: 'Today',
  });
  const [filterType, setFilterType] = useState<FilterType>('single');

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
        <Text style={styles.headerTitle}>Moments</Text>
        <Text style={styles.headerSubtitle}>
          Your journal entries and memories
        </Text>
      </View>

      {/* Enhanced Moments Renderer - now handles its own scrolling */}
      <EnhancedMomentsRenderer
        plugins={plugins}
        dateRange={getCurrentDateRange()}
        groupBy={groupBy}
        sortBy={sortBy}
        searchQuery={searchQuery}
        style={styles.momentsRenderer}
        headerComponents={[
          <DateFilterBar
            key="date-filter"
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onDateRangeChange={handleDateRangeChange}
            filterType={filterType}
            onFilterTypeChange={handleFilterTypeChange}
            selectedRange={selectedRange}
          />,
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
          />,
        ]}
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    marginTop: 4,
    fontFamily: Fonts.regular,
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
});
