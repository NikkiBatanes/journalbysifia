import { Calendar, LocaleConfig } from 'react-native-calendars';
import React, { useState, useEffect, useImperativeHandle, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, StatusBar, KeyboardAvoidingView, Platform, Modal, NativeModules } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, CalendarDays } from 'lucide-react-native';
import { isToday, isSameDay, format, startOfWeek, addDays, addWeeks } from 'date-fns';
import { adjustDayIndexForWeekStart } from '../utils/weekStartUtils';
import type { Day } from 'date-fns';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { useScroll } from '../context/ScrollContext';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

import PlanCarousel from '../components/journal/PlanCarousel';
import ReflectCarousel from '../components/journal/ReflectCarousel';
import PrayCarousel from '../components/journal/PrayCarousel';
import ThemedText from '../components/common/ThemedText';

// Inline system removed
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';

export type JournalScreenRef = {
  resetToCurrentDate: () => void;
};

const JournalScreen = React.forwardRef<JournalScreenRef, any>(({ navigation }, ref) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  // Create dynamic fonts object - match Dashboard approach
  const fonts = useMemo(() => ({
    fontRegular: getFontFamily(fontKey, 'regular'),
    fontMedium: getFontFamily(fontKey, 'medium'),
    fontSemiBold: getFontFamily(fontKey, 'semiBold'),
    fontBold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  // Create dynamic styles with theme fonts and insets
  const styles = useMemo(() => createStyles(fonts, insets), [fonts, insets]);
  useScreenStatusBar('dark', Colors.hopeWhite);
  // Layout constants for week header spacing
  const WEEK_HPAD = 16; // use a single consistent padding on both sides
  // Get week start preference from user metadata
  const weekStartPreference = (user as any)?.user_metadata?.preferences?.weekStart as
    | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | undefined;

  // Map preferences.weekStart to date-fns weekStartsOn (0=Sun ... 6=Sat)
  const weekStartsOn: Day = useMemo((): Day => {
    const key = weekStartPreference;
    const map: Record<string, Day> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return key ? (map[key] ?? 0) : 0; // default Sunday
  }, [weekStartPreference]);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { setShowTabBar, setContentScrollRef } = useScroll();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [refreshKey] = useState(0);
  const lastSelectedDate = useRef<Date | null>(null);

  // Removed: global edit mode (inline view no longer used)

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    resetToCurrentDate: () => {
      const now = new Date();

      setCurrentDate(prevDate => {
        // If already on today's date, toggle to last selected date if available
        if (isSameDay(prevDate, now) && lastSelectedDate.current && !isSameDay(lastSelectedDate.current, now)) {
          const prev = new Date(lastSelectedDate.current);
          lastSelectedDate.current = null;
          return prev;
        } else {
          // Save current date as last selected and go to today
          lastSelectedDate.current = new Date(prevDate);
          return now;
        }
      });
    },
  }));

  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(
    adjustDayIndexForWeekStart(new Date().getDay(), weekStartsOn)
  );

  // Configure calendar locale to show uppercase weekday headers (SUN, MON, ...)
  // This affects all Calendar instances unless defaultLocale is changed later.
  if (!LocaleConfig.locales.customUpper) {
    LocaleConfig.locales.customUpper = {
      monthNames: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ],
      monthNamesShort: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
      dayNames: ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'],
      dayNamesShort: ['SUN','MON','TUE','WED','THU','FRI','SAT'],
      today: 'TODAY',
    } as any;
  }
  LocaleConfig.defaultLocale = 'customUpper';

  // Subtle haptic feedback, gated by user preference
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;}
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) {return;}
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Ensure local YYYY-MM-DD formatting for calendar API (avoid UTC toISOString shifts)
  const formatLocalYYYYMMDD = useCallback((d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Track if we've handled the initial scroll
  const hasInitializedScroll = useRef(false);

  // Refs for header weeks scroller and vertical content scroller
  const scrollViewRef = useRef<ScrollView>(null);
  const contentScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setContentScrollRef(contentScrollRef);
    return () => {
      setContentScrollRef(null);
    };
  }, [setContentScrollRef]);

  // Reset to today's date when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setCurrentDate(today);
      hasInitializedScroll.current = true;
    }, [])
  );

  // Centralized reset: ensure top-of-content and clear transient UI
  const resetToTop = useCallback(() => {
    try {
      // Scroll vertical content to top
      contentScrollRef.current?.scrollTo?.({ y: 0, animated: false });
    } catch {}
    try {
      // Ensure header expanded
      setIsHeaderCollapsed(false);
    } catch {}
    try {
      // Reset to today's date
      const today = new Date();
      setCurrentDate(today);
      lastSelectedDate.current = null;
    } catch {}
    try {
      // Close calendar modal if open
      setShowCalendarModal(false);
    } catch {}
  }, []);

  // Listen for bottom tab presses to trigger reset
  useEffect(() => {
    const subSelf = navigation?.addListener?.('tabPress', resetToTop);
    const subParent = navigation?.getParent?.()?.addListener?.('tabPress', resetToTop);
    return () => {
      if (typeof subSelf === 'function') {subSelf();}
      if (typeof subParent === 'function') {subParent();}
    };
  }, [navigation, resetToTop]);

  // Store scroll position to preserve carousel position when navigating away
  const savedScrollPosition = useRef<number>(0);

  // Save scroll position when screen loses focus, restore when it gains focus
  useFocusEffect(
    useCallback(() => {
      // Restore scroll position when screen gains focus
      if (savedScrollPosition.current > 0) {
        setTimeout(() => {
          try {
            contentScrollRef.current?.scrollTo?.({ y: savedScrollPosition.current, animated: false });
          } catch {}
        }, 100); // Small delay to ensure content is rendered
      }

      // Return cleanup function that saves position when screen loses focus
      return () => {
        // savedScrollPosition.current is already being updated by handleContentScroll
      };
    }, [])
  );
  const [weeks, setWeeks] = useState<Date[][]>([]);
  const [_screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [headerWidth, setHeaderWidth] = useState<number>(0);
  const scrollX = useRef(0);

  // Update screen width on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      // Reset headerWidth to force re-measurement on orientation change
      setHeaderWidth(0);
    });
    return () => subscription?.remove();
  }, []);

  // Scroll tracking refs
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('');
  const scrollTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Haptics while header week is actively scrolled and implied date changes
  const lastHeaderHapticDateKey = useRef<string | null>(null);
  const lastHeaderHapticTime = useRef<number>(0);
  const handleHeaderScroll = useCallback((event: any) => {
    const now = Date.now();
    const { contentOffset } = event.nativeEvent || {};
    const offsetX = contentOffset?.x ?? 0;
    const weekIndex = Math.round(offsetX / headerWidth);
    if (weeks.length === 0 || weekIndex < 0 || weekIndex >= weeks.length) {return;}
    const currentWeek = weeks[weekIndex];
    if (!currentWeek || selectedDayOfWeek < 0 || selectedDayOfWeek >= currentWeek.length) {return;}
    const targetDay = currentWeek[selectedDayOfWeek];
    if (!targetDay) {return;}
    const key = format(targetDay, 'yyyy-MM-dd');
    if (key !== lastHeaderHapticDateKey.current && now - lastHeaderHapticTime.current > 120) {
      triggerLightHaptic();
      lastHeaderHapticDateKey.current = key;
      lastHeaderHapticTime.current = now;
    }
  }, [weeks, selectedDayOfWeek, headerWidth, triggerLightHaptic]);

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

      // Generate weeks spanning 3 months (previous, current, next) for smooth scrolling
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

      // Get the first day to show (start from previous month)
      let currentWeekStart = startOfWeek(prevMonth, { weekStartsOn });

      // Generate enough weeks to cover 3 months (approximately 12-15 weeks)
      for (let i = 0; i < 15; i++) {
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
  }, [currentDate, weekStartsOn]);

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
    if (scrollViewRef.current && weeks.length > 0 && currentWeekIndex.current >= 0 && headerWidth > 0) {
      const scrollTo = currentWeekIndex.current * headerWidth;

      // Small delay to ensure the layout is updated
      setTimeout(() => {
        if (scrollViewRef.current) {

          scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
          scrollX.current = scrollTo;
        }
      }, 50);
    }
  }, [weeks, headerWidth]);

  // Handle scroll position when header expands/collapses
  useEffect(() => {
    if (scrollViewRef.current && weeks.length > 0 && hasInitializedScroll.current && headerWidth > 0) {
      const scrollTo = currentWeekIndex.current * headerWidth;

      // Small delay to ensure the layout is updated
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
          scrollX.current = scrollTo;
        }
      }, 10);
    }
  }, [isHeaderCollapsed, weeks, headerWidth]);

  // Always keep selectedDayOfWeek in sync with currentDate
  useEffect(() => {
    setSelectedDayOfWeek(adjustDayIndexForWeekStart(currentDate.getDay(), weekStartsOn));
  }, [currentDate, weekStartsOn]);

  // Track scroll position and update current date based on visible week
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Update scroll position for tracking
    scrollX.current = offsetX;

    // Calculate the current week index based on scroll position
    if (headerWidth === 0) {return;}
    const weekIndex = Math.round(offsetX / headerWidth);

    // Add bounds checking and ensure we have valid data
    if (weeks.length > 0 && weekIndex >= 0 && weekIndex < weeks.length) {
      const currentWeek = weeks[weekIndex];
      if (currentWeek && currentWeek.length > selectedDayOfWeek && selectedDayOfWeek >= 0) {
        const targetDay = currentWeek[selectedDayOfWeek];
        if (targetDay) {
          // Only update if the day is different to prevent unnecessary re-renders
          if (!isSameDay(targetDay, currentDate)) {

            // Subtle feedback when swiping header left/right changes the date
            triggerLightHaptic();
            // Update the date immediately for better UX
            setCurrentDate(new Date(targetDay.getTime()));
          }

          // Check if we need to regenerate weeks for smooth scrolling across months
          // If we're near the edges (first 2 or last 2 weeks), regenerate with the new target date as center
          if (weekIndex <= 2 || weekIndex >= weeks.length - 3) {
            const targetMonth = targetDay.getMonth();
            const currentMonth = currentDate.getMonth();

            // Only regenerate if we've moved to a different month
            if (targetMonth !== currentMonth) {

              // The useEffect will trigger regeneration when currentDate changes
            }
          }
        }
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    // Feedback on picking a date from the week strip
    triggerLightHaptic();
    // Create a new date object with just the date part (no time)
    const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Update the current date and the selected day of week
    setCurrentDate(newDate);
    setSelectedDayOfWeek(adjustDayIndexForWeekStart(newDate.getDay(), weekStartsOn));

    // Find which week this date is in
    const weekIndex = weeks.findIndex(week =>
      week.some(day => isSameDay(day, newDate))
    );

    if (weekIndex >= 0 && scrollViewRef.current && headerWidth > 0) {
      const scrollTo = weekIndex * headerWidth;
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
    const dayWidth = Math.floor((headerWidth - WEEK_HPAD * 2) / 7);
    return (
      <View
        key={`week-${weekIndex}`}
        style={[styles.weekContainer, { width: headerWidth, paddingHorizontal: WEEK_HPAD }]}
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
                { width: dayWidth },
                isCurrentDay && styles.currentDayContainer,
                isSelected && styles.selectedDayContainer,
              ]}
              onPress={() => handleDateSelect(date)}
              activeOpacity={0.7}
            >
              <View style={styles.dayContent}>
                <ThemedText
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  style={[
                    styles.dayNameText,
                    isCurrentDay && !isSelected && styles.currentDayNameText,
                    (isCurrentDay || isSelected) && isSelected && styles.dayNameTextHighlighted,
                  ]}
                >
                  {isCurrentDay ? 'TODAY' : dayName}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.dayNumberText,
                    isCurrentDay && !isSelected && styles.currentDayText,
                    isSelected && styles.selectedDayText,
                  ]}
                >
                  {dayNumber}
                </ThemedText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };



  // Inline view removed: no pages pagination

  const handleContentScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    const isScrollingUp = y < (lastScrollY.current || 0);

    // Save scroll position for restoration when navigating back
    savedScrollPosition.current = y;

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

  // Pull-to-refresh REMOVED - using skeleton loading instead to prevent logout issues

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
      <View style={styles.header}>
        <View style={[styles.monthYearContainer, styles.headerContent, isHeaderCollapsed && styles.collapsedPadding]}>
          <ThemedText weight="bold" style={styles.monthYearText}>
            {isHeaderCollapsed
              ? (currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'EEEE, MMMM d')
                : format(currentDate, 'EEEE, MMMM d, yyyy'))
              : (currentDate.getFullYear() === new Date().getFullYear()
                ? format(currentDate, 'MMMM')
                : format(currentDate, 'MMMM yyyy'))}
          </ThemedText>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => { triggerLightHaptic(); navigation.navigate('JournalMoments'); }}
              accessibilityRole="button"
              accessibilityLabel="Add note"
            >
              <Feather size={24} color={Colors.anchorBlue} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarIconButton}
              onPress={() => { triggerLightHaptic(); setShowCalendarModal(true); }}
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
            >
              <CalendarDays size={26} color={Colors.anchorBlue} />
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
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && w !== headerWidth) {setHeaderWidth(w);}
          }}
        >
          {headerWidth > 0 && (
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weeksContainer}
              snapToInterval={headerWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              pagingEnabled
              onScroll={handleHeaderScroll}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
            >
              {weeks.map((week, index) => renderWeek(week, index))}
            </ScrollView>
          )}
        </Animated.View>
      </View>

      <View style={styles.content}>
        {
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              ref={contentScrollRef}
              style={styles.tabContent}
              contentContainerStyle={styles.scrollViewContent}
              onScroll={handleContentScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.carouselContainer}>
                <PlanCarousel
                  selectedDate={currentDate}
                  refreshKey={refreshKey}
                />
              </View>
              {/* Only show ReflectCarousel for today or past dates */}
              {currentDate <= new Date() && (
                <>
                  <View style={styles.carouselContainer}>
                    <ReflectCarousel
                      selectedDate={currentDate}
                      refreshKey={refreshKey}
                    />
                  </View>
                  <View style={styles.carouselContainer}>
                    <PrayCarousel selectedDate={currentDate} />
                  </View>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        }
      </View>

      {/* Full Calendar Modal for quick date selection */}
      <Modal
        visible={showCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ThemedText weight="semiBold" style={styles.modalTitle}>SELECT DATE</ThemedText>
            <View style={styles.calendarWrapper}>
              <Calendar
                current={formatLocalYYYYMMDD(currentDate)}
                renderHeader={(date) => (
                  <ThemedText weight="semiBold" style={styles.monthHeaderText}>{format(new Date(date as any), 'MMMM yyyy').toUpperCase()}</ThemedText>
                )}
                style={styles.calendarCompact}
                headerStyle={styles.calendarHeaderCompact}
                onPressArrowLeft={(subtractMonth: () => void) => {
                  // Haptic on tapping previous month
                  triggerLightHaptic();
                  subtractMonth();
                }}
                onPressArrowRight={(addMonth: () => void) => {
                  // Haptic on tapping next month
                  triggerLightHaptic();
                  addMonth();
                }}
                onDayPress={(day) => {
                  // Feedback on picking a date from the calendar modal
                  triggerLightHaptic();
                  const [y, m, d] = day.dateString.split('-').map(n => parseInt(n, 10));
                  const picked = new Date(y, (m - 1), d);
                  setCurrentDate(picked);
                  lastSelectedDate.current = picked;
                  setShowCalendarModal(false);
                }}
                monthFormat="MMMM yyyy"
                hideArrows={false}
                hideExtraDays={false}
                firstDay={weekStartsOn}
                enableSwipeMonths={true}
                theme={{
                  calendarBackground: Colors.anchorBlue,
                  textSectionTitleColor: Colors.hopeWhite,
                  selectedDayBackgroundColor: Colors.alertCoral,
                  selectedDayTextColor: Colors.hopeWhite,
                  todayTextColor: Colors.alertCoral,
                  dayTextColor: Colors.hopeWhite,
                  textDisabledColor: 'rgba(255,255,255,0.35)',
                  arrowColor: Colors.hopeWhite,
                  monthTextColor: Colors.hopeWhite,
                  textDayFontFamily: fonts.fontMedium,
                  textMonthFontFamily: fonts.fontBold,
                  textDayHeaderFontFamily: fonts.fontMedium,
                  // Compact sizing
                  textDayFontSize: 13,
                  textDayHeaderFontSize: 11,
                }}
                markingType="custom"
                markedDates={(function(){
                  const selectedStr = formatLocalYYYYMMDD(currentDate);
                  const todayStr = formatLocalYYYYMMDD(new Date());
                  const marked: any = {
                    [selectedStr]: {
                      selected: true,
                      customStyles: {
                        text: { fontFamily: fonts.fontBold, color: Colors.hopeWhite },
                      },
                    },
                  };
                  if (todayStr !== selectedStr) {
                    marked[todayStr] = {
                      customStyles: {
                        text: { color: Colors.alertCoral, fontFamily: fonts.fontBold },
                      },
                    };
                  }
                  return marked;
                })()}
              />
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                // Haptic on cancel
                triggerLightHaptic();
                setShowCalendarModal(false);
              }}
            >
              <ThemedText weight="semiBold" style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
});

