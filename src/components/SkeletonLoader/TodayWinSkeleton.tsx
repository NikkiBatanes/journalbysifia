import React from 'react';
import { View, StyleSheet } from 'react-native';

export const TodayWinSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.headerSkeleton} />

      {/* Content skeleton */}
      <View style={styles.contentContainer}>
        <View style={styles.textLineSkeleton} />
        <View style={[styles.textLineSkeleton, styles.shortLine]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
  },
  headerSkeleton: {
    height: 16,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 12,
  },
  contentContainer: {
    gap: 8,
  },
  textLineSkeleton: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
  },
  shortLine: {
    width: '70%',
  },
});
