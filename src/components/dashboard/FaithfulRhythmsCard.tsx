import React, { useCallback, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import {
  FAITHFUL_RHYTHM_UPDATED,
  FAITHFUL_RHYTHM_ORDER,
  getFaithfulRhythmsSnapshot,
  type FaithfulRhythmsSnapshot,
  type FaithfulRhythmId,
  type RhythmDay,
  type RoutineRhythmSnapshot,
} from '../../services/faithfulRhythmService';

interface FaithfulRhythmsCardProps {
  variant?: 'today' | 'profile';
}

const dayStyle = (day: RhythmDay) => {
  if (day.status === 'complete') {return styles.dayComplete;}
  if (day.status === 'partial') {return styles.dayPartial;}
  if (day.status === 'future') {return styles.dayFuture;}
  return styles.dayOpen;
};

const RHYTHM_ICONS: Record<FaithfulRhythmId, string> = {
  morning: 'sunny-outline',
  evening: 'moon-outline',
  heart_journal: 'heart-outline',
  prayer: 'heart-circle-outline',
  bible_study: 'library-outline',
  session_notes: 'document-text-outline',
  reviews: 'refresh-circle-outline',
};

export const FaithfulRhythmRow = ({ rhythm, expanded = false }: { rhythm: RoutineRhythmSnapshot; expanded?: boolean }) => {
  const streakUnit = rhythm.cadence === 'daily'
    ? 'day'
    : rhythm.cadence === 'weekly'
      ? 'week'
      : rhythm.cadence === 'monthly'
        ? 'month'
        : 'review';
  const streakLabel = `${rhythm.currentStreak} ${rhythm.currentStreak === 1 ? streakUnit : `${streakUnit}s`}`;
  const windowLabel = rhythm.id === 'session_notes'
    ? `${rhythm.weekCompleted} of ${rhythm.weekEligible} Sundays this month`
    : rhythm.weekEligible
    ? `${rhythm.weekCompleted} of ${rhythm.weekEligible} ${rhythm.unitLabel}`
    : `No ${rhythm.unitLabel} yet`;

  return (
    <View style={styles.rhythmRow} accessibilityLabel={`${rhythm.label}: ${windowLabel}, ${streakLabel}`}>
      <View style={styles.rhythmHeading}>
        <View style={styles.iconCircle}>
          <Ionicons name={RHYTHM_ICONS[rhythm.id]} size={17} color={Colors.sage} />
        </View>
        <View style={styles.rhythmCopy}>
          <ThemedText weight="semiBold" style={styles.rhythmLabel}>{rhythm.label}</ThemedText>
          <ThemedText style={styles.rhythmMeta}>{windowLabel} · {streakLabel}</ThemedText>
        </View>
        <ThemedText weight="bold" style={styles.percentage}>{rhythm.weeklyPercent}%</ThemedText>
      </View>
      {rhythm.days.length ? (
        <View style={styles.daysRow}>
          {rhythm.days.map(day => (
            <View key={`${rhythm.id}:${day.date}`} style={styles.dayColumn}>
              <ThemedText numberOfLines={1} style={[styles.dayLabel, expanded && styles.dayLabelExpanded]}>{day.label}</ThemedText>
              <View style={[styles.dayDot, dayStyle(day)]} />
            </View>
          ))}
        </View>
      ) : (
        <ThemedText style={styles.emptyRhythm}>Completed reviews will appear here.</ThemedText>
      )}
    </View>
  );
};

const FaithfulRhythmsCard: React.FC<FaithfulRhythmsCardProps> = ({ variant = 'today' }) => {
  const navigation = useNavigation<any>();
  const { preferences } = useAuth();
  const [snapshot, setSnapshot] = useState<FaithfulRhythmsSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const next = await getFaithfulRhythmsSnapshot(preferences?.weekStart || 'monday');
    setSnapshot(next);
  }, [preferences?.weekStart]);

  useFocusEffect(useCallback(() => {
    let active = true;
    refresh().catch(() => {
      if (active) {setSnapshot(null);}
    });
    const subscription = DeviceEventEmitter.addListener(FAITHFUL_RHYTHM_UPDATED, () => {
      if (active) {refresh().catch(() => setSnapshot(null));}
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refresh]));

  if (!snapshot) {return null;}
  const bestRhythm = FAITHFUL_RHYTHM_ORDER
    .map(id => snapshot[id])
    .reduce((best, rhythm) => (
      rhythm.currentStreak > best.currentStreak ? rhythm : best
    ));
  const streakUnit = bestRhythm.cadence === 'daily'
    ? 'day'
    : bestRhythm.cadence === 'weekly'
      ? 'week'
      : bestRhythm.cadence === 'monthly'
        ? 'month'
        : 'review';
  const streakUnitLabel = bestRhythm.currentStreak === 1 ? streakUnit : `${streakUnit}s`;
  const summary = bestRhythm.currentStreak > 0
    ? `${bestRhythm.label} · best current streak`
    : 'Tap to see your rhythm details';
  const accessibilitySummary = bestRhythm.currentStreak > 0
    ? `Best current streak is ${bestRhythm.currentStreak} ${streakUnitLabel} in ${bestRhythm.label}`
    : 'No active streak yet';

  return (
    <TouchableOpacity
      style={[styles.card, variant === 'profile' && styles.profileCard]}
      onPress={() => {
        triggerLightHaptic();
        navigation.navigate('FaithfulRhythms');
      }}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Faithful rhythms. ${accessibilitySummary}. Tap to view details.`}
    >
      <View style={styles.summaryIcon}>
        <Ionicons name="flame" size={24} color={Colors.faithGold} />
      </View>
      <View style={styles.summaryCopy}>
        <ThemedText weight="bold" style={styles.eyebrow}>YOUR FAITHFUL RHYTHMS</ThemedText>
        <ThemedText numberOfLines={1} style={styles.subtitle}>{summary}</ThemedText>
      </View>
      <View style={styles.streakCountContainer}>
        <View style={styles.streakCountRow}>
          <ThemedText weight="bold" style={styles.streakCount}>{bestRhythm.currentStreak}</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={Colors.sage} />
        </View>
        <ThemedText style={styles.streakUnit}>{streakUnitLabel}</ThemedText>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginTop: 24,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileCard: { marginTop: 0 },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {flex: 1},
  eyebrow: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.7 },
  subtitle: { color: Colors.textGray, fontSize: 12, lineHeight: 18, marginTop: 3 },
  streakCountContainer: {alignItems: 'flex-end', minWidth: 54},
  streakCountRow: {flexDirection: 'row', alignItems: 'center', gap: 1},
  streakCount: {color: Colors.faithGold, fontSize: 25, lineHeight: 29},
  streakUnit: {color: Colors.textGray, fontSize: 10, lineHeight: 13, marginRight: 17},
  rhythmRow: { gap: 12 },
  rhythmHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  rhythmCopy: { flex: 1 },
  rhythmLabel: { color: Colors.text, fontSize: 14, lineHeight: 19 },
  rhythmMeta: { color: Colors.textGray, fontSize: 11, lineHeight: 16, marginTop: 1 },
  percentage: { color: Colors.sage, fontSize: 19, lineHeight: 24 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  dayColumn: { alignItems: 'center', gap: 5, minWidth: 23 },
  dayLabel: { color: Colors.textGray, fontSize: 9, lineHeight: 12 },
  dayLabelExpanded: { fontSize: 8 },
  dayDot: { width: 17, height: 17, borderRadius: 9, borderWidth: 1 },
  dayComplete: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  dayPartial: { backgroundColor: Colors.faithGold, borderColor: Colors.faithGold },
  dayOpen: { backgroundColor: 'transparent', borderColor: Colors.cardBorder },
  dayFuture: { backgroundColor: Colors.anchorBlueLight, borderColor: Colors.anchorBlueLight, opacity: 0.55 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.cardBorder, marginVertical: 16 },
  emptyRhythm: { color: Colors.textGray, fontSize: 10, lineHeight: 15, marginLeft: 44 },
});

export default FaithfulRhythmsCard;
