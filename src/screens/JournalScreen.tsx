import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, addDays, startOfWeek, isToday, isSameDay, addWeeks } from 'date-fns';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { TodaysFocus } from '../components/journal/TodaysFocus';
import { Todos } from '../components/journal/Todos';
import { TimeBlock } from '../components/journal/TimeBlock';
import { GuidedReflection } from '../components/journal/GuidedReflection';
import { GratitudeList } from '../components/journal/GratitudeList';
import { JournalEntries } from '../components/journal/JournalEntries';
import { TodayWin } from '../components/journal/TodayWin';
import { LookingForward } from '../components/journal/LookingForward';

type TabType = 'journal' | 'schedule' | 'prayer' | 'finance';

type ViewMode = 'daily' | 'weekly' | 'monthly';

export type JournalScreenRef = {
  resetToCurrentDate: () => void;
};

const JournalScreen = forwardRef<JournalScreenRef>((props, ref) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const lastSelectedDate = useRef<Date | null>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    resetToCurrentDate: () => {
      const now = new Date();

      setCurrentDate(prevDate => {
        // If we have a last selected date and it's different from now
        if (lastSelectedDate.current && !isSameDay(lastSelectedDate.current, now)) {
          const prev = new Date(lastSelectedDate.current);
          lastSelectedDate.current = null;
          return prev; // Return the last selected date
        } else {
          // Save current date before switching to now
          lastSelectedDate.current = new Date(prevDate);
          return now; // Return current date
        }
      });
    },
  }));
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(new Date().getDay());
  const [activeTab, setActiveTab] = useState<TabType>('journal');

  // Track if we've handled the initial scroll
  const hasInitializedScroll = useRef(false);

  // Reset to Journal tab when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setActiveTab(prevTab => prevTab === 'journal' ? prevTab : 'journal');
      // Only reset scroll position if we haven't initialized yet
      if (!hasInitializedScroll.current) {
        const today = new Date();
        setCurrentDate(today);
        hasInitializedScroll.current = true;
      }
    }, [])
  );
  // Unused state variable - keeping for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setWeekStart] = useState(startOfWeek(new Date()));
  const [weeks, setWeeks] = useState<Date[][]>([]);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const scrollX = React.useRef(6 * screenWidth); // Start at the middle week
  // Day width is used for calculations but not directly in rendering

  // Removed separate month tracking

  // Generate weeks based on the current month being viewed
  useEffect(() => {
    const generateWeeks = () => {
      const weeksArray: Date[][] = [];

      // Get the first day of the current month
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      // Get the last day of the current month
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Get the first day to show (previous Sunday from the 1st of the month)
      let currentWeekStart = startOfWeek(firstDayOfMonth);

      // Generate 6 weeks to ensure we have enough weeks to display
      for (let i = 0; i < 6; i++) {
        const week: Date[] = [];
        // Generate 7 days for this week
        for (let j = 0; j < 7; j++) {
          week.push(addDays(currentWeekStart, j));
        }
        weeksArray.push(week);

        // Move to next week
        currentWeekStart = addWeeks(currentWeekStart, 1);
      }

      return weeksArray;
    };

    setWeeks(generateWeeks());
  }, [currentDate.getMonth(), currentDate.getFullYear()]); // Only regenerate when month or year changes

  // Remove the separate month tracking since we'll use currentDate directly

  // Store the current week index separately to maintain position
  const currentWeekIndex = useRef<number>(0);

  // Update the current week index when currentDate changes
  useEffect(() => {
    if (weeks.length > 0) {
      const index = weeks.findIndex(week =>
        week.some(day => isSameDay(day, currentDate))
      );
      if (index >= 0) {
        currentWeekIndex.current = index;
      }
    }
  }, [currentDate, weeks]);

  // Handle scroll position when header expands/collapses
  useEffect(() => {
    if (scrollViewRef.current && weeks.length > 0 && hasInitializedScroll.current) {
      const scrollTo = currentWeekIndex.current * screenWidth;

      // Small delay to ensure the layout is updated
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
          scrollX.current = scrollTo;
        }
      }, 10);
    }
  }, [isHeaderCollapsed, weeks, screenWidth]);

  // Always keep selectedDayOfWeek in sync with currentDate
  useEffect(() => {
    setSelectedDayOfWeek(currentDate.getDay());
  }, [currentDate]);

  // Track scroll position and update current date based on visible week
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Update scroll position for tracking
    scrollX.current = offsetX;

    // Calculate the current week index based on scroll position
    const weekIndex = Math.round(offsetX / screenWidth);

    // Only update if we have valid week data
    if (weeks[weekIndex] && weeks[weekIndex][selectedDayOfWeek]) {
      const targetDay = weeks[weekIndex][selectedDayOfWeek];
      // Only update if the day is different to prevent unnecessary re-renders
      if (!isSameDay(targetDay, currentDate)) {
        // Update the date immediately for better UX
        setCurrentDate(new Date(targetDay.getTime()));
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    // Create a new date object with just the date part (no time)
    const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Update the current date and the selected day of week
    setCurrentDate(newDate);
    setSelectedDayOfWeek(newDate.getDay());

    // Find which week this date is in
    const weekIndex = weeks.findIndex(week =>
      week.some(day => isSameDay(day, newDate))
    );

    if (weekIndex >= 0 && scrollViewRef.current) {
      const scrollTo = weekIndex * screenWidth;
      // Only scroll if not already at the correct position
      if (Math.abs(scrollX.current - scrollTo) > 1) {
        scrollViewRef.current.scrollTo({
          x: scrollTo,
          animated: true,
        });
        scrollX.current = scrollTo;
      }
    }
  };
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.monthYearContainer}>
          <Text style={styles.monthYearText}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
        </View>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'daily' && styles.activeViewMode]}
            onPress={() => setViewMode('daily')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={viewMode === 'daily' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'weekly' && styles.activeViewMode]}
            onPress={() => setViewMode('weekly')}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={viewMode === 'weekly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'monthly' && styles.activeViewMode]}
            onPress={() => setViewMode('monthly')}
          >
            <Ionicons
              name="calendar-sharp"
              size={16}
              color={viewMode === 'monthly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Day names */}
      <View style={styles.daysHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
          // Get the date for this day in the currently visible week
          const firstDayOfWeek = startOfWeek(currentDate);
          const dayDate = addDays(firstDayOfWeek, index);

          // Only show 'TODAY' if this is the actual current date
          const isCurrentDay = isToday(dayDate);
          const displayText = isCurrentDay ? 'TODAY' : day;

          return (
            <View key={index} style={styles.dayNameContainer}>
              <Text style={[
                styles.dayName,
                isCurrentDay && styles.todayText,
              ]}>
                {displayText}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Weeks */}
      <View style={styles.scrollContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weeksContainer}
          snapToInterval={screenWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled
          onMomentumScrollEnd={handleScroll}
          onScrollBeginDrag={() => {}}
          scrollEventThrottle={16}
        >
          {weeks.map((week, index) => renderWeek(week, index))}
        </ScrollView>
      </View>

      {/* View mode selector */}
    </View>
  );

  const renderWeek = (week: Date[], weekIndex: number) => {
    return (
      <View
        key={`week-${weekIndex}`}
        style={[
          styles.weekContainer,
          { width: screenWidth },
        ]}
      >
        {week.map((date) => {
          const isCurrentDay = isToday(date);
          const isSelected = isSameDay(date, currentDate);

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dayContainer,
                isCurrentDay && styles.currentDayContainer,
                isSelected && styles.selectedDayContainer,
              ]}
              onPress={() => handleDateSelect(date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayText,
                isCurrentDay && styles.currentDayText,
                isSelected && styles.selectedDayText,
              ]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const handleContentScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const newIsCollapsed = y > 40;

    // Only update if the collapsed state actually changes
    if (newIsCollapsed !== isHeaderCollapsed) {
      // Save the current scroll position before updating
      const currentScrollX = scrollX.current;
      setIsHeaderCollapsed(newIsCollapsed);

      // Restore the horizontal scroll position after state update
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: currentScrollX, animated: false });
        }
      }, 10);
    }
  }, [isHeaderCollapsed]);

