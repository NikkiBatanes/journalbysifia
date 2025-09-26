import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Colors } from '../theme';

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  style?: ViewStyle;
  backgroundColor?: string;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({ width, height, style, backgroundColor = '#E1E9EE' }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const widthAsNumber = typeof width === 'string' ? parseFloat(width) : width;
  const widthStyle = typeof width === 'string' && width.endsWith('%')
    ? { width: width as `${number}%` }
    : { width: widthAsNumber };

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
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
          borderRadius: 4,
          opacity: pulseAnim,
        } as ViewStyle,
        style,
      ]}
    />
  );
};

const PlaybookSkeletonLoader = () => {
  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Playbook Info Skeleton */}
        <View style={styles.playbookInfoContainer}>
          <View style={styles.playbookHeader}>
            <View style={styles.headerTitleContainer}>
              {/* Title */}
              <SkeletonBox width="75%" height={32} style={styles.titleSkeleton} />

              {/* Day, date */}
              <SkeletonBox width="40%" height={18} style={styles.dateSkeleton} />
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
                      backgroundColor="rgba(142, 169, 167, 0.2)"
                    />
                  </View>

                  {/* Tasks */}
                  <SkeletonBox width={70} height={18} style={styles.tasksText} />
                </View>
              </View>

              {/* Two icons */}
              <View style={styles.iconsWrapper}>
                <SkeletonBox width={40} height={40} style={styles.iconSkeleton} />
                <SkeletonBox width={40} height={40} style={styles.iconSkeleton} />
              </View>
            </View>
          </View>
        </View>

        {/* Single card */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Title */}
            <SkeletonBox width="60%" height={16} style={styles.cardTitleSkeleton} />

            {/* Summary - 6 lines */}
            <View style={styles.summaryContainer}>
              <SkeletonBox width="100%" height={24} style={styles.summaryLine} />
              <SkeletonBox width="95%" height={24} style={styles.summaryLine} />
              <SkeletonBox width="98%" height={24} style={styles.summaryLine} />
              <SkeletonBox width="92%" height={24} style={styles.summaryLine} />
              <SkeletonBox width="96%" height={24} style={styles.summaryLine} />
              <SkeletonBox width="85%" height={24} style={styles.summaryLine} />
            </View>

            {/* Text - 3 lines */}
            <View style={styles.textContainer}>
              <SkeletonBox width="100%" height={14} style={styles.textLine} />
              <SkeletonBox width="92%" height={14} style={styles.textLine} />
              <SkeletonBox width="85%" height={14} style={styles.textLine} />
              <SkeletonBox width="85%" height={14} style={styles.textLine} />
            </View>
          </View>
        </View>
      </View>
    </View>
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
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  progressBarFill: {
    borderRadius: 4,
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
    borderRadius: 12,
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
  card: {
    width: '100%',
    maxWidth: 335, // Matches SCREEN_WIDTH - 80 when screen width is 375 (iPhone 8)
    height: 450,
    backgroundColor: Colors.modalBlue,
    borderRadius: 28,
    padding: 24,
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
