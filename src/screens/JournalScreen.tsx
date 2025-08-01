import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, RefreshControl, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Pencil, Check } from 'lucide-react-native';
import { useScroll } from '../context/ScrollContext';
import { format, addDays, startOfWeek, isSameDay, addWeeks, isToday } from 'date-fns';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import PlanCarousel from '../components/journal/PlanCarousel';
import ReflectCarousel from '../components/journal/ReflectCarousel';
import PrayCarousel from '../components/journal/PrayCarousel';

// New Plugin Architecture System
import { JournalSystem } from '../systems/journal';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { forceRefreshAllJournalData } from '../storage/journalStorage';
import { forceRefreshReflectionEntries } from '../storage/reflectionStorage';





export type JournalScreenRef = {
  resetToCurrentDate: () => void;
};

const JournalScreen = forwardRef<JournalScreenRef>((props, ref) => {
  const { user } = useAuth();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'carousel' | 'inline'>('carousel');
  const [currentPage, setCurrentPage] = useState(0);
  const [triggerGlobalEdit, setTriggerGlobalEdit] = useState(false);
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [targetComponentId, setTargetComponentId] = useState<string | null>(null);
  const lastSelectedDate = useRef<Date | null>(null);
  const pageScrollRefs = useRef<{ [key: string]: ScrollView | null }>({});
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Handle global edit mode changes from components
  const handleGlobalEditModeChange = useCallback((isEditMode: boolean) => {
    setIsGlobalEditMode(isEditMode);
  }, []);

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

  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(new Date().getDay());


  // Track if we've handled the initial scroll
  const hasInitializedScroll = useRef(false);

  // Reset scroll position when screen comes into focus
  useFocusEffect(
    useCallback(() => {
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
                    isCurrentDay && !isSelected && styles.currentDayNameText,
                    (isCurrentDay || isSelected) && isSelected && styles.dayNameTextHighlighted,
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

  // Pagination data
  const pages = useMemo(() => [
    { title: 'Plan', key: 'plan' },
    { title: 'Reflect', key: 'reflect' },
    { title: 'Pray', key: 'pray' },
  ], []);

  // Handle component tap to switch to inline view and scroll to specific component
  const handleComponentTap = useCallback((pageKey: string, componentId?: string) => {
    const pageIndex = pages.findIndex(page => page.key === pageKey);
    if (pageIndex !== -1) {
      setCurrentPage(pageIndex);
      setViewMode('inline');

      // Store the component to scroll to
      if (componentId) {
        setTargetComponentId(componentId);
      }

      // Scroll horizontal ScrollView to the correct page after a delay
      setTimeout(() => {
        if (horizontalScrollRef.current) {
          const currentScreenWidth = Dimensions.get('window').width;
          horizontalScrollRef.current.scrollTo({
            x: pageIndex * currentScreenWidth,
            animated: true,
          });
        }
      }, 100);
    }
  }, [pages]);

  // Removed unused handleBackToCarousel function

  // Component mapping for scroll-to functionality
  const componentMapping = useMemo(() => ({
    'focus': { page: 'plan', index: 0 },
    'todos': { page: 'plan', index: 1 },
    'timeblocks': { page: 'plan', index: 2 },
    'reflection': { page: 'reflect', index: 0 },
    'gratitude': { page: 'reflect', index: 1 },
    'todayswin': { page: 'reflect', index: 2 },
    'lookingforward': { page: 'reflect', index: 3 },
    'prayerjournal': { page: 'pray', index: 0 },
    'devotionalprayers': { page: 'pray', index: 1 },
    'peopleprayers': { page: 'pray', index: 2 },
  }), []);

  // Scroll to specific component
  const scrollToComponent = useCallback((componentId: string) => {
    const mapping = componentMapping[componentId as keyof typeof componentMapping];
    if (mapping) {
      const scrollView = pageScrollRefs.current[mapping.page];
      if (scrollView) {
        // Calculate approximate scroll position (each component wrapper is ~200px)
        const scrollPosition = mapping.index * 200;
        scrollView.scrollTo({ y: scrollPosition, animated: true });
      }
    }
  }, [componentMapping]);

  // Effect to handle scroll-to when target component changes
  useEffect(() => {
    if (targetComponentId && viewMode === 'inline') {
      // Delay scroll to ensure view has rendered
      setTimeout(() => {
        scrollToComponent(targetComponentId);
        setTargetComponentId(null);
      }, 300);
    }
  }, [targetComponentId, viewMode, scrollToComponent]);

  // Temporary function for testing component navigation
  // This can be called from console or added as onPress handlers
  const navigateToComponent = useCallback((componentId: string) => {
    const mapping = componentMapping[componentId as keyof typeof componentMapping];
    if (mapping) {
      handleComponentTap(mapping.page, componentId);
    }
  }, [componentMapping, handleComponentTap]);

  // Expose navigation function for testing
  useEffect(() => {
    // @ts-ignore - for testing purposes
    window.navigateToComponent = navigateToComponent;
  }, [navigateToComponent]);

  // Handle swipe to change pages
  const handlePageScroll = (event: any) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < pages.length) {
      setCurrentPage(pageIndex);
    }
  };

  // Handle swipe down gesture to close inline view
  const handleSwipeDown = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { velocityY, translationY } = event.nativeEvent;
      // Check for fast downward swipe (velocity > 500 and translation > 50)
      if (velocityY > 500 && translationY > 50) {
        setViewMode('carousel');
      }
    }
  };



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





  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
      <View style={styles.header}>
        <View style={[styles.monthYearContainer, styles.headerContent, isHeaderCollapsed && styles.collapsedPadding]}>
          <Text style={styles.monthYearText}>
            {isHeaderCollapsed
              ? (currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'EEEE, MMMM d')
                : format(currentDate, 'EEEE, MMMM d, yyyy'))
              : (currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'MMMM')
                : format(currentDate, 'MMMM yyyy'))}
          </Text>
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

      <View style={styles.content}>
        {viewMode === 'carousel' ? (
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              style={styles.tabContent}
              contentContainerStyle={styles.scrollViewContent}
              onScroll={handleContentScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.alertCoral}
                colors={[Colors.alertCoral]}
              />
            }
          >
            <View style={styles.carouselContainer}>
              <PlanCarousel
                selectedDate={currentDate}
                refreshKey={refreshKey}
                onComponentTap={(componentId) => {
                  const mapping = componentMapping[componentId as keyof typeof componentMapping];
                  if (mapping) {
                    handleComponentTap(mapping.page, componentId);
                  }
                }}
              />
            </View>
            {/* Only show ReflectCarousel for today or past dates */}
            {currentDate <= new Date() && (
              <>
                <View style={styles.carouselContainer}>
                  <ReflectCarousel
                    selectedDate={currentDate}
                    refreshKey={refreshKey}
                    onComponentTap={(componentId) => {
                      const mapping = componentMapping[componentId as keyof typeof componentMapping];
                      if (mapping) {
                        handleComponentTap(mapping.page, componentId);
                      }
                    }}
                  />
                </View>
                <View style={styles.carouselContainer}>
                  <PrayCarousel
                    selectedDate={currentDate}
                    onComponentTap={(componentId) => {
                      const mapping = componentMapping[componentId as keyof typeof componentMapping];
                      if (mapping) {
                        handleComponentTap(mapping.page, componentId);
                      }
                    }}
                  />
                </View>
              </>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <PanGestureHandler onHandlerStateChange={handleSwipeDown}>
            <View style={styles.inlineViewContainer}>
              <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              >
                <ScrollView
                ref={horizontalScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handlePageScroll}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.tabContent}
              >
              {pages.map((page, _index) => (
                <ScrollView
                  key={page.key}
                  ref={(scrollRef) => { pageScrollRefs.current[page.key] = scrollRef; }}
                  style={[styles.pageContainer, { width: Dimensions.get('window').width }]}
                  contentContainerStyle={styles.scrollViewContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefreshing}
                      onRefresh={handleRefresh}
                      tintColor={Colors.alertCoral}
                      colors={[Colors.alertCoral]}
                    />
                  }
                  onScroll={handleContentScroll}
                  scrollEventThrottle={16}
                >
                  <View style={styles.inlinePageContainer}>
                    <Text style={styles.inlinePageTitle}>{page.title}</Text>
                    <View style={styles.inlineComponentsContainer}>
                       {page.key === 'plan' && (
                         <JournalSystem
                           selectedDate={currentDate}
                           viewMode="inline"
                           categories={['plan']}
                           refreshKey={refreshKey}
                           triggerGlobalEdit={triggerGlobalEdit}
                           onGlobalEditTriggered={() => setTriggerGlobalEdit(false)}
                           onGlobalEditModeChange={handleGlobalEditModeChange}
                           style={styles.journalSystemContainer}
                         />
                       )}
                       {page.key === 'reflect' && currentDate <= new Date() && (
                         <JournalSystem
                           selectedDate={currentDate}
                           viewMode="inline"
                           categories={['reflect']}
                           refreshKey={refreshKey}
                           triggerGlobalEdit={triggerGlobalEdit}
                           onGlobalEditTriggered={() => setTriggerGlobalEdit(false)}
                           onGlobalEditModeChange={handleGlobalEditModeChange}
                           style={styles.journalSystemContainer}
                         />
                       )}
                       {page.key === 'pray' && currentDate <= new Date() && (
                         <JournalSystem
                           selectedDate={currentDate}
                           viewMode="inline"
                           categories={['pray']}
                           refreshKey={refreshKey}
                           triggerGlobalEdit={triggerGlobalEdit}
                           onGlobalEditTriggered={() => setTriggerGlobalEdit(false)}
                           onGlobalEditModeChange={handleGlobalEditModeChange}
                           style={styles.journalSystemContainer}
                         />
                       )}
                    </View>
                  </View>
                </ScrollView>
              ))}
              </ScrollView>
              </KeyboardAvoidingView>
              {/* Pagination Overlay */}
              <View style={styles.paginationOverlay}>
                <View style={styles.paginationContainer}>
                  {pages.map((page, index) => (
                    <View
                      key={page.key}
                      style={[
                        styles.paginationDot,
                        currentPage === index && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
                {/* Global Edit Button positioned beside pagination */}
                <TouchableOpacity
                  style={[styles.editButton, isGlobalEditMode && styles.editButtonActive]}
                  onPress={() => {
                    // Switch to inline view and trigger global edit mode
                    if (viewMode !== 'inline') {
                      setViewMode('inline');
                      // Trigger global edit mode after switching to inline view
                      setTimeout(() => {
                        setTriggerGlobalEdit(true);
                      }, 100);
                    } else {
                      // Toggle global edit mode if already in inline view
                      setTriggerGlobalEdit(true);
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={isGlobalEditMode ? 'Save and exit edit mode' : 'Enter global edit mode'}
                >
                  {isGlobalEditMode ? (
                    <Check size={12} color={Colors.hopeWhite} strokeWidth={2.5} />
                  ) : (
                    <Pencil size={12} color={Colors.hopeWhite} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </PanGestureHandler>
        )}
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
  keyboardAvoidingView: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
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
    gap: 24,
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
    padding: 4, // Reduced from 8
    paddingBottom: 100,
    gap: 0, // Add gap between carousel items
  },
  tabText: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    marginVertical: 12,
  },
  header: {
    backgroundColor: Colors.hopeWhite,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerContent: {
    backgroundColor: Colors.hopeWhite,
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
    color: Colors.anchorBlue,
    paddingRight: 12,
  },
  carouselContainer: {
    marginBottom: 34,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.hopeWhite,
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
    color: Colors.anchorBlue,
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
    color: 'rgba(26, 60, 109, 0.7)',
    marginBottom: 0,  // Removed margin
    letterSpacing: 0.1,
  },
  dayNameTextHighlighted: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 9,
    fontWeight: '600',
  },
  currentDayNameText: {
    color: Colors.anchorBlue,
    fontFamily: Fonts.bold,
    fontSize: 9,
    fontWeight: '600',
  },
  dayNumberText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.anchorBlue,
    lineHeight: 14,
  },
  currentDayContainer: {
    borderWidth: 0,
    backgroundColor: Colors.hopeWhite,
    zIndex: 1, // Ensure current day appears above other elements
    elevation: 1, // For Android
  },
  selectedDayContainer: {
    backgroundColor: Colors.alertCoral,
  },
  currentDayText: {
    color: Colors.anchorBlue,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedDayText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,

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
  // Swipable pagination styles
  pageContainer: {
    flex: 1,
  },
  // Inline view styles
  inlineViewContainer: {
    flex: 1,
    position: 'relative',
  },
  inlinePageContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inlinePageTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 20,
  },
  inlineComponentsContainer: {
    flex: 1,
  },
  componentWrapper: {
    marginBottom: 16,
  },
  journalSystemContainer: {
    flex: 1,
  },
  // Pagination overlay styles
  paginationOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  editButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: 50, // Half of pagination width + gap
    width: 24,
    height: 24,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Same as pagination background
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonActive: {
    backgroundColor: Colors.alertCoral, // Active state with coral background
  },
  paginationContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: Colors.hopeWhite,
    width: 20,
  },
});

export default JournalScreen;
