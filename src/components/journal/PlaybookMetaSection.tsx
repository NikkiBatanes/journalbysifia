// Animated FROM PLAYBOOK metadata section used by all journal log editors.
// Vertical bar uses alignSelf:'stretch' so its height = content height (no onLayout needed).
// scaleY + translateY grows the bar top-to-bottom. Text items stagger-fade in.

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Animated, LayoutChangeEvent } from 'react-native';
import ThemedText from '../common/ThemedText';
import StepContextCard from './StepContextCard';
import { Colors } from '../../theme/colors';

interface PlaybookMetaSectionProps {
  playbookTitle?: string;
  /** Full label string e.g. "Action 2: Identify the Pattern". Pass undefined to hide. */
  actionLabel?: string;
  stepBody?: string;
  stepExample?: string | null;
}

const PlaybookMetaSection: React.FC<PlaybookMetaSectionProps> = ({
  playbookTitle,
  actionLabel,
  stepBody,
  stepExample,
}) => {
  // ─── Line animation (native driver) ─────────────────────────────────────────
  const lineScale   = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  // lineHeight measured from the bar itself once layout is known
  const [lineHeight, setLineHeight] = useState(0);

  // translateY trick: scaleY from center → shift up by half height so top stays fixed
  const lineTranslateY = useMemo(
    () => lineScale.interpolate({ inputRange: [0, 1], outputRange: [-(lineHeight / 2), 0] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineHeight],
  );

  const lineAnimated = useRef(false);
  const handleBarLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0 || lineAnimated.current) { return; }
    lineAnimated.current = true;
    setLineHeight(h); // triggers useMemo to rebuild the interpolation with correct height
    Animated.parallel([
      Animated.timing(lineOpacity, { toValue: 1, duration: 400, delay: 300, useNativeDriver: true }),
      Animated.spring(lineScale, { toValue: 1, tension: 40, friction: 10, delay: 300, useNativeDriver: true }),
    ]).start();
  };

  // ─── Text stagger animations (native driver) — fire on mount, unconditionally ─
  const fromOpacity   = useRef(new Animated.Value(0)).current;
  const fromY         = useRef(new Animated.Value(6)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const titleY        = useRef(new Animated.Value(6)).current;
  const actionOpacity = useRef(new Animated.Value(0)).current;
  const actionY       = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    const stagger = (op: Animated.Value, tr: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(tr, { toValue: 0, tension: 100, friction: 10, useNativeDriver: true }),
        ]).start();
      }, delay);
    };
    stagger(fromOpacity, fromY, 60);
    if (playbookTitle) { stagger(titleOpacity, titleY, 160); }
    if (actionLabel)   { stagger(actionOpacity, actionY, 250); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Bar: alignSelf:'stretch' → height matches content column height.
          scaleY + translateY gives the grow-from-top effect. */}
      <Animated.View
        style={[
          styles.verticalLine,
          {
            opacity: lineOpacity,
            transform: [{ translateY: lineTranslateY }, { scaleY: lineScale }],
          },
        ]}
        onLayout={handleBarLayout}
      />

      {/* Content column — the bar stretches to match this column's height */}
      <View style={styles.content}>
        <Animated.View style={{ opacity: fromOpacity, transform: [{ translateY: fromY }] }}>
          <ThemedText weight="medium" style={styles.fromText}>
            FROM PLAYBOOK
          </ThemedText>
        </Animated.View>

        {playbookTitle ? (
          <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
            <ThemedText style={styles.metadataText}>{playbookTitle}</ThemedText>
          </Animated.View>
        ) : null}

        {actionLabel ? (
          <Animated.View style={{ opacity: actionOpacity, transform: [{ translateY: actionY }] }}>
            <ThemedText style={styles.metadataText}>{actionLabel}</ThemedText>
          </Animated.View>
        ) : null}

        {stepBody ? (
          <StepContextCard body={stepBody} example={stepExample} />
        ) : null}
      </View>
    </View>
  );
};

const styles = {
  container: {
    marginTop: 32,
    marginBottom: 24,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  },
  verticalLine: {
    width: 2,
    alignSelf: 'stretch' as const,
    backgroundColor: 'rgba(255,255,255,0.3)' as const,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  fromText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.4,
    letterSpacing: 1.5,
    marginBottom: 6,
    fontWeight: '500' as const,
    lineHeight: 12,
    textTransform: 'uppercase' as const,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
  },
};

export default PlaybookMetaSection;
