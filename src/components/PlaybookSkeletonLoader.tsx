import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme';

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  style?: ViewStyle;
  backgroundColor?: string;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({ width, height, style, backgroundColor = 'rgba(255,255,255,0.18)' }) => {
  // Dark-theme friendly shimmer range
  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const widthAsNumber = typeof width === 'string' ? parseFloat(width) : width;
  const widthStyle = typeof width === 'string' && width.endsWith('%')
    ? { width: width as `${number}%` }
    : { width: widthAsNumber };

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start((finished) => {
        // Only continue if component is still mounted and animation finished properly
        if (finished) {
          pulse();
        }
      });
    };

    // Start animation
    pulse();

    // Cleanup function to prevent memory leaks
    return () => {
      pulseAnim.stopAnimation();
      // Mark as finished to prevent recursive calls
      (pulseAnim as any)._finished = true;
    };
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          ...widthStyle,
          height,
          backgroundColor,
          borderRadius: 10,
          opacity: pulseAnim,
        } as ViewStyle,
        style,
      ]}
    />
  );
};

// Animated progress bar skeleton component
const AnimatedProgressBarSkeleton = () => {
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const animateProgress = () => {
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 0.25,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start((finished) => {
        // Only continue if component is still mounted and animation finished properly
        if (finished) {
          animateProgress();
        }
      });
    };

    // Start animation
    animateProgress();

    // Cleanup function to prevent memory leaks
    return () => {
      progressAnim.stopAnimation();
      // Mark as finished to prevent recursive calls
      (progressAnim as any)._finished = true;
    };
  }, [progressAnim]);

  return (
    <Animated.View
      style={[
        styles.progressBarFill,
        styles.progressBarFillLight,
        styles.progressBarEmpty,
        { opacity: progressAnim },
      ]}
    />
  );
};

const PlaybookSkeletonLoader = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Continue Section Skeleton */}
        <View style={styles.carouselTitleContainer}>
          <SkeletonBox width="30%" height={20} backgroundColor={'rgba(255,255,255,0.22)'} />
        </View>
        <View style={styles.carouselRow}>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="70%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="50%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="65%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="45%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="75%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="55%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
        </View>

        {/* Category Section Skeleton */}
        <View style={styles.carouselTitleContainer}>
          <SkeletonBox width="25%" height={20} backgroundColor={'rgba(255,255,255,0.22)'} />
        </View>
        <View style={styles.carouselRow}>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="60%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="40%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="70%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="50%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
        </View>

        {/* Another Category Section Skeleton */}
        <View style={styles.carouselTitleContainer}>
          <SkeletonBox width="20%" height={20} backgroundColor={'rgba(255,255,255,0.22)'} />
        </View>
        <View style={styles.carouselRow}>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="65%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="45%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="55%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="35%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
          <View style={styles.carouselCardSkeleton}>
            <SkeletonBox width="100%" height={120} backgroundColor={'rgba(255,255,255,0.12)'} />
            <View style={styles.cardContentSkeleton}>
              <SkeletonBox width="60%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="40%" height={12} style={styles.cardSubtitleSkeleton} backgroundColor={'rgba(255,255,255,0.14)'} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  carouselTitleContainer: {
    marginBottom: 12,
  },
  carouselRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  carouselCardSkeleton: {
    width: 140,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContentSkeleton: {
    padding: 12,
    gap: 4,
  },
  cardTitleSkeleton: {
    marginBottom: 2,
  },
  cardSubtitleSkeleton: {
    marginBottom: 0,
  },
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    alignSelf: 'center',
  },
  titleSkeletonContainer: {
    marginTop: 16,
    alignSelf: 'center',
  },
  chevronSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  transitionLineContainer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 48,
  },
  stepIconSkeleton: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  textBlock: {
    marginTop: 24,
  },
  textLine: {
    marginBottom: 8,
  },
  iconSkeleton: {
    borderRadius: 16,
  },
  progressBarFill: {
    height: 12,
    borderRadius: 12,
  },
  progressBarEmpty: {
    width: 0,
  },
  progressBarFillLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
});

export default PlaybookSkeletonLoader;
