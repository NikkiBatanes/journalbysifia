import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { Logger } from '../utils/ProductionLogger';
import { triggerLightHaptic } from '../utils/haptics';

interface SubscriptionPlanModalProps {
  visible: boolean;
  onClose: () => void;
  navigation?: any;
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  platform_subscription_id?: string;
  limits?: {
    playbooks: number;
    devotionals: number;
  };
  playbooks_used?: number;
  devotionals_used?: number;
  subscription_display_name?: string;
  trial_chosen_tier?: string;
  billing_cycle?: 'monthly' | 'annual';
  has_used_trial?: boolean;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
}

const SubscriptionPlanModal: React.FC<SubscriptionPlanModalProps> = ({
  visible,
  onClose,
  navigation,
}) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSubscriptionData = React.useCallback(async (forceRefresh = false) => {
    if (!user?.id) {return;}

    try {
      setLoading(true);
      Logger.info('[SubscriptionPlanModal] Loading subscription data', {
        userId: user.id,
        forceRefresh,
        component: 'SubscriptionPlanModal',
      });

      // Force fresh read when modal opens to get latest subscription data
      const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id, forceRefresh);

      Logger.info('[SubscriptionPlanModal] Subscription data loaded', {
        userId: user.id,
        tier: subscriptionData?.tier,
        status: subscriptionData?.status,
        trialEndDate: subscriptionData?.trial_end_date,
        subscriptionEndDate: subscriptionData?.subscription_end_date,
        forceRefresh,
        component: 'SubscriptionPlanModal',
      });

      setSubscription(subscriptionData as any);
    } catch (error) {
      Logger.error('Failed to load subscription data for modal', error as Error, {
        component: 'SubscriptionPlanModal',
        userId: user.id,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load subscription data when modal becomes visible
  // Force refresh to get latest data after purchases
  useEffect(() => {
    if (visible && user?.id) {
      loadSubscriptionData(true); // Force fresh read to catch post-purchase updates
    }
  }, [visible, user?.id, loadSubscriptionData]);

  // Also refresh when modal comes back into focus (after returning from purchase flow)
  useFocusEffect(
    React.useCallback(() => {
      if (visible && user?.id) {
        loadSubscriptionData(true); // Force refresh when returning from purchase
      }
    }, [visible, user?.id, loadSubscriptionData])
  );

  const getTierInfo = (tier: string): {
    name: string;
    description: string;
    features: string[];
    limits: {
      playbooks: number;
      devotionals: number;
    };
    color: string;
  } => {
    const tierBase = tier?.replace(/_annual$/, '') || 'seeker';

    switch (tierBase) {
      case 'seeker':
        return {
          name: 'siFia Seeker',
          description: 'Free access',
          features: [
            'Basic journaling for personal reflection',
            'A quiet space to write and process your thoughts',
            'Explore siFia’s approach to discernment',
          ],
          limits: {
            playbooks: 2,
            devotionals: 2,
          },
          color: Colors.textGray,
        };
      case 'spark':
        return {
          name: 'siFia Spark',
          description: 'For consistent encouragement',
          features: [
            '10 playbooks each month',
            '10 devotionals each month',
            'Access 1-day, 3-day devotionals',
            'Gentle reminders to keep you on track',
            'Track your progress week by week',
                        'Calendar Sync to stay on track',
            'Copy To-Dos to other dates for flexibility',
            'Smart Journaling for personalized reflection',
          ],
          limits: {
            playbooks: 10,
            devotionals: 10,
          },
          color: Colors.alertCoral,
        };
      case 'growth':
        return {
          name: 'siFia Growth',
          description: 'For deeper transformation',
          features: [
            '25 playbooks each month',
            '25 devotionals each month',
            'Access 1-day, 3-day, 5-day devotionals',
            'Gentle reminders to keep you on track',
            'Track your progress week by week',
                        'Calendar Sync to stay on track',
            'Copy To-Dos to other dates for flexibility',
            'Advanced reflection prompts',
            'Smart Journaling for personalized reflection',
            'Export to PDF for sharing and printing',
          ],
          limits: {
            playbooks: 25,
            devotionals: 25,
          },
          color: Colors.growthGreen,
        };
      case 'transformation':
        return {
          name: 'siFia Transformation',
          description: 'For a life transformed in spirit and purpose',
          features: [
            'Unlimited playbooks',
            'Unlimited devotionals',
            'Access 1-day, 3-day, 5-day, 7-day devotionals',
            'Gentle reminders to keep you on track',
            'Track your progress week by week',
                        'Calendar Sync to stay on track',
            'Copy To-Dos to other dates for flexibility',
            'Advanced reflection prompts',
            'Smart Journaling for personalized reflection',
            'Export to PDF for sharing and printing',
            'Priority support',
          ],
          limits: {
            playbooks: -1, // Unlimited
            devotionals: -1, // Unlimited
          },
          color: Colors.faithGold,
        };
      case 'free_trial':
        // For trials, show trial-specific info with trial limits (2/2)
        const chosenTier = subscription?.trial_chosen_tier || 'growth';
        const chosenTierName = chosenTier.charAt(0).toUpperCase() + chosenTier.slice(1);
        const billingCycle = subscription?.billing_cycle === 'annual' ? ' Annual' : '';

        return {
          name: `siFia ${chosenTierName}${billingCycle} Trial`,
          description: `3-day free trial of ${chosenTierName}`,
          features: [
            `3 days free access to the ${chosenTierName}${billingCycle} plan`,
            '2 playbooks during trial',
            '2 devotionals during trial',
            'Full access to all features',
            'Cancel anytime',
            'No commitment',
          ],
          limits: {
            playbooks: 2,
            devotionals: 2,
          },
          color: Colors.alertCoral,
        };
      default:
        return getTierInfo('seeker');
    }
  };

  const getStatusInfo = (status: string, subscriptionData: Subscription) => {
    // Handle seeker users (no subscription or seeker tier)
    if (!subscriptionData || subscriptionData.tier === 'seeker') {
      return {
        text: 'Free Plan',
        badge: true,
        color: Colors.faithGold,
      };
    }

    switch (status) {
      case 'active':
        if (subscriptionData.cancel_at_period_end) {
          return {
            text: 'Cancels at period end',
            color: Colors.alertCoral,
          };
        }
        return {
          text: 'Active',
          badge: true,
          color: Colors.growthGreen,
        };
      case 'trialing':
        const trialEnd = subscriptionData.current_period_end
          ? new Date(subscriptionData.current_period_end).toLocaleDateString()
          : 'Trial period';
        return {
          text: `Trial ends ${trialEnd}`,
          color: Colors.faithGold,
        };
      case 'canceled':
        return {
          text: 'Canceled',
          color: Colors.textGray,
        };
      case 'past_due':
        return {
          text: 'Payment Due',
          color: Colors.alertCoral,
        };
      default:
        return {
          text: 'Unknown',
          color: Colors.textGray,
        };
    }
  };

  const tierInfo = subscription ? getTierInfo(subscription.tier) : getTierInfo('seeker');
  const statusInfo = subscription ? getStatusInfo(subscription.status, subscription) : { text: 'Loading...', color: Colors.textGray };

  // Determine billing period
  const tierBase = subscription?.tier?.replace(/_annual$/, '') || 'seeker';
  // For trials, use billing_cycle field; for paid tiers, check tier suffix
  const isAnnual = subscription?.tier === 'free_trial'
    ? subscription?.billing_cycle === 'annual'
    : subscription?.tier?.includes('_annual') || false;
  const billingPeriod = isAnnual ? 'Annual' : 'Monthly';

  // Check if user should see upgrade button - show for all tiers except yearly Transformation
  const showUpgradeButton = !(tierBase === 'transformation' && isAnnual);

  // Get contextual button text based on current tier
  const getUpgradeButtonText = () => {
    switch (tierBase) {
      case 'seeker':
        return 'Continue with siFia';
      case 'spark':
        return 'Upgrade Plan';
      case 'growth':
        return 'Upgrade Plan';
      case 'transformation':
        return isAnnual ? 'Manage Plan' : 'Upgrade Plan to Annual';
      default:
        return 'View Plans';
    }
  };

  const handleUpgradePress = () => {
    try {
      triggerLightHaptic();
    } catch {}

    console.log('SubscriptionPlanModal: handleUpgradePress called', { navigation: !!navigation, tier: subscription?.tier });

    if (navigation && navigation.navigate) {
      console.log('SubscriptionPlanModal: Navigating to OnboardingSalesOffer');
      // Don't close modal immediately - let user close it manually

      // For annual users, show only annual plans to prevent downgrading to monthly
      // For Transformation monthly users, show only annual transformation option
      // For other tiers, use normal upgrade mode
      const isTransformationMonthly = tierBase === 'transformation' && !isAnnual;
      const isAnnualUser = isAnnual && tierBase !== 'seeker';
      const isSeekerUser = tierBase === 'seeker';

      (navigation as any).navigate('OnboardingSalesOffer', {
        source: 'profile_upgrade',
        currentTier: subscription?.tier || 'seeker',
        skipNotificationPreference: true,
        // Seeker users tapping "Avail Plan" should see the default onboarding copy ("Your Journey Begins"),
        // not limit-gating copy like "Unlock playbooks".
        upgradeMode: isSeekerUser ? false : (!isTransformationMonthly && !isAnnualUser),
        forceTransformationAnnual: isTransformationMonthly, // Custom flag to filter to only annual transformation
        forceAnnualOnly: isAnnualUser, // Show only annual plans for current tier
      });
    } else {
      console.log('SubscriptionPlanModal: Navigation not available');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { try { triggerLightHaptic(); } catch {} onClose(); }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <ThemedText weight="bold" style={styles.headerTitle}>
            Current Plan
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="diamond" size={48} color={Colors.hopeWhite} />
              <ThemedText weight="medium" style={styles.loadingText}>
                Loading plan details...
              </ThemedText>
            </View>
          ) : (
            <>
              {/* Plan Card */}
              <View style={styles.planCard}>
                {statusInfo.badge && (
                  <View style={styles.badgeContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                      <ThemedText style={styles.statusBadgeText}>
                        {statusInfo.text}
                      </ThemedText>
                    </View>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <ThemedText weight="bold" style={styles.planName}>
                      {tierInfo.name}
                    </ThemedText>
                    <ThemedText style={styles.planDescription}>
                      {tierInfo.description}
                    </ThemedText>
                    {tierBase !== 'seeker' && (
                  <View style={styles.billingPeriodBadge}>
                    <ThemedText style={styles.billingPeriodBadgeText}>
                      {billingPeriod}
                    </ThemedText>
                  </View>
                )}
                  </View>
                </View>

                {!statusInfo.badge && (
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <ThemedText style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.text}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Features Section */}
              <View style={styles.section}>
                <ThemedText weight="semiBold" style={styles.sectionTitle}>
                  Plan Features
                </ThemedText>
                {tierInfo.features.map((feature: string, index: number) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.alertCoral} />
                    <ThemedText style={styles.featureText}>{feature}</ThemedText>
                  </View>
                ))}
              </View>

              {/* Upgrade Button */}
              {showUpgradeButton && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgradePress}
                  activeOpacity={0.85}
                >
                  <ThemedText weight="bold" style={styles.upgradeButtonText}>
                    {getUpgradeButtonText()}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.anchorBlue,
    width: '100%',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginTop: 16,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
    alignItems: 'center',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginBottom: 4,
  },
  billingPeriodBadge: {
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'center',
  },
  billingPeriodBadgeText: {
    fontSize: 11,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  upgradeButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    textAlign: 'center',
  },
});

export default SubscriptionPlanModal;
