import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const DashboardActionStepsSkeleton: React.FC = () => {
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
      {/* Centered title bar */}
      <View style={styles.titleRow}>
        <Animated.View style={[styles.titleBar, { opacity }]} />
      </View>

      {/* List of action step placeholders (3 items) */}
      <View style={styles.listContainer}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.item}>
            <View style={styles.headerRow}>
              <Animated.View style={[styles.checkbox, { opacity }]} />
              <Animated.View style={[styles.titleLine, { opacity }]} />
            </View>
            <View style={styles.exampleRow}>
              <Animated.View style={[styles.leftBar, { opacity }]} />
              <View style={{ flex: 1 }}>
                <Animated.View style={[styles.exampleLineLong, { opacity }]} />
              </View>
            </View>
            <View style={styles.metaRow}>
              <Animated.View style={[styles.metaChip, { opacity }]} />
            </View>
          </View>
        ))}
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
    width: 180,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  listContainer: {
    gap: 10,
  },
  item: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  titleLine: {
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    flex: 1,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginLeft: 2 + 18 + 6, // align with live title offset
  },
  leftBar: {
    width: 1,
    height: 28,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginRight: 8,
    marginTop: 2,
  },
  exampleLineLong: {
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    width: '85%',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 2 + 18 + 6,
  },
  metaChip: {
    height: 12,
    width: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

export default DashboardActionStepsSkeleton;
