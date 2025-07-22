import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, RefreshControl } from 'react-native';
import { useScroll } from '../context/ScrollContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, addDays, startOfWeek, isSameDay, addWeeks, isToday } from 'date-fns';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { TodaysFocusReactQuery } from '../components/journal/TodaysFocusReactQuery';
import { Todos } from '../components/journal/Todos';
import { TimeBlock } from '../components/journal/TimeBlock';
import { GratitudeList } from '../components/journal/GratitudeList';
import { ReflectionLog } from '../components/journal/ReflectionLog';
import { TodayWinReactQuery } from '../components/journal/TodayWinReactQuery';
import { LookingForwardReactQuery } from '../components/journal/LookingForwardReactQuery';
import { ScheduleContent } from '../components/journal/ScheduleContent';
import PrayerJournalTab from '../components/journal/PrayerJournalTab';
import { useAuth } from '../context/AuthContext';
import { forceRefreshAllJournalData } from '../storage/journalStorage';
import { forceRefreshReflectionEntries } from '../storage/reflectionStorage';

type TabType = 'journal' | 'schedule' | 'prayer' | 'finance';

type ViewMode = 'daily' | 'weekly' | 'monthly';

export type JournalScreenRef = {
  resetToCurrentDate: () => void;
};

const JournalScreen = forwardRef<JournalScreenRef>((props, ref) => {
  const { user } = useAuth();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const scrollX = useRef(0);

  // Scroll tracking refs
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('');
  const scrollTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Animation state
  const scrollY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const weekOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const weekHeight = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [44, 0],
    extrapolate: 'clamp',
  });


  useEffect(() => {
    const generateWeeks = () => {
      const weeksArray: Date[][] = [];

      // Get the first day of the current month
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

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
  }, [currentDate]);

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

  // Initialize scroll position when weeks are first generated
  useEffect(() => {
    if (scrollViewRef.current && weeks.length > 0 && currentWeekIndex.current >= 0) {
      const scrollTo = currentWeekIndex.current * screenWidth;

      // Small delay to ensure the layout is updated
      setTimeout(() => {
        if (scrollViewRef.current) {
          console.log('📅 Initializing scroll position to week', currentWeekIndex.current, 'at position', scrollTo);
          scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
          scrollX.current = scrollTo;
        }
      }, 50);
    }
  }, [weeks, screenWidth]);

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

  // Switch away from prayer tab when future date is selected
  useEffect(() => {
    const isFutureDate = currentDate > new Date();
    if (isFutureDate && activeTab === 'prayer') {
      setActiveTab('journal');
    }
  }, [currentDate, activeTab]);

  // Track scroll position and update current date based on visible week
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Update scroll position for tracking
    scrollX.current = offsetX;

    // Calculate the current week index based on scroll position
    const weekIndex = Math.round(offsetX / screenWidth);

    // Add bounds checking and ensure we have valid data
    if (weeks.length > 0 && weekIndex >= 0 && weekIndex < weeks.length) {
      const currentWeek = weeks[weekIndex];
      if (currentWeek && currentWeek.length > selectedDayOfWeek && selectedDayOfWeek >= 0) {
        const targetDay = currentWeek[selectedDayOfWeek];
        if (targetDay) {
          // Only update if the day is different to prevent unnecessary re-renders
          if (!isSameDay(targetDay, currentDate)) {
            console.log('📅 Date swipe: updating to', format(targetDay, 'yyyy-MM-dd'));
            // Update the date immediately for better UX
            setCurrentDate(new Date(targetDay.getTime()));
          }
        }
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

  const renderWeek = (week: Date[], weekIndex: number) => {
    return (
      <View
        key={`week-${weekIndex}`}
        style={[styles.weekContainer, { width: screenWidth }]}
      >
        {week.map((date) => {
          const isCurrentDay = isToday(date);
          const isSelected = isSameDay(date, currentDate);
          const dayName = format(date, 'EEE').toUpperCase();
          const dayNumber = format(date, 'd');

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
              <View style={styles.dayContent}>
                <Text
                  style={[
                    styles.dayNameText,
                    (isCurrentDay || isSelected) && styles.dayNameTextHighlighted,
                  ]}
                >
                  {isCurrentDay ? 'TODAY' : dayName}
                </Text>
                <Text
                  style={[
                    styles.dayNumberText,
                    isCurrentDay && !isSelected && styles.currentDayText,
                    isSelected && styles.selectedDayText,
                  ]}
                >
                  {dayNumber}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const { setShowTabBar } = useScroll();

  const handleContentScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    const isScrollingUp = y < (lastScrollY.current || 0);

    // Update scroll direction
    scrollDirection.current = isScrollingUp ? 'up' : 'down';
    lastScrollY.current = y;

    // Update header animation
    scrollY.setValue(y);

    // Update header collapsed state
    const shouldBeCollapsed = y > 40;
    if (shouldBeCollapsed !== isHeaderCollapsed) {
      setIsHeaderCollapsed(shouldBeCollapsed);
    }

    // Show/hide tab bar based on scroll direction
    clearTimeout(scrollTimeout.current);
    if (scrollDirection.current === 'down' && y > 20) {
      setShowTabBar(false);
    } else if (scrollDirection.current === 'up') {
      setShowTabBar(true);
    }

    // Auto-show tab bar when scrolling stops or near top
    scrollTimeout.current = setTimeout(() => {
      if (y < 20) {
        setShowTabBar(true);
      }
    }, 1000);
  }, [isHeaderCollapsed, scrollY, setShowTabBar]);

  // Pull-to-refresh function
  const handleRefresh = useCallback(async () => {
    if (!user || isRefreshing) {return;}

    setIsRefreshing(true);

    try {
      console.log('Starting pull-to-refresh for all journal data...');

      // Force refresh all journal data (gratitude, todos, today_win, looking_forward)
      await forceRefreshAllJournalData(user.id, currentDate);

      // Force refresh reflection entries
      await forceRefreshReflectionEntries(user.id, currentDate);

      // Increment refresh key to trigger re-render of all components
      setRefreshKey(prev => prev + 1);

      console.log('Pull-to-refresh completed successfully');
    } catch (error) {
      console.error('Error during pull-to-refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, currentDate, isRefreshing]);

  const renderTabContent = () => {
    const isFutureDate = currentDate > new Date();

    switch (activeTab) {
      case 'journal':
        return (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollViewContent}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.alertCoral}
                colors={[Colors.alertCoral]}
              />
            }
          >
            <View style={styles.componentSpacing}>
              <TodaysFocusReactQuery selectedDate={currentDate} refreshKey={refreshKey} />
            </View>
            <View style={styles.componentSpacing}>
              <Todos selectedDate={currentDate} refreshKey={refreshKey} />
            </View>
            <View style={styles.componentSpacing}>
              <TimeBlock selectedDate={currentDate} refreshKey={refreshKey} />
            </View>
            {/* Only show these components for today or past dates */}
            {!isFutureDate && (
              <>
                <View style={styles.componentSpacing}>
                  <GratitudeList selectedDate={currentDate} />
                </View>
                <View style={styles.componentSpacing}>
                  <ReflectionLog
                    selectedDate={currentDate}
                    refreshKey={refreshKey}
                  />
                </View>
                <View style={styles.componentSpacing}>
                  <TodayWinReactQuery selectedDate={currentDate} />
                </View>
                <View style={styles.componentSpacing}>
                  <LookingForwardReactQuery selectedDate={currentDate} />
                </View>
              </>
            )}
          </ScrollView>
        );
      case 'schedule':
        return (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollViewContent}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.alertCoral}
                colors={[Colors.alertCoral]}
              />
            }
          >
            <ScheduleContent selectedDate={currentDate} />
          </ScrollView>
        );
      case 'prayer':
        return (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollViewContent}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.alertCoral}
                colors={[Colors.alertCoral]}
              />
            }
          >
            <PrayerJournalTab selectedDate={currentDate} />
          </ScrollView>
        );
      case 'finance':
        return (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollViewContent}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.alertCoral}
                colors={[Colors.alertCoral]}
              />
            }
          >
            <Text style={styles.tabText}>Finance Content</Text>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  const renderTabBar = () => {
    const isFutureDate = currentDate > new Date();

    return (
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
        {/* Hide prayer tab for future dates */}
        {!isFutureDate && (
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
        )}
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.monthYearContainer, styles.headerContent, isHeaderCollapsed && styles.collapsedPadding]}>
          <Text style={styles.monthYearText}>
            {isHeaderCollapsed
              ? currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'EEEE, MMMM d')
                : format(currentDate, 'EEEE, MMMM d, yyyy')
              : currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'MMMM')
                : format(currentDate, 'MMMM yyyy')}
          </Text>
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'daily' && styles.activeViewMode]}
              onPress={() => setViewMode('daily')}
            >
              <Ionicons
                name="calendar"
                size={20}
                color={viewMode === 'daily' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'weekly' && styles.activeViewMode]}
              onPress={() => setViewMode('weekly')}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={viewMode === 'weekly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'monthly' && styles.activeViewMode]}
              onPress={() => setViewMode('monthly')}
            >
              <Ionicons
                name="calendar-sharp"
                size={20}
                color={viewMode === 'monthly' ? Colors.hopeWhite : 'rgba(255,255,255,0.7)'}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Animated.View
          style={[
            styles.scrollContainer,
            {
              opacity: weekOpacity,
              height: weekHeight,
            },
          ]}
        >
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
            scrollEventThrottle={16}
          >
            {weeks.map((week, index) => renderWeek(week, index))}
          </ScrollView>
        </Animated.View>
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
    marginBottom: 8,
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
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  tabContent: {
    flex: 1,
  },
  tabContentNoPadding: {
    flex: 1,
    padding: 0,
  },
  scheduleTabContent: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollViewContent: {
    padding: 8,
    paddingBottom: 100,
  },
  tabText: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    marginVertical: 12,
  },
  header: {
    backgroundColor: Colors.anchorBlue,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    padding: 4,
    borderRadius: 8,
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: Colors.anchorBlue,
    marginBottom: 0,
  },
  monthYearText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: Colors.hopeWhite,
    paddingRight: 12,
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
    height: 44,  // Reduced from 48
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    flexShrink: 0,
    paddingVertical: 1,  // Reduced from 2
  },
  dayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontFamily: Fonts.medium,
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 0,  // Removed margin
    letterSpacing: 0.1,
  },
  dayNameTextHighlighted: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  dayNumberText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.hopeWhite,
    lineHeight: 14,
  },
  currentDayContainer: {
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    zIndex: 1, // Ensure current day appears above other elements
    elevation: 1, // For Android
  },
  selectedDayContainer: {
    backgroundColor: Colors.alertCoral,
  },
  currentDayText: {
    color: Colors.hopeWhite,
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
    overflow: 'hidden',
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
