import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { Easing, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

import { Colors } from '../theme';

export default function SwipeUpIndicator() {
  const translateY = useSharedValue(0);

  const animation = React.useCallback(() => {
    translateY.value = withRepeat(
      withTiming(-16, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [translateY]);

  React.useEffect(() => {
    animation();
  }, [animation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <Ionicons name="chevron-up" size={32} color={Colors.anchorBlue} style={styles.icon} />
      </Animated.View>
      <Text style={styles.text}>Tap the card or Swipe up to continue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  iconContainer: {
    marginBottom: 2,
  },
  icon: {
    opacity: 0.7,
  },
  text: {
    color: Colors.anchorBlue,
    fontSize: 13,
    opacity: 0.85,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
