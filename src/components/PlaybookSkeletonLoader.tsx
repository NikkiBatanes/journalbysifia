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
      ]).start(() => pulse());
    };

    pulse();

    // Cleanup function to prevent memory leaks
    return () => {
      pulseAnim.stopAnimation();
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

const PlaybookSkeletonLoader = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 48 : 16;
  const tabletCardWidth = Math.min(width - horizontalPadding * 2, 720);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.contentContainer, isTablet && styles.contentContainerTablet]}>
        {/* Playbook Info Skeleton */}
        <View style={styles.playbookInfoContainer}>
          <View style={styles.playbookHeader}>
            <View style={styles.headerTitleContainer}>
              {/* Title */}
              <SkeletonBox width="75%" height={32} style={styles.titleSkeleton} backgroundColor={'rgba(255,255,255,0.22)'} />

              {/* Day, date */}
              <SkeletonBox width="40%" height={18} style={styles.dateSkeleton} backgroundColor={'rgba(255,255,255,0.16)'} />
            </View>

            {/* Progress bar */}
            <View style={styles.progressAndViewRow}>
              <View style={styles.progressContainer}>
                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <SkeletonBox
                      width="100%"
                      height={32}
                      style={styles.progressBarFill}
                      backgroundColor="rgba(255, 255, 255, 0.20)"
                    />
                  </View>

                  {/* Tasks */}
                </View>
              </View>

              {/* Two icons */}
              <View style={styles.iconsWrapper}>
                <SkeletonBox width={40} height={40} style={styles.iconSkeleton} backgroundColor={'rgba(255,255,255,0.10)'} />
                <SkeletonBox width={40} height={40} style={styles.iconSkeleton} backgroundColor={'rgba(255,255,255,0.10)'} />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.cardContainer, isTablet && styles.cardContainerTablet]}>
          <View
            style={[
              styles.card,
              isTablet && styles.cardTablet,
              isTablet && { width: tabletCardWidth, maxWidth: tabletCardWidth },
            ]}
          >
            {/* Title */}
            <SkeletonBox width="60%" height={16} style={styles.cardTitleSkeleton} backgroundColor={'rgba(255,255,255,0.20)'} />
            <View style={styles.summaryContainer}>
              <SkeletonBox width="100%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.20)'} />
              <SkeletonBox width="95%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="98%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.20)'} />
              <SkeletonBox width="92%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.18)'} />
              <SkeletonBox width="96%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.20)'} />
              <SkeletonBox width="85%" height={24} style={styles.summaryLine} backgroundColor={'rgba(255,255,255,0.16)'} />
            </View>

            {/* Text - 3 lines */}
            <View style={styles.textContainer}>
              <SkeletonBox width="100%" height={14} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
              <SkeletonBox width="92%" height={14} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
              <SkeletonBox width="85%" height={14} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
              <SkeletonBox width="85%" height={14} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
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
  contentContainerTablet: {
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 32,
  },
  playbookInfoContainer: {
    marginBottom: 24,
  },
  playbookHeader: {
    width: '100%',
  },
  headerTitleContainer: {
    marginBottom: 16,
  },
  progressAndViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  progressBarFill: {
    borderRadius: 8,
  },
  tasksText: {
    marginLeft: 12,
  },
  titleSkeleton: {
    marginBottom: 12,
  },
  dateSkeleton: {
    marginBottom: 20,
  },
  iconsWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  iconSkeleton: {
    borderRadius: 16,
  },
  cardTitleSkeleton: {
    marginBottom: 16,
  },
  iconsContainer: {
    flexDirection: 'row',
    gap: 0,
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 0,
  },
  cardContainerTablet: {
    alignItems: 'center',
    marginTop: 12,
  },
  card: {
    width: '100%',
    maxWidth: 335, // Matches SCREEN_WIDTH - 80 when screen width is 375 (iPhone 8)
    height: 450,
    backgroundColor: Colors.modalBlue,
    borderRadius: 36,
    padding: 24,
  },
  cardTablet: {
    maxWidth: 520,
    height: 520,
    padding: 32,
    borderRadius: 40,
  },
  summaryContainer: {
    marginBottom: 24,
    marginTop: 24,
  },
  summaryLine: {
    marginBottom: 8,
  },
  textContainer: {
    marginTop: 16,
  },
  textLine: {
    marginBottom: 6,
  },
});

export default PlaybookSkeletonLoader;
