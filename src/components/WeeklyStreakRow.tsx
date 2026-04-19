/**
 * WeeklyStreakRow.tsx
 * Displays a row of 7 days representing the user's weekly streak
 * Respects user's week start preference and shows completion states
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type DayState = 'completed' | 'missed' | 'today' | 'future';

interface WeeklyStreakRowProps {
  weekStart?: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  dayStates: DayState[];
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

const WeeklyStreakRow: React.FC<WeeklyStreakRowProps> = ({ weekStart = 'Sunday', dayStates }) => {
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };

  const orderedDays = WEEK_ORDER[weekStart] || WEEK_ORDER.Sunday;

  // Create animated values for each day
  const scaleAnims = useRef(
    orderedDays.map(() => new Animated.Value(0))
  ).current;

  // Trigger staggered spring animations on mount
  useEffect(() => {
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
  }, []);

  // Show placeholder circles while loading
  if (!dayStates || dayStates.length === 0) {
    return (
      <View style={styles.container}>
        {orderedDays.map((day) => (
          <View key={day} style={styles.dayContainer}>
            <View style={[styles.dayCircle, styles.futureCircle]} />
            <Text style={[styles.dayLabel, font, styles.futureLabel]}>{FULL_DAY_LABELS[day]}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {orderedDays.map((day, index) => {
        const state = dayStates[index] || 'future';
        const label = FULL_DAY_LABELS[day] || DAY_LABELS[day];

        return (
          <Animated.View key={day} style={styles.dayContainer}>
            <Animated.View
              style={[
                styles.dayCircle,
                getDayCircleStyle(state),
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
                <Ionicons name="sparkles" size={12} color={Colors.hopeWhite} />
              )}
            </Animated.View>
            <Text style={[styles.dayLabel, font, getDayLabelStyle(state)]}>{label}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const getDayCircleStyle = (state: DayState) => {
  switch (state) {
    case 'completed':
      return styles.completedCircle;
    case 'missed':
      return styles.missedCircle;
    case 'today':
      return styles.todayCircle;
    case 'future':
    default:
      return styles.futureCircle;
  }
};

const getDayLabelStyle = (state: DayState) => {
  switch (state) {
    case 'completed':
      return styles.completedLabel;
    case 'missed':
      return styles.missedLabel;
    case 'today':
      return styles.todayLabel;
    case 'future':
    default:
      return styles.futureLabel;
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
});

export default WeeklyStreakRow;
