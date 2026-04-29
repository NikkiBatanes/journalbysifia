import React from 'react';
import { View, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const _isTablet = width >= 768;
const ITEM_WIDTH = _isTablet ? 384 : Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;
const SIDE_INSET = Math.max(
  0,
  _isTablet ? 24 : Math.round((VISIBLE_WIDTH - ITEM_WIDTH) / 2),
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
    outputRange: [0.3, 0.8],
  });

  const CarouselCardSkeleton = () => (
    <View style={styles.carouselCardTouch}>
      <Animated.View style={[styles.carouselCard, { opacity }]}>
        {/* Category label */}
        <Animated.View style={[styles.categoryLabelSkeleton, { opacity }]} />

        {/* Menu button */}
        <Animated.View style={[styles.menuButtonSkeleton, { opacity }]} />

        {/* Date */}
        <Animated.View style={[styles.dateSkeleton, { opacity }]} />

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

  const FaithfulActionCardSkeleton = () => (
    <View style={styles.carouselCardTouch}>
      <Animated.View style={[styles.carouselCard, { opacity }]}>
        {/* Date row with icon */}
        <Animated.View style={[styles.faDateRowSkeleton, { opacity }]} />

        {/* "FAITHFUL ACTION" badge */}
        <Animated.View style={[styles.faBadgeSkeleton, { opacity }]} />

        {/* Title row: number badge + title text */}
        <View style={styles.faTitleRow}>
          <Animated.View style={[styles.faNumberBadgeSkeleton, { opacity }]} />
          <Animated.View style={[styles.faTitleTextSkeleton, { opacity }]} />
        </View>

        {/* Description lines */}
        <Animated.View style={[styles.faDescLine, { opacity, width: '95%' }]} />
        <Animated.View style={[styles.faDescLine, { opacity, width: '85%' }]} />
        <Animated.View style={[styles.faDescLine, { opacity, width: '70%', marginBottom: 12 }]} />

        {/* Divider */}
        <Animated.View style={[styles.faDividerSkeleton, { opacity }]} />

        {/* "FROM PLAYBOOK" label */}
        <Animated.View style={[styles.faFromLabelSkeleton, { opacity }]} />

        {/* Playbook title */}
        <Animated.View style={[styles.faPlaybookTitleSkeleton, { opacity }]} />

        {/* Divider */}
        <Animated.View style={[styles.faDividerSkeleton, { opacity }]} />

        {/* Progress meta row */}
        <View style={styles.faProgressMetaRow}>
          <Animated.View style={[styles.faProgressMetaText, { opacity }]} />
          <Animated.View style={[styles.faProgressPercent, { opacity }]} />
        </View>

        {/* Progress bar */}
        <View style={styles.faProgressBarTrack}>
          <Animated.View style={[styles.faProgressBarFill, { opacity }]} />
        </View>

        {/* Updated date row */}
        <Animated.View style={[styles.faDateRowSkeleton, { opacity, width: '50%' }]} />
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
        <CarouselCardSkeleton />
      </ScrollView>
    </View>
  );

  const FaithfulActionsSectionSkeleton = () => (
    <View style={styles.categorySection}>
      {/* Section Header */}
      <View style={styles.categorySectionHeader}>
        <Animated.View style={[styles.categorySectionTitle, { opacity, width: '65%' }]} />
        <Animated.View style={[styles.categorySectionCount, { opacity }]} />
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
      >
        <FaithfulActionCardSkeleton />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Faithful Actions Carousel */}
      <FaithfulActionsSectionSkeleton />
      {/* Playbook Category Carousel */}
      <SectionSkeleton />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categorySection: {
    marginTop: 32,
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 4,
    width: '40%',
  },
  categorySectionCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  categoryLabelSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 4,
    width: 60,
    marginBottom: 8,
  },
  menuButtonSkeleton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dateSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 4,
    width: '60%',
  },
  titleSkeleton: {
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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

  // ── Faithful Action card skeleton styles ──
  faDateRowSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    width: '55%',
    marginBottom: 8,
  },
  faBadgeSkeleton: {
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    width: 110,
    marginBottom: 8,
  },
  faTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  faNumberBadgeSkeleton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  faTitleTextSkeleton: {
    flex: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 4,
  },
  faDescLine: {
    height: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 5,
  },
  faDividerSkeleton: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  faFromLabelSkeleton: {
    height: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    width: 90,
    marginBottom: 6,
  },
  faPlaybookTitleSkeleton: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 4,
    width: '80%',
    marginBottom: 2,
  },
  faProgressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  faProgressMetaText: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    width: '60%',
  },
  faProgressPercent: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    width: 30,
  },
  faProgressBarTrack: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faProgressBarFill: {
    height: '100%',
    width: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
});
