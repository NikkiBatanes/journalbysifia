import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface GratitudeSkeletonProps {
  count?: number;
}

export const GratitudeSkeleton: React.FC<GratitudeSkeletonProps> = ({ count = 3 }) => {
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
          <View style={styles.itemNumber} />
          <View style={[styles.textLine, { width: `${Math.random() * 40 + 50}%` }]} />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingBottom: 16,
    marginTop: 10,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
    marginLeft: 4,
  },
  textLine: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    flex: 1,
  },
});
