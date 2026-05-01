import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated } from 'react-native';
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
  const isMounted = useRef(true);
  const widthAsNumber = typeof width === 'string' ? parseFloat(width) : width;
  const widthStyle = typeof width === 'string' && width.endsWith('%')
    ? { width: width as `${number}%` }
    : { width: widthAsNumber };

  useEffect(() => {
    isMounted.current = true;

    const pulse = () => {
      if (!isMounted.current) {return;}

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
        if (finished && isMounted.current) {
          pulse();
        }
      });
    };

    // Start animation
    pulse();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted.current = false;
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
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* PLAYBOOK Label with Chevron - matches PlaybookWalkthroughScreen */}
        <View style={styles.playbookLabelContainer}>
          <SkeletonBox width="25%" height={12} backgroundColor={'rgba(255,255,255,0.22)'} />
          <View style={styles.chevronSkeleton} />
        </View>

        {/* Title Skeleton - below PLAYBOOK label */}
        <View style={styles.titleSkeletonContainer}>
          <SkeletonBox width="70%" height={28} backgroundColor={'rgba(255,255,255,0.24)'} />
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

        {/* Transition Line Divider - matches PlaybookWalkthroughScreen Step 0 */}
        <View style={styles.transitionLineContainer}>
          <SkeletonBox width="60%" height={16} backgroundColor={'rgba(255,255,255,0.12)'} />
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
