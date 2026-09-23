import React from 'react';
import {StyleSheet, View} from 'react-native';
import {BookOpen, Heart, Moon, Sun} from 'lucide-react-native';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { useWeeklyRhythm } from '../../hooks/useWeeklyRhythm';
import {formatReviewCardPeriod} from '../../utils/reviewCardPeriod';
import ReviewDashboardCard from './ReviewDashboardCard';

interface Props {
  periodStart: string;
  periodEnd: string;
  onBegin: () => void;
  alsoReady?: string;
  started?: boolean;
  referenceDate?: string;
}

const WeeklyReviewCard = ({ periodStart, periodEnd, onBegin, alsoReady, started = false, referenceDate }: Props) => {
  const rhythm = useWeeklyRhythm(periodStart, periodEnd, referenceDate);
  return (
    <ReviewDashboardCard
      eyebrow="WEEKLY REVIEW"
      title="A week worth remembering."
      description={started ? 'Your weekly review is in progress.' : 'Your weekly review is ready.'}
      periodLabel={formatReviewCardPeriod(periodStart, periodEnd)}
      actionLabel={started ? 'Continue your week' : 'Explore your week'}
      alsoReady={alsoReady}
      onBegin={onBegin}
      stats={
        <>
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
              { label: 'Journal\nentries', count: rhythm?.journal, Icon: BookOpen },
            ].map(({ label, count, Icon }) => (
              <View key={label} style={styles.stat}>
                <Icon size={16} color={Colors.hopeWhite} strokeWidth={1.6} />
                <ThemedText weight="semiBold" style={styles.count}>{count ?? '–'}</ThemedText>
                <ThemedText style={styles.statLabel}>{label}</ThemedText>
              </View>
            ))}
          </View>
        </>
      }
    />
  );
};
const styles = StyleSheet.create({
  statsEyebrow: {color: Colors.hopeWhite, opacity: 0.85, fontSize: 9, lineHeight: 15, letterSpacing: 1},
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  daysCount: {color: Colors.hopeWhite, fontSize: 36, lineHeight: 48},
  daysLabel: {flex: 1, color: Colors.hopeWhite, fontSize: 10, lineHeight: 15},
  breakdown: {borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 14, marginTop: 8, gap: 13},
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { color: Colors.hopeWhite, fontSize: 17, minWidth: 14 },
  statLabel: {flex: 1, color: Colors.hopeWhite, fontSize: 9, lineHeight: 14},
});
export default WeeklyReviewCard;
