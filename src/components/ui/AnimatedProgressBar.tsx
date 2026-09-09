import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Animated as RNAnimated, Easing as RNEasing } from 'react-native';

export interface AnimatedProgressBarProps {
  percentage: number; // 0 - 100
  height?: number; // fallback if no trackStyle.height provided
  durationMs?: number;
  containerStyle?: ViewStyle; // wrapper around the bar
  trackStyle?: ViewStyle; // background track style
  fillStyle?: ViewStyle; // foreground fill style
}

/**
 * AnimatedProgressBar
 * - Width animation matches the Playbook Detail header bar:
 *   RNAnimated.timing with cubic out easing, animating width from 0%-100%.
 * - UseNativeDriver is false because width cannot use native driver.
 */
const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  percentage,
  height = 12,
  durationMs = 450,
  containerStyle,
  trackStyle,
  fillStyle,
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const progressAnim = React.useRef(new RNAnimated.Value(clamped)).current;

  React.useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: clamped,
      duration: durationMs,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false, // width animation
    }).start();
  }, [clamped, durationMs, progressAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.track, { height }, trackStyle]}>
        <RNAnimated.View style={[styles.fill, { width: animatedWidth, height }, fillStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#526A5B',
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
});

export default AnimatedProgressBar;
