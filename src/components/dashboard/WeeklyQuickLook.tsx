import React from 'react';
import { StyleSheet, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { useWeeklyRhythm } from '../../hooks/useWeeklyRhythm';

const WeeklyQuickLook = ({ start, end }: { start: string; end: string }) => {
  const rhythm = useWeeklyRhythm(start, end);
  return <View style={styles.card}>
    <View style={styles.row}>
      <View style={styles.days}>{rhythm?.days.map(day => (
        <View key={day.date} style={styles.day} accessible accessibilityLabel={`${format(parseISO(day.date), 'EEEE, MMMM d')}: ${day.active ? 'saved activity' : 'no saved activity'}`}>
          <View style={[styles.dot, day.active && styles.activeDot]} />
          <ThemedText style={styles.label}>{format(parseISO(day.date), 'EEEEE')}</ThemedText>
        </View>
      )) ?? <ThemedText style={styles.note}>Loading your week…</ThemedText>}</View>
      <View style={styles.total}>
        <ThemedText style={styles.count}>{rhythm?.activeDays ?? '–'}</ThemedText>
        <ThemedText style={styles.totalLabel}>{rhythm?.activeDays === 1 ? 'day' : 'days'} with saved moments</ThemedText>
      </View>
    </View>
    <ThemedText style={styles.note}>Every moment counts. Keep making space.</ThemedText>
  </View>;
};
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  days: { flex: 2, flexDirection: 'row', justifyContent: 'space-between', paddingRight: 12 },
  day: { alignItems: 'center', gap: 7 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1, borderColor: Colors.cardBorder },
  activeDot: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  label: { fontSize: 9, color: Colors.textGray },
  total: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.cardBorder, paddingLeft: 12 },
  count: { color: Colors.sage, fontSize: 29 },
  totalLabel: { flex: 1, fontSize: 10, lineHeight: 15, color: Colors.text },
  note: { color: Colors.textGray, fontSize: 10, lineHeight: 16, marginTop: 12 },
});
export default WeeklyQuickLook;
