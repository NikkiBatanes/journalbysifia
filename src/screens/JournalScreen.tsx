import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { Spacing } from '../theme/styles';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const JournalScreen: React.FC = () => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const scrollViewRef = React.useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const scrollX = React.useRef(6 * screenWidth); // Start at the middle week
  const dayWidth = screenWidth / 7;

  // Get the start and end of the current week
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday as first day of week
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Generate days for 12 weeks total (6 weeks before and 6 weeks after current week)
  const weeks: Date[][] = [];
  const weeksToShow = 12; // Total weeks to show (6 before + current + 5 after)
  const startWeek = addWeeks(weekStart, -6); // Start 6 weeks before current week

  // Generate each week's dates
  for (let i = 0; i < weeksToShow; i++) {
    const weekStartDate = addWeeks(startWeek, i);
    const week: Date[] = [];

    // Generate 7 days for each week
    for (let j = 0; j < 7; j++) {
      week.push(addDays(weekStartDate, j));
    }
    weeks.push(week);


  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = direction === 'prev' ? subWeeks(prevDate, 1) : addWeeks(prevDate, 1);
      // Find the week index for the new date
      const weekIndex = weeks.findIndex(week =>
        week.some(day => isSameDay(day, newDate))
      );

      if (weekIndex >= 0 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          x: weekIndex * screenWidth,
          animated: true,
        });
      }

      return newDate;
    });
  };

  // Auto-scroll to current week on mount and when weeks change
  React.useEffect(() => {
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
  
  // Track scroll position with debounce to reduce updates
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Only update if the change is significant (more than 1 pixel)
    if (Math.abs(scrollX.current - offsetX) > 1) {
      scrollX.current = offsetX;
    }
  };

  const handleDateSelect = (date: Date) => {
    // Create a new date object with just the date part (no time)
    const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Update the current date
    setCurrentDate(newDate);
    
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
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <Text key={index} style={styles.dayName}>
            {day}
          </Text>
        ))}
      </View>

      {/* Weeks */}
      <View style={{ width: '100%' }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weeksContainer}
          snapToInterval={screenWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {weeks.map(renderWeek)}
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
          { width: screenWidth }
        ]}
      >
        {week.map((date, dayIndex) => {
          const isCurrentDay = isToday(date);
          const isSelected = isSameDay(date, currentDate);
          
          return (
            <TouchableOpacity 
              key={date.toISOString()}
              style={[
                styles.dayContainer,
                isCurrentDay && styles.currentDayContainer,
                isSelected && styles.selectedDayContainer
              ]}
              onPress={() => handleDateSelect(date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayText,
                isCurrentDay && styles.currentDayText,
                isSelected && styles.selectedDayText
              ]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      {/* Journal content will go here */}
      <View style={styles.content}>
        {/* Journal entries will be rendered here */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
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
    marginLeft: 2, // Align with the days of the week
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16, // Match the month year padding
    paddingVertical: 12,
    backgroundColor: Colors.anchorBlue,
  },
  dayName: {
    width: 40,
    textAlign: 'center',
    color: Colors.hopeWhite,
    fontSize: 12,
    opacity: 0.8,
    fontFamily: Fonts.regular,
    marginHorizontal: 2,
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
  dateText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
});

export default JournalScreen;
