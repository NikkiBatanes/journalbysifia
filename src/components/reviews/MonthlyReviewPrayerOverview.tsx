import React, {useMemo} from 'react';
import {FlatList, StyleSheet, View, useWindowDimensions} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../common/ThemedText';
import PrayerHandsIcon from '../common/PrayerHandsIcon';
import {ReviewPrayerMomentCard} from './ReviewPrayerMomentCard';
import type {
  MonthlyPrayerReflection,
  PrayerReviewItem,
} from '../../services/prayerReviewService';
import type {ReviewCaptureItem} from '../../services/reviewCaptureService';
import {Colors} from '../../theme/colors';

const toCaptureItem = (
  item: PrayerReviewItem,
  answered: boolean,
): ReviewCaptureItem => ({
  id: item.id,
  kind: 'prayer',
  presentation: 'prayer',
  title: item.title,
  subtitle: item.subtitle,
  text: item.text,
  selectedDate: item.eventDate,
  answered,
  prayerEventType: item.eventType,
  prayerId: item.prayerId,
  needId: item.needId,
  requestId: item.requestId,
  prayerActivityType: item.requestId
    ? 'request'
    : item.needId
    ? 'need'
    : 'other',
  prayerActivityId: item.requestId || item.prayerId,
  prayerTypeLabel: item.prayerTypeLabel,
});

const CardSeparator = () => <View style={styles.separator} />;

const PrayerSection = ({
  title,
  items,
  answered,
  empty,
  cardWidth,
  onCarouselTouchStart,
  onCarouselTouchEnd,
}: {
  title: string;
  items: PrayerReviewItem[];
  answered: boolean;
  empty: string;
  cardWidth: number;
  onCarouselTouchStart?: () => void;
  onCarouselTouchEnd?: () => void;
}) => {
  const cards = useMemo(
    () => items.map(item => toCaptureItem(item, answered)),
    [answered, items],
  );

  return (
    <View style={styles.section}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          {answered ? (
            <Ionicons name="sparkles-outline" size={19} color={Colors.sage} />
          ) : (
            <PrayerHandsIcon size={19} color={Colors.sage} />
          )}
          <ThemedText
            accessibilityRole="header"
            weight="semiBold"
            style={styles.groupTitle}>
            {title}
          </ThemedText>
        </View>
        <ThemedText style={styles.groupCount}>
          {items.length}{' '}
          {answered
            ? items.length === 1
              ? 'prayer answered'
              : 'prayers answered'
            : items.length === 1
            ? 'prayer still waiting'
            : 'prayers still waiting'}
        </ThemedText>
      </View>

      {cards.length ? (
        <FlatList
          horizontal
          nestedScrollEnabled
          data={cards}
          keyExtractor={item => item.id}
          style={styles.carouselViewport}
          contentContainerStyle={styles.carousel}
          onTouchStart={onCarouselTouchStart}
          onTouchEnd={onCarouselTouchEnd}
          onTouchCancel={onCarouselTouchEnd}
          onScrollEndDrag={onCarouselTouchEnd}
          onMomentumScrollEnd={onCarouselTouchEnd}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + 12}
          disableIntervalMomentum
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews={false}
          ItemSeparatorComponent={CardSeparator}
          getItemLayout={(_, index) => ({
            length: cardWidth + 12,
            offset: 28 + (cardWidth + 12) * index,
            index,
          })}
          renderItem={({item}) => (
            <ReviewPrayerMomentCard item={item} width={cardWidth} />
          )}
        />
      ) : (
        <ThemedText style={styles.empty}>{empty}</ThemedText>
      )}
    </View>
  );
};

export const MonthlyReviewPrayerOverview = ({
  reflection,
  onCarouselTouchStart,
  onCarouselTouchEnd,
}: {
  reflection?: MonthlyPrayerReflection;
  onCarouselTouchStart?: () => void;
  onCarouselTouchEnd?: () => void;
}) => {
  const {width} = useWindowDimensions();
  const cardWidth = Math.min(310, Math.max(240, width - 76));
  const answered = reflection?.answered ?? [];
  const waiting = reflection?.waiting ?? [];

  return (
    <View style={styles.container}>
      <PrayerSection
        title="Answered this month"
        items={answered}
        answered
        empty="No answers were recorded this month."
        cardWidth={cardWidth}
        onCarouselTouchStart={onCarouselTouchStart}
        onCarouselTouchEnd={onCarouselTouchEnd}
      />
      <PrayerSection
        title="Still waiting"
        items={waiting}
        answered={false}
        empty="No active prayers are still waiting."
        cardWidth={cardWidth}
        onCarouselTouchStart={onCarouselTouchStart}
        onCarouselTouchEnd={onCarouselTouchEnd}
      />
      <ThemedText style={styles.note}>
        Prayer requests you have not prayed for yet are not included.
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {gap: 30, marginTop: 22},
  section: {gap: 12},
  groupHeader: {
    alignItems: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  groupTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  groupTitle: {color: Colors.text, fontSize: 18, lineHeight: 24},
  groupCount: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  carouselViewport: {marginHorizontal: -28},
  carousel: {paddingHorizontal: 28, alignItems: 'flex-start'},
  separator: {width: 12},
  empty: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 21,
    paddingVertical: 8,
  },
  note: {fontSize: 11, lineHeight: 18, color: Colors.textGray},
});
