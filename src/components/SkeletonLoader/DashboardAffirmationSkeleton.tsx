import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const DashboardAffirmationSkeleton: React.FC = () => {
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
    <View style={styles.card}>
      {/* Title placeholder */}
      <View style={styles.titleRow}>
        <Animated.View style={[styles.titleBar, { opacity }]} />
      </View>

      {/* Affirmation item placeholders */}
      <View style={styles.listContainer}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.item}>
            <Animated.View style={[styles.itemLineLong, { opacity }]} />
            <Animated.View style={[styles.itemLineShort, { opacity }]} />
          </View>
        ))}
      </View>

      {/* Read button placeholder */}
      <View style={styles.readRow}>
        <Animated.View style={[styles.readButton, { opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 140,
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  titleBar: {
    height: 12,
    width: 200,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  listContainer: {
    gap: 8,
  },
  item: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  itemLineLong: {
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 8,
    width: '92%',
  },
  itemLineShort: {
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    width: '70%',
  },
  readRow: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  readButton: {
    height: 36,
    width: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
});

export default DashboardAffirmationSkeleton;
