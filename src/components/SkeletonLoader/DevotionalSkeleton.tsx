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
            {/* Date skeleton */}
            <Animated.View style={[styles.dateSkeleton, { opacity }]} />

            {/* Title skeleton */}
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />

            {/* Progress bar skeleton */}
            <View style={styles.progressContainer}>
              <View style={styles.progressRow}>
                {/* Progress bar background */}
                <View style={styles.progressBarContainer}>
                  <Animated.View style={[styles.progressBarSkeleton, { opacity }]} />
                </View>

                {/* Tasks text skeleton */}
                <Animated.View style={[styles.tasksSkeleton, { opacity }]} />
              </View>
            </View>
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
    padding: 12,
    width: '100%',
    height: 88,
    marginBottom: 12,
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 1,
    width: '90%',
  },
  cardContent: {
    flex: 1,
  },
  dateSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 4,
    width: '70%',
  },
  progressContainer: {
    marginTop: 'auto',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBarContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBarSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: '97%',
  },
  tasksSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    width: 60,
  },
});

export default DevotionalSkeleton;
