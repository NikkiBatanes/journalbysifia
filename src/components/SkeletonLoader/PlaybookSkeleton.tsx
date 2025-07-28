import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme';

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

  return (
    <View style={styles.container}>
      {/* Section Header Skeleton */}
      <View style={styles.sectionHeader}>
        <Animated.View style={[styles.sectionHeaderSkeleton, { opacity }]} />
      </View>

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
    padding: 16,
  },
  sectionHeader: {
    backgroundColor: '#f6f8fa',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  sectionHeaderSkeleton: {
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Match TodaysFocus skeleton color
    borderRadius: 4,
    width: '25%', // Approximate width for "JULY 2025"
  },
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 12,
    width: '100%',
    height: 88, // Match the actual card height
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  dateSkeleton: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    marginBottom: 4,
    width: '60%', // Approximate width for "MONDAY, JULY 28, 2025"
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 1,
    width: '85%', // Approximate width for title
  },
  progressContainer: {
    marginTop: 'auto', // Push to bottom like the real progress bar
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
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 2,
    width: '100%',
  },
  tasksSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    width: 50, // Approximate width for "0/5 Tasks"
  },
});
