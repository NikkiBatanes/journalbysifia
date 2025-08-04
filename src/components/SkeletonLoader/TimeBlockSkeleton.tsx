import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../../theme/colors';

interface TimeBlockSkeletonProps {
  count?: number;
}

export const TimeBlockSkeleton: React.FC<TimeBlockSkeletonProps> = ({ count = 3 }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
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

  const renderSkeletonItem = (index: number) => (
    <View key={index} style={styles.skeletonItem}>
      {/* Time Column */}
      <View style={styles.timeColumn}>
        <Animated.View style={[styles.timeBlock, { opacity }]} />
        <Animated.View style={[styles.durationBlock, { opacity }]} />
      </View>

      {/* Details Column */}
      <View style={styles.detailsColumn}>
        <Animated.View style={[styles.titleBlock, { opacity }]} />
        <View style={styles.metaRow}>
          <Animated.View style={[styles.categoryBlock, { opacity }]} />
          <Animated.View style={[styles.locationBlock, { opacity }]} />
        </View>
        <Animated.View style={[styles.notesBlock, { opacity }]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => renderSkeletonItem(index))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 16,
  },
  skeletonItem: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  timeColumn: {
    width: 90,
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.15)',

  },
  timeBlock: {
    width: 60,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 4,
  },
  durationBlock: {
    width: 40,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 16,
  },
  titleBlock: {
    width: '80%',
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  categoryBlock: {
    width: 80,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 7,
  },
  locationBlock: {
    width: 60,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 7,
  },
  notesBlock: {
    width: '60%',
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
  },
});
