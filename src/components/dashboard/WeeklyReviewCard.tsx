import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { ArrowRight, BookOpen, Heart, Moon, Sun } from 'lucide-react-native';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic } from '../../utils/haptics';
import { useWeeklyRhythm } from '../../hooks/useWeeklyRhythm';
import { type WeeklyRhythm } from '../../services/weeklyRhythmService';

interface Props {
  periodStart: string;
  periodEnd: string;
  onBegin: () => void;
  alsoReady?: string;
  started?: boolean;
  seededRhythm?: WeeklyRhythm | null;
}

const WeeklyReviewCard = ({ periodStart, periodEnd, onBegin, alsoReady, started = false, seededRhythm }: Props) => {
  const liveRhythm = useWeeklyRhythm(periodStart, periodEnd);
  const rhythm = seededRhythm ?? liveRhythm;
  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);
  const periodLabel = `${format(start, 'MMM d')}–${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`;
  return (
    <View style={styles.card}>
      <View style={styles.columns}>
        <View style={styles.copy}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>WEEKLY REVIEW</ThemedText>
          <ThemedText weight="semiBold" style={styles.title}>A week worth remembering.</ThemedText>
          <ThemedText style={styles.description}>{started ? 'Your weekly review is in progress.' : 'Your weekly review is ready.'}</ThemedText>
          <ThemedText style={styles.period}>{periodLabel}</ThemedText>
          <TouchableOpacity style={styles.begin} accessibilityRole="button" activeOpacity={0.8} onPress={() => { triggerLightHaptic(); onBegin(); }}>
            <ThemedText weight="semiBold" style={styles.beginText}>{started ? 'Continue your week' : 'Explore your week'}</ThemedText>
            <ArrowRight size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <View style={styles.stats}>
          <ThemedText style={styles.statsEyebrow}>YOU SHOWED UP</ThemedText>
          <View style={styles.daysRow}>
            <ThemedText weight="semiBold" style={styles.daysCount}>{rhythm?.activeDays ?? '–'}</ThemedText>
            <ThemedText style={styles.daysLabel}>{rhythm?.activeDays === 1 ? 'day' : 'days'} that week</ThemedText>
          </View>
          <View style={styles.breakdown}>
            {[
              { label: 'Morning\ncheck-ins', count: rhythm?.morning, Icon: Sun },
              { label: 'Evening\nreflections', count: rhythm?.evening, Icon: Moon },
              { label: 'Prayers', count: rhythm?.prayers, Icon: Heart },
              { label: 'Other journal\nentries', count: rhythm?.journal, Icon: BookOpen },
            ].map(({ label, count, Icon }) => (
              <View key={label} style={styles.stat}>
                <Icon size={16} color={Colors.hopeWhite} strokeWidth={1.6} />
                <ThemedText weight="semiBold" style={styles.count}>{count ?? '–'}</ThemedText>
                <ThemedText style={styles.statLabel}>{label}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
      {alsoReady ? <ThemedText style={styles.note}>Also ready: {alsoReady}</ThemedText> : null}
    </View>
  );
};
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.sage, borderColor: Colors.sage, borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 8 },
  columns: { flexDirection: 'row' },
  copy: { flex: 1.45, minWidth: 0, paddingRight: 15 },
  eyebrow: { color: Colors.hopeWhite, fontSize: 10, lineHeight: 16, letterSpacing: 1.8 },
  title: { color: Colors.hopeWhite, fontSize: 24, lineHeight: 32, marginTop: 14 },
  description: { color: Colors.hopeWhite, fontSize: 12, lineHeight: 19, marginTop: 12 },
  period: { color: Colors.hopeWhite, opacity: 0.85, fontSize: 12, lineHeight: 19, marginTop: 3 },
  begin: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17 },
  beginText: { color: Colors.hopeWhite, fontSize: 12, flexShrink: 1 },
  stats: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 16 },
  statsEyebrow: { color: Colors.hopeWhite, opacity: 0.85, fontSize: 9, lineHeight: 15, letterSpacing: 1 },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  daysCount: { color: Colors.hopeWhite, fontSize: 36, lineHeight: 48 },
  daysLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 10, lineHeight: 15 },
  breakdown: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 14, marginTop: 8, gap: 13 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { color: Colors.hopeWhite, fontSize: 17, minWidth: 14 },
  statLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 9, lineHeight: 14 },
  note: { color: Colors.hopeWhite, opacity: 0.85, fontSize: 11, lineHeight: 18, marginTop: 12 },
});
export default WeeklyReviewCard;
