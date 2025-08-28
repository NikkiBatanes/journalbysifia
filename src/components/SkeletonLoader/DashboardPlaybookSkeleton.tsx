import React from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = Math.round(width * 0.75);
const ITEM_SPACING = 12; // add visible gap between cards in skeleton
const SIDE_PADDING = Math.round((width - ITEM_WIDTH) / 2);

const DashboardPlaybookSkeleton: React.FC = () => {
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
      <View style={styles.header}>
        <MaterialCommunityIcons name="clipboard-text-play" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Playbooks</Text>
      </View>

      <View style={[styles.row, { paddingHorizontal: SIDE_PADDING }]}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.card,
              { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
              index === 0 ? { marginLeft: -(SIDE_PADDING - 16) } : null,
            ]}
          >
            {/* Top-right badge removed for cleaner skeleton */}

            {/* Title */}
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />

            {/* Description */}
            <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

            {/* Progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                {/* Empty progress (no fill) to indicate loading state */}
                <Animated.View style={[styles.progressFill, styles.emptyProgress, { opacity }]} />
              </View>
              <Animated.View style={[styles.progressTextSkeleton, { opacity }]} />
            </View>

            {/* Steps info */}
            <Animated.View style={[styles.stepsSkeleton, { opacity }]} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
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
  row: {
    flexDirection: 'row',
    paddingRight: 16,
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  badge: {
    height: 24,
    minWidth: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  titleSkeleton: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 6,
    marginBottom: 12,
    width: '78%', // avoid overlap with percentage badge
    alignSelf: 'flex-start',
  },
  descriptionSkeleton: {
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 16,
    width: '92%',
    alignSelf: 'flex-start',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.alertCoral,
  },
  emptyProgress: {
    width: '0%',
  },
  progressTextSkeleton: {
    height: 12,
    width: 110,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepsSkeleton: {
    height: 12,
    width: 160,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});

export default DashboardPlaybookSkeleton;
