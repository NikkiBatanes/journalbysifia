import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  width: number | null; // null for full width
  color?: string;
  height?: number;
  backgroundColor?: string;
}

const ProgressBar = ({
  progress,
  width,
  color = Colors.faithGold,
  height = 6,
  backgroundColor = 'rgba(0, 0, 0, 0.1)',
}: ProgressBarProps) => {
  // Ensure progress is between 0 and 1
  // If progress > 1, assume it's a percentage and convert to decimal
  const progressValue = progress > 1 ? progress / 100 : progress;
  const clampedProgress = Math.min(Math.max(progressValue, 0), 1);

  return (
    <View
      style={[
        styles.container,
        {
          width: width || '100%',
          height,
          backgroundColor,
          borderRadius: height / 2,
        },
      ]}
    >
      <View
        style={[
          styles.progress,
          {
            width: `${clampedProgress * 100}%`,
            height,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default ProgressBar;
