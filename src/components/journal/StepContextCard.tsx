// Collapsible action context card — shown inside journal modals when opened from Faithful Actions.
// Displays the action step's body text and optional example with a delayed fade-in.
// Single collapse toggle; starts expanded.

import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { triggerLightHaptic } from '../../utils/haptics';

interface StepContextCardProps {
  body: string;
  example?: string | null;
  /** ms before the card fades in — lets the modal animation settle first */
  delay?: number;
}

const StepContextCard: React.FC<StepContextCardProps> = ({ body, example, delay = 700 }) => {
  const [expanded, setExpanded] = useState(true); // starts open
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!body) { return null; }

  return (
    <Animated.View style={{ opacity: fadeAnim, marginTop: 10 }}>
      {/* Single toggle row */}
      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(e => !e);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 0, right: 16 }}
        style={styles.toggleRow}
      >
        <ThemedText style={styles.toggleLabel}>Action</ThemedText>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={10}
          color="rgba(255,255,255,0.35)"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.bodyBlock}>
          <ThemedText style={styles.bodyText}>{body}</ThemedText>

          {/* Example — icon-only header, no separate collapse */}
          {example ? (
            <View style={styles.exampleBlock}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={12}
                color="rgba(255,255,255,0.35)"
                style={styles.exampleIcon}
              />
              <ThemedText style={styles.exampleText}>{example}</ThemedText>
            </View>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
};

const styles = {
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 0,
  },
  toggleLabel: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.45,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  bodyBlock: {
    marginTop: 6,
  },
  bodyText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.55,
    lineHeight: 18,
  },
  exampleBlock: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginTop: 8,
    gap: 6,
  },
  exampleIcon: {
    marginTop: 2,
  },
  exampleText: {
    flex: 1,
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.42,
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
};

export default StepContextCard;
