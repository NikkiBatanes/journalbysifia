import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
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

type PaidPlanTier = 'spark' | 'growth' | 'transformation';

const PAID_PLAN_ORDER: PaidPlanTier[] = ['spark', 'growth', 'transformation'];

const SubscriptionSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;

    const animate = () => {
      if (!isMounted.current) {return;}

      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]).start((finished) => {
        if (finished && isMounted.current) {
          animate();
        }
      });
    };

    animate();

    return () => {
      isMounted.current = false;
      animatedValue.stopAnimation();
    };
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={skeletonStyles.container}>
      {/* Plan card skeleton */}
      <View style={skeletonStyles.planCard}>
        <Animated.View style={[skeletonStyles.badgePill, { opacity }]} />
        <Animated.View style={[skeletonStyles.planName, { opacity }]} />
        <Animated.View style={[skeletonStyles.planDescription, { opacity }]} />
        <Animated.View style={[skeletonStyles.billingBadge, { opacity }]} />

        {/* Feature lines */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Animated.View key={`feature-${i}`} style={[skeletonStyles.featureLine, { opacity, width: i % 2 === 0 ? '85%' : '70%' }]} />
        ))}
      </View>
    </View>
  );
};

const skeletonStyles = StyleSheet.create({
  container: {
    padding: 24,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    paddingTop: 56,
  },
  badgePill: {
    position: 'absolute',
    top: 16,
    left: 16,
    height: 24,
    width: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  planName: {
    height: 24,
    width: '60%',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  planDescription: {
    height: 14,
    width: '50%',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  billingBadge: {
    height: 20,
    width: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginBottom: 24,
  },
  featureLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
});

const normalizePaidPlanTier = (tier?: string | null): PaidPlanTier | undefined => {
  const normalized = String(tier || '').toLowerCase().replace(/_annual$/, '');
  return PAID_PLAN_ORDER.includes(normalized as PaidPlanTier) ? normalized as PaidPlanTier : undefined;
};

const getNextPaidPlanTier = (tier?: string | null): PaidPlanTier => {
  const current = normalizePaidPlanTier(tier);
  if (!current) {
    return 'growth';
  }

  const currentIndex = PAID_PLAN_ORDER.indexOf(current);
  return PAID_PLAN_ORDER[Math.min(currentIndex + 1, PAID_PLAN_ORDER.length - 1)];
};

const isAnnualBillingCycle = (billingCycle?: string | null): boolean => {
  const normalized = String(billingCycle || '').toLowerCase();
  return normalized === 'annual' || normalized === 'yearly' || normalized === 'year';
};

interface SubscriptionPlanModalProps {
  visible: boolean;
  onClose: () => void;
  navigation?: any;
  // Test mode props for simulating subscription states
  testModeTier?: string;
  testModeStatus?: string;
  testModeBillingCycle?: 'monthly' | 'annual';
  testModeTrialChosenTier?: string;
  testModeHasUsedTrial?: boolean;
  testModeCancelAtPeriodEnd?: boolean;
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
  testModeTier,
  testModeStatus,
  testModeBillingCycle,
  testModeTrialChosenTier,
  testModeHasUsedTrial,
  testModeCancelAtPeriodEnd,
}) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if in test mode
  const isTestMode = !!testModeTier;

  const loadSubscriptionData = React.useCallback(async (forceRefresh = false) => {
    if (!user?.id && !isTestMode) {return;}

    try {
      setLoading(true);

      // Use test mode data if provided
      if (isTestMode) {
        const testSubscription: Subscription = {
          id: 'test-id',
          tier: testModeTier || 'seeker',
          status: testModeStatus || (testModeTier === 'seeker' ? 'active' : 'active'),
          limits: testModeTier === 'seeker' ? { playbooks: 2, devotionals: 2 } :
                   testModeTier === 'spark' ? { playbooks: 10, devotionals: 10 } :
                   testModeTier === 'growth' ? { playbooks: 25, devotionals: 25 } :
                   testModeTier === 'transformation' ? { playbooks: -1, devotionals: -1 } :
                   testModeTier === 'free_trial' ? { playbooks: 2, devotionals: 2 } :
                   { playbooks: 2, devotionals: 2 },
          playbooks_used: 0,
          devotionals_used: 0,
          subscription_display_name: testModeTier === 'free_trial' ? `siFia ${testModeTrialChosenTier || 'Growth'} Trial` : undefined,
          trial_chosen_tier: testModeTrialChosenTier,
          billing_cycle: testModeBillingCycle || 'monthly',
          has_used_trial: testModeHasUsedTrial,
          cancel_at_period_end: testModeCancelAtPeriodEnd,
          current_period_end: testModeStatus === 'trialing' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        };
        setSubscription(testSubscription);
        return;
      }

      Logger.info('[SubscriptionPlanModal] Loading subscription data', {
        userId: user?.id,
        forceRefresh,
        component: 'SubscriptionPlanModal',
      });

      // Force fresh read when modal opens to get latest subscription data
      if (!user?.id) {
        return;
      }
      const subscriptionData = await NewSubscriptionService.getUserSubscription(user.id, forceRefresh);

      Logger.info('[SubscriptionPlanModal] Subscription data loaded', {
        userId: user?.id,
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
        userId: user?.id,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isTestMode, testModeTier, testModeStatus, testModeBillingCycle, testModeTrialChosenTier, testModeHasUsedTrial, testModeCancelAtPeriodEnd]);

  // Load subscription data when modal becomes visible
  // Force refresh to get latest data after purchases
  useEffect(() => {
    if (visible && (user?.id || isTestMode)) {
      loadSubscriptionData(true); // Force fresh read to catch post-purchase updates
    }
  }, [visible, user?.id, isTestMode, loadSubscriptionData]);

  // Also refresh when modal comes back into focus (after returning from purchase flow)
  useFocusEffect(
    React.useCallback(() => {
      if (visible && (user?.id || isTestMode)) {
        loadSubscriptionData(true); // Force refresh when returning from purchase
      }
    }, [visible, user?.id, isTestMode, loadSubscriptionData])
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
          description: 'A quiet place to begin',
          features: [
            'Basic journaling for personal reflection',
            'A quiet space to write and process what\'s on your heart',
            'Begin exploring siFia\'s approach to reflection and discernment',
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
          description: 'For getting started',
          features: [
            '10 playbooks each month',
            '10 devotionals each month',
            'Access 1-day and 3-day devotionals',
            'Gentle reminders',
            'Track your progress week by week',
            'Plan Ahead inside your journal',
            'Copy To-Dos to other dates',
            'Guided prompts',
            'Smart Journaling',
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
            'Access 1-day, 3-day, and 5-day devotionals',
            'Gentle reminders',
            'Track your progress week by week',
            'Plan Ahead inside your journal',
            'Copy To-Dos to other dates',
            'Guided prompts',
            'Smart Journaling',
            'Calendar Auto-Sync',
            'Export to PDF',
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
            '60 playbooks each month',
            '60 devotionals each month',
            'Access 1-day, 3-day, 5-day, and 7-day devotionals',
            'Gentle reminders',
            'Track your progress week by week',
            'Plan Ahead inside your journal',
            'Copy To-Dos to other dates',
            'Guided prompts',
            'Smart Journaling',
            'Calendar Auto-Sync',
            'Export to PDF',
            'Priority support',
          ],
          limits: {
            playbooks: 60,
            devotionals: 60,
          },
          color: Colors.faithGold,
        };
      case 'free_trial':
        // For trials, show trial-specific info with tier-specific limits
        const chosenTier = subscription?.trial_chosen_tier || 'growth';
        const chosenTierName = chosenTier.charAt(0).toUpperCase() + chosenTier.slice(1);
        const billingCycle = subscription?.billing_cycle === 'annual' ? ' Annual' : '';

        // Get tier-specific trial limits
        const trialLimits = chosenTier === 'spark' ? { playbooks: 5, devotionals: 5 } :
                            chosenTier === 'growth' ? { playbooks: 10, devotionals: 10 } :
                            chosenTier === 'transformation' ? { playbooks: 25, devotionals: 25 } :
                            { playbooks: 10, devotionals: 10 }; // default to growth

        // Get tier-specific features based on chosen tier
        const tierFeatures = chosenTier === 'spark' ? [
          `${trialLimits.playbooks} playbooks during trial`,
          `${trialLimits.devotionals} devotionals during trial`,
          'Access 1-day and 3-day devotionals',
          'Gentle reminders',
          'Track your progress week by week',
          'Plan Ahead inside your journal',
          'Copy To-Dos to other dates',
          'Guided prompts',
          'Smart Journaling',
        ] : chosenTier === 'growth' ? [
          `${trialLimits.playbooks} playbooks during trial`,
          `${trialLimits.devotionals} devotionals during trial`,
          'Access 1-day, 3-day, and 5-day devotionals',
          'Gentle reminders',
          'Track your progress week by week',
          'Plan Ahead inside your journal',
          'Copy To-Dos to other dates',
          'Guided prompts',
          'Smart Journaling',
          'Calendar Auto-Sync',
          'Export to PDF',
        ] : chosenTier === 'transformation' ? [
          `${trialLimits.playbooks} playbooks during trial`,
          `${trialLimits.devotionals} devotionals during trial`,
          'Access 1-day, 3-day, 5-day, and 7-day devotionals',
          'Gentle reminders',
          'Track your progress week by week',
          'Plan Ahead inside your journal',
          'Copy To-Dos to other dates',
          'Guided prompts',
          'Smart Journaling',
          'Calendar Auto-Sync',
          'Export to PDF',
          'Priority support',
        ] : [
          `${trialLimits.playbooks} playbooks during trial`,
          `${trialLimits.devotionals} devotionals during trial`,
          'Access 1-day and 3-day devotionals',
          'Gentle reminders',
          'Track your progress week by week',
          'Plan Ahead inside your journal',
          'Copy To-Dos to other dates',
          'Guided prompts',
          'Smart Journaling',
        ];

        return {
          name: `siFia ${chosenTierName}${billingCycle} Trial`,
          description: `3-day free trial with full access to ${chosenTierName}`,
          features: [
            ...tierFeatures,
            'Cancel anytime before trial ends',
          ],
          limits: trialLimits,
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
          ? new Date(subscriptionData.current_period_end).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
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
  const tierBase = normalizePaidPlanTier(subscription?.tier) || subscription?.tier?.replace(/_annual$/, '') || 'seeker';
  // For trials, use billing_cycle field; for paid tiers, check tier suffix
  const isAnnual = subscription?.tier === 'free_trial'
    ? isAnnualBillingCycle(subscription?.billing_cycle)
    : Boolean(subscription?.tier?.includes('_annual') || isAnnualBillingCycle(subscription?.billing_cycle));
  const billingPeriod = isAnnual ? 'Annual' : 'Monthly';
  const currentTrialPlanTier = normalizePaidPlanTier(subscription?.trial_chosen_tier) || 'growth';
  const currentTrialBillingCycle = isAnnualBillingCycle(subscription?.billing_cycle) || isAnnual ? 'annual' : 'monthly';
  const isHighestAnnualPlan = tierBase === 'transformation' && isAnnual;
  const isHighestAnnualTrialPlan = tierBase === 'free_trial' && currentTrialPlanTier === 'transformation' && currentTrialBillingCycle === 'annual';
  const showTrialViewOtherPlans = tierBase === 'free_trial' && !isHighestAnnualTrialPlan;

  // Check if user should see upgrade button - show for all tiers except annual Transformation
  const showUpgradeButton = !isHighestAnnualPlan;

  // Get contextual button text based on current tier
  const getUpgradeButtonText = () => {
    switch (tierBase) {
      case 'seeker':
        return 'View all plans';
      case 'free_trial':
        return 'Continue with siFia';
      case 'spark':
        return 'Upgrade to Growth';
      case 'growth':
        return 'Upgrade to Transformation';
      case 'transformation':
        return isAnnual ? 'Manage Plan' : 'Switch to Transformation Annual';
      default:
        return 'View Plans';
    }
  };

  const handleUpgradePress = () => {
    if (navigation) {
      // For annual users, show only annual plans to prevent downgrading to monthly
      // For Transformation monthly users, show only annual transformation option
      // For other tiers, use normal upgrade mode
      const isTransformationMonthly = tierBase === 'transformation' && !isAnnual;
      const isAnnualUser = isAnnual && tierBase !== 'seeker';
      const isSeekerUser = tierBase === 'seeker';
      const isTrialUser = tierBase === 'free_trial';
      const currentPaidTier = normalizePaidPlanTier(tierBase);
      const selectedPaidUpgradeTier = getNextPaidPlanTier(currentPaidTier);
      const selectedTrialUpgradeTier = getNextPaidPlanTier(currentTrialPlanTier);
      const selectedTrialBillingCycle = currentTrialPlanTier === 'transformation' && currentTrialBillingCycle === 'monthly'
        ? 'annual'
        : currentTrialBillingCycle;

      const params = {
        source: 'profile_upgrade',
        currentTier: subscription?.tier || 'seeker',
        currentTrialChosenTier: currentTrialPlanTier,
        currentTrialBillingCycle,
        selectedTier: isTrialUser
          ? selectedTrialUpgradeTier
          : isSeekerUser
            ? undefined
            : selectedPaidUpgradeTier,
        selectedBillingCycle: isTrialUser
          ? selectedTrialBillingCycle
          : (isTransformationMonthly || isAnnual) ? 'annual' : 'monthly',
        profileTrialViewPlans: isTrialUser,
        skipNotificationPreference: true,
        // Seeker users tapping "Avail Plan" should see the default onboarding copy ("Your Journey Begins"),
        // not limit-gating copy like "Unlock playbooks".
        upgradeMode: isSeekerUser ? false : (!isTransformationMonthly && !isAnnualUser),
        forceTransformationAnnual: isTransformationMonthly, // Custom flag to filter to only annual transformation
        forceAnnualOnly: isAnnualUser, // Show only annual plans for current tier
        testModeTier: isTestMode ? subscription?.tier : undefined,
        testModeIsOnTrial: isTestMode && isTrialUser ? true : undefined,
        testModeHasStartedTrial: isTestMode && isTrialUser ? true : undefined,
        testModeTrialChosenTier: isTestMode ? currentTrialPlanTier : undefined,
        testModeBillingCycle: isTestMode ? currentTrialBillingCycle : undefined,
        testModeHasEverStartedTrial: isTestMode ? (testModeHasUsedTrial ?? isTrialUser) : undefined,
      };

      onClose();
      setTimeout(() => {
        (navigation as any).navigate('OnboardingSalesOffer', params);
      }, 250);
    } else {
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
            <Ionicons name="chevron-back" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <ThemedText weight="bold" style={styles.headerTitle}>
            Current Plan
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, showUpgradeButton && styles.scrollContentWithFooter]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <SubscriptionSkeleton />
          ) : (
            <>
              {/* Plan Card */}
              <View style={styles.planCard}>
                {/* Trial ends pill in upper left corner */}
                {tierBase === 'free_trial' && (
                  <View style={styles.trialEndsPillContainer}>
                    <View style={styles.trialEndsPill}>
                      <ThemedText style={styles.trialEndsPillText}>
                        {statusInfo.text}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {statusInfo.badge && tierBase !== 'free_trial' && (
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

                {!statusInfo.badge && tierBase !== 'free_trial' && (
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
            </>
          )}
        </ScrollView>

        {/* Sticky Footer with Buttons */}
        {showUpgradeButton && (
          <SafeAreaView style={styles.stickyFooter}>
            {tierBase === 'free_trial' ? (
              <>
                {/* Primary button for trial users: Continue with siFia */}
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    onClose();
                    if (navigation) {
                      navigation.navigate('DashboardHome' as any);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <ThemedText weight="bold" style={styles.upgradeButtonText}>
                    Continue with siFia
                  </ThemedText>
                </TouchableOpacity>

                {/* Secondary button for trial users: View Other Plans */}
                {showTrialViewOtherPlans && (
                  <TouchableOpacity
                    style={styles.viewPlansButton}
                    onPress={() => {
                      try { triggerLightHaptic(); } catch {}
                      handleUpgradePress();
                    }}
                    activeOpacity={0.85}
                  >
                    <ThemedText weight="bold" style={styles.viewPlansButtonText}>
                      View Other Plans
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  handleUpgradePress();
                }}
                activeOpacity={0.85}
              >
                <ThemedText weight="bold" style={styles.upgradeButtonText}>
                  {getUpgradeButtonText()}
                </ThemedText>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        )}
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
    padding: 24,
    paddingBottom: 32,
  },
  scrollContentWithFooter: {
    paddingBottom: 180,
  },
  stickyFooter: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    paddingTop: 56,
  },
  trialEndsPillContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  trialEndsPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.faithGold,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  trialEndsPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
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
    position: 'absolute',
    top: 16,
    left: 16,
  },
  planName: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 16,
  },
  upgradeButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center',
  },
  viewPlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 12,
  },
  viewPlansButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SubscriptionPlanModal;
