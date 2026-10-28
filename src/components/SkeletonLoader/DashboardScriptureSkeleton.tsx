import React from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {Colors} from '../../theme/colors';

interface DashboardScriptureSkeletonProps {
  centered?: boolean;
}

const DashboardScriptureSkeleton: React.FC<DashboardScriptureSkeletonProps> = ({
  centered = false,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.8,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.35,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animatedValue]);

  return (
    <View
      accessibilityLabel="Loading Scripture"
      accessibilityRole="progressbar"
      style={[styles.container, centered && styles.containerCentered]}
      testID="dashboard-scripture-skeleton">
      <View style={[styles.verseContent, centered && styles.contentCentered]}>
        <Animated.View
          style={[styles.verseLine, styles.verseLineLong, {opacity: animatedValue}]}
        />
        <Animated.View
          style={[styles.verseLine, styles.verseLineMedium, {opacity: animatedValue}]}
        />
        <Animated.View
          style={[styles.verseLine, styles.verseLineShort, {opacity: animatedValue}]}
        />
        <Animated.View
          style={[styles.referenceBar, {opacity: animatedValue}]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 112,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 12,
  },
  verseContent: {
    width: '100%',
    alignItems: 'flex-end',
    gap: 7,
  },
  containerCentered: {alignItems: 'center'},
  contentCentered: {alignItems: 'center'},
  verseLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.lightGray,
  },
  verseLineLong: {
    width: '88%',
  },
  verseLineMedium: {
    width: '72%',
  },
  verseLineShort: {
    width: '48%',
  },
  referenceBar: {
    width: 96,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.lightGray,
    marginTop: 3,
  },
});

export default DashboardScriptureSkeleton;
