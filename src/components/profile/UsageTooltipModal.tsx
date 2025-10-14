import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';

export type TooltipType = 'playbooks' | 'devotionals' | 'faithPoints' | 'badges';

interface TooltipContent {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
}

interface Props {
  visible: boolean;
  type: TooltipType | null;
  onClose: () => void;
  subscription: any; // Subscription data
  usage: {
    playbooks: { used: number; limit: number };
    devotionals: { used: number; limit: number };
  } | null;
  stats: {
    faithPoints: number;
    level: number;
    badgesCount?: number;
  } | null;
}

const UsageTooltipModal: React.FC<Props> = ({
  visible,
  type,
  onClose,
  subscription,
  usage,
  stats,
}) => {
  if (!type || !visible) return null;

  const getTooltipContent = (): TooltipContent => {
    const tier = subscription?.tier || 'seeker';
    const trialChosenTier = subscription?.trial_chosen_tier;
    const displayName = subscription?.subscription_display_name || 'siFia Seeker';
    const isOnTrial = tier === 'free_trial';
    const trialEndDate = subscription?.trial_end_date;
    
    // Calculate days remaining for trial
    let daysRemaining = 0;
    if (isOnTrial && trialEndDate) {
      const endDate = new Date(trialEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const effectiveTier = isOnTrial && trialChosenTier ? trialChosenTier : tier;

    switch (type) {
      case 'playbooks':
        const playbooksUsed = usage?.playbooks.used || 0;
        const playbooksLimit = usage?.playbooks.limit || 0;
        const playbooksRemaining = Math.max(0, playbooksLimit - playbooksUsed);
        
        let playbooksDesc = '';
        if (isOnTrial) {
          // Get the full tier limits for after trial
          const fullLimits = getFullTierLimits(trialChosenTier || 'spark');
          if (playbooksRemaining === 0) {
            // All trial playbooks used
            const tierName = trialChosenTier ? trialChosenTier.charAt(0).toUpperCase() + trialChosenTier.slice(1) : 'Growth';
            playbooksDesc = `You are on ${displayName}. You have used all ${playbooksLimit} trial ${playbooksLimit === 1 ? 'playbook' : 'playbooks'}.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.playbooks === -1 ? 'unlimited playbooks' : `${fullLimits.playbooks} playbooks`} every month.`;
          } else {
            playbooksDesc = `You are on ${displayName}. You have ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available during your trial and have used ${playbooksUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.playbooks === -1 ? 'unlimited playbooks' : `${fullLimits.playbooks} playbooks`} every month.`;
          }
        } else if (playbooksLimit === -1) {
          playbooksDesc = `You are on ${displayName}. You have unlimited playbooks! Generate as many as you need to support your spiritual journey.`;
        } else {
          playbooksDesc = `You are on ${displayName}. You have ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available each month and have used ${playbooksUsed}.\n\n${playbooksRemaining} ${playbooksRemaining === 1 ? 'playbook' : 'playbooks'} remaining this month.`;
        }
        
        return {
          title: 'Playbooks',
          description: playbooksDesc,
          icon: 'clipboard-text-play',
          iconColor: Colors.alertCoral,
        };

      case 'devotionals':
        const devotionalsUsed = usage?.devotionals.used || 0;
        const devotionalsLimit = usage?.devotionals.limit || 0;
        const devotionalsRemaining = Math.max(0, devotionalsLimit - devotionalsUsed);
        
        let devotionalsDesc = '';
        if (isOnTrial) {
          const fullLimits = getFullTierLimits(trialChosenTier || 'spark');
          if (devotionalsRemaining === 0) {
            // All trial devotionals used
            const tierName = trialChosenTier ? trialChosenTier.charAt(0).toUpperCase() + trialChosenTier.slice(1) : 'Growth';
            devotionalsDesc = `You are on ${displayName}. You have used all ${devotionalsLimit} trial ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'}.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.devotionals === -1 ? 'unlimited devotionals' : `${fullLimits.devotionals} devotionals`} every month.`;
          } else {
            devotionalsDesc = `You are on ${displayName}. You have ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available during your trial and have used ${devotionalsUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.devotionals === -1 ? 'unlimited devotionals' : `${fullLimits.devotionals} devotionals`} every month.`;
          }
        } else if (devotionalsLimit === -1) {
          devotionalsDesc = `You are on ${displayName}. You have unlimited devotionals! Generate as many as you need for your daily spiritual growth.`;
        } else {
          devotionalsDesc = `You are on ${displayName}. You have ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available each month and have used ${devotionalsUsed}.\n\n${devotionalsRemaining} ${devotionalsRemaining === 1 ? 'devotional' : 'devotionals'} remaining this month.`;
        }
        
        return {
          title: 'Devotionals',
          description: devotionalsDesc,
          icon: 'book',
          iconColor: Colors.growthGreen,
        };

      case 'faithPoints':
        const points = stats?.faithPoints || 0;
        const level = stats?.level || 1;
        const levelTitles: Record<number, string> = {
          1: 'Seeker', 2: 'Believer', 3: 'Disciple', 4: 'Servant', 5: 'Leader',
          6: 'Teacher', 7: 'Mentor', 8: 'Elder', 9: 'Steward', 10: 'Ambassador',
        };
        const currentLevelTitle = levelTitles[level] || 'Seeker';
        const nextLevelTitle = levelTitles[level + 1] || 'Ambassador';
        
        // Calculate points needed for next level
        const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
        const currentThreshold = levelThresholds[level - 1] || 0;
        const nextThreshold = levelThresholds[level] || 10000;
        const pointsNeeded = Math.max(0, nextThreshold - points);
        
        const faithDesc = `You currently have ${points} Faith Points and are at Level ${level}: ${currentLevelTitle}.\n\nFaith Points are earned by:\n• Completing playbook action steps\n• Finishing devotionals\n• Daily journaling\n• Prayer activities\n• Maintaining streaks\n\n${level < 10 ? `You need ${pointsNeeded} more points to reach Level ${level + 1}: ${nextLevelTitle}.` : 'You have reached the maximum level! Keep growing in faith.'}`;
        
        return {
          title: 'Faith Points',
          description: faithDesc,
          icon: 'star-four-points',
          iconColor: Colors.faithGold,
        };

      case 'badges':
        const badgesCount = stats?.badgesCount || 0;
        const badgesDesc = `You have earned ${badgesCount} badge${badgesCount !== 1 ? 's' : ''}!\n\nBadges are awarded for:\n• Completing playbooks\n• Maintaining prayer streaks\n• Finishing devotional series\n• Reaching faith point milestones\n• Consistent journaling\n• Special achievements\n\nKeep growing in your spiritual journey to earn more badges!`;
        
        return {
          title: 'Badges',
          description: badgesDesc,
          icon: 'trophy',
          iconColor: Colors.alertCoral,
        };

      default:
        return {
          title: 'Info',
          description: 'No information available.',
          icon: 'information',
          iconColor: Colors.anchorBlue,
        };
    }
  };

  // Helper function to get full tier limits
  const getFullTierLimits = (tier: string): { playbooks: number; devotionals: number } => {
    switch (tier) {
      case 'spark':
        return { playbooks: 8, devotionals: 8 };
      case 'growth':
        return { playbooks: 20, devotionals: 20 };
      case 'transformation':
      case 'family':
        return { playbooks: -1, devotionals: -1 };
      default:
        return { playbooks: 0, devotionals: 0 };
    }
  };

  const content = getTooltipContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.tooltipContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <MaterialCommunityIcons
                    name={content.icon}
                    size={24}
                    color={content.iconColor}
                  />
                  <ThemedText weight="bold" style={styles.title}>
                    {content.title}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={24} color={Colors.hopeWhite} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <ThemedText weight="regular" style={styles.description}>
                  {content.description}
                </ThemedText>
              </View>

              {/* Footer */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <ThemedText weight="semiBold" style={styles.closeButtonText}>
                  Got it!
                </ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    color: Colors.hopeWhite,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  closeButton: {
    backgroundColor: Colors.alertCoral,
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default UsageTooltipModal;
