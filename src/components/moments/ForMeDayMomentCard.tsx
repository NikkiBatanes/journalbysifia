import React from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import {format, isValid, parseISO} from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import type {MomentTimelineItem} from '../../services/momentTimelineService';

const displayDate = (value: unknown, fallback: string): string => {
  const parsed =
    typeof value === 'string' && value.trim()
      ? parseISO(value)
      : parseISO(`${fallback}T12:00:00`);
  if (!isValid(parsed)) {
    return fallback;
  }
  return format(
    parsed,
    parsed.getFullYear() === new Date().getFullYear()
      ? 'EEE, MMM d · h:mm a'
      : 'EEE, MMM d, yyyy · h:mm a',
  );
};

export const isForMeDayTimelineItem = (
  item: MomentTimelineItem | undefined,
): boolean =>
  item?.kind === 'reflection' &&
  item.reflection?.type === 'gospel_anniversary' &&
  item.reflection?.source === 'for_me_day';

export const ForMeDayMomentCard = ({
  timelineItem,
}: {
  timelineItem: MomentTimelineItem;
}) => {
  const reflection = timelineItem.reflection;
  const metadata = reflection?.metadata ?? {};
  const isTestimony = metadata.forMeDayEntry === 'testimony';
  const title = isTestimony
    ? 'Your testimony'
    : reflection?.title?.replace(/\bFor Me Day\b/gi, 'New Life Day') ||
      'My New Life Day';
  const writtenAt = isTestimony
    ? metadata.testimonyWrittenAt || reflection?.created_at
    : metadata.writtenAt || reflection?.created_at;
  const anniversaryNumber = Number(metadata.anniversaryNumber);
  const footer =
    !isTestimony && Number.isFinite(anniversaryNumber) && anniversaryNumber > 0
      ? `${anniversaryNumber} ${anniversaryNumber === 1 ? 'year' : 'years'} with Jesus`
      : "A marker of God's faithfulness";

  return (
    <View style={styles.card} accessibilityLabel={`My New Life Day. ${title}`}>
      <View style={styles.header}>
        <View style={styles.mark}>
          <Ionicons
            name={isTestimony ? 'sparkles-outline' : 'gift-outline'}
            size={20}
            color={Colors.sage}
          />
        </View>
        <View style={styles.headerCopy}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>
            MY NEW LIFE DAY
          </ThemedText>
          <ThemedText style={styles.date}>
            {displayDate(writtenAt, timelineItem.selectedDate)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.pill}>
        <ThemedText weight="semiBold" style={styles.pillText}>
          {isTestimony ? 'TESTIMONY' : 'YEARLY REFLECTION'}
        </ThemedText>
      </View>

      {!isTestimony && (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      )}
      {!!reflection?.content?.trim() && (
        <Text style={styles.body} numberOfLines={6}>
          {reflection.content.trim()}
        </Text>
      )}

      <View style={styles.divider} />
      <View style={styles.footer}>
        <Ionicons name="sparkles" size={14} color={Colors.sage} />
        <ThemedText style={styles.footerText}>{footer}</ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#FBF7EE',
    borderWidth: 1,
    borderColor: 'rgba(185, 149, 98, 0.38)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 16,
  },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185, 149, 98, 0.14)',
  },
  headerCopy: {flex: 1},
  eyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
  },
  date: {
    color: Colors.textGray,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    marginBottom: 10,
  },
  pillText: {
    color: Colors.sage,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.1,
  },
  title: {
    color: Colors.text,
    fontFamily: Platform.select({ios: 'Georgia-Bold', android: 'serif'}),
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 29,
    marginBottom: 10,
  },
  body: {
    color: Colors.text,
    fontFamily: Platform.select({ios: 'Georgia', android: 'serif'}),
    fontSize: 15,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(185, 149, 98, 0.24)',
    marginVertical: 16,
  },
  footer: {flexDirection: 'row', alignItems: 'center', gap: 7},
  footerText: {flex: 1, color: Colors.textGray, fontSize: 11, lineHeight: 16},
});
