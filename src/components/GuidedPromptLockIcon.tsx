// GuidedPromptLockIcon - Lock icon component for guided prompt feature gating
// Shows lock icon for restricted guided prompts with upgrade functionality

import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import type { SubscriptionTier } from '../types/subscription';
import { checkGuidedPromptAccess } from '../utils/guidedPromptGating';

interface GuidedPromptLockIconProps {
  /** Current user subscription tier */
  tier: SubscriptionTier;
  /** Number of guided prompts already used */
  usedPrompts?: number;
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
  /** Specific prompt to check access for */
  prompt?: string;
  /** Force show lock regardless of tier (for individual prompt restrictions) */
  forceShow?: boolean;
}

const GuidedPromptLockIcon: React.FC<GuidedPromptLockIconProps> = ({
  tier,
  usedPrompts = 0,
  context = 'inApp',
  onLockTap,
  size = 20,
  showLabel = false,
  style,
  position = 'right',
  prompt,
  forceShow = false,
}) => {
  // Check access using guided prompt gating rules
  const accessCheck = checkGuidedPromptAccess(tier, usedPrompts, context);

  // Only show locks when explicitly forced (for specific locked prompts)
  // Don't show locks based on tier alone
  const shouldShowLock = forceShow;

  console.log('[GuidedPromptLockIcon] Lock check:', {
    tier,
    usedPrompts,
    forceShow,
    shouldShowLock,
    prompt: prompt || 'no prompt specified',
  });

  // Don't render if not locked
  if (!shouldShowLock) {
    return null;
  }

  const handleLockPress = () => {
    console.log(`[GuidedPromptLockIcon] Lock tapped for guided prompts, tier: ${tier}, used: ${usedPrompts}`);
    if (onLockTap) {
      onLockTap();
    }
  };

  const containerStyle = [
    styles.container,
    position === 'center' && styles.centerPosition,
    position === 'left' && styles.leftPosition,
    style,
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
    // Clean styling without background/border
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    // Slight visual nudge to center icon
    marginTop: 2,
  },
  lockLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginLeft: 4,
  },
});

export default GuidedPromptLockIcon;
