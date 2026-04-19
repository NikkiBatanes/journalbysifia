import React from 'react';
import { View, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const isTablet = width >= 768;
const ITEM_WIDTH = isTablet ? 384 : Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;
const SIDE_INSET = Math.max(
  0,
  isTablet ? 24 : Math.round((VISIBLE_WIDTH - ITEM_WIDTH) / 2),
);

export const PlaybookSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const CarouselCardSkeleton = () => (
    <View style={styles.carouselCardTouch}>
      <Animated.View style={[styles.carouselCard, { opacity }]}>
        {/* Gradient container with category label */}
        <View style={styles.gradientContainer}>
          <View style={styles.categoryLabel}>
            <Animated.View style={[styles.categoryLabelTextSkeleton, { opacity }]} />
          </View>
          <Animated.View style={[styles.menuButtonSkeleton, { opacity }]} />
        </View>

        {/* Date */}
        <View style={styles.dateWithBadge}>
          <Animated.View style={[styles.dateSkeleton, { opacity }]} />
        </View>

        {/* Title */}
        <Animated.View style={[styles.titleSkeleton, { opacity }]} />

        {/* Description */}
        <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

        {/* Sections container */}
        <View style={styles.sectionsContainer}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <View key={item} style={styles.sectionItem}>
              <Animated.View style={[styles.statusPillSkeleton, { opacity }]} />
              <View style={styles.sectionContent}>
                <Animated.View style={[styles.sectionLabelSkeleton, { opacity }]} />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );

  const SectionSkeleton = () => (
    <View style={styles.categorySection}>
      {/* Section Header */}
      <View style={styles.categorySectionHeader}>
        <Animated.View style={[styles.categorySectionTitle, { opacity }]} />
        <Animated.View style={[styles.categorySectionCount, { opacity }]} />
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
      >
        {[1, 2, 3].map((item) => (
          <CarouselCardSkeleton key={item} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Continue Section */}
      <SectionSkeleton />

      {/* Category Sections */}
      <SectionSkeleton />
      <SectionSkeleton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categorySection: {
    marginTop: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE_INSET,
    paddingBottom: 12,
  },
  categorySectionTitle: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: '40%',
  },
  categorySectionCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    width: 24,
    height: 16,
  },
  carouselCardTouch: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  gradientContainer: {
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
    position: 'relative',
  },
  categoryLabel: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  categoryLabelTextSkeleton: {
    height: 10,
    backgroundColor: 'rgba(3, 32, 61, 0.3)',
    borderRadius: 4,
    width: 60,
  },
  menuButtonSkeleton: {
    position: 'absolute',
    right: 10,
    top: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateWithBadge: {
    marginBottom: 4,
  },
  dateSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: '40%',
  },
  titleSkeleton: {
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 4,
    width: '90%',
  },
  descriptionSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 6,
    width: '70%',
  },
  sectionsContainer: {
    marginTop: 10,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 6,
  },
  sectionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabelSkeleton: {
    height: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: '50%',
  },
});
