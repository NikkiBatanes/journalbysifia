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
import { triggerSuccessHaptic } from '../../utils/haptics';
import { Badge } from '../../services/faithPointsService';
import ThemedText from '../common/ThemedText';

const { height } = Dimensions.get('window');

// Global guard to prevent multiple animations of the same type
const activeAnimations = new Set<string>();

interface AnimatedBadgeNotificationProps {
  badge: Badge;
  onAnimationComplete?: () => void;
}

const AnimatedBadgeNotification: React.FC<AnimatedBadgeNotificationProps> = ({ badge, onAnimationComplete }) => {

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


  const sparkleSpin = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
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
      <View style={styles.notificationBox}>
        <View style={styles.badgeSection}>
          <View style={[styles.badgeIconContainer, { backgroundColor: badge.rarity === 'common' ? Colors.growthGreen : getRarityColor() }]}>
            <Text style={styles.badgeIcon}>{badge.rarity === 'common' ? '🙏🏼' : badge.icon}</Text>
          </View>

          {/* Sparkle effects for all badges */}
          {badge.rarity === 'legendary' && (
            <>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleTopRight,
                  {
                     transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="sparkles" size={16} color="#fbbf24" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleBottomLeft,
                  {
                    transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="sparkles" size={14} color="#fbbf24" />
              </Animated.View>
            </>
          )}
          {badge.rarity === 'epic' && (
            <>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleTopRight,
                  {
                     transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="star" size={16} color="#8b5cf6" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleBottomLeft,
                  {
                    transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="star" size={14} color="#8b5cf6" />
              </Animated.View>
            </>
          )}
          {badge.rarity === 'rare' && (
            <>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleTopRight,
                  {
                     transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="diamond" size={16} color="#3b82f6" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleBottomLeft,
                  {
                    transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="diamond" size={14} color="#3b82f6" />
              </Animated.View>
            </>
          )}
          {badge.rarity === 'common' && (
            <>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleTopRight,
                  {
                     transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.sparkle,
                  styles.sparkleBottomLeft,
                  {
                    transform: [{ rotate: sparkleSpin }],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
              </Animated.View>
            </>
          )}
        </View>

        <View style={styles.textSection}>
          <ThemedText weight="semiBold" style={[styles.unlockText, { color: Colors.hopeWhite }]}>
            Badge Unlocked!
          </ThemedText>
          <ThemedText weight="bold" style={[styles.badgeName, { color: Colors.hopeWhite }]}>{badge.name}</ThemedText>
          <ThemedText style={[styles.badgeDescription, { color: Colors.hopeWhite }]}>{badge.description}</ThemedText>

          {badge.rarity === 'legendary' && (
            <View style={styles.legendaryBadge}>
              <Ionicons name="trophy" size={12} color="#f59e0b" />
              <Text style={styles.legendaryText}>LEGENDARY</Text>
            </View>
          )}
          {badge.rarity === 'epic' && (
            <View style={styles.epicBadge}>
              <Ionicons name="star" size={12} color="#8b5cf6" />
              <Text style={styles.epicText}>EPIC</Text>
            </View>
          )}
          {badge.rarity === 'rare' && (
            <View style={styles.rareBadge}>
              <Ionicons name="diamond" size={12} color="#3b82f6" />
              <Text style={styles.rareText}>RARE</Text>
            </View>
          )}
          {badge.rarity === 'common' && (
            <View style={styles.commonBadge}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.growthGreen} />
              <Text style={styles.commonText}>COMMON</Text>
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
    backgroundColor: '#1a3c6d',
    borderRadius: 24,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
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
  sparkleTopRight: {
    top: -5,
    right: -5,
  },
  sparkleBottomLeft: {
    bottom: -5,
    left: -5,
  },
  textSection: {
    flex: 1,
  },
  unlockText: {
    fontSize: 12,
    marginBottom: 4,
    // Typography handled by ThemedText weight=semiBold
  },
  badgeName: {
    fontSize: 18,
    marginBottom: 4,
    // Typography handled by ThemedText weight=bold
  },
  badgeDescription: {
    fontSize: 14,
    lineHeight: 20,
    // Typography handled by ThemedText
  },
  legendaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  epicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  rareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  commonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  legendaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    marginLeft: 4,
  },
  epicText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8b5cf6',
    marginLeft: 4,
  },
  rareText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
    marginLeft: 4,
  },
  commonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.growthGreen,
    marginLeft: 4,
  },
});

export default AnimatedBadgeNotification;
