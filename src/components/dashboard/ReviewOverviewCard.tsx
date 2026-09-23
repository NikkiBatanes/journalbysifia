import React, { useMemo } from 'react';
import {StyleSheet, View} from 'react-native';
import {Bookmark, BookOpen, CircleCheck, Heart, Moon, Share2, Sparkles, Sun, Target} from 'lucide-react-native';

import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { type LocalReviewEntry, type ReviewType } from '../../storage/reviewStorage';
import {formatReviewCardPeriod} from '../../utils/reviewCardPeriod';
import {useMonthlyReviewStats} from '../../hooks/useMonthlyReviewStats';
import ReviewDashboardCard from './ReviewDashboardCard';

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
    title: 'Remember what this month held.',
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
  reviewType,
  periodStart,
  periodEnd,
  alsoReady,
  onBegin,
}: {
  review: LocalReviewEntry | null;
  reviewType: Exclude<ReviewType, 'weekly'>;
  periodStart: string;
  periodEnd: string;
  alsoReady?: string;
  onBegin: () => void;
}) => {
  const type = reviewType;
  const copy = CARD_COPY[type];
  const isBeginYear = type === 'begin_year';
  const isInProgress = review?.status === 'draft';
  const description = type === 'monthly'
    ? isInProgress ? 'Your monthly review is in progress.' : 'Your monthly review is ready.'
    : copy.description;
  const action = type === 'monthly' && isInProgress ? 'Continue your month' : copy.action;
  const monthlyStats = useMonthlyReviewStats(type === 'monthly', periodStart, periodEnd);
  const monthlyHighlights = [
    {label: 'Answered prayers', value: monthlyStats?.answeredPrayers, Icon: CircleCheck},
    {label: 'Remembered', value: monthlyStats?.rememberedFromWeeks, Icon: Bookmark},
    {label: 'Gospel shared', value: monthlyStats?.gospelShares, Icon: Share2},
  ].filter((item): item is typeof item & {value: number} => Boolean(item.value));

  const { headline, rows } = useMemo<{ headline: number; rows: StatRow[] }>(() => {
    if (isBeginYear) {
      const priorities = review ? countAnswers(review, [
        'begin_year_priority_1',
        'begin_year_priority_2',
        'begin_year_priority_3',
      ]) : 0;
      return {
        headline: priorities,
        rows: [
          { label: 'Posture named', value: review ? countAnswers(review, ['posture']) : 0, Icon: Sparkles },
          { label: 'Anchoring Scripture', value: review ? countAnswers(review, ['scripture_begin']) : 0, Icon: BookOpen },
          { label: 'Faithful focus', value: review ? countAnswers(review, ['faithfulness_begin']) : 0, Icon: Target },
          { label: 'Entrusted to God', value: review ? countAnswers(review, ['surrender']) : 0, Icon: Heart },
        ],
      };
    }

    const priorityKeys = type === 'quarterly'
      ? ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3']
      : ['next_month_priority_1', 'next_month_priority_2', 'next_month_priority_3'];
    return {
      headline: review?.memorableItems.length ?? 0,
      rows: [
        { label: 'Prayers', value: review ? countKinds(review, ['prayer']) : 0, Icon: Heart },
        { label: 'Gratitude + wins', value: review ? countKinds(review, ['gratitude', 'win']) : 0, Icon: Sparkles },
        { label: 'Scripture moments', value: review ? countKinds(review, ['scripture']) : 0, Icon: BookOpen },
        { label: type === 'year_end' ? 'Things to carry' : 'Priorities named', value: review ? (type === 'year_end' ? countAnswers(review, ['carry']) : countAnswers(review, priorityKeys)) : 0, Icon: Target },
      ],
    };
  }, [isBeginYear, review, type]);

  return (
    <ReviewDashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={description}
      periodLabel={formatReviewCardPeriod(periodStart, periodEnd, type === 'year_end' || type === 'begin_year')}
      actionLabel={action}
      alsoReady={alsoReady}
      onBegin={onBegin}
      footer={type === 'monthly' && monthlyHighlights.length ? (
        <View style={styles.monthlyHighlights}>
          {monthlyHighlights.map(({label, value, Icon}) => (
            <View key={label} style={styles.monthlyHighlight}>
              <Icon size={14} color={Colors.hopeWhite} strokeWidth={1.7} />
              <View style={styles.monthlyHighlightCopy}>
                <ThemedText weight="semiBold" style={styles.monthlyHighlightCount}>{value}</ThemedText>
                <ThemedText style={styles.monthlyHighlightLabel}>{label}</ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      stats={
        type === 'monthly' ? <>
          <ThemedText style={styles.statsEyebrow}>YOU SHOWED UP</ThemedText>
          <View style={styles.metricRow}>
            <ThemedText weight="semiBold" style={styles.metric}>{monthlyStats?.activeDays ?? '–'}</ThemedText>
            <ThemedText style={styles.metricLabel}>{monthlyStats?.activeDays === 1 ? 'day this month' : 'days this month'}</ThemedText>
          </View>
          <View style={styles.monthlyGrid}>
            {[
              {label: 'Check-ins', value: monthlyStats?.morning, Icon: Sun},
              {label: 'Reflections', value: monthlyStats?.evening, Icon: Moon},
              {label: 'Prayers', value: monthlyStats?.prayers, Icon: Heart},
              {label: 'Journal', value: monthlyStats?.journal, Icon: BookOpen},
            ].map(({label, value, Icon}) => (
              <View key={label} style={styles.monthlyMetric}>
                <View style={styles.monthlyMetricValue}>
                  <Icon size={14} color={Colors.hopeWhite} strokeWidth={1.6} />
                  <ThemedText weight="semiBold" style={styles.monthlyMetricCount}>{value ?? '–'}</ThemedText>
                </View>
                <ThemedText style={styles.monthlyMetricLabel}>{label}</ThemedText>
              </View>
            ))}
          </View>
        </> : <>
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
        </>
      }
    />
  );
};

const styles = StyleSheet.create({
  statsEyebrow: { color: Colors.hopeWhite, opacity: 0.85, fontSize: 9, lineHeight: 15, letterSpacing: 1 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  metric: { color: Colors.hopeWhite, fontSize: 36, lineHeight: 48 },
  metricLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 10, lineHeight: 15 },
  breakdown: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 14, marginTop: 8, gap: 13 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { color: Colors.hopeWhite, fontSize: 17, minWidth: 14 },
  statLabel: { flex: 1, color: Colors.hopeWhite, fontSize: 9, lineHeight: 14 },
  monthlyGrid: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 13,
    marginTop: 8,
    rowGap: 11,
  },
  monthlyMetric: {width: '50%', minWidth: 0, paddingRight: 3},
  monthlyMetricValue: {flexDirection: 'row', alignItems: 'center', gap: 5},
  monthlyMetricCount: {color: Colors.hopeWhite, fontSize: 17, lineHeight: 21},
  monthlyMetricLabel: {color: Colors.hopeWhite, opacity: 0.88, fontSize: 8, lineHeight: 12, marginTop: 1},
  monthlyHighlights: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingTop: 11,
    marginTop: 14,
  },
  monthlyHighlight: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  monthlyHighlightCopy: {flex: 1, minWidth: 0},
  monthlyHighlightCount: {color: Colors.hopeWhite, fontSize: 14, lineHeight: 17},
  monthlyHighlightLabel: {color: Colors.hopeWhite, opacity: 0.88, fontSize: 7.5, lineHeight: 11},
});

export default ReviewOverviewCard;
