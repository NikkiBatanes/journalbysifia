import React from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import {Colors} from '../../theme/colors';

type ScriptureLoadingSkeletonProps = {
  /** Use the dark tone when the skeleton sits on a forest/dark reader surface. */
  tone?: 'light' | 'dark';
  variant?: 'inline' | 'card' | 'reader';
  lines?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const LINE_WIDTHS: Array<`${number}%`> = [
  '96%',
  '88%',
  '93%',
  '70%',
  '90%',
  '82%',
  '62%',
];

/** A shared text-shaped loading state for every Scripture passage fetch. */
const ScriptureLoadingSkeleton: React.FC<ScriptureLoadingSkeletonProps> = ({
  tone = 'light',
  variant = 'card',
  lines,
  style,
  testID = 'scripture-loading-skeleton',
}) => {
  const opacity = React.useRef(new Animated.Value(0.38)).current;
  const lineCount = lines ?? (variant === 'reader' ? 7 : variant === 'inline' ? 2 : 4);

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.76,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.38,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View
      accessible
      accessibilityLabel="Loading Scripture"
      accessibilityRole="progressbar"
      style={[styles.container, styles[variant], style]}
      testID={testID}>
      {Array.from({length: lineCount}, (_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.line,
            variant === 'reader'
              ? styles.readerLine
              : variant === 'inline'
              ? styles.inlineLine
              : styles.cardLine,
            index === Math.min(4, lineCount - 1) && lineCount > 5
              ? styles.paragraphBreak
              : null,
            {
              width: LINE_WIDTHS[index % LINE_WIDTHS.length],
              opacity,
              backgroundColor:
                tone === 'dark' ? 'rgba(242,245,247,0.32)' : Colors.lightGray,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {width: '100%', alignItems: 'flex-start'},
  inline: {paddingVertical: 5},
  card: {minHeight: 94, justifyContent: 'center', paddingVertical: 10},
  reader: {minHeight: 260, paddingTop: 4},
  line: {borderRadius: 8},
  inlineLine: {height: 8, marginBottom: 7},
  cardLine: {height: 12, marginBottom: 11},
  readerLine: {height: 18, marginBottom: 18},
  paragraphBreak: {marginTop: 12},
});

export default ScriptureLoadingSkeleton;
