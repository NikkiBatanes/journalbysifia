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
        {/* PLAYBOOK Label with Chevron - matches PlaybookWalkthroughScreen */}
        <View style={styles.playbookLabelContainer}>
          <SkeletonBox width="25%" height={12} backgroundColor={'rgba(255,255,255,0.22)'} />
          <View style={styles.chevronSkeleton} />
        </View>

        {/* Step Label Row - matches PlaybookWalkthroughScreen */}
        <View style={styles.stepLabelRow}>
          <View style={[styles.iconSkeleton, styles.stepIconSkeleton]} />
          <SkeletonBox width="35%" height={14} backgroundColor={'rgba(255,255,255,0.22)'} />
        </View>

        {/* Text Block Skeleton - matches PlaybookWalkthroughScreen text blocks */}
        <View style={styles.textBlock}>
          <SkeletonBox width="100%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
          <SkeletonBox width="95%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
          <SkeletonBox width="98%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
          <SkeletonBox width="92%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
          <SkeletonBox width="96%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
          <SkeletonBox width="85%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
          <SkeletonBox width="90%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.16)'} />
          <SkeletonBox width="88%" height={22} style={styles.textLine} backgroundColor={'rgba(255,255,255,0.14)'} />
        </View>

        {/* Floating Action Button Skeleton - matches PlaybookWalkthroughScreen floating buttons */}
        <View style={styles.floatingButtonSkeleton}>
          <SkeletonBox width={120} height={44} style={{ borderRadius: 22 }} backgroundColor={'rgba(255,255,255,0.18)'} />
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
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    alignSelf: 'center',
  },
  chevronSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
  floatingButtonSkeleton: {
    position: 'absolute',
    bottom: 80,
    left: 16,
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
