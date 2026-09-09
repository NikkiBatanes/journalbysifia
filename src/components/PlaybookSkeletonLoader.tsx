import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  style?: ViewStyle;
  backgroundColor?: string;
  borderRadius?: number;
}

interface PlaybookSkeletonLoaderProps {
  variant?: 'legacy' | 'cover';
  showClose?: boolean;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width,
  height,
  style,
  backgroundColor = 'rgba(255,255,255,0.18)',
  borderRadius = 10,
}) => {
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
          borderRadius,
          opacity: pulseAnim,
        } as ViewStyle,
        style,
      ]}
    />
  );
};

const PlaybookSkeletonLoader: React.FC<PlaybookSkeletonLoaderProps> = ({ variant = 'legacy', showClose = true }) => {
  const insets = useSafeAreaInsets();

  if (variant === 'cover') {
    return (
      <View style={styles.container}>
        <View style={[styles.coverContent, IS_IPAD && styles.coverContentPad, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}>
          {showClose && (
            <View style={[styles.coverCloseButton, { top: insets.top + 8 }]}>
              <SkeletonBox width={17} height={17} borderRadius={9} backgroundColor="rgba(255,255,255,0.3)" />
            </View>
          )}

          <View style={styles.coverCenter}>
            <View style={styles.coverPlaybookLabel}>
              <SkeletonBox width={64} height={11} borderRadius={5} backgroundColor="rgba(255,255,255,0.22)" />
              <SkeletonBox width={16} height={16} borderRadius={8} backgroundColor="rgba(255,255,255,0.18)" />
            </View>

            <View style={styles.coverTitleBlock}>
              <SkeletonBox width="86%" height={31} borderRadius={12} backgroundColor="rgba(255,255,255,0.24)" />
              <SkeletonBox width="62%" height={31} borderRadius={12} style={styles.coverTitleLine} backgroundColor="rgba(255,255,255,0.24)" />
            </View>

            <View style={styles.coverSubtitleBlock}>
              <SkeletonBox width="92%" height={17} borderRadius={8} backgroundColor="rgba(255,255,255,0.16)" />
              <SkeletonBox width="76%" height={17} borderRadius={8} style={styles.coverSubtitleLine} backgroundColor="rgba(255,255,255,0.14)" />
            </View>

            <View style={styles.coverTimePill}>
              <SkeletonBox width={15} height={15} borderRadius={8} backgroundColor="rgba(255,255,255,0.22)" />
              <SkeletonBox width={104} height={13} borderRadius={7} backgroundColor="rgba(255,255,255,0.2)" />
            </View>

            <SkeletonBox
              width="100%"
              height={54}
              borderRadius={50}
              style={styles.coverBeginButton}
              backgroundColor="rgba(255,255,255,0.2)"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.contentContainer, IS_IPAD && styles.contentContainerPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8) }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.sage,
  },
  coverContent: {
    flex: 1,
    paddingHorizontal: 28,
  },
  coverContentPad: {
    paddingHorizontal: 96,
  },
  coverCloseButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  coverCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 34,
  },
  coverPlaybookLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  coverTitleBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 22,
  },
  coverTitleLine: {
    marginTop: 8,
  },
  coverSubtitleBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 18,
  },
  coverSubtitleLine: {
    marginTop: 8,
  },
  coverTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 24,
  },
  coverBeginButton: {
    marginTop: 28,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  contentContainerPad: {
    paddingHorizontal: 48,
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
