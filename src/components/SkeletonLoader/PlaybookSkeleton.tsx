import React from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

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

  const CardSkeleton = () => (
    <View style={styles.card}>
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
  );

  const SectionSkeleton = ({ title }: { title: string }) => (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Animated.View style={[styles.sectionHeaderText, { opacity }]} />
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.carouselCard}>
            <CardSkeleton />
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Continue Section (In Progress) */}
      <SectionSkeleton title="CONTINUE YOUR PLAYBOOKS" />

      {/* Category Sections (All View) */}
      <SectionSkeleton title="SPIRITUAL GROWTH" />
      <SectionSkeleton title="RELATIONSHIPS" />
      <SectionSkeleton title="PERSONAL DEVELOPMENT" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // No padding - skeleton is rendered inside PlaybookListScreen's padded container
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 30, // Match PlaybookListScreen section header margin
    marginBottom: 10, // Match PlaybookListScreen spacing
  },
  sectionHeaderText: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light on blue
    borderRadius: 4,
    width: '40%',
  },
  carouselContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  carouselCard: {
    width: 280, // Match actual card width in carousel
  },
  sectionHeaderSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light on blue
    borderRadius: 4,
    width: '30%', // Increased width to better match "JULY 2025"
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)', // Match actual card surface on BlueSheet
    borderRadius: 20,
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
    width: '70%', // Increased width to better match "MONDAY, JULY 28, 2025"
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 1,
    width: '90%', // Increased width to better match title
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
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    width: '97%',
  },
  tasksSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Light color for dark card background
    borderRadius: 4,
    width: 60, // Increased width to better match "0/5 Tasks"
  },
});
