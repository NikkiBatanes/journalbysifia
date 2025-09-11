// DevotionalLockIcon - Enterprise-grade lock icon component for devotional feature gating
// Displays lock icon with tier-based visibility and upgrade functionality

import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import type { SubscriptionTier } from '../types/subscription';
import { checkDevotionalAccess } from '../utils/tierLockingRules';

interface DevotionalLockIconProps {
  /** Current user subscription tier */
  tier: SubscriptionTier;
  /** Devotional duration (1, 3, 5, 7 days) */
  duration: number;
  /** Context for dynamic messaging */
  context?: 'onboarding' | 'inApp';
  /** Callback when lock icon is tapped */
  onLockTap?: () => void;
  /** Size of the lock icon */
  size?: number;
  /** Show text label with lock */
  showLabel?: boolean;
  /** Custom style for container */
  style?: any;
  /** Position of lock icon */
  position?: 'right' | 'left' | 'center';
}

const DevotionalLockIcon: React.FC<DevotionalLockIconProps> = ({
  tier,
  duration,
  context = 'inApp',
  onLockTap,
  size = 20,
  showLabel = false,
  style,
  position = 'right'
}) => {
  // Check access using tier locking rules
  const accessCheck = checkDevotionalAccess(tier, duration, context);
  
  // Don't render if not locked
  if (!accessCheck.lockIconVisible) {
    return null;
  }

  const handleLockPress = () => {
    console.log(`[DevotionalLockIcon] Lock tapped for ${duration}-day devotional, tier: ${tier}`);
    if (onLockTap) {
      onLockTap();
    }
  };

  const containerStyle = [
    styles.container,
    position === 'center' && styles.centerPosition,
    position === 'left' && styles.leftPosition,
    style
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handleLockPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
    >
      <View style={styles.lockContainer}>
        <MaterialCommunityIcons
          name="lock"
          size={size}
          color={Colors.alertCoral}
        />
        {showLabel && (
          <ThemedText weight="medium" style={styles.lockLabel}>
            Locked
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPosition: {
    alignSelf: 'center',
  },
  leftPosition: {
    alignSelf: 'flex-start',
  },
  lockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Remove background/border per UI request
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  lockLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginLeft: 4,
  },
});

export default DevotionalLockIcon;
