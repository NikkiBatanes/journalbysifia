/**
 * WeeklyStreakRow.tsx
 * Displays a row of 7 days representing the user's weekly streak
 * Respects user's week start preference and shows completion states
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type DayState = 'completed' | 'missed' | 'today' | 'future';

interface WeeklyStreakRowProps {
  weekStart?: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  dayStates: DayState[];
  dayLabels?: string[];
  appearance?: 'dark' | 'light';
}

const DAY_LABELS: Record<string, string> = {
  Sunday: 'S',
  Monday: 'M',
  Tuesday: 'T',
  Wednesday: 'W',
  Thursday: 'T',
  Friday: 'F',
  Saturday: 'S',
};

const FULL_DAY_LABELS: Record<string, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

const WEEK_ORDER: Record<string, string[]> = {
  Sunday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  Monday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  Tuesday: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'],
  Wednesday: ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'],
  Thursday: ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
  Friday: ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  Saturday: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

const WeeklyStreakRow: React.FC<WeeklyStreakRowProps> = ({ weekStart = 'Sunday', dayStates, dayLabels, appearance = 'dark' }) => {
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };

  const orderedDays = WEEK_ORDER[weekStart] || WEEK_ORDER.Sunday;
  const visibleDayCount = dayLabels?.length || orderedDays.length;
  const visibleDays = orderedDays.slice(0, visibleDayCount);

  // Create animated values for each day (stable across renders)
  const scaleAnims = useMemo(
    () => Array.from({length: visibleDayCount}, () => new Animated.Value(0)),
    [visibleDayCount]
  );

  // Trigger staggered spring animations when dayStates loads
  useEffect(() => {
    if (!dayStates || dayStates.length === 0) {return;}

    scaleAnims.forEach((anim, index) => {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        delay: index * 50, // 50ms stagger from left to right
        useNativeDriver: true,
      }).start();
    });
  }, [dayStates, scaleAnims]);

  // Show placeholder circles while loading
  if (!dayStates || dayStates.length === 0) {
    return (
      <View style={styles.container}>
        {visibleDays.map((day) => (
          <View key={day} style={styles.dayContainer}>
            <View style={[styles.dayCircle, styles.futureCircle, appearance === 'light' && styles.futureCircleLight]} />
            <Text style={[styles.dayLabel, font, styles.futureLabel, appearance === 'light' && styles.futureLabelLight]}>{FULL_DAY_LABELS[day]}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {visibleDays.map((day, index) => {
        const state = dayStates[index] || 'future';
        const label = dayLabels?.[index] || FULL_DAY_LABELS[day] || DAY_LABELS[day];

        return (
          <Animated.View key={`${day}:${index}`} style={styles.dayContainer}>
            <Animated.View
              style={[
                styles.dayCircle,
                getDayCircleStyle(state, appearance),
                {
                  transform: [
                    {
                      scale: scaleAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {state === 'completed' && (
                <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} />
              )}
            </Animated.View>
            <Text style={[styles.dayLabel, font, getDayLabelStyle(state, appearance)]}>{label}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const getDayCircleStyle = (state: DayState, appearance: 'dark' | 'light') => {
  const lightStyle = appearance === 'light';
  switch (state) {
    case 'completed':
      return [styles.completedCircle, lightStyle && styles.completedCircleLight];
    case 'missed':
      return [styles.missedCircle, lightStyle && styles.missedCircleLight];
    case 'today':
      return [styles.todayCircle, lightStyle && styles.todayCircleLight];
    case 'future':
    default:
      return [styles.futureCircle, lightStyle && styles.futureCircleLight];
  }
};

const getDayLabelStyle = (state: DayState, appearance: 'dark' | 'light') => {
  const lightStyle = appearance === 'light';
  switch (state) {
    case 'completed':
      return [styles.completedLabel, lightStyle && styles.completedLabelLight];
    case 'missed':
      return [styles.missedLabel, lightStyle && styles.missedLabelLight];
    case 'today':
      return [styles.todayLabel, lightStyle && styles.todayLabelLight];
    case 'future':
    default:
      return [styles.futureLabel, lightStyle && styles.futureLabelLight];
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 12,
  },
  dayContainer: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedCircle: {
    backgroundColor: Colors.faithGold,
  },
  missedCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  futureCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  completedCircleLight: {
    backgroundColor: Colors.sage,
  },
  missedCircleLight: {
    backgroundColor: 'transparent',
    borderColor: Colors.cardBorder,
    borderWidth: 1,
  },
  todayCircleLight: {
    backgroundColor: Colors.anchorBlueLight,
    borderColor: Colors.sage,
    borderWidth: 1,
  },
  futureCircleLight: {
    backgroundColor: Colors.anchorBlueLight,
    opacity: 0.55,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  completedLabel: {
    color: Colors.hopeWhite,
    opacity: 1,
  },
  missedLabel: {
    color: Colors.hopeWhite,
    opacity: 0.3,
  },
  todayLabel: {
    color: Colors.hopeWhite,
    opacity: 1,
    fontWeight: '600',
  },
  futureLabel: {
    color: Colors.hopeWhite,
    opacity: 0.15,
  },
  completedLabelLight: {
    color: Colors.text,
  },
  missedLabelLight: {
    color: Colors.textGray,
    opacity: 0.55,
  },
  todayLabelLight: {
    color: Colors.sage,
  },
  futureLabelLight: {
    color: Colors.textGray,
    opacity: 0.45,
  },
});

export default WeeklyStreakRow;
