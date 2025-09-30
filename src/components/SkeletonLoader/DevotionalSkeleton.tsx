import React from 'react';
import { View, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const ITEM_WIDTH = VISIBLE_WIDTH * 0.8;
const ITEM_SPACING = 8;
const SIDE_INSET = Math.max(0, (VISIBLE_WIDTH - ITEM_WIDTH) / 2);

const DevotionalSkeleton: React.FC = () => {
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

  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <Animated.View style={[styles.headerIcon, { opacity }]} />
        <Animated.View style={[styles.headerTitle, { opacity }]} />
      </View>

      {/* Horizontal Carousel Skeleton */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_INSET }]}
        scrollEnabled={false}
        style={styles.scrollExpanded}
      >
        {[1, 2].map((item) => (
          <View key={item} style={[styles.carouselCard, { width: ITEM_WIDTH, marginRight: ITEM_SPACING }]}>
            {/* Card Header - Category Badge and Status Badge */}
            <View style={styles.cardHeader}>
              <Animated.View style={[styles.categoryBadge, { opacity }]} />
              <Animated.View style={[styles.statusBadge, { opacity }]} />
            </View>

            {/* Title */}
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />
            <Animated.View style={[styles.titleSkeletonShort, { opacity }]} />

            {/* Verse Preview */}
            <View style={styles.versePreview}>
              <Animated.View style={[styles.verseText, { opacity }]} />
              <Animated.View style={[styles.verseTextShort, { opacity }]} />
              <Animated.View style={[styles.verseReference, { opacity }]} />
            </View>

            {/* Description */}
            <Animated.View style={[styles.descriptionLine, { opacity }]} />
            <Animated.View style={[styles.descriptionLineShort, { opacity }]} />

            {/* Next/Status Section */}
            <View style={styles.statusSection}>
              <Animated.View style={[styles.statusLabel, { opacity }]} />
              <Animated.View style={[styles.statusInfo, { opacity }]} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    height: 18,
    width: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  scrollContainer: {
    paddingRight: 16,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16,
  },
  carouselCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 80,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 6,
    width: '85%',
  },
  titleSkeletonShort: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 12,
    width: '60%',
  },
  versePreview: {
    backgroundColor: Colors.lightPurple,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  verseText: {
    height: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 4,
    width: '90%',
  },
  verseTextShort: {
    height: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 4,
    width: '70%',
  },
  verseReference: {
    height: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    width: 100,
    alignSelf: 'flex-end',
  },
  descriptionLine: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 4,
    width: '92%',
  },
  descriptionLineShort: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 16,
    width: '75%',
  },
  statusSection: {
    gap: 4,
  },
  statusLabel: {
    height: 10,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 4,
    marginBottom: 4,
  },
  statusInfo: {
    height: 13,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
  },
});

export default DevotionalSkeleton;
