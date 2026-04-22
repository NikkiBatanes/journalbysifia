import React, { useRef } from 'react';
import { View, Animated, ScrollView } from 'react-native';
import ThemedText from './common/ThemedText';

// Default carousel constants (can be overridden via props)
const DEFAULT_ITEM_SIZE = 280;

interface CategoryCarouselRowProps<T> {
  category: string;
  items: T[];
  cardStyles: any;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemSize?: number;
}

function CategoryCarouselRow<T>({
  category,
  items,
  cardStyles,
  renderItem,
  itemSize = DEFAULT_ITEM_SIZE,
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
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cardStyles.carouselContent}
        decelerationRate="fast"
        snapToInterval={itemSize}
        snapToAlignment="center"
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
        {items.map((item, index) => renderItem(item, index))}
      </Animated.ScrollView>
    </View>
  );
}

export default CategoryCarouselRow;
