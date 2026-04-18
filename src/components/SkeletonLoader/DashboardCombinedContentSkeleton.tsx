import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = Math.round(width * 0.75);
const ITEM_SPACING = 12;
const SIDE_PADDING = Math.round((width - ITEM_WIDTH) / 2);

const DashboardCombinedContentSkeleton: React.FC = () => {
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
        <Animated.View style={[styles.titleSkeleton, { opacity }]} />
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
            {/* Type indicator */}
            <Animated.View style={[styles.typeIndicatorSkeleton, { opacity }]} />

            {/* Title */}
            <Animated.View style={[styles.cardTitleSkeleton, { opacity }]} />

            {/* Subtitle */}
            <Animated.View style={[styles.subtitleSkeleton, { opacity }]} />

            {/* Progress bar / Day indicator */}
            <View style={styles.bottomSection}>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, styles.emptyProgress, { opacity }]} />
              </View>
              <Animated.View style={[styles.textSkeleton, { opacity }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titleSkeleton: {
    height: 14,
    width: 180,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  row: {
    flexDirection: 'row',
    paddingRight: 16,
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    position: 'relative',
  },
  typeIndicatorSkeleton: {
    height: 12,
    width: 80,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  cardTitleSkeleton: {
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
    width: '85%',
  },
  subtitleSkeleton: {
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 12,
    width: '92%',
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.alertCoral,
  },
  emptyProgress: {
    width: '0%',
  },
  textSkeleton: {
    height: 12,
    width: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});

export default DashboardCombinedContentSkeleton;