const renderTabContent = () => {
  switch (activeTab) {
    case 'journal':
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollViewContent}
          onScroll={handleContentScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.componentSpacing}>
            <TodaysFocus />
          </View>
          <View style={styles.componentSpacing}>
            <Todos />
          </View>
          <View style={styles.componentSpacing}>
            <TimeBlock />
          </View>
          <View style={styles.componentSpacing}>
            <GuidedReflection />
          </View>
          <View style={styles.componentSpacing}>
            <GratitudeList />
          </View>
          <View style={styles.componentSpacing}>
            <JournalEntries />
          </View>
          <View style={styles.componentSpacing}>
            <TodayWin />
          </View>
          <View style={styles.componentSpacing}>
            <LookingForward />
          </View>
          </ScrollView>
        );
      case 'schedule':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabText}>Schedule Content</Text>
          </View>
        );
      case 'prayer':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabText}>Prayer Content</Text>
          </View>
        );
      case 'finance':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabText}>Finance Content</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'journal' && styles.activeTab]}
        onPress={() => setActiveTab('journal')}
      >
        <Ionicons
          name="journal-outline"
          size={20}
          color={activeTab === 'journal' ? Colors.alertCoral : Colors.mediumGray}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'schedule' && styles.activeTab]}
        onPress={() => setActiveTab('schedule')}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={activeTab === 'schedule' ? Colors.alertCoral : Colors.mediumGray}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'prayer' && styles.activeTab]}
        onPress={() => setActiveTab('prayer')}
      >
        <Ionicons
          name="heart-outline"
          size={20}
          color={activeTab === 'prayer' ? Colors.alertCoral : Colors.mediumGray}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'finance' && styles.activeTab]}
        onPress={() => setActiveTab('finance')}
      >
        <Ionicons
          name="wallet-outline"
          size={20}
          color={activeTab === 'finance' ? Colors.alertCoral : Colors.mediumGray}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.monthYearContainer, styles.headerContent, isHeaderCollapsed && styles.collapsedPadding]}>
          <Text style={styles.monthYearText}>
            {isHeaderCollapsed ? format(currentDate, 'MMMM d, yyyy') : format(currentDate, 'MMMM yyyy')}
          </Text>
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'daily' && styles.activeViewMode]}
              onPress={() => setViewMode('daily')}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={viewMode === 'daily' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'weekly' && styles.activeViewMode]}
              onPress={() => setViewMode('weekly')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={viewMode === 'weekly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'monthly' && styles.activeViewMode]}
              onPress={() => setViewMode('monthly')}
            >
              <Ionicons
                name="calendar-sharp"
                size={16}
                color={viewMode === 'monthly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
          </View>
        </View>
        {!isHeaderCollapsed && (
          <>
            <View style={styles.daysHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                const firstDayOfWeek = startOfWeek(currentDate);
                const dayDate = addDays(firstDayOfWeek, index);
                const isCurrentDay = isToday(dayDate);
                const displayText = isCurrentDay ? 'TODAY' : day;
                return (
                  <View key={index} style={styles.dayNameContainer}>
                    <Text style={[
                      styles.dayName,
                      isCurrentDay && styles.todayText,
                    ]}>
                      {displayText}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.scrollContainer}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weeksContainer}
                snapToInterval={screenWidth}
                snapToAlignment="start"
                decelerationRate="fast"
                pagingEnabled
                onMomentumScrollEnd={handleScroll}
                onScrollBeginDrag={() => {}}
                scrollEventThrottle={16}
              >
                {weeks.map((week, index) => renderWeek(week, index))}
              </ScrollView>
            </View>
          </>
        )}
      </View>
      {renderTabBar()}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  componentSpacing: {
    marginBottom: 10,  // Reduced from 16 to 10 for tighter spacing
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  tabItem: {
    padding: 8,
    marginLeft: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)', // alertCoral with 20% opacity
  },
  tabContent: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 80, // Add extra padding at the bottom to prevent content from being hidden behind tab bar
  },
  tabText: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    marginVertical: 12,
  },
  header: {
    backgroundColor: Colors.anchorBlue,
    paddingTop: 60, // Add padding to account for status bar
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
  },
  viewModeButton: {
    padding: 6,
    borderRadius: 14,
    marginHorizontal: 1,
  },
  activeViewMode: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewModeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  activeViewModeText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  monthYearContainer: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: Colors.anchorBlue,
  },
  collapsedDateText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginRight: 12,
  },
  monthYearText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.anchorBlue,
  },
  dayNameContainer: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 9,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.2,
  },
  todayText: {
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    fontSize: 9,
    letterSpacing: 0.2,
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekContainer: {
    width: Dimensions.get('window').width,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dayContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    flexShrink: 0,
  },
  currentDayContainer: {
    backgroundColor: Colors.hopeWhite,
  },
  selectedDayContainer: {
    backgroundColor: Colors.anchorBlue,
    borderWidth: 2,
    borderColor: Colors.hopeWhite,
    zIndex: 1, // Ensure selected day appears above other elements
    elevation: 1, // For Android
  },
  dayText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  currentDayText: {
    color: Colors.anchorBlue,
    fontFamily: Fonts.bold,
  },
  selectedDayText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  viewModeContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  viewModeButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  activeViewModeCompact: {
    backgroundColor: Colors.hopeWhite,
  },
  viewModeTextCompact: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  activeViewModeTextCompact: {
    color: Colors.anchorBlue,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    width: '100%',
  },
  collapsedPadding: {
    paddingBottom: 0,
  },
  dateText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
});

export default JournalScreen;
