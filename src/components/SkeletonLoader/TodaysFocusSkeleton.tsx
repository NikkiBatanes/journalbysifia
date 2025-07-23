import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export const TodaysFocusSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      {/* Focus Section */}
      <View style={styles.section}>
        <Animated.View style={[styles.sectionHeader, { opacity }]} />
        <Animated.View style={[styles.focusLine, { opacity }]} />
        <Animated.View style={[styles.focusLineShort, { opacity }]} />
      </View>

      {/* Priorities Section */}
      <View style={styles.section}>
        <Animated.View style={[styles.sectionHeader, { opacity }]} />
        {Array.from({ length: 3 }).map((_, index) => (
          <Animated.View key={index} style={[styles.priorityItem, { opacity }]}>
            <View style={styles.priorityBullet} />
            <View style={[styles.priorityText, { width: `${Math.random() * 40 + 50}%` }]} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    marginBottom: 12,
    width: '30%',
  },
  focusLine: {
    height: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    marginBottom: 8,
    width: '85%',
  },
  focusLineShort: {
    height: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    width: '60%',
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  priorityBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 12,
  },
  priorityText: {
    height: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
  },
});
