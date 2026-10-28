import React, {useEffect, useRef} from 'react';
import {Animated, type StyleProp, type ViewStyle} from 'react-native';

interface StaggeredBounceInProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** A short, springy entrance used by selectable pill and card groups. */
const StaggeredBounceIn: React.FC<StaggeredBounceInProps> = ({
  children,
  index,
  delay = 160,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(progress, {
      toValue: 1,
      delay: delay + index * 45,
      tension: 92,
      friction: 9,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, index, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp'}),
          transform: [
            {translateY: progress.interpolate({inputRange: [0, 1], outputRange: [14, 0]})},
            {scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.9, 1]})},
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
};

export default StaggeredBounceIn;
