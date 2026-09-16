import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns';

import { adjustDayIndexForWeekStart } from '../../utils/weekStartUtils';
import type { Day } from 'date-fns';

import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface JournalCalendarStripProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  weekStartsOn: Day;
}

const WEEK_HPAD = 16;
const WEEKS_TO_GENERATE = 15;

const JournalCalendarStrip: React.FC<JournalCalendarStripProps> = ({
  currentDate,
  onSelectDate,
  weekStartsOn,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const scrollX = useRef(0);

  const weeks = useMemo(() => {
    const weeksArray: Date[][] = [];
    const startFrom = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    let currentWeekStart = startOfWeek(startFrom, { weekStartsOn });
    for (let i = 0; i < WEEKS_TO_GENERATE; i++) {
      const week: Date[] = [];
      for (let j = 0; j < 7; j++) {
        week.push(addDays(currentWeekStart, j));
      }
      weeksArray.push(week);
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }
    return weeksArray;
  }, [currentDate, weekStartsOn]);

  const currentWeekIndex = useMemo(() => {
    return weeks.findIndex(week => week.some(day => isSameDay(day, currentDate)));
  }, [weeks, currentDate]);

  const selectedDayOfWeek = useMemo(
    () => adjustDayIndexForWeekStart(currentDate.getDay(), weekStartsOn),
    [currentDate, weekStartsOn],
  );

  useEffect(() => {
    if (scrollViewRef.current && headerWidth > 0 && currentWeekIndex >= 0) {
      const scrollTo = currentWeekIndex * headerWidth;
      if (Math.abs(scrollX.current - scrollTo) > 1) {
        scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
        scrollX.current = scrollTo;
      }
    }
  }, [currentWeekIndex, headerWidth]);

  const handleScroll = (event: any) => {
    const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
    scrollX.current = offsetX;
  };

  const handleMomentumScrollEnd = (event: any) => {
    const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
    scrollX.current = offsetX;
    if (headerWidth === 0) { return; }
    const weekIndex = Math.round(offsetX / headerWidth);
    if (weekIndex >= 0 && weekIndex < weeks.length) {
      const targetDay = weeks[weekIndex][selectedDayOfWeek];
      if (targetDay && !isSameDay(targetDay, currentDate)) {
        onSelectDate(targetDay);
      }
    }
  };

  const renderWeek = (week: Date[], weekIndex: number) => {
    const dayWidth = Math.max(30, Math.floor((headerWidth - WEEK_HPAD * 2) / 7));
    return (
      <View
        key={`week-${weekIndex}`}
        style={[styles.weekContainer, { width: headerWidth, paddingHorizontal: WEEK_HPAD }]}
      >
        {week.map((date) => {
          const active = isSameDay(date, currentDate);
          const realToday = isToday(date);
          const dayName = format(date, 'EEE').toUpperCase();
          const dayNumber = format(date, 'd');

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dayContainer,
                { width: dayWidth },
                realToday && !active && styles.currentDayContainer,
                active && styles.selectedDayContainer,
              ]}
              onPress={() => onSelectDate(date)}
              activeOpacity={0.7}
            >
              <View style={styles.dayContent}>
                <ThemedText
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  style={[
                    styles.dayNameText,
                    realToday && !active && styles.currentDayNameText,
                    active && styles.dayNameTextHighlighted,
                  ]}
                >
                  {realToday ? 'TODAY' : dayName}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.dayNumberText,
                    realToday && !active && styles.currentDayText,
                    active && styles.selectedDayText,
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

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== headerWidth) { setHeaderWidth(w); }
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
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
        >
          {weeks.map((week, index) => renderWeek(week, index))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
    backgroundColor: Colors.hopeWhite,
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: WEEK_HPAD,
  },
  dayContainer: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    paddingVertical: 1,
  },
  dayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: Colors.textGray,
    marginBottom: 0,
    letterSpacing: 0.2,
  },
  dayNameTextHighlighted: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },
  currentDayNameText: {
    color: Colors.sage,
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  dayNumberText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 14,
  },
  currentDayContainer: {
    backgroundColor: Colors.anchorBlueLight,
  },
  selectedDayContainer: {
    backgroundColor: Colors.sage,
  },
  currentDayText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  selectedDayText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
});

export default JournalCalendarStrip;
