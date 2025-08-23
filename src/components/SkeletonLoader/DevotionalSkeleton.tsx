import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme/colors';

const DevotionalSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
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

  return (
    <View style={styles.container}>
      {/* Match DashboardPrayerSkeleton structure: single transparent card */}
      <View style={styles.card}>
        {/* Title line */}
        <Animated.View style={[styles.titleSkeleton, { opacity }]} />

        {/* Description block */}
        <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* CTA line */}
        <Animated.View style={[styles.ctaSkeleton, { opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    marginBottom: 12,
  },
  titleSkeleton: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 6,
    marginBottom: 12,
    width: '78%',
    alignSelf: 'flex-start',
  },
  descriptionSkeleton: {
    height: 38,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 14,
    width: '92%',
    alignSelf: 'flex-start',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 8,
  },
  ctaSkeleton: {
    height: 14,
    width: 140,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 10,
  },
});

export default DevotionalSkeleton;
