import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const MomentsSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;

    const animate = () => {
      if (!isMounted.current) {return;}

      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
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

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.container}>
      {/* Header skeleton row: grouping + filter chips */}
      <View style={styles.headerRow}>
        <Animated.View style={[styles.chip, styles.chipShort, { opacity }]} />
        <Animated.View style={[styles.chip, styles.chipMedium, { opacity }]} />
      </View>

      {/* Section header bar */}
      <Animated.View style={[styles.sectionHeader, { opacity }]} />

      {/* A few rectangle cards to mimic carousel items */}
      {[0, 1, 2].map(i => (
        <View key={`moments-skel-${i}`} style={styles.card}>
          <Animated.View style={[styles.cardTitle, { opacity }]} />
          <Animated.View style={[styles.cardLine, { opacity, width: width * 0.78 }]} />
          <Animated.View style={[styles.cardLine, { opacity, width: width * 0.6 }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  chipShort: {
    width: 90,
  },
  chipMedium: {
    width: 110,
  },
  sectionHeader: {
    height: 16,
    width: '40%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    height: 16,
    width: '55%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
  },
  cardLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
  },
});

export default MomentsSkeleton;
