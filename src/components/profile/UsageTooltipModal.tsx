import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';

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

// Apple monthly renewal helper: renews on the same calendar day each month.
// If that day does not exist in the target month (e.g., 31), it renews on the last day of that month.
function getNextAppleMonthlyResetDate(subscriptionStartISO?: string | null): Date {
  const now = new Date();
  // Set to start of today for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!subscriptionStartISO) {
    // Fallback: first day of the next month
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const start = new Date(subscriptionStartISO);
  const targetDay = start.getDate();

  // Calculate the reset date for this month (at midnight)
  const lastDayOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const resetDayThisMonth = Math.min(targetDay, lastDayOfThisMonth);
  const resetDateThisMonth = new Date(now.getFullYear(), now.getMonth(), resetDayThisMonth);

  // If the reset date for this month is today or in the future, use it
  if (resetDateThisMonth >= today) {
    return resetDateThisMonth;
  }

  // Calculate next month's reset date
  const nextMonth = now.getMonth() + 1;
  const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
  const normalizedMonth = (nextMonth + 12) % 12;
  const lastDayOfNextMonth = new Date(nextYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(targetDay, lastDayOfNextMonth);

  return new Date(nextYear, normalizedMonth, day);
}

const UsageTooltipModal: React.FC<Props> = ({
  visible,
  type,
  onClose,
  subscription,
  usage,
  stats,
}) => {
  const navigation = useNavigation();
  if (!type || !visible) {return null;}

  const getTooltipContent = (): TooltipContent => {
    const tier = subscription?.tier || 'seeker';
    const trialChosenTier = subscription?.trial_chosen_tier;
    const rawDisplayName = subscription?.subscription_display_name || 'siFia Seeker';
    // Add "Plan" for paid users (not trials)
    const isOnTrial = tier === 'free_trial';
    // Strip " Trial" suffix before adding " Plan" (defensive coding for edge cases)
    const cleanName = rawDisplayName.replace(/ Trial$/, '');
    const displayName = isOnTrial ? rawDisplayName : `${cleanName} Plan`;
    const trialEndDate = subscription?.trial_end_date;

    // Calculate days remaining for trial
    let daysRemaining = 0;
    if (isOnTrial && trialEndDate) {
      const endDate = new Date(trialEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // effectiveTier removed - was calculated but never used

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
            playbooksDesc = `You are on ${displayName}. You have used all ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.playbooks === -1 ? 'unlimited playbooks' : `${fullLimits.playbooks} playbooks`} every month.`;
          } else {
            playbooksDesc = `You are on ${displayName}. You have ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available during your trial and have used ${playbooksUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.playbooks === -1 ? 'unlimited playbooks' : `${fullLimits.playbooks} playbooks`} every month.`;
          }
        } else if (playbooksLimit === -1) {
          playbooksDesc = `You are on ${displayName}. You have unlimited playbooks! Generate as many as you need to support your spiritual journey.`;
        } else if (playbooksLimit === 0) {
          // Seeker tier - no playbooks
          playbooksDesc = 'You are on the free Seeker plan. This plan does not include playbook generation.\n\nHowever, you can still:\n• Use journaling tools\n• Track your spiritual progress\n• Interact with any shared playbooks\n• Explore all app features\n\nUpgrade to unlock personalized playbook generation!';
        } else {
          if (playbooksRemaining === 0) {
            // All playbooks used for paid plans
            playbooksDesc = `You are on ${displayName}. You have used all ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available this month.\n\nYour playbooks will reset at the start of next month.`;
          } else {
            playbooksDesc = `You are on ${displayName}. You have ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available each month and have used ${playbooksUsed}.\n\n${playbooksRemaining} ${playbooksRemaining === 1 ? 'playbook' : 'playbooks'} remaining this month.`;
          }
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
            devotionalsDesc = `You are on ${displayName}. You have used all ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.devotionals === -1 ? 'unlimited devotionals' : `${fullLimits.devotionals} devotionals`} every month.`;
          } else {
            devotionalsDesc = `You are on ${displayName}. You have ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available during your trial and have used ${devotionalsUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.devotionals === -1 ? 'unlimited devotionals' : `${fullLimits.devotionals} devotionals`} every month.`;
          }
        } else if (devotionalsLimit === -1) {
          devotionalsDesc = `You are on ${displayName}. You have unlimited devotionals! Generate as many as you need for your daily spiritual growth.`;
        } else if (devotionalsLimit === 0) {
          // Seeker tier - no devotionals
          devotionalsDesc = 'You are on the free Seeker plan. This plan does not include devotional generation.\n\nHowever, you can still:\n• Use journaling tools\n• Track your spiritual progress\n• Interact with any shared devotionals\n• Explore all app features\n\nUpgrade to unlock personalized devotional generation!';
        } else {
          // Paid plan with monthly limit: use Apple-style monthly reset date from subscription_start_date
          const resetDate = getNextAppleMonthlyResetDate(subscription?.subscription_start_date);
          const now = new Date();
          const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const dayText = daysUntilReset === 1 ? 'day' : 'days';
          const resetDateStr = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          if (devotionalsRemaining === 0) {
            // All devotionals used for paid plans
            devotionalsDesc = `You are on ${displayName}. You have used all ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available this month.\n\nYour devotionals will reset in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          } else {
            devotionalsDesc = `You are on ${displayName}. You have ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available each month and have used ${devotionalsUsed}.\n\n${devotionalsRemaining} ${devotionalsRemaining === 1 ? 'devotional' : 'devotionals'} remaining this month. Resets in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          }
        }

        return {
          title: 'Devotionals',
          description: devotionalsDesc,
          icon: 'book',
          iconColor: Colors.alertCoral,
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
        // currentThreshold removed - was calculated but never used
        const nextThreshold = levelThresholds[level] || 10000;
        const pointsNeeded = Math.max(0, nextThreshold - points);

        const faithDesc = `You currently have ${points} Faith Points and are at Level ${level}: ${currentLevelTitle}.\n\nFaith Points are earned by:\n• Completing playbook action steps\n• Finishing devotionals\n• Daily journaling\n• Prayer activities\n• Maintaining streaks\n\n${level < 10 ? `You need ${pointsNeeded} more points to reach Level ${level + 1}: ${nextLevelTitle}.` : 'You have reached the maximum level! Keep growing in faith.'}`;

        return {
          title: 'Faith Points',
          description: faithDesc,
          icon: 'star-four-points',
          iconColor: Colors.alertCoral,
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

  // Check if user is on Seeker tier (0 limits)
  const isSeeker = (usage?.playbooks.limit === 0 && usage?.devotionals.limit === 0) ||
                   subscription?.tier === 'seeker';
  const showUpgradeButton = isSeeker && (type === 'playbooks' || type === 'devotionals');

  const handleUpgrade = () => {
    console.log('🔧 Upgrade button pressed - type:', type, 'tier:', subscription?.tier);
    triggerLightHaptic();

    // Always show sales offer screen from profile usage counter
    // Users can choose trial from within the sales offer screen
    console.log('🔧 Always showing sales offer from profile usage counter');

    // Close tooltip modal first
    onClose();

    // Navigate after tooltip closes with proper delay
    setTimeout(() => {
      console.log('🔧 Attempting navigation...');
      try {
        // Always navigate to sales offer screen
        console.log('🔧 Navigating to OnboardingSalesOffer');
        (navigation as any).reset({
          index: 0,
          routes: [{ name: 'OnboardingSalesOffer', params: {
            upgradeMode: true,
            currentTier: subscription?.tier || 'seeker',
            skipNotificationPreference: true,
            featureType: type === 'playbooks' || type === 'devotionals' ? type : undefined,
            source: 'profile_usage_counter',
            feature: type === 'playbooks' ? 'playbooks' : 'devotionals',
            returnTo: 'UserProfile',
            context: 'profile_settings',
            dismissBothModalsOnClose: true, // Custom flag to handle dismissal
          }}],
        });
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback: try to navigate without extra parameters
        try {
          (navigation as any).navigate('OnboardingSalesOffer');
        } catch (fallbackError) {
          console.error('Fallback navigation error:', fallbackError);
        }
      }
    }, 300);
  };

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
              {showUpgradeButton ? (
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade} activeOpacity={0.7}>
                    <ThemedText weight="semiBold" style={styles.upgradeButtonText}>
                      Upgrade Now
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => { triggerLightHaptic(); onClose(); }} activeOpacity={0.7}>
                    <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
                      Maybe Later
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.closeButton} onPress={() => { triggerLightHaptic(); onClose(); }} activeOpacity={0.7}>
                  <ThemedText weight="semiBold" style={styles.closeButtonText}>
                    Got it!
                  </ThemedText>
                </TouchableOpacity>
              )}
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    margin: 20,
    marginTop: 0,
  },
  upgradeButton: {
    flex: 1,
    backgroundColor: Colors.alertCoral,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default UsageTooltipModal;
