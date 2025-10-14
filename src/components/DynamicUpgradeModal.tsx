// DynamicUpgradeModal - Context-aware upgrade modal for devotional feature gating
// Shows different messaging based on onboarding vs in-app context

import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { X, Lock, Sparkles } from 'lucide-react-native';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import type { SubscriptionTier } from '../types/subscription';
import { getUpgradeMessage, getNextTier } from '../utils/tierLockingRules';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DynamicUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  tier: SubscriptionTier;
  duration: number;
  context: 'onboarding' | 'inApp';
  usageInfo?: {
    used: number;
    limit: number | 'Unlimited';
    remaining: number | 'Unlimited';
  };
}

const DynamicUpgradeModal: React.FC<DynamicUpgradeModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  tier,
  duration,
  context,
  usageInfo,
}) => {
  const nextTier = getNextTier(tier);
  const upgradeMessage = getUpgradeMessage(tier, context);

  // Get context-specific content
  const getModalContent = () => {
    if (context === 'onboarding') {
      return {
        title: 'Unlock Your Spiritual Journey',
        subtitle: upgradeMessage,
        buttonText: 'Start Your Journey',
        description: `Begin with personalized ${duration}-day devotionals crafted for your faith walk.`,
      };
    } else {
      return {
        title: 'Unlock This Feature',
        subtitle: upgradeMessage,
        buttonText: 'Upgrade Now',
        description: `Access ${duration}-day devotionals and deepen your spiritual growth.`,
      };
    }
  };

  const content = getModalContent();

  const getTierDisplayName = (tierName: SubscriptionTier): string => {
    switch (tierName) {
      case 'spark': return 'siFia Spark';
      case 'growth': return 'siFia Growth';
      case 'transformation': return 'siFia Transformation';
      case 'family': return 'siFia Family';
      default: return tierName.charAt(0).toUpperCase() + tierName.slice(1);
    }
  };

  const getFeatureList = () => {
    if (tier === 'seeker') {
      return [
        'Personalized devotionals',
        'Smart journaling features',
        'Progress tracking',
        'Unlimited access to 1 & 3-day devotionals',
      ];
    } else if (tier === 'spark') {
      return [
        'Extended 5 & 7-day devotionals',
        'Advanced spiritual insights',
        'Priority support',
        '20 monthly devotionals',
      ];
    } else {
      return [
        'Unlimited devotionals',
        'Premium spiritual content',
        'Advanced analytics',
        'Priority support',
      ];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <X size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Lock Icon */}
            <View style={styles.iconContainer}>
              <Lock size={48} color={Colors.alertCoral} strokeWidth={1.5} />
            </View>

            {/* Title */}
            <ThemedText weight="bold" style={styles.title}>
              {content.title}
            </ThemedText>

            {/* Subtitle */}
            <ThemedText weight="regular" style={styles.subtitle}>
              {content.subtitle}
            </ThemedText>

            {/* Description */}
            <ThemedText weight="regular" style={styles.description}>
              {content.description}
            </ThemedText>

            {/* Usage Info */}
            {usageInfo && (
              <View style={styles.usageContainer}>
                <ThemedText weight="medium" style={styles.usageText}>
                  Current Usage: {usageInfo.used} / {usageInfo.limit === 'Unlimited' ? '∞' : usageInfo.limit}
                </ThemedText>
              </View>
            )}

            {/* Next Tier Info */}
            {nextTier && (
              <View style={styles.tierContainer}>
                <Sparkles size={20} color={Colors.growthGreen} />
                <ThemedText weight="semiBold" style={styles.tierText}>
                  Upgrade to {getTierDisplayName(nextTier)}
                </ThemedText>
              </View>
            )}

            {/* Features List */}
            <View style={styles.featuresContainer}>
              <ThemedText weight="semiBold" style={styles.featuresTitle}>
                What you'll unlock:
              </ThemedText>
              {getFeatureList().map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.featureBullet} />
                  <ThemedText weight="regular" style={styles.featureText}>
                    {feature}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={onUpgrade}
                activeOpacity={0.8}
              >
                <ThemedText weight="semiBold" style={styles.upgradeButtonText}>
                  {content.buttonText}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <ThemedText weight="medium" style={styles.cancelButtonText}>
                  Maybe Later
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  usageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  usageText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  tierContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  tierText: {
    fontSize: 14,
    color: Colors.growthGreen,
    marginLeft: 8,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.alertCoral,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  upgradeButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default DynamicUpgradeModal;
