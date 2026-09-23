import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Heart} from 'lucide-react-native';

import type {MomentTimelineItem} from '../../services/momentTimelineService';
import {Colors} from '../../theme/colors';
import ThemedText from '../common/ThemedText';

interface Props {
  timelineItem: MomentTimelineItem;
}

export const WeeklyGratitudeMomentCard: React.FC<Props> = ({timelineItem}) => {
  const periodLabel = typeof timelineItem.metadata?.periodLabel === 'string'
    ? timelineItem.metadata.periodLabel
    : '';
  const gratitudeItems = timelineItem.preview.lines;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Heart size={22} color={Colors.sage} strokeWidth={2.2}/>
        </View>
        <View style={styles.headerCopy}>
          <ThemedText weight="semiBold" style={styles.category}>Weekly Gratitude</ThemedText>
          {!!periodLabel && (
            <View style={styles.datePill}>
              <ThemedText weight="medium" style={styles.dateText}>{periodLabel}</ThemedText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText weight="medium" style={styles.sectionLabel}>Your thank-you to God</ThemedText>
        <View style={styles.list}>
          {gratitudeItems.map((gratitude, index) => (
            <ThemedText key={`${gratitude}-${index}`} style={styles.gratitude}>{gratitude}</ThemedText>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          What this week has come to mean to you.
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.cardBackground,
  },
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.anchorBlueLight,
  },
  headerCopy: {flex: 1, marginLeft: 12},
  category: {fontSize: 18, color: Colors.text},
  datePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlueLight,
  },
  dateText: {fontSize: 12, lineHeight: 18, color: Colors.sage},
  section: {paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.inputBorder},
  sectionLabel: {
    fontSize: 11,
    color: Colors.textGray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {gap: 16},
  gratitude: {fontSize: 16, lineHeight: 24, color: Colors.text},
  footer: {paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.inputBorder},
  footerText: {fontSize: 13, lineHeight: 20, color: Colors.textGray},
});
