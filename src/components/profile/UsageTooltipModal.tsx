import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';

export type TooltipType = 'playbooks' | 'devotionals' | 'refinements' | 'wisdom' | 'faithPoints' | 'badges';

interface TooltipContent {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  level?: number;
  levelTitle?: string;
  progress?: number;
  points?: number;
  pointsNeeded?: number;
  nextLevelTitle?: string;
}

interface Props {
  visible: boolean;
  type: TooltipType | null;
  onClose: () => void;
  subscription: any; // Subscription data
  usage: {
    playbooks: { used: number; limit: number };
    devotionals: { used: number; limit: number };
    refinements: { used: number; limit: number };
    wisdom: { used: number; limit: number };
  } | null;
  stats: {
    faithPoints: number;
    level: number;
    badgesCount?: number;
  } | null;
}

// Apple monthly renewal helper: renews on the same calendar day each month.
// If that day does not exist in the target month (e.g., 31), it renews on the last day of that month.
// IMPORTANT: Always returns NEXT billing cycle date, never today
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

  // If the reset date for this month is in the FUTURE (not today), use it
  // Changed from >= to > so today's date triggers next month calculation
  if (resetDateThisMonth > today) {
    return resetDateThisMonth;
  }

  // Calculate next month's reset date (either because today is past this month's date, or today IS the reset date)
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
            playbooksDesc = `You are on ${displayName}. You have used all ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.playbooks === -1 ? 'playbooks without a monthly counter' : `${fullLimits.playbooks} playbooks`} every month.`;
          } else {
            playbooksDesc = `You are on ${displayName}. You have ${playbooksLimit} ${playbooksLimit === 1 ? 'playbook' : 'playbooks'} available during your trial and have used ${playbooksUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.playbooks === -1 ? 'playbooks without a monthly counter' : `${fullLimits.playbooks} playbooks`} every month.`;
          }
        } else if (playbooksLimit === -1) {
          playbooksDesc = `You are on ${displayName}. This plan does not use a monthly playbook counter.`;
        } else if (playbooksLimit === 0) {
          // Defensive fallback if limits failed to load.
          playbooksDesc = 'Your monthly playbook limit could not be loaded. The free Seeker plan includes 2 playbooks each month.';
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
            devotionalsDesc = `You are on ${displayName}. You have used all ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.devotionals === -1 ? 'devotionals without a monthly counter' : `${fullLimits.devotionals} devotionals`} every month.`;
          } else {
            devotionalsDesc = `You are on ${displayName}. You have ${devotionalsLimit} ${devotionalsLimit === 1 ? 'devotional' : 'devotionals'} available during your trial and have used ${devotionalsUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.devotionals === -1 ? 'devotionals without a monthly counter' : `${fullLimits.devotionals} devotionals`} every month.`;
          }
        } else if (devotionalsLimit === -1) {
          devotionalsDesc = `You are on ${displayName}. This plan does not use a monthly devotional counter.`;
        } else if (devotionalsLimit === 0) {
          // Defensive fallback if limits failed to load.
          devotionalsDesc = 'Your monthly devotional limit could not be loaded. The free Seeker plan includes 1 devotional each month.';
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

      case 'refinements':
        const refinementsUsed = usage?.refinements.used || 0;
        const refinementsLimit = usage?.refinements.limit || 0;
        const refinementsRemaining = Math.max(0, refinementsLimit - refinementsUsed);

        let refinementsDesc = 'Refinements let you regenerate and improve your playbook content with AI-powered insights to better match your current journey and needs.';

        if (isOnTrial) {
          const fullLimits = getFullTierLimits(trialChosenTier || 'spark');
          if (refinementsRemaining === 0) {
            const tierName = trialChosenTier ? trialChosenTier.charAt(0).toUpperCase() + trialChosenTier.slice(1) : 'Growth';
            refinementsDesc += `\n\nYou are on ${displayName}. You have used all ${refinementsLimit} ${refinementsLimit === 1 ? 'refinement' : 'refinements'} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.refinements === -1 ? 'refinements without a monthly counter' : `${fullLimits.refinements} refinements`} every month.`;
          } else {
            refinementsDesc += `\n\nYou are on ${displayName}. You have ${refinementsLimit} ${refinementsLimit === 1 ? 'refinement' : 'refinements'} available during your trial and have used ${refinementsUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.refinements === -1 ? 'refinements without a monthly counter' : `${fullLimits.refinements} refinements`} every month.`;
          }
        } else if (refinementsLimit === -1) {
          refinementsDesc += `\n\nYou are on ${displayName}. This plan does not use a monthly refinement counter.`;
        } else if (refinementsLimit === 0) {
          refinementsDesc += '\n\nYour monthly refinement limit could not be loaded.';
        } else {
          const resetDate = getNextAppleMonthlyResetDate(subscription?.subscription_start_date);
          const now = new Date();
          const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const dayText = daysUntilReset === 1 ? 'day' : 'days';
          const resetDateStr = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          if (refinementsRemaining === 0) {
            refinementsDesc += `\n\nYou are on ${displayName}. You have used all ${refinementsLimit} ${refinementsLimit === 1 ? 'refinement' : 'refinements'} available this month.\n\nYour refinements will reset in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          } else {
            refinementsDesc += `\n\nYou are on ${displayName}. You have ${refinementsLimit} ${refinementsLimit === 1 ? 'refinement' : 'refinements'} available each month and have used ${refinementsUsed}.\n\n${refinementsRemaining} ${refinementsRemaining === 1 ? 'refinement' : 'refinements'} remaining this month. Resets in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          }
        }

        return {
          title: 'Playbook Refinements',
          description: refinementsDesc,
          icon: 'auto-fix',
          iconColor: Colors.alertCoral,
        };

      case 'wisdom':
        const wisdomUsed = usage?.wisdom.used || 0;
        const wisdomLimit = usage?.wisdom.limit || 0;
        const wisdomRemaining = Math.max(0, wisdomLimit - wisdomUsed);

        let wisdomDesc = "How to's provide personalized, step-by-step guidance for your faithful actions. Ask siFia for practical wisdom on how to apply biblical truths to specific situations in your life.";

        if (isOnTrial) {
          const fullLimits = getFullTierLimits(trialChosenTier || 'spark');
          if (wisdomRemaining === 0) {
            const tierName = trialChosenTier ? trialChosenTier.charAt(0).toUpperCase() + trialChosenTier.slice(1) : 'Growth';
            wisdomDesc += `\n\nYou are on ${displayName}. You have used all ${wisdomLimit} ${wisdomLimit === 1 ? 'how-to' : "how-to's"} available during your trial.\n\nDon't worry! You can still explore all ${tierName} tier features during your trial. After your trial ends in ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'}, you will have ${fullLimits.wisdom === -1 ? "how-to's without a monthly counter" : `${fullLimits.wisdom} how-to's`} every month.`;
          } else {
            wisdomDesc += `\n\nYou are on ${displayName}. You have ${wisdomLimit} ${wisdomLimit === 1 ? 'how-to' : "how-to's"} available during your trial and have used ${wisdomUsed}.\n\nYou have ${daysRemaining} ${daysRemaining !== 1 ? 'days' : 'day'} remaining in your trial. After your trial ends, you will have ${fullLimits.wisdom === -1 ? "how-to's without a monthly counter" : `${fullLimits.wisdom} how-to's`} every month.`;
          }
        } else if (wisdomLimit === -1) {
          wisdomDesc += `\n\nYou are on ${displayName}. This plan does not use a monthly how-to counter.`;
        } else if (wisdomLimit === 0) {
          wisdomDesc += '\n\nYour monthly how-to limit could not be loaded.';
        } else {
          const resetDate = getNextAppleMonthlyResetDate(subscription?.subscription_start_date);
          const now = new Date();
          const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const dayText = daysUntilReset === 1 ? 'day' : 'days';
          const resetDateStr = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          if (wisdomRemaining === 0) {
            wisdomDesc += `\n\nYou are on ${displayName}. You have used all ${wisdomLimit} ${wisdomLimit === 1 ? 'how-to' : "how-to's"} available this month.\n\nYour how-to's will reset in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          } else {
            wisdomDesc += `\n\nYou are on ${displayName}. You have ${wisdomLimit} ${wisdomLimit === 1 ? 'how-to' : "how-to's"} available each month and have used ${wisdomUsed}.\n\n${wisdomRemaining} ${wisdomRemaining === 1 ? 'how-to' : "how-to's"} remaining this month. Resets in ${daysUntilReset} ${dayText} on ${resetDateStr}.`;
          }
        }

        return {
          title: "How to's for Faithful Actions",
          description: wisdomDesc,
          icon: 'lightbulb',
          iconColor: Colors.alertCoral,
        };

      case 'faithPoints':
        const points = stats?.faithPoints || 0;
        const level = stats?.level || 1;
        const levelTitles: Record<number, string> = {
          1: 'Beginning', 2: 'Growing', 3: 'Rooted', 4: 'Steady', 5: 'Grounded',
          6: 'Faithful', 7: 'Maturing', 8: 'Deepening', 9: 'Strengthened', 10: 'Abiding',
        };
        const currentLevelTitle = levelTitles[level] || 'Beginning';
        const nextLevelTitle = levelTitles[level + 1] || 'Abiding';

        // Calculate points needed for next level
        const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
        const currentThreshold = levelThresholds[level - 1] || 0;
        const nextThreshold = levelThresholds[level] || 10000;
        const pointsNeeded = Math.max(0, nextThreshold - points);
        const progress = level < 10 ? Math.min(1, Math.max(0, (points - currentThreshold) / (nextThreshold - currentThreshold))) : 1;

        const faithDesc = `You currently have ${points} Faith Points.`;

        return {
          title: 'Faith Points',
          description: faithDesc,
          icon: 'star-four-points',
          iconColor: Colors.alertCoral,
          level,
          levelTitle: currentLevelTitle,
          progress,
          points,
          pointsNeeded,
          nextLevelTitle,
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
  const getFullTierLimits = (tier: string): { playbooks: number; devotionals: number; refinements: number; wisdom: number } => {
    switch (tier) {
      case 'spark':
        return { playbooks: 10, devotionals: 10, refinements: 3, wisdom: 5 };
      case 'growth':
        return { playbooks: 25, devotionals: 25, refinements: 6, wisdom: 12 };
      case 'transformation':
        return { playbooks: 60, devotionals: 60, refinements: 15, wisdom: 25 };
      case 'family':
        return { playbooks: -1, devotionals: -1, refinements: -1, wisdom: -1 };
      default:
        return { playbooks: 2, devotionals: 1, refinements: 1, wisdom: 2 };
    }
  };

  const content = getTooltipContent();

  // Check if user is on Seeker tier.
  const isSeeker = (usage?.playbooks.limit === 0 && usage?.devotionals.limit === 0) ||
                   subscription?.tier === 'seeker';
  const showUpgradeButton = isSeeker && (type === 'playbooks' || type === 'devotionals');

  const handleUpgrade = () => {
        triggerLightHaptic();

    // Always show sales offer screen from profile usage counter
    // Users can choose trial from within the sales offer screen

    // CRITICAL: Close tooltip modal first to ensure proper navigation context
    onClose();

    // Use longer delay to ensure modal is fully closed before navigation
    // This prevents navigation context issues with React Native modals
    setTimeout(() => {
            try {
        const nav = navigation as any;

        // Check if navigation is available
        if (!nav || typeof nav.navigate !== 'function') {
                    return;
        }

                nav.navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: subscription?.tier || 'seeker',
          skipNotificationPreference: true,
          featureType: type === 'playbooks' || type === 'devotionals' ? type : undefined,
          source: 'profile_usage_counter',
          feature: type === 'playbooks' ? 'playbooks' : 'devotionals',
          returnTo: 'UserProfile',
          context: 'profile_settings',
          dismissBothModalsOnClose: true, // Custom flag to handle dismissal
        });
        /* Navigation completed */
      } catch (error) {
        /* Handle navigation error silently */
      }
    }, 500); // Increased delay to ensure modal is fully closed
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <ThemedText weight="medium" style={styles.modalTitle}>{content.title}</ThemedText>
          {type === 'faithPoints' && content.level !== undefined && (
            <View style={styles.levelSection}>
              <ThemedText weight="semiBold" style={styles.levelText}>
                Level {content.level}: {content.levelTitle}
              </ThemedText>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(content.progress || 0) * 100}%` }]} />
              </View>
              <ThemedText weight="regular" style={styles.pointsText}>
                {content.points} FP
              </ThemedText>
              {content.level !== undefined && content.level < 10 && content.pointsNeeded !== undefined && (
                <>
                  <ThemedText weight="regular" style={styles.pointsNeededText}>
                    You need {content.pointsNeeded} more points to reach
                  </ThemedText>
                  <View style={styles.nextLevelPill}>
                    <ThemedText weight="semiBold" style={styles.nextLevelPillText}>
                      Level {content.level + 1}: {content.nextLevelTitle}
                    </ThemedText>
                  </View>
                </>
              )}
            </View>
          )}
          <View style={styles.content}>
            {type === 'faithPoints' ? (
              <>
                <ThemedText weight="regular" style={styles.descriptionHeading}>
                  Faith Points are earned by
                </ThemedText>
                <View style={styles.bulletList}>
                  <ThemedText weight="regular" style={styles.descriptionBullets}>
                    • Completing playbook action steps
                  </ThemedText>
                  <ThemedText weight="regular" style={styles.descriptionBullets}>
                    • Finishing devotionals
                  </ThemedText>
                  <ThemedText weight="regular" style={styles.descriptionBullets}>
                    • Daily journaling
                  </ThemedText>
                  <ThemedText weight="regular" style={styles.descriptionBullets}>
                    • Prayer activities
                  </ThemedText>
                  <ThemedText weight="regular" style={styles.descriptionBullets}>
                    • Maintaining streaks
                  </ThemedText>
                </View>
              </>
            ) : (
              <ThemedText weight="regular" style={styles.description}>
                {content.description}
              </ThemedText>
            )}
          </View>
          {showUpgradeButton ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleUpgrade} activeOpacity={0.7}>
                <ThemedText weight="semiBold" style={styles.primaryButtonText}>
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
            <TouchableOpacity style={styles.fullWidthButton} onPress={() => { triggerLightHaptic(); onClose(); }} activeOpacity={0.7}>
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                Got it
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    padding: 20,
    maxWidth: 340,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  levelSection: {
    marginBottom: 16,
  },
  levelText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 4,
  },
  pointsText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  nextLevelPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginTop: 12,
  },
  nextLevelPillText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  pointsNeededText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 12,
  },
  content: {
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  descriptionHeading: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  bulletList: {
    gap: 4,
  },
  descriptionBullets: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  fullWidthButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
    minHeight: 48,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.alertCoral,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
});

export default UsageTooltipModal;
