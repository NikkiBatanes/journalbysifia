import React, { useState, useRef } from 'react';
import { View, StyleSheet, RefreshControl, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import type { DateRange, FilterType } from '../components/moments/DateFilterBar';
// New dropdown controls
import GroupingSelect, { GroupingMode, GroupingSelectHandle } from '../components/moments/GroupingSelect';
import FilterSelect, { FilterKey, FilterSelectHandle } from '../components/moments/FilterSelect';
import type { GroupingType, SortType, PrayerAnswerFilter } from '../components/moments/GroupingControls';
import { EnhancedMomentsRenderer } from '../systems/journal/renderers/EnhancedMomentsRenderer';
import { getAllPlugins } from '../systems/journal/plugins/registry';

export const MomentsScreen: React.FC = () => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontBold = getFontFamily(fontKey, 'bold');
  const fontRegular = getFontFamily(fontKey, 'regular');
  // Date filtering state - Default to show all dates up to today (exclude future dates)
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    startDate: new Date(2000, 0, 1), // Start from a very early date to show all entries
    endDate: new Date(), // Cap at current local date to avoid showing future entries by default
    label: 'Until Today',
  });
  const [filterType, setFilterType] = useState<FilterType>('range');
  const [showFilters, setShowFilters] = useState(true);

  // Grouping and search state
  const [groupBy, setGroupBy] = useState<GroupingType>('date');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Prayer answered filter state
  const [prayerAnswerFilter, setPrayerAnswerFilter] = useState<PrayerAnswerFilter>('all');
  // New simplified grouping and filters state
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('day');
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);

  // Refs to programmatically open modals
  const groupingRef = useRef<GroupingSelectHandle>(null);
  const filterRef = useRef<FilterSelectHandle>(null);

  // TEMP: map new grouping to legacy groupBy until renderer is updated
  React.useEffect(() => {
    const mapping: Record<GroupingMode, GroupingType> = {
      day: 'date',
      week: 'week', // now supported by renderer
      month: 'month',
      year: 'year', // now supported by renderer
    };
    const next = mapping[groupingMode];
    if (next !== groupBy) setGroupBy(next);
  }, [groupingMode]);

  // Get all available plugins
  const plugins = getAllPlugins();
  const isSmallScreen = Dimensions.get('window').width <= 360;

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
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftRow}>
            <Feather size={20} color={Colors.hopeWhite} />
            <ThemedText weight="bold" style={[styles.headerTitle, { fontFamily: fontBold, marginLeft: 8 }]}>Moments</ThemedText>
          </View>
          <View style={styles.headerControls}>
            <GroupingSelect ref={groupingRef} value={groupingMode} onChange={setGroupingMode} compact={isSmallScreen} />
            <FilterSelect
              ref={filterRef}
              values={activeFilters}
              compact={isSmallScreen}
              onChange={(vals) => {
                setActiveFilters(vals);
                // Map to legacy prayerAnswerFilter for renderer compatibility now
                const hasAnswered = vals.includes('answeredPrayers');
                const hasUnanswered = vals.includes('unansweredPrayers');
                const mapped: PrayerAnswerFilter = hasAnswered && hasUnanswered ? 'all' : (hasAnswered ? 'answered' : (hasUnanswered ? 'unanswered' : 'all'));
                setPrayerAnswerFilter(mapped);
              }}
            />
          </View>
        </View>
        <ThemedText style={[styles.headerSubtitle, { fontFamily: fontRegular }]}>Your journal entries and memories</ThemedText>
      </View>

      {/* Enhanced Moments Renderer - now handles its own scrolling */}
      <EnhancedMomentsRenderer
        plugins={plugins}
        dateRange={(function computeRange() {
          const base = getCurrentDateRange();
          if (activeFilters.includes('upcoming')) {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
            return { ...base, startDate: tomorrow, endDate: sixMonthsAhead, label: 'Upcoming' } as DateRange;
          }
          return base;
        })()}
        groupBy={groupBy}
        sortBy={sortBy}
        searchQuery={searchQuery}
        prayerAnswerFilter={prayerAnswerFilter}
        filterKeys={activeFilters}
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
  content: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 0, // edge-to-edge
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
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  controlsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
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
