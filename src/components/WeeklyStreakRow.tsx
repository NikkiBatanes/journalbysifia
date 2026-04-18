/**
 * WeeklyStreakRow.tsx
 * Displays a row of 7 days representing the user's weekly streak
 * Respects user's week start preference and shows completion states
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.container}>
      {orderedDays.map((day, index) => {
        const state = dayStates[index] || 'future';
        const label = FULL_DAY_LABELS[day] || DAY_LABELS[day];

        return (
          <View key={day} style={styles.dayContainer}>
            <View style={[styles.dayCircle, getDayCircleStyle(state)]}>
              {state === 'completed' && (
                <Ionicons name="sparkle" size={12} color={Colors.hopeWhite} />
              )}
            </View>
            <Text style={[styles.dayLabel, font, getDayLabelStyle(state)]}>{label}</Text>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 16,
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
    shadowColor: Colors.faithGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  missedCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayCircle: {
    backgroundColor: Colors.faithGold,
    shadowColor: Colors.faithGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
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
