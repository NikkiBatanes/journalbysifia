/**
 * AnimatedPointsNotification.tsx
 * Animated notification that shows points awarded with smooth animations
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { triggerSuccessHaptic, triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic } from '../../utils/haptics';

const { height } = Dimensions.get('window'); // Removed unused width variable

interface AnimatedPointsNotificationProps {
  points: number;
  visible: boolean;
  onAnimationComplete?: () => void;
  position?: 'top' | 'center' | 'bottom';
  activityType?: string;
}

const AnimatedPointsNotification: React.FC<AnimatedPointsNotificationProps> = ({
  points,
  visible,
  onAnimationComplete,
  position = 'center',
  activityType = 'activity',
}) => {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;

  const hideNotification = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -50,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // Only call onAnimationComplete if the animation actually finished
      if (finished) {
        onAnimationComplete?.();
      }
    });
  }, [translateY, opacity, scale, onAnimationComplete]);

  useEffect(() => {
    console.log('[AnimatedPointsNotification] useEffect triggered, visible:', visible);
    if (!visible) {return;}

    // Reset animation values to ensure proper starting state
    translateY.setValue(50);
    opacity.setValue(0);
    scale.setValue(0.5);
    sparkleRotation.setValue(0);

    console.log('[AnimatedPointsNotification] Starting entrance animation');

    // Start entrance animation - FASTER for immediate feedback
    const entranceAnimation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300, // Reduced from 600ms to 300ms
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200, // Reduced from 400ms to 200ms
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 150, // Increased tension for snappier animation
        friction: 6, // Reduced friction for faster response
        useNativeDriver: true,
      }),
    ]);

    // Sparkle rotation animation
    const sparkleAnimation = Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Start animations
    entranceAnimation.start(() => {
      console.log('[AnimatedPointsNotification] Entrance animation completed');
    });
    sparkleAnimation.start();

    // Haptic feedback synchronized with animation
    // Distinct FAITH POINTS award feel:
    // - Small awards: medium + light (double-tap) shortly after entrance pop
    // - Big awards / completions: heavy + success combo
    let h1: ReturnType<typeof setTimeout> | null = null;
    let h2: ReturnType<typeof setTimeout> | null = null;
    try {
      const at = (activityType || '').toLowerCase();
      const isCompletion = at.includes('action_step_completed') || at.includes('playbook_completed');
      const isBigAward = isCompletion || points >= 20;

      // For prayer_for_now, use a single light tap - IMMEDIATE
      if (at === 'prayer_for_now') {
        h1 = setTimeout(() => { try { triggerLightHaptic(); } catch {} }, 50); // Reduced from 160ms
      } else if (isBigAward) {
        // Heavy hit, then success pulse - FASTER
        h1 = setTimeout(() => { try { triggerHeavyHaptic(); } catch {} }, 50); // Reduced from 140ms
        h2 = setTimeout(() => { try { triggerSuccessHaptic(); } catch {} }, 150); // Reduced from 260ms
      } else {
        // Medium + light double-tap - SNAPPIER
        h1 = setTimeout(() => { try { triggerMediumHaptic(); } catch {} }, 50); // Reduced from 140ms
        h2 = setTimeout(() => { try { triggerLightHaptic(); } catch {} }, 120); // Reduced from 220ms
      }
    } catch {}

    // Auto-hide after 2.5 seconds
    const hideTimer = setTimeout(() => {
      hideNotification();
    }, 2500);

    // Cleanup function
    return () => {
      clearTimeout(hideTimer);
      if (h1) { clearTimeout(h1); }
      if (h2) { clearTimeout(h2); }
      sparkleAnimation.stop();
      entranceAnimation.stop();

      // Reset animations if component unmounts
      if (!visible) {
        translateY.setValue(50);
        opacity.setValue(0);
        scale.setValue(0.5);
      }
    };
  }, [visible, hideNotification, translateY, opacity, scale, sparkleRotation]);

  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return { top: height * 0.15 };
      case 'bottom':
        return { bottom: height * 0.15 };
      default:
        return { top: height * 0.4 };
    }
  };

  const getActivityIcon = () => {
    const at = (activityType || '').toLowerCase();
    // Specific override for playbook_generated: use MCI clipboard-text-play
    if (at === 'playbook_generated') { return { lib: 'MCI' as const, name: 'clipboard-text-play' as const }; }
    // General mappings (Ionicons)
    if (at.includes('devotional')) { return { lib: 'Ion' as const, name: 'book' as const }; }
    // Use praying hands icon for prayer-related activities
    if (at.includes('prayer')) { return { lib: 'MCI' as const, name: 'hands-pray' as const }; }
    if (at.includes('journal')) { return { lib: 'Ion' as const, name: 'create' as const }; }
    if (at.includes('playbook')) { return { lib: 'Ion' as const, name: 'book' as const }; }
    if (at.includes('streak')) { return { lib: 'Ion' as const, name: 'flame' as const }; }
    return { lib: 'Ion' as const, name: 'star' as const };
  };

  const getActivityColor = () => {
    // Unify all Faith Points backgrounds to faithGold
    return Colors.faithGold;
  };

  if (!visible) {
    console.log('[AnimatedPointsNotification] Not visible, returning null');
    return null;
  }

  console.log('[AnimatedPointsNotification] Rendering notification:', { points, activityType, visible });

  const sparkleRotationInterpolate = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, getPositionStyle()]}>
      <Animated.View
        style={[
          styles.notification,
          {
            transform: [
              { translateY },
              { scale },
            ],
            opacity,
            backgroundColor: getActivityColor(),
            borderWidth: 3,
            borderColor: 'white',
          },
        ]}
      >
        {/* Background sparkles */}
        <Animated.View
          style={[
            styles.sparkleBackground,
            {
              transform: [{ rotate: sparkleRotationInterpolate }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={40} color="rgba(255,255,255,0.3)" />
        </Animated.View>

        {/* Main content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {(() => {
              const spec = getActivityIcon();
              if (spec.lib === 'MCI') {
                return (
                  <MaterialCommunityIcons
                    name={spec.name}
                    size={24}
                    color={Colors.hopeWhite}
                  />
                );
              }
              return (
                <Ionicons
                  name={spec.name}
                  size={24}
                  color={Colors.hopeWhite}
                />
              );
            })()}
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.pointsText}>+{points} FP</Text>
            <Text style={styles.activityText}>
              {(() => {
                const at = (activityType || '').toLowerCase();
                if (at === 'playbook_completed') {
                  return 'MISSION ACCOMPLISHED';
                }
                if (at === 'affirmation_read_aloud') {
                  return 'AFFIRMATIONS';
                }
                if (at === 'prayer_for_now') {
                  return 'PRAYER';
                }
                if (at === 'devotional_completed') {
                  return 'Devotional Completed';
                }
                return activityType.replace(/_/g, ' ').toUpperCase();
              })()}
            </Text>
          </View>

          <View style={styles.sparkleContainer}>
            <Animated.View
              style={{
                transform: [{ rotate: sparkleRotationInterpolate }],
              }}
            >
              <Ionicons name="sparkles" size={20} color={Colors.hopeWhite} />
            </Animated.View>
          </View>
        </View>

        {/* Floating particles */}
        <View style={styles.particlesContainer}>
          {[...Array(3)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  left: 20 + index * 30,
                },
              ]}
            >
              <Ionicons name="star" size={8} color={Colors.hopeWhite} />
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999999,
    elevation: 999999999,
    pointerEvents: 'none',
  },
  notification: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 200,
  },
  sparkleBackground: {
    position: 'absolute',
    top: -10,
    right: -10,
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  activityText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.hopeWhite,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  sparkleContainer: {
    marginLeft: 10,
  },
  particlesContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 40,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});

export default AnimatedPointsNotification;
