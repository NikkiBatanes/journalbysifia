/**
 * AnimatedPointsNotification.tsx
 * Animated notification that shows points awarded with smooth animations
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

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
    if (!visible) return;

    // Start entrance animation
    const entranceAnimation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
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
    entranceAnimation.start();
    sparkleAnimation.start();

    // Auto-hide after 2.5 seconds
    const hideTimer = setTimeout(() => {
      hideNotification();
    }, 2500);

    // Cleanup function
    return () => {
      clearTimeout(hideTimer);
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
    if (activityType.includes('devotional')) return 'book';
    if (activityType.includes('prayer')) return 'heart';
    if (activityType.includes('journal')) return 'create';
    if (activityType.includes('playbook')) return 'library';
    if (activityType.includes('streak')) return 'flame';
    return 'star';
  };

  const getActivityColor = () => {
    if (activityType.includes('devotional')) return Colors.spiritualPink;
    if (activityType.includes('prayer')) return Colors.anchorBlue;
    if (activityType.includes('journal')) return Colors.growthGreen;
    if (activityType.includes('playbook')) return Colors.modalBlue;
    if (activityType.includes('streak')) return Colors.faithGold;
    return Colors.spiritualPink;
  };

  if (!visible) return null;

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
            <Ionicons 
              name={getActivityIcon()} 
              size={24} 
              color={Colors.hopeWhite} 
            />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.pointsText}>
              +{points} Faith Points
            </Text>
            <Text style={styles.activityText}>
              {activityType.replace('_', ' ').toUpperCase()}
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
    fontSize: 10,
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
