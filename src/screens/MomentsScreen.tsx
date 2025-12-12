import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, StatusBar, Dimensions, DeviceEventEmitter, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Search, X as CloseIcon } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import type { DateRange, FilterType } from '../components/moments/DateFilterBar';
// New dropdown controls
import GroupingSelect, { GroupingMode, GroupingSelectHandle } from '../components/moments/GroupingSelect';
import FilterSelect, { FilterKey, FilterSelectHandle } from '../components/moments/FilterSelect';
import { GroupingType } from '../components/moments/GroupingControls';
import { EnhancedMomentsRenderer } from '../systems/journal/renderers/EnhancedMomentsRenderer';
import { getAllPlugins } from '../systems/journal/plugins/registry';

type PrayerAnswerFilter = 'all' | 'answered' | 'unanswered';

export const MomentsScreen: React.FC = () => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontBold = getFontFamily(fontKey, 'bold');
  const fontRegular = getFontFamily(fontKey, 'regular');
  // Date filtering state - Default to show all dates up to today (exclude future dates)
  const [selectedDate] = useState(new Date());
  const [selectedRange] = useState<DateRange>({
    startDate: new Date(2000, 0, 1), // Start from a very early date to show all entries
    endDate: new Date(), // Cap at current local date to avoid showing future entries by default
    label: 'Until Today',
  });
  const [filterType, _setFilterType] = useState<FilterType>('range');
  const [_showFilters, _setShowFilters] = useState(false);

  // Grouping and search state
  const [groupBy, setGroupBy] = useState<GroupingType>('date');
  const [sortBy, _setSortBy] = useState<'newest' | 'oldest' | 'category' | 'type'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Prayer answered filter state
  const [prayerAnswerFilter, setPrayerAnswerFilter] = useState<PrayerAnswerFilter>('all');
  // New simplified grouping and filters state
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('day');
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);

  // Refresh key to trigger data reload when reflections are saved
  const [refreshKey, setRefreshKey] = useState(0);

  // Refs to programmatically open modals
  const groupingRef = useRef<GroupingSelectHandle>(null);
  const filterRef = useRef<FilterSelectHandle>(null);

  // Map new grouping to legacy groupBy until renderer is updated
  React.useEffect(() => {
    const mapping: Record<GroupingMode, GroupingType> = {
      day: 'date',
      week: 'week',
      month: 'month',
      year: 'year',
    };
    const next = mapping[groupingMode];
    if (next !== groupBy) {setGroupBy(next);}
  }, [groupBy, groupingMode]);

  // Listen for reflection save and delete events to refresh the moments view
  useEffect(() => {
    const handleReflectionChanged = () => {
      setRefreshKey(prev => prev + 1);
    };

    const savedSubscription = DeviceEventEmitter.addListener('reflection_saved', handleReflectionChanged);
    const deletedSubscription = DeviceEventEmitter.addListener('reflection_deleted', handleReflectionChanged);
    
    // CRITICAL FIX: Also listen for timeblock events to refresh when timeblocks are saved
    const timeblockSavedSubscription = DeviceEventEmitter.addListener('timeblock_saved', handleReflectionChanged);
    const timeblockDeletedSubscription = DeviceEventEmitter.addListener('timeblock_deleted', handleReflectionChanged);

    return () => {
      savedSubscription.remove();
      deletedSubscription.remove();
      timeblockSavedSubscription.remove();
      timeblockDeletedSubscription.remove();
    };
  }, []);

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

  // Removed unused handlers

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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.header}>
        <View style={[styles.headerTopRow, isSmallScreen && styles.headerTopRowWrap]}>
          <View style={[styles.headerLeftRow, isSmallScreen && styles.headerLeftRowCompact]}>
            <Feather size={20} color={Colors.hopeWhite} />
            <ThemedText weight="bold" style={[styles.headerTitle, styles.marginLeft8, { fontFamily: fontBold }]}>Moments</ThemedText>
          </View>
          <View style={[
            styles.headerControls,
            isSmallScreen && styles.headerControlsCompact,
          ]}>
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

        <View style={[styles.searchContainer, isSmallScreen && styles.searchContainerCompact]}>
          <Search size={18} color={Colors.textGray} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Moments"
            placeholderTextColor={Colors.textGray}
            style={[
              styles.searchInput,
              { fontFamily: fontRegular },
              isSmallScreen && styles.searchInputCompact,
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <CloseIcon size={16} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
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
        refreshKey={refreshKey}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTopRowWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeftRowCompact: {
    marginRight: 8,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerControlsCompact: {
    gap: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.hopeWhite,
  },
  marginLeft8: {
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textGray,
    marginTop: 4,
  },
  searchContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchContainerCompact: {
    alignSelf: 'stretch',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.hopeWhite,
    paddingVertical: 0,
  },
  searchInputCompact: {
    fontSize: 15,
    paddingVertical: 2,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
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
