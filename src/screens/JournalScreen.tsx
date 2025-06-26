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

  // Reset to Journal tab when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setActiveTab('journal');
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

  useEffect(() => {
    const generateWeeks = () => {
      const weeksArray: Date[][] = [];
      const now = new Date();

      // Add previous weeks
      for (let i = -4; i < 0; i++) {
        const weekStart = startOfWeek(addWeeks(now, i));
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
          week.push(addDays(weekStart, j));
        }
        weeksArray.push(week);
      }

      // Add current week
      const currentWeekStart = startOfWeek(now);
      const currentWeek: Date[] = [];
      for (let i = 0; i < 7; i++) {
        currentWeek.push(addDays(currentWeekStart, i));
      }
      weeksArray.push(currentWeek);

      // Add next weeks
      for (let i = 1; i <= 12; i++) {
        const weekStart = startOfWeek(addWeeks(now, i));
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
          week.push(addDays(weekStart, j));
        }
        weeksArray.push(week);
      }

      return weeksArray;
    };

    setWeeks(generateWeeks());
  }, []);

  // Auto-scroll to current week on mount and when weeks change
  useEffect(() => {
    if (scrollViewRef.current && weeks.length > 0) {
      // Find the index of the week containing currentDate
      const weekIndex = weeks.findIndex(week =>
        week.some(day => isSameDay(day, currentDate))
      );

      if (weekIndex >= 0) {
        const scrollTo = weekIndex * screenWidth;
        // Only scroll if not already at the correct position
        if (Math.abs(scrollX.current - scrollTo) > 1) {
          scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
          scrollX.current = scrollTo;
        }
      }
    }
  }, [weeks, currentDate, screenWidth]);

  // Track scroll position and update current date based on visible week
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Update scroll position for tracking
    scrollX.current = offsetX;

    // Calculate the current week index based on scroll position
    const weekIndex = Math.round(offsetX / screenWidth);

    // Only update the date if we've scrolled to a new week
    const currentWeekIndex = weeks.findIndex(week =>
      week.some(day => isSameDay(day, currentDate))
    );

    if (weekIndex !== currentWeekIndex && weeks[weekIndex] && weeks[weekIndex][selectedDayOfWeek]) {
      const targetDay = weeks[weekIndex][selectedDayOfWeek];
      if (!isSameDay(targetDay, currentDate)) {
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
      // Calculate the currently visible week index
      const currentWeekIndex = Math.round(scrollX.current / screenWidth);

      // Only scroll if the selected date is in a different week
      if (weekIndex !== currentWeekIndex) {
        scrollViewRef.current.scrollTo({
          x: weekIndex * screenWidth,
          animated: true,
        });
        // Update the scroll position ref
        scrollX.current = weekIndex * screenWidth;
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'journal':
        return (
          <ScrollView style={styles.tabContent}>
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
      {renderHeader()}
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
    marginBottom: 16,
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
    padding: 16,
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
    padding: 8,
    borderRadius: 16,
    marginHorizontal: 2,
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
    paddingVertical: 16,
    paddingHorizontal: 6, // Match the padding of the days header
    backgroundColor: Colors.anchorBlue,
  },
  monthYearText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.anchorBlue,
  },
  dayNameContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    width: '100%',
  },
  todayText: {
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    fontSize: 10,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 16,
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
    padding: 16,
  },
  scrollContainer: {
    width: '100%',
  },
  dateText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
});

export default JournalScreen;
