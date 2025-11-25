/**
 * AnimatedBadgeNotification.tsx
 * Animated notification that shows badge unlocked with smooth animations
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
import { Colors } from '../../theme/colors';
import { triggerSuccessHaptic, triggerLightHaptic } from '../../utils/haptics';
import { Badge } from '../../services/faithPointsService';

const { height } = Dimensions.get('window');

// Global guard to prevent multiple animations of the same type
const activeAnimations = new Set<string>();

interface AnimatedBadgeNotificationProps {
  badge: Badge;
  onAnimationComplete?: () => void;
}

const AnimatedBadgeNotification: React.FC<AnimatedBadgeNotificationProps> = ({
  badge,
  onAnimationComplete,
}) => {
  const componentId = useRef(Math.random().toString(36).substr(2, 9)).current;

  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;

  const hideNotification = useCallback(() => {
    const animationKey = `badge-${badge.id}`;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      activeAnimations.delete(animationKey);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });
  }, [badge.id, translateY, opacity, scale, onAnimationComplete]);

  const showNotification = useCallback(() => {
    const animationKey = `badge-${badge.id}`;

    // Prevent duplicate animations
    if (activeAnimations.has(animationKey)) {
      return;
    }
    activeAnimations.add(animationKey);

    // Trigger haptic feedback
    triggerSuccessHaptic();

    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous sparkle rotation
    Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Auto-hide after 3.5 seconds
    setTimeout(() => {
      if (activeAnimations.has(animationKey)) {
        hideNotification();
      }
    }, 3500);
  }, [badge.id, translateY, opacity, scale, sparkleRotation, hideNotification]);

  useEffect(() => {
    showNotification();
    return () => {
      activeAnimations.delete(`badge-${badge.id}`);
    };
  }, [showNotification, badge.id]);

  const getRarityColor = () => {
    switch (badge.rarity) {
      case 'common':
        return Colors.textGray;
      case 'rare':
        return Colors.playbookBlue;
      case 'epic':
        return Colors.devotionalPurple;
      case 'legendary':
        return Colors.faithGold;
      default:
        return Colors.anchorBlue;
    }
  };

  const getRarityGradient = () => {
    switch (badge.rarity) {
      case 'common':
        return ['#94a3b8', '#64748b'];
      case 'rare':
        return ['#3b82f6', '#1d4ed8'];
      case 'epic':
        return ['#8b5cf6', '#6d28d9'];
      case 'legendary':
        return ['#f59e0b', '#d97706'];
      default:
        return ['#6366f1', '#4f46e5'];
    }
  };

  const sparkleSpin = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.notificationContainer,
        {
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={[styles.notificationBox, { borderColor: getRarityColor() }]}>
        <View style={styles.badgeSection}>
          <View style={[styles.badgeIconContainer, { backgroundColor: getRarityColor() }]}>
            <Text style={styles.badgeIcon}>{badge.icon}</Text>
          </View>
          
          {/* Sparkle effects for legendary badges */}
          {badge.rarity === 'legendary' && (
            <>
              <Animated.View
                style={[
                  styles.sparkle,
                  {
                    transform: [{ rotate: sparkleSpin }],
                    top: -5,
                    right: -5,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={16} color="#fbbf24" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.sparkle,
                  {
                    transform: [{ rotate: sparkleSpin }],
                    bottom: -5,
                    left: -5,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={14} color="#fbbf24" />
              </Animated.View>
            </>
          )}
        </View>

        <View style={styles.textSection}>
          <Text style={[styles.title, { color: getRarityColor() }]}>
            Badge Unlocked!
          </Text>
          <Text style={styles.badgeName}>{badge.name}</Text>
          <Text style={styles.badgeDescription}>{badge.description}</Text>
          
          {badge.rarity === 'legendary' && (
            <View style={styles.legendaryBadge}>
              <Ionicons name="trophy" size={12} color="#f59e0b" />
              <Text style={styles.legendaryText}>LEGENDARY</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: height * 0.15,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999999999,
    elevation: 999999999,
  },
  notificationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSection: {
    position: 'relative',
    marginRight: 16,
  },
  badgeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  badgeIcon: {
    fontSize: 28,
  },
  sparkle: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSection: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  legendaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  legendaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    marginLeft: 4,
  },
});

export default AnimatedBadgeNotification;
