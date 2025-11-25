/**
 * BadgeSkeletonLoader.tsx
 * Skeleton loader component for badges and badge count
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

interface BadgeSkeletonLoaderProps {
  count?: number;
  showCount?: boolean;
}

const BadgeSkeletonLoader: React.FC<BadgeSkeletonLoaderProps> = ({ 
  count = 8, 
  showCount = true 
}) => {
  return (
    <View style={styles.container}>
      {/* Badge Count Skeleton */}
      {showCount && (
        <View style={styles.countContainer}>
          <View style={styles.countSkeleton} />
          <View style={styles.totalCountSkeleton} />
        </View>
      )}

      {/* Badges Grid Skeleton */}
      <View style={styles.badgesGrid}>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={styles.badgeSkeleton}>
            <View style={styles.badgeIconSkeleton} />
            <View style={styles.badgeTextSkeleton} />
            <View style={styles.badgeDescriptionSkeleton} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countSkeleton: {
    width: 120,
    height: 24,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    marginRight: 8,
  },
  totalCountSkeleton: {
    width: 80,
    height: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeSkeleton: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeIconSkeleton: {
    width: 50,
    height: 50,
    backgroundColor: Colors.lightGray,
    borderRadius: 25,
    marginBottom: 12,
    alignSelf: 'center',
  },
  badgeTextSkeleton: {
    width: '80%',
    height: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'center',
  },
  badgeDescriptionSkeleton: {
    width: '100%',
    height: 12,
    backgroundColor: Colors.lightGray,
    borderRadius: 6,
  },
});

export default BadgeSkeletonLoader;
