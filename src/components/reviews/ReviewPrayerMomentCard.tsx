import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import type {ReviewCaptureItem} from '../../services/reviewCaptureService';
import {Colors} from '../../theme/colors';

const formatDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const prayerTypeFor = (item: ReviewCaptureItem): string =>
  item.prayerTypeLabel ||
  (item.prayerActivityType === 'request'
    ? 'PRAYER REQUEST'
    : item.prayerActivityType === 'cast'
    ? 'CAST PRAYER'
    : item.prayerActivityType === 'open'
    ? 'OPEN PRAYER'
    : item.prayerActivityType === 'need'
    ? 'PRAYER NEED'
    : item.prayerActivityType === 'person'
    ? 'PRAYED FOR'
    : 'PRAYER');

export const ReviewPrayerMomentCard = ({
  item,
  width,
  selected = false,
  onPress,
  selectionAppearance = 'bookmark',
}: {
  item: ReviewCaptureItem;
  width: number;
  selected?: boolean;
  onPress?: () => void;
  selectionAppearance?: 'bookmark' | 'heart';
}) => {
  const body = item.text?.trim();
  const distinctBody =
    body && body.toLocaleLowerCase() !== item.title.trim().toLocaleLowerCase()
      ? body
      : '';
  const spokenCopy = distinctBody
    ? `${item.title.trim()} — ${distinctBody}`
    : item.title.trim();
  const date = formatDate(item.selectedDate);
  const content = (
    <>
      {onPress ? (
        <View
          style={[
            styles.remember,
            selectionAppearance === 'heart' && styles.heart,
            selected &&
              (selectionAppearance === 'heart'
                ? styles.heartSelected
                : styles.rememberSelected),
          ]}>
          <Ionicons
            name={
              selectionAppearance === 'heart'
                ? selected
                  ? 'heart'
                  : 'heart-outline'
                : selected
                ? 'bookmark'
                : 'bookmark-outline'
            }
            size={18}
            color={
              selectionAppearance === 'heart'
                ? Colors.alertCoral
                : selected
                ? Colors.hopeWhite
                : Colors.sage
            }
          />
        </View>
      ) : null}
      <View style={[styles.metaRow, !onPress && styles.metaRowReadOnly]}>
        <Ionicons name="heart-outline" size={15} color={Colors.sage} />
        <ThemedText weight="semiBold" style={styles.eyebrow}>
          {prayerTypeFor(item)}
        </ThemedText>
        <ThemedText style={styles.date}>{date}</ThemedText>
      </View>
      <ThemedText weight="bold" style={styles.title} numberOfLines={2}>
        {item.title}
      </ThemedText>
      {!!distinctBody && (
        <ThemedText style={styles.body} numberOfLines={4}>
          {distinctBody}
        </ThemedText>
      )}
      <View style={styles.statusPill}>
        <Ionicons
          name={item.answered ? 'sparkles-outline' : 'leaf-outline'}
          size={14}
          color={Colors.sage}
        />
        <ThemedText weight="semiBold" style={styles.statusText}>
          {item.answered ? 'God answered' : 'Carry in prayer'}
        </ThemedText>
      </View>
    </>
  );
  const cardStyle = [
    styles.card,
    selected &&
      (selectionAppearance === 'heart'
        ? styles.cardHearted
        : styles.cardSelected),
    {width},
  ];

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={`${prayerTypeFor(item)}. ${date}. ${item.title}. ${
          item.answered ? 'God answered' : 'Carry in prayer'
        }`}
        style={cardStyle}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={
        selectionAppearance === 'heart'
          ? `${selected ? 'Remove heart' : 'Heart this moment'}. ${date}. ${spokenCopy}`
          : `${
              selected ? 'Remove from remembered' : 'Remember this'
            }. ${date}. ${spokenCopy}`
      }
      accessibilityState={{checked: selected}}
      activeOpacity={0.76}
      onPress={onPress}
      style={cardStyle}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 196,
    padding: 20,
    paddingTop: 22,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: Colors.sage,
    backgroundColor: 'rgba(82, 106, 91, 0.06)',
  },
  cardHearted: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(217, 120, 114, 0.07)',
  },
  remember: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    zIndex: 2,
  },
  rememberSelected: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  heart: {
    borderColor: 'rgba(217, 120, 114, 0.42)',
  },
  heartSelected: {
    backgroundColor: 'rgba(217, 120, 114, 0.16)',
    borderColor: Colors.alertCoral,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 36,
    marginBottom: 12,
  },
  metaRowReadOnly: {paddingRight: 0},
  eyebrow: {
    color: Colors.sage,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  date: {
    marginLeft: 'auto',
    color: Colors.textGray,
    fontSize: 10,
    lineHeight: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 7,
  },
  body: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.actionBackground,
  },
  statusText: {color: Colors.sage, fontSize: 11, lineHeight: 15},
});
