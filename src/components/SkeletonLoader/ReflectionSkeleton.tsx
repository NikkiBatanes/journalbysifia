import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme/colors';

interface ReflectionSkeletonProps {
  count?: number;
}

export const ReflectionSkeleton: React.FC<ReflectionSkeletonProps> = ({ count = 3 }) => {
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
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.skeletonCard, { opacity }]}>
          <View style={styles.cardHeader}>
            <View style={styles.titleSkeleton} />
            <View style={styles.typeBadge} />
          </View>
          <View style={styles.contentSkeleton} />
          <View style={styles.metaRow}>
            <View style={styles.dateSkeleton} />
            <View style={styles.tagsSkeleton} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSkeleton: {
    height: 20,
    backgroundColor: Colors.lightGray,
    borderRadius: 4,
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    height: 20,
    width: 60,
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
  },
  contentSkeleton: {
    height: 60,
    backgroundColor: Colors.lightGray,
    borderRadius: 6,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateSkeleton: {
    height: 14,
    width: 80,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
  tagsSkeleton: {
    height: 14,
    width: 100,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
});
