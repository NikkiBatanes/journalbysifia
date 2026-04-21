// src/components/PlaybookReadyOverlay.tsx
//
// Self-contained "Your playbook is ready" intro overlay.
// Shown exactly once during onboarding (AsyncStorage gate is handled by the
// parent — this component just renders when `visible` is true).
//
import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import { BorderRadii } from '../theme/styles';
import ThemedText from './common/ThemedText';
import { triggerLightHaptic } from '../utils/haptics';

interface PlaybookReadyOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

const PlaybookReadyOverlay: React.FC<PlaybookReadyOverlayProps> = ({ visible, onDismiss }) => {
  // ─── Fade ────────────────────────────────────────────────────────────────
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const buttonPressedRef = useRef(false);

  // Fade in when visible becomes true
  useEffect(() => {
    if (visible) {
      buttonPressedRef.current = false;
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, modalOpacity]);

  // ─── Star burst ──────────────────────────────────────────────────────────
  const starPositions = useMemo(
    () =>
      [
        { top: 20, left: '20%' },
        { top: 10, right: '18%' },
        { top: 60, left: '8%' },
        { top: 55, right: '6%' },
        { top: 30, left: '60%' },
        { top: 75, left: '40%' },
        { top: -5, right: '40%' },
      ] as Array<{
        top: number;
        left?: number | `${number}%` | 'auto';
        right?: number | `${number}%` | 'auto';
      }>,
    []
  );

  const starAnims = useRef(
    starPositions.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const sparkleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      sparkleTimersRef.current.forEach(t => clearTimeout(t));
      sparkleTimersRef.current = [];
    };

    if (visible) {
      try { triggerLightHaptic(); } catch {}

      starAnims.forEach((anim, i) => {
        anim.scale.setValue(0);
        anim.opacity.setValue(0);
        const delay = i * 90;

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.spring(anim.scale, {
              toValue: 1.4,
              useNativeDriver: true,
              speed: 18,
              bounciness: 8,
            }),
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 500,
            delay: 150,
            useNativeDriver: true,
          }),
        ]).start();

        const t = setTimeout(() => {
          try { triggerLightHaptic(); } catch {}
        }, delay);
        sparkleTimersRef.current.push(t);
      });
    } else {
      clearTimers();
    }

    return () => clearTimers();
  }, [visible, starAnims]);

  // ─── Dismiss handler ─────────────────────────────────────────────────────
  const handlePress = () => {
    if (buttonPressedRef.current) { return; }
    buttonPressedRef.current = true;
    try { triggerLightHaptic(); } catch {}

    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: modalOpacity }]}>
        <View style={styles.card}>
          {/* Bursting Stars */}
          <View style={styles.starsLayer} pointerEvents="none">
            {starPositions.map((pos, idx) => (
              <Animated.View
                key={idx}
                style={[
                  styles.starItem,
                  pos,
                  {
                    transform: [{ scale: starAnims[idx].scale }],
                    opacity: starAnims[idx].opacity,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={14}
                  color={Colors.hopeWhite}
                />
              </Animated.View>
            ))}
          </View>

          <ThemedText weight="bold" style={styles.title}>
            Your playbook is ready
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            {'This is a space to slow down and reflect with God. Not everything will feel easy.\nThat\u2019s okay.'}
          </ThemedText>

          <View style={styles.warningContainer}>
            <Ionicons name="heart" size={16} color={Colors.alertCoral} />
            <ThemedText style={styles.warningText}>
              {'The next time something unsettles you, return here before you respond.'}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.9}
            onPress={handlePress}
          >
            <ThemedText weight="bold" style={styles.buttonText}>
              Start My Playbook
            </ThemedText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.anchorBlue,
    borderRadius: BorderRadii.cardXL,
    padding: 24,
    position: 'relative',
  },
  starsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starItem: {
    position: 'absolute',
  },
  title: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 14,
    lineHeight: 22,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: `${Colors.alertCoral}20`,
    borderWidth: 0.4,
    borderColor: Colors.alertCoral,
    padding: 12,
    borderRadius: 20,
    marginBottom: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.hopeWhite,
    lineHeight: 19,
    opacity: 0.9,
  },
  button: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
});

export default PlaybookReadyOverlay;
