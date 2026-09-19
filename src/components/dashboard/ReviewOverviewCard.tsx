import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ArrowRight, BookOpen, Heart, Sparkles, Target } from 'lucide-react-native';

import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic } from '../../utils/haptics';
import { type LocalReviewEntry, type ReviewType } from '../../storage/reviewStorage';

type StatRow = {
  label: string;
  value: number;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const CARD_COPY: Record<Exclude<ReviewType, 'weekly'>, {
  eyebrow: string;
  title: string;
  description: string;
  metricLabel: string;
  action: string;
}> = {
  monthly: {
    eyebrow: 'MONTHLY REVIEW',
    title: 'A month worth noticing.',
    description: 'Notice what mattered and what you want to carry forward.',
    metricLabel: 'moments marked',
    action: 'Explore your month',
  },
  quarterly: {
    eyebrow: 'QUARTERLY REVIEW',
    title: 'Notice this season.',
    description: 'Look back on the patterns, growth, and faithfulness you saw.',
    metricLabel: 'moments marked',
    action: 'Explore your season',
  },
  year_end: {
    eyebrow: 'YEAR END REVIEW',
    title: 'Remember your year with God.',
    description: 'Close the year with gratitude, honesty, and remembrance.',
    metricLabel: 'moments marked',
    action: 'Review your year',
  },
  begin_year: {
    eyebrow: 'BEGIN YEAR REVIEW',
    title: 'Begin with what matters.',
    description: 'Enter the year with intention and entrust what lies ahead.',
    metricLabel: 'priorities named',
    action: 'Begin your year',
  },
};

const countKinds = (review: LocalReviewEntry, kinds: string[]) =>
  review.memorableItems.filter(item => kinds.includes(item.kind)).length;

const countAnswers = (review: LocalReviewEntry, keys: string[]) =>
  keys.filter(key => Boolean(review.answers[key]?.trim())).length;

const ReviewOverviewCard = ({
  review,
  periodLabel,
  alsoReady,
  onBegin,
}: {
  review: LocalReviewEntry;
  periodLabel: string;
  alsoReady?: string;
  onBegin: () => void;
}) => {
  const type = review.type as Exclude<ReviewType, 'weekly'>;
  const copy = CARD_COPY[type];
  const isBeginYear = type === 'begin_year';

  const { headline, rows } = useMemo<{ headline: number; rows: StatRow[] }>(() => {
    if (isBeginYear) {
      const priorities = countAnswers(review, [
        'begin_year_priority_1',
        'begin_year_priority_2',
        'begin_year_priority_3',
      ]);
      return {
        headline: priorities,
        rows: [
          { label: 'Posture named', value: countAnswers(review, ['posture']), Icon: Sparkles },
          { label: 'Anchoring Scripture', value: countAnswers(review, ['scripture_begin']), Icon: BookOpen },
          { label: 'Faithful focus', value: countAnswers(review, ['faithfulness_begin']), Icon: Target },
          { label: 'Entrusted to God', value: countAnswers(review, ['surrender']), Icon: Heart },
        ],
      };
    }

    const priorityKeys = type === 'quarterly'
      ? ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3']
      : ['next_month_priority_1', 'next_month_priority_2', 'next_month_priority_3'];
    return {
      headline: review.memorableItems.length,
      rows: [
        { label: 'Prayers', value: countKinds(review, ['prayer']), Icon: Heart },
        { label: 'Gratitude + wins', value: countKinds(review, ['gratitude', 'win']), Icon: Sparkles },
        { label: 'Scripture moments', value: countKinds(review, ['scripture']), Icon: BookOpen },
        { label: type === 'year_end' ? 'Things to carry' : 'Priorities named', value: type === 'year_end' ? countAnswers(review, ['carry']) : countAnswers(review, priorityKeys), Icon: Target },
      ],
    };
  }, [isBeginYear, review, type]);

  return (
    <View style={styles.card}>
      <View style={styles.columns}>
        <View style={styles.copy}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>{copy.eyebrow}</ThemedText>
          <ThemedText weight="semiBold" style={styles.title}>{copy.title}</ThemedText>
          <ThemedText style={styles.description}>{copy.description}</ThemedText>
          <ThemedText style={styles.period}>{periodLabel}</ThemedText>
          <TouchableOpacity
            style={styles.begin}
            accessibilityRole="button"
            accessibilityLabel={copy.action}
            activeOpacity={0.8}
            onPress={() => { triggerLightHaptic(); onBegin(); }}
          >
            <ThemedText weight="semiBold" style={styles.beginText}>{copy.action}</ThemedText>
            <ArrowRight size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <View style={styles.stats}>
          <ThemedText style={styles.statsEyebrow}>{isBeginYear ? 'WHAT MATTERS' : 'YOU SHOWED UP'}</ThemedText>
          <View style={styles.metricRow}>
            <ThemedText weight="semiBold" style={styles.metric}>{headline}</ThemedText>
            <ThemedText style={styles.metricLabel}>{copy.metricLabel}</ThemedText>
          </View>
          <View style={styles.breakdown}>
            {rows.map(({ label, value, Icon }) => (
              <View key={label} style={styles.stat}>
                <Icon size={16} color={Colors.hopeWhite} strokeWidth={1.6} />
                <ThemedText weight="semiBold" style={styles.count}>{value}</ThemedText>
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
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  metric: { color: Colors.hopeWhite, fontSize: 36, lineHeight: 48 },
  metricLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 10, lineHeight: 15 },
  breakdown: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 14, marginTop: 8, gap: 13 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { color: Colors.hopeWhite, fontSize: 17, minWidth: 14 },
  statLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 9, lineHeight: 14 },
  note: { color: Colors.hopeWhite, opacity: 0.85, fontSize: 11, lineHeight: 18, marginTop: 12 },
});

export default ReviewOverviewCard;
