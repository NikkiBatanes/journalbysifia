import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const ITEM_WIDTH = Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;

const SkeletonBlock: React.FC<{ opacity: Animated.AnimatedInterpolation<number>; style: object }> = ({ opacity, style }) => (
  <Animated.View style={[style, { opacity }]} />
);

const DashboardCombinedContentSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
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
      {/* Section title */}
      <View style={styles.header}>
        <SkeletonBlock opacity={opacity} style={styles.titleSkeleton} />
      </View>

      <View style={styles.row}>
        {[0, 1].map((index) => (
          <View
            key={index}
            style={[styles.card, { width: ITEM_WIDTH, marginRight: ITEM_SPACING }]}
          >
            {/* Gradient header row: icon circle + category pill + menu dot */}
            <View style={styles.gradientContainer}>
              <View style={styles.gradientTagRow}>
                <SkeletonBlock opacity={opacity} style={styles.iconCircle} />
                <SkeletonBlock opacity={opacity} style={styles.categoryPill} />
              </View>
              <SkeletonBlock opacity={opacity} style={styles.menuDot} />
            </View>

            {/* Date */}
            <SkeletonBlock opacity={opacity} style={styles.dateSkeleton} />

            {/* Title — 2 lines */}
            <SkeletonBlock opacity={opacity} style={styles.titleLine1} />
            <SkeletonBlock opacity={opacity} style={styles.titleLine2} />

            {/* Description — 2 lines */}
            <SkeletonBlock opacity={opacity} style={styles.descLine1} />
            <SkeletonBlock opacity={opacity} style={styles.descLine2} />

            {/* Progress section */}
            <View style={styles.progressSection}>
              {/* Header row: "Progress" label + day counter */}
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <SkeletonBlock opacity={opacity} style={styles.progressIconSkeleton} />
                  <SkeletonBlock opacity={opacity} style={styles.progressLabelSkeleton} />
                </View>
                <SkeletonBlock opacity={opacity} style={styles.dayCounterSkeleton} />
              </View>

              {/* Progress bar */}
              <View style={styles.barBg}>
                <SkeletonBlock opacity={opacity} style={styles.barFill} />
              </View>

              {/* Next day info */}
              <View style={styles.nextDayContainer}>
                <SkeletonBlock opacity={opacity} style={styles.nextLabelSkeleton} />
                <SkeletonBlock opacity={opacity} style={styles.nextTitleSkeleton} />
                <View style={styles.readTimeRow}>
                  <SkeletonBlock opacity={opacity} style={styles.readTimeIconSkeleton} />
                  <SkeletonBlock opacity={opacity} style={styles.readTimeSkeleton} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const SKEL = 'rgba(255,255,255,0.18)';
const SKEL_LIGHT = 'rgba(255,255,255,0.12)';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titleSkeleton: {
    height: 12,
    width: 160,
    borderRadius: 6,
    backgroundColor: SKEL,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 26,
    padding: 16,
  },
  // Gradient header
  gradientContainer: {
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gradientTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SKEL,
  },
  categoryPill: {
    height: 20,
    width: 64,
    borderRadius: 999,
    backgroundColor: SKEL,
  },
  menuDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SKEL_LIGHT,
  },
  // Date
  dateSkeleton: {
    height: 12,
    width: '45%',
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
    marginBottom: 6,
  },
  // Title 2 lines
  titleLine1: {
    height: 15,
    width: '88%',
    borderRadius: 6,
    backgroundColor: SKEL,
    marginBottom: 5,
  },
  titleLine2: {
    height: 15,
    width: '65%',
    borderRadius: 6,
    backgroundColor: SKEL,
    marginBottom: 6,
  },
  // Description 2 lines
  descLine1: {
    height: 12,
    width: '92%',
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
    marginBottom: 4,
  },
  descLine2: {
    height: 12,
    width: '72%',
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
    marginBottom: 0,
  },
  // Progress section
  progressSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressIconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: SKEL_LIGHT,
  },
  progressLabelSkeleton: {
    height: 12,
    width: 60,
    borderRadius: 6,
    backgroundColor: SKEL,
  },
  dayCounterSkeleton: {
    height: 12,
    width: 100,
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    width: '35%',
    borderRadius: 3,
    backgroundColor: SKEL,
  },
  // Next day info
  nextDayContainer: {
    marginTop: 8,
    gap: 4,
  },
  nextLabelSkeleton: {
    height: 12,
    width: 36,
    borderRadius: 6,
    backgroundColor: SKEL,
  },
  nextTitleSkeleton: {
    height: 12,
    width: '75%',
    borderRadius: 6,
    backgroundColor: SKEL,
  },
  readTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeIconSkeleton: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
  },
  readTimeSkeleton: {
    height: 11,
    width: 60,
    borderRadius: 6,
    backgroundColor: SKEL_LIGHT,
  },
});

export default DashboardCombinedContentSkeleton;
