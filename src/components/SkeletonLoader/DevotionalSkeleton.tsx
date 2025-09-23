import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme';

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
      {/* Section Header Skeleton */}
      <View style={styles.sectionHeader} />

      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.card}>
          <View style={styles.cardContent}>
            {/* Date */}
            <Animated.View style={[styles.dateSkeleton, { opacity }]} />

            {/* Title */}
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />

            {/* Description (1-2 lines) */}
            <Animated.View style={[styles.descriptionLine, { opacity }]} />

            {/* Tags row (category + from playbook pill) */}
            <View style={styles.tagsRow}>
              <Animated.View style={[styles.tagPill, { opacity }]} />
            </View>

            {/* Progress header (label left + counter right) */}
            <View style={styles.progressHeaderRow}>
              <Animated.View style={[styles.progressHeaderLabel, { opacity }]} />
            </View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressRow}>
                <View style={styles.progressBarContainer}>
                  <Animated.View style={[styles.progressBarSkeleton, { opacity }]} />
                </View>
              </View>
            </View>

            {/* Next line */}
            <Animated.View style={[styles.nextLine, { opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 30,
    marginBottom: 10,
    width: '30%',
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    height: 200,
    marginBottom: 14,
  },
  titleSkeleton: {
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 6,
    marginTop: 2,
    width: '85%',
  },
  cardContent: {
    flex: 1,
  },
  dateSkeleton: {
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 4,
    width: '70%',
  },
  descriptionLine: {
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 4,
    width: '92%',
  },
  descriptionLineShort: {
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 8,
    width: '70%',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tagPill: {
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    width: 74,
  },
  tagPillShort: {
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    width: 104,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressHeaderLabel: {
    height: 20,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 4,
  },
  progressHeaderCounter: {
    height: 15,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
  },
  progressContainer: {
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBarContainer: {
    flex: 1,
    marginRight: 0,
  },
  progressBarSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: '100%',
  },
  nextLine: {
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 4,
    marginTop: 8,
    width: 120,
  },
});

export default DevotionalSkeleton;
