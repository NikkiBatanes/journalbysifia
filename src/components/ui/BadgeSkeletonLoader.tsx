/**
 * BadgeSkeletonLoader.tsx
 * Skeleton loader component for badges and badge count
 * Matches exact layout of real badges in BadgesModal
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
  showCount = false 
}) => {
  return (
    <View style={styles.container}>
      {/* Badges List Skeleton - matches real badge layout */}
      <View style={styles.badgesList}>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={styles.badgeSkeleton}>
            {/* Left side - Icon Container */}
            <View style={styles.iconContainer}>
              <View style={styles.badgeIconContainer}>
                <View style={styles.badgeIconSkeleton} />
              </View>
              {/* Rarity Badge Skeleton */}
              <View style={styles.rarityBadgeSkeleton} />
            </View>
            
            {/* Right side - Content Container */}
            <View style={styles.contentContainer}>
              <View style={styles.badgeNameSkeleton} />
              <View style={styles.badgeDescriptionSkeleton} />
              <View style={styles.unlockedDateSkeleton} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    marginHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(242, 245, 247, 0.1)',
    borderRadius: 16,
  },
  countSkeleton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignSelf: 'center',
  },
  totalCountSkeleton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignSelf: 'center',
  },
  badgesList: {
    flex: 1,
    paddingHorizontal: 0,
  },
  badgeSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 80,
  },
  iconContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  badgeIconContainer: {
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  badgeIconSkeleton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
  },
  rarityBadgeSkeleton: {
    width: 40,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    alignSelf: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  badgeNameSkeleton: {
    width: '60%',
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeDescriptionSkeleton: {
    width: '90%',
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 8,
  },
  unlockedDateSkeleton: {
    width: '40%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
  },
});

export default BadgeSkeletonLoader;
