import React, { useRef } from 'react';
import { View, Animated, ScrollView } from 'react-native';
import ThemedText from './common/ThemedText';

// Carousel constants
const ITEM_SIZE = 280;
const ITEM_SPACING = 16;
const SIDE_INSET = 16;

interface CategoryCarouselRowProps<T> {
  category: string;
  items: T[];
  cardStyles: any;
  renderItem: (item: T, index: number) => React.ReactNode;
}

function CategoryCarouselRow<T>({
  category,
  items,
  cardStyles,
  renderItem,
}: CategoryCarouselRowProps<T>): React.ReactElement {
  const rowScrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={cardStyles.categorySection}>
      <View style={cardStyles.categorySectionHeader}>
        <ThemedText weight="semiBold" style={cardStyles.categorySectionTitle}>{category.toUpperCase()}</ThemedText>
        <View style={cardStyles.categorySectionCount}>
          <ThemedText style={cardStyles.categorySectionCountText}>{items.length}</ThemedText>
        </View>
      </View>
      <View style={cardStyles.carouselList}>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cardStyles.carouselContent}
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE + ITEM_SPACING}
          snapToAlignment="start"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: rowScrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          directionalLockEnabled={true}
          disableIntervalMomentum={false}
          bounces={false}
          removeClippedSubviews={true}
        >
          {items.map((item, index) => (
            <View key={index} style={{ width: ITEM_SIZE, marginRight: ITEM_SPACING }}>
              {renderItem(item, index)}
            </View>
          ))}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

export default CategoryCarouselRow;
