import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

const DashboardPrayerSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.container}>
      {/* Header removed in skeleton per design (no icon + title) */}

      {[0].map((i) => (
        <View key={i} style={styles.card}>
          {/* Top-right badge removed for cleaner skeleton */}

          {/* Title */}
          <Animated.View style={[styles.titleSkeleton, { opacity }]} />

          {/* Description lines */}
          <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

          {/* Divider */}
          <View style={styles.divider} />

          {/* CTA line */}
          <Animated.View style={[styles.ctaSkeleton, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    marginBottom: 12,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  badge: {
    height: 20,
    minWidth: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
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

export default DashboardPrayerSkeleton;