const createStyles = (fonts: {
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
}, insets: { top: number; bottom: number; left: number; right: number }) => StyleSheet.create({
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
    paddingTop: 24, // vertical padding only (increased to restore spacing)
    paddingBottom: 100,
    paddingHorizontal: 0,
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
    paddingTop: insets.top,
    paddingBottom: 12,
  },
  headerContent: {
    backgroundColor: Colors.hopeWhite,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 14,
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
    fontFamily: fonts.fontMedium,
    fontSize: 14,
  },
  activeViewModeText: {
    color: Colors.hopeWhite,
    fontFamily: fonts.fontBold,
  },
  monthYearContainer: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: Colors.anchorBlue,
    marginBottom: 0,
  },
  monthYearText: {
    fontSize: 18,
    fontFamily: fonts.fontBold,
    color: Colors.anchorBlue,
    paddingRight: 12,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 0,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  calendarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
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
    fontFamily: fonts.fontMedium,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.2,
  },
  todayText: {
    fontFamily: fonts.fontBold,
    color: Colors.anchorBlue,
    fontSize: 9,
    letterSpacing: 0.2,
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dayContainer: {
    flex: 1,
    height: 44,  // Reduced from 48
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    paddingVertical: 1,  // Reduced from 2
  },
  dayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontFamily: fonts.fontSemiBold,
    fontSize: 10,
    color: 'rgba(26, 60, 109, 0.9)',
    marginBottom: 0,
    letterSpacing: 0.2,
  },
  dayNameTextHighlighted: {
    color: Colors.hopeWhite,
    fontFamily: fonts.fontSemiBold,
    fontSize: 10,
  },
  currentDayNameText: {
    color: Colors.anchorBlue,
    fontFamily: fonts.fontBold,
    fontSize: 10,
  },
  dayNumberText: {
    fontFamily: fonts.fontBold,
    fontSize: 14,
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
    fontFamily: fonts.fontBold,
    fontSize: 14,
  },
  selectedDayText: {
    color: Colors.hopeWhite,
    fontFamily: fonts.fontBold,
    fontSize: 14,
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
    fontFamily: fonts.fontMedium,
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
    fontFamily: fonts.fontBold,
    fontSize: 20,
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
  // Calendar modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 20,
    marginTop: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: fonts.fontSemiBold,
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  calendarWrapper: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  // Cancel-style button matching Todos
  modalButton: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonText: {
    fontFamily: fonts.fontSemiBold,
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  monthHeaderText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontFamily: fonts.fontSemiBold,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
  calendarCompact: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
  },
  calendarHeaderCompact: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginBottom: 2,
  },
});

export default withErrorBoundary(JournalScreen, 'JournalScreen');
