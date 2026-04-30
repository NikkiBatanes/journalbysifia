import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const DashboardScriptureSkeleton: React.FC = () => {
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
    <View style={styles.card}>
      {/* Title placeholder (centered bar) */}
      <View style={styles.titleRow}>
        <Animated.View style={[styles.titleBar, { opacity }]} />
      </View>

      {/* Verse block with left bar */}
      <View style={styles.verseRow}>
        <Animated.View style={[styles.leftBar, { opacity }]} />
        <View style={styles.verseContent}>
          <Animated.View style={[styles.verseLineLong, { opacity }]} />
          <Animated.View style={[styles.verseLineShort, { opacity }]} />
          <Animated.View style={[styles.referenceBar, { opacity }]} />
        </View>
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
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 120,
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  titleBar: {
    height: 12,
    width: 160,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  leftBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'stretch',
    marginTop: 2,
  },
  verseContent: {
    flex: 1,
  },
  verseLineLong: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 10,
    width: '92%',
  },
  verseLineShort: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 8,
    width: '70%',
  },
  referenceBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    width: 120,
    marginTop: 2,
  },
});

export default DashboardScriptureSkeleton;
