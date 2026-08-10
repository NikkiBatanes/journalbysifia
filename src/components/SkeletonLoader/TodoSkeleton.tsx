import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface TodoSkeletonProps {
  count?: number;
}

export const TodoSkeleton: React.FC<TodoSkeletonProps> = ({ count = 3 }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;

    const animate = () => {
      if (!isMounted.current) {return;}

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
      ]).start((finished) => {
        if (finished && isMounted.current) {
          animate();
        }
      });
    };

    animate();

    return () => {
      isMounted.current = false;
      animatedValue.stopAnimation();
    };
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.skeletonItem, { opacity }]}>
          <View style={styles.checkbox} />
          <View style={styles.textContainer}>
            <View style={[styles.textLine, { width: `${Math.random() * 40 + 60}%` }]} />
            <View style={[styles.textLine, styles.textLineSmall, { width: `${Math.random() * 30 + 40}%` }]} />
          </View>
          <View style={styles.actionButton} />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  textLine: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    marginBottom: 4,
  },
  textLineSmall: {
    height: 10,
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
