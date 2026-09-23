import React, {useMemo, useState} from 'react';
import {FlatList, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import type {ReviewCaptureItem, ReviewCapturePresentation} from '../../services/reviewCaptureService';

export interface ReviewMomentGroup {
  key: string;
  presentation: ReviewCapturePresentation;
  title: string;
  items: ReviewCaptureItem[];
}

export interface ReviewMomentCardData {
  key: string;
  item: ReviewCaptureItem;
  relatedItems: ReviewCaptureItem[];
}

interface Props {
  groups: ReviewMomentGroup[];
  cardWidth: number;
  header: React.ReactElement;
  empty: React.ReactElement;
  footer?: React.ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
  renderGroupHeader: (group: ReviewMomentGroup) => React.ReactElement;
  renderCard: (card: ReviewMomentCardData) => React.ReactElement;
}

const CardSeparator = () => <View style={styles.separator}/>;

const MomentGroup = ({group, cardWidth, renderGroupHeader, renderCard}: Pick<Props, 'cardWidth' | 'renderGroupHeader' | 'renderCard'> & {group: ReviewMomentGroup}) => {
  const [measuredHeight, setMeasuredHeight] = useState(196);
  const cards = useMemo(() => {
    if (group.presentation === 'todo') {
      const days = new Map<string, ReviewCaptureItem[]>();
      group.items.forEach(item => {
        const related = days.get(item.selectedDate) ?? [];
        related.push(item);
        days.set(item.selectedDate, related);
      });
      return [...days].map(([date, relatedItems]) => ({
        key: `todos-${date}`, item: relatedItems[0], relatedItems,
      }));
    }
    return group.items.map(item => ({
      key: `${item.kind}-${item.id}-${item.selectedDate}`, item, relatedItems: [item],
    }));
  }, [group.items, group.presentation]);

  return (
    <View style={styles.group}>
      {renderGroupHeader(group)}
      <FlatList
        horizontal
        nestedScrollEnabled
        data={cards}
        keyExtractor={card => card.key}
        style={styles.carouselViewport}
        contentContainerStyle={[styles.carousel, {minHeight: measuredHeight}]}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        disableIntervalMomentum
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        ItemSeparatorComponent={CardSeparator}
        getItemLayout={(_, index) => ({length: cardWidth + 12, offset: 22 + (cardWidth + 12) * index, index})}
        renderItem={({item}) => (
          <View onLayout={event => {
            const height = event.nativeEvent.layout.height;
            // Recycling a tall card must not collapse the row beneath the reader.
            setMeasuredHeight(previous => Math.max(previous, height));
          }}>
            {renderCard(item)}
          </View>
        )}
      />
    </View>
  );
};

/** Bounds the work on Continue to nearby groups and cards, including on a busy week. */
export const WeeklyReviewMomentsList = ({groups, cardWidth, header, empty, footer, contentContainerStyle, renderGroupHeader, renderCard}: Props) => (
  <FlatList
    style={styles.list}
    data={groups}
    keyExtractor={group => group.key}
    contentContainerStyle={contentContainerStyle}
    ListHeaderComponent={header}
    ListEmptyComponent={empty}
    ListFooterComponent={footer}
    initialNumToRender={2}
    maxToRenderPerBatch={2}
    windowSize={5}
    removeClippedSubviews={false}
    keyboardShouldPersistTaps="always"
    keyboardDismissMode="interactive"
    showsVerticalScrollIndicator={false}
    renderItem={({item}) => (
      <MomentGroup group={item} cardWidth={cardWidth} renderGroupHeader={renderGroupHeader} renderCard={renderCard}/>
    )}
  />
);

const styles = StyleSheet.create({
  list: {flex: 1},
  group: {marginBottom: 24},
  carouselViewport: {marginHorizontal: -22},
  carousel: {paddingHorizontal: 22, alignItems: 'flex-start'},
  separator: {width: 12},
});
