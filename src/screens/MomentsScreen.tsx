import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, StatusBar, DeviceEventEmitter, TextInput, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather, ChevronDown } from 'lucide-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import type { DateRange, FilterType } from '../components/moments/DateFilterBar';
import GroupingSelect, { GroupingMode, GroupingSelectHandle } from '../components/moments/GroupingSelect';
import FilterSelect, { FilterKey, FilterSelectHandle } from '../components/moments/FilterSelect';
import { GroupingType } from '../components/moments/GroupingControls';
import { EnhancedMomentsRenderer } from '../systems/journal/renderers/EnhancedMomentsRenderer';
import { getAllPlugins } from '../systems/journal/plugins/registry';
import { triggerLightHaptic } from '../utils/haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PrayerAnswerFilter = 'all' | 'answered' | 'unanswered';

export const MomentsScreen: React.FC = () => {
  const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;
  const navigation = useNavigation();
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

  // Search and filter modal visibility
  const [showSearch, setShowSearch] = useState(false);

  // Refs to programmatically open modals
  const groupingRef = useRef<GroupingSelectHandle>(null);
  const filterRef = useRef<FilterSelectHandle>(null);
  const searchInputRef = useRef<any>(null);

  // Toggle search with animation
  const toggleSearch = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
    });
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Focus input after animation
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

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

    // Refresh when sermon notes are saved
    const sermonSavedSubscription = DeviceEventEmitter.addListener('sermon_saved', handleReflectionChanged);

    return () => {
      savedSubscription.remove();
      deletedSubscription.remove();
      timeblockSavedSubscription.remove();
      timeblockDeletedSubscription.remove();
      sermonSavedSubscription.remove();
    };
  }, []);

  // Get all available plugins
  const plugins = getAllPlugins();

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

  const screenContent = (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.lightBackground}
        translucent={false}
      />

      <View style={[styles.headerBar, IS_IPAD && styles.headerBarPad, { backgroundColor: Colors.lightBackground }]}>
        <View style={[styles.pageInner, IS_IPAD && styles.pageInnerPad]}>
          {/* Row 1: Title with icon left, actions right */}
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeftRow}>
              <Feather size={20} color={Colors.text} />
              <ThemedText weight="bold" style={[styles.headerTitle, styles.marginLeft8, { fontFamily: fontBold, color: Colors.text }]}>Moments</ThemedText>
            </View>
            <View style={styles.headerActions}>
              {/* Days pill with arrow down */}
              <TouchableOpacity
                style={styles.statusDropdownBtn}
                onPress={() => { triggerLightHaptic(); groupingRef.current?.open(); }}
                activeOpacity={0.75}
              >
                <ThemedText weight="semiBold" style={[styles.statusDropdownBtnText, { fontFamily: fontRegular, color: Colors.text }]}>
                  {groupingMode === 'day' ? 'Days' : groupingMode === 'week' ? 'Weeks' : groupingMode === 'month' ? 'Months' : 'Years'}
                </ThemedText>
                <ChevronDown size={14} color={Colors.text} />
              </TouchableOpacity>

              {/* Filter icon button */}
              <TouchableOpacity
                style={styles.dateFilterCircleButton}
                onPress={() => { triggerLightHaptic(); filterRef.current?.open(); }}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="tune" size={16} color={Colors.text} />
              </TouchableOpacity>

              {/* Search circle button */}
              <TouchableOpacity
                style={styles.searchCircleButton}
                onPress={toggleSearch}
                activeOpacity={0.75}
              >
                <Ionicons name={showSearch ? 'close' : 'search'} size={17} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Subtitle - hidden when search is open */}
          {!showSearch && (
            <ThemedText style={[styles.headerSubtitle, { fontFamily: fontRegular }]}>Your journal entries and memories</ThemedText>
          )}

          {/* Row 2: Search bar — height animated by LayoutAnimation (native thread) */}
          {showSearch && (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={Colors.textGray} style={styles.searchIcon} />
              <View style={styles.searchInputWrapper}>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search Moments..."
                  placeholderTextColor={Colors.placeholderText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  textAlignVertical="center"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  keyboardAppearance="light"
                />
              </View>
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.placeholderText} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {!showSearch && <View style={styles.searchBarCollapsedSpacer} />}
        </View>
      </View>

      {/* GroupingSelect and FilterSelect - rendered off-screen for ref functionality */}
      <View style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <GroupingSelect ref={groupingRef} value={groupingMode} onChange={setGroupingMode} compact={false} />
        <FilterSelect
          ref={filterRef}
          values={activeFilters}
          compact={false}
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

      {/* Enhanced Moments Renderer - now handles its own scrolling */}
      <EnhancedMomentsRenderer
        plugins={plugins}
        navigation={navigation}
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
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {screenContent}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: Colors.lightBackground,
  },
  headerBarPad: {
    paddingHorizontal: 48,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  pageInnerPad: {
    maxWidth: '100%',
    paddingHorizontal: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 6,
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: 0.5,
    flex: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  statusDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusDropdownBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  dateFilterCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    height: 42,
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchInput: {
    width: '100%',
    height: Platform.OS === 'ios' ? 22 : '100%',
    fontSize: 15,
    lineHeight: Platform.OS === 'ios' ? 20 : undefined,
    fontFamily: Fonts.regular,
    color: Colors.text,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchBarCollapsedSpacer: {
    height: 0,
  },
  // Legacy styles kept for compatibility
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  marginLeft8: {
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 4,
    marginBottom: 8,
  },
  searchContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchContainerCompact: {
    alignSelf: 'stretch',
  },
  searchInputCompact: {
    fontSize: 15,
    paddingVertical: 2,
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
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 12,
    padding: 12,
  },
  filterToggle: {
    alignSelf: 'flex-end',
    marginTop: 16,
  },
  filterToggleButton: {
    backgroundColor: Colors.anchorBlueLight,
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
    backgroundColor: Colors.anchorBlueLight,
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
    backgroundColor: Colors.text,
  },
});
