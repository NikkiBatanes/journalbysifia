import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';
import ThemedText from './common/ThemedText';
import { SubscriptionTier } from '../types/subscription';
import { checkPlanningAccess } from '../utils/tierLockingRules';

interface PlanningLockIconProps {
  /** Current user subscription tier */
  tier: SubscriptionTier;
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

/**
 * PlanningLockIcon - Enterprise-grade lock icon for future planning features
 * 
 * Shows lock icon for Seeker tier users when accessing future planning features.
 * Uses same styling and behavior as DevotionalLockIcon for consistency.
 * 
 * @param tier - User's current subscription tier
 * @param context - Context for upgrade messaging
 * @param onLockTap - Callback when lock is tapped
 * @param size - Icon size (default: 20)
 * @param showLabel - Show "Locked" text label
 * @param style - Additional styling
 * @param position - Icon position alignment
 */
export const PlanningLockIcon: React.FC<PlanningLockIconProps> = ({
  tier,
  context = 'inApp',
  onLockTap,
  size = 20,
  showLabel = false,
  style,
  position = 'right'
}) => {
  // Check access using tier locking rules
  const accessCheck = checkPlanningAccess(tier, context);
  
  // Don't render if not locked
  if (!accessCheck.lockIconVisible) {
    return null;
  }

  const handleLockPress = () => {
    console.log(`[PlanningLockIcon] Lock tapped for future planning, tier: ${tier}`);
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
    // Slight visual nudge to center icon within tall rows
    marginTop: 2,
  },
  lockLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginLeft: 4,
  },
});

export default PlanningLockIcon;
