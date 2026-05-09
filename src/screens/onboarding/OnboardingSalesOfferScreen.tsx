import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
  Platform,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService, { LocationPricing, PricingTier as ServicePricingTier } from '../../services/pricingService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { useDevotionalGating } from '../../hooks/useDevotionalGating';
import { isDevotionalDurationLocked } from '../../utils/tierLockingRules';
import type { SubscriptionTier } from '../../types/subscription';
import PlatformPaymentService from '../../services/PlatformPaymentService';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { PurchaseSuccessModal } from '../../components/PurchaseSuccessModal';
import { PurchaseLoadingModal } from '../../components/PurchaseLoadingModal';
import { notificationService } from '../../services/notificationService';
import { useScreenStatusBar } from '../../hooks/useScreenStatusBar';
import { useQueryClient } from '@tanstack/react-query';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';
import ThemedText from '../../components/common/ThemedText';
import { generateSalesCopy } from '../../utils/dynamicSalesCopy';
import { triggerLightHaptic } from '../../utils/haptics';
import { notificationDeepLinkService } from '../../services/notificationDeepLinkService';

// removed Dimensions width as unused

// Use PricingTier from pricingService to avoid drift
type PricingTier = ServicePricingTier;
type BillingCycle = 'monthly' | 'annual';
type PaidPlanTier = 'spark' | 'growth' | 'transformation';
type OfferDismissBehavior = 'goBack' | 'userInput' | 'notificationSetup';

const PAID_PLAN_ORDER: PaidPlanTier[] = ['spark', 'growth', 'transformation'];

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

const normalizeBillingCycle = (billingCycle?: string | null): BillingCycle => {
  const normalized = String(billingCycle || '').toLowerCase();
  return normalized === 'annual' || normalized === 'yearly' || normalized === 'year' ? 'annual' : 'monthly';
};

const getPaidPlanRank = (tier?: string | null): number => {
  const normalized = normalizePaidPlanTier(tier);
  return normalized ? PAID_PLAN_ORDER.indexOf(normalized) : -1;
};

interface RouteParams {
  upgradeMode?: boolean;
  currentTier?: string;
  selectedTier?: string;
  billingCycle?: BillingCycle;
  currentTrialBillingCycle?: BillingCycle;
  selectedBillingCycle?: BillingCycle;
  requestedDuration?: number; // when user tapped a locked duration (e.g., 7 days)
  featureType?: 'playbooks' | 'devotionals' | 'wisdom' | 'export_pdf' | 'export_docx'; // explicitly mark which feature triggered the upgrade
  // Navigation context flags
  source?: string; // e.g., 'planning_lock', 'copy_todos_lock', 'guided_prompts_lock', 'calendar_auto_sync'
  feature?: string; // e.g., 'future_planning', 'copy_todos', 'guided_prompts'
  tier?: string; // caller-reported tier
  skipNotificationPreference?: boolean;
  context?: string; // e.g., 'profile_settings', 'timeblock'
  changedTier?: string; // tier changed in trial offer screen
  returnTo?: string; // e.g., 'UserProfile' - screen to return to on close
  returnToReflection?: boolean; // when launched from reflection editor
  dismissBothModalsOnClose?: boolean; // when both modals should be dismissed on close
  dismissBehavior?: OfferDismissBehavior;
  forceTransformationAnnual?: boolean; // Show only annual transformation option
  forceAnnualOnly?: boolean; // Show only annual plans for current tier
  onboardingFlow?: boolean; // True when in initial registration onboarding
  currentTrialChosenTier?: string;
  profileTrialViewPlans?: boolean;
  testModeTier?: string;
  testModeIsOnTrial?: boolean;
  testModeHasStartedTrial?: boolean;
  testModeHasEverStartedTrial?: boolean;
  testModeTrialChosenTier?: string;
  testModeTrialEndDate?: string;
  testModeBillingCycle?: BillingCycle;
  testModeRemaining?: number;
  testModeLimit?: number;
  // Copy todos specific data
  incompleteTodosCount?: number;
  incompleteTodosPercentage?: number;
  // TimeBlockEditor context: params to re-open the editor after dismissal
  returnParams?: Record<string, unknown>;
}

// Logger instance for this component (outside to avoid React Hook dependency issues)
const logger = Logger;

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const devotionalGating = useDevotionalGating();
  const { refreshSubscription: refreshNewSubscription } = useNewSubscription(user?.id || '');
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Lifecycle logging
  useEffect(() => {
    Logger.info('[OnboardingSalesOfferScreen] Component MOUNTED');
    return () => {
      Logger.info('[OnboardingSalesOfferScreen] Component UNMOUNTED');
    };
  }, []);

  // Always show light status bar (white icons) on this screen
  useScreenStatusBar('light', Colors.hopeWhite);

  // Haptic feedback helper
  const triggerSuccessHaptic = () => {
    try {
      // Use React Native haptics instead of Expo for bare RN projects
      const { RNHapticFeedback } = require('react-native-haptic-feedback');
      RNHapticFeedback.trigger('notificationSuccess', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
    } catch (error) {
      // Silently fail if haptics not available
    }
  };

  const [footerHeight, setFooterHeight] = useState(0);

  // Check if we're in upgrade mode (from devotional modal) or onboarding mode
  const routeParams = route.params as RouteParams | undefined;
  const isUpgradeMode = routeParams?.upgradeMode || false;

  const resetToUserInput = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'UserInput' as any }],
    });
  }, [navigation]);

  const navigateToNotificationSetup = useCallback((userType: 'paid' | 'freemium', extraParams?: Record<string, any>) => {
    (navigation as any).navigate('OnboardingNotificationSetup', {
      userType,
      ...extraParams,
    });
  }, [navigation]);

  const goBackOrFallback = useCallback((fallback: 'userInput' | 'notificationSetup' = 'userInput') => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    if (fallback === 'notificationSetup') {
      navigateToNotificationSetup('freemium', { fromCancelledSales: true });
      return;
    }

    resetToUserInput();
  }, [navigation, navigateToNotificationSetup, resetToUserInput]);

  const subscription = devotionalGating.subscription;
  const hasEverStartedTrial = Boolean(subscription?.trial_start_date);
  const isCurrentlyOnTrial = subscription?.tier === 'free_trial';

  // Test mode: override trial status if provided
  const testModeIsOnTrial = routeParams?.testModeIsOnTrial;
  const testModeHasStartedTrial = routeParams?.testModeHasStartedTrial ?? routeParams?.testModeHasEverStartedTrial;
  const testModeTrialEndDate = routeParams?.testModeTrialEndDate;
  const testModeTier = routeParams?.testModeTier;
  const routeIndicatesTrial = routeParams?.currentTier === 'free_trial' || routeParams?.tier === 'free_trial' || routeParams?.profileTrialViewPlans === true;

  const effectiveIsCurrentlyOnTrial = testModeIsOnTrial !== undefined ? testModeIsOnTrial : (isCurrentlyOnTrial || routeIndicatesTrial);
  const effectiveHasEverStartedTrial = testModeHasStartedTrial !== undefined ? testModeHasStartedTrial : hasEverStartedTrial;
  const effectiveTrialChosenTier = (routeParams?.testModeTrialChosenTier || routeParams?.currentTrialChosenTier || subscription?.trial_chosen_tier) as SubscriptionTier | undefined;
  const effectiveTrialPlanTier = normalizePaidPlanTier(effectiveTrialChosenTier);
  const effectiveTrialEndDate = testModeTrialEndDate || subscription?.trial_end_date;
  const effectiveCurrentTrialBillingCycle = routeParams?.currentTrialBillingCycle || routeParams?.testModeBillingCycle || (subscription as any)?.billing_cycle || 'monthly';
  const routeBillingCycle = routeParams?.selectedBillingCycle || routeParams?.billingCycle || routeParams?.currentTrialBillingCycle || routeParams?.testModeBillingCycle;
  const initialIsAnnual = routeParams?.forceTransformationAnnual || routeParams?.forceAnnualOnly || routeBillingCycle === 'annual';

  const [isAnnual, setIsAnnual] = useState(Boolean(initialIsAnnual));

  // Check if coming from profile to preselect current tier
  const isFromProfile = routeParams?.source === 'profile';

  const currentUserTier = isFromProfile ? (routeParams?.currentTier || routeParams?.tier || 'seeker') :
                              (routeParams?.currentTier || routeParams?.tier || devotionalGating.tier || 'seeker') as string;
  const trialUpgradeTier = getNextPaidPlanTier(effectiveTrialPlanTier);
  const initialSelectedTier = routeParams?.forceTransformationAnnual ? 'transformation' :
                              routeParams?.selectedTier ? normalizePaidPlanTier(routeParams.selectedTier) || routeParams.selectedTier :
                              routeParams?.forceAnnualOnly ? getNextPaidPlanTier(currentUserTier) :
                              isFromProfile && currentUserTier && currentUserTier !== 'seeker' ? normalizePaidPlanTier(currentUserTier) || currentUserTier :
                              routeParams?.profileTrialViewPlans && effectiveIsCurrentlyOnTrial ? trialUpgradeTier :
                              routeParams?.testModeTrialChosenTier ? normalizePaidPlanTier(routeParams.testModeTrialChosenTier) || routeParams.testModeTrialChosenTier :
                              routeParams?.requestedDuration === 7 ? 'transformation' :
                              routeParams?.requestedDuration ? 'growth' :
                              'growth';

  // Debug logging
  logger.debug('Sales offer screen debug', {
    isFromProfile,
    currentUserTier,
    initialSelectedTier,
    routeParams: route.params,
    requestedDuration: routeParams?.requestedDuration,
  });
  const [selectedTier, setSelectedTier] = useState(initialSelectedTier);
  const [hasManualTierSelection, setHasManualTierSelection] = useState(false);
  const selectedPlanTier = normalizePaidPlanTier(selectedTier) || selectedTier;

  useEffect(() => {
    if (!hasManualTierSelection && selectedPlanTier !== selectedTier) {
      setSelectedTier(selectedPlanTier);
    }
  }, [hasManualTierSelection, selectedPlanTier, selectedTier]);

  useEffect(() => {
    if (!hasManualTierSelection && selectedPlanTier !== initialSelectedTier) {
      setSelectedTier(initialSelectedTier);
    }
  }, [hasManualTierSelection, initialSelectedTier, selectedPlanTier]);

  // Helper function to get tier display name
  const getTierDisplayName = (tier: string): string => {
    const tierNames = {
      'seeker': 'Seeker',
      'free_trial': 'Trial',
      'spark': 'Spark',
      'growth': 'Growth',
      'transformation': 'Transformation',
      'transformation_annual': 'Transformation',
    } as Record<string, string>;
    return tierNames[tier] || tier;
  };
  const [_expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);

  const monthlyScale = useRef(new Animated.Value(1)).current;
  const annualScale = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const animateToggle = useCallback((toAnnual: boolean) => {
    if (toAnnual) {
      Animated.spring(monthlyScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      Animated.spring(annualScale, {
        toValue: 1.05,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.spring(annualScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      Animated.spring(monthlyScale, {
        toValue: 1.05,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [monthlyScale, annualScale]);

  useEffect(() => {
    animateToggle(isAnnual);
  }, [isAnnual, animateToggle]);

  useEffect(() => {
    setIsAnnual(Boolean(initialIsAnnual));
  }, [initialIsAnnual]);

  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);
  const [lastPurchasedTier, setLastPurchasedTier] = useState<string | null>(null);
  const requestedDuration = routeParams?.requestedDuration;
  const incompleteTodosCount = routeParams?.incompleteTodosCount || 0;
  const incompleteTodosPercentage = routeParams?.incompleteTodosPercentage || 0;

  const effectiveCurrentUserTier = (testModeTier || currentUserTier) as string;
  const effectiveIsSeekerTier = effectiveCurrentUserTier === 'seeker' || !effectiveCurrentUserTier;
  const guidedPromptsTier = routeParams?.tier || effectiveCurrentUserTier;
  const isProfileTrialViewPlans = Boolean(routeParams?.profileTrialViewPlans);
  const shouldUseTrialPlanSwitcher = isUpgradeMode && effectiveIsCurrentlyOnTrial && Boolean(effectiveTrialPlanTier);
  const isCurrentTransformationPlan = normalizePaidPlanTier(effectiveCurrentUserTier) === 'transformation'
    || effectiveTrialPlanTier === 'transformation'
    || Boolean(routeParams?.forceTransformationAnnual);
  const profileTrialTier = effectiveTrialPlanTier || normalizePaidPlanTier(effectiveTrialChosenTier) || 'spark';
  const profileTrialTierName = getTierDisplayName(profileTrialTier);

  const customProfileTrialTitle = 'View other plans';
  const customProfileTrialSubtitle = `You're currently on the ${profileTrialTierName} trial. You can continue with this trial or explore other plans.`;
  const customProfileTrialNote = 'Changing plans during your trial may start your new plan right away.';

  const fromPlanningLock = !isUpgradeMode && routeParams?.source === 'planning_lock' && routeParams?.feature === 'future_planning' && effectiveIsSeekerTier;
  const fromCopyTodosLock = !isUpgradeMode && routeParams?.source === 'copy_todos_lock' && routeParams?.feature === 'copy_todos';
  const fromGuidedPromptsLock = !isUpgradeMode && routeParams?.source === 'guided_prompts_lock' && routeParams?.feature === 'guided_prompts' && (guidedPromptsTier === 'seeker' || !guidedPromptsTier);
  const fromExportRestriction = !isUpgradeMode && (routeParams?.source === 'pdf_export_restriction' || routeParams?.source === 'docx_export_restriction') && (routeParams?.feature === 'export_pdf' || routeParams?.feature === 'export_docx');
  const fromRepeatOptionsLock = !isUpgradeMode && routeParams?.source === 'repeat_options';
  const fromRepeatUpgradePrompt = !isUpgradeMode && routeParams?.source === 'repeat_upgrade_prompt';
  const fromCalendarAutoSync = !isUpgradeMode && (routeParams?.source === 'calendar_auto_sync' || routeParams?.source === 'calendar_sync');

  const canOfferTrial = !effectiveIsCurrentlyOnTrial && !effectiveHasEverStartedTrial && effectiveIsSeekerTier;
  const shouldUseTrialProduct = canOfferTrial;

  // Detect if coming from devotional gating
  // Use explicit featureType if provided, otherwise fall back to requestedDuration logic
  const fromDevotionalGating = isUpgradeMode && (routeParams?.featureType === 'devotionals' || (!routeParams?.featureType && requestedDuration));

  // Generate dynamic sales copy for playbook/devotional gating
  const dynamicSalesCopy = React.useMemo(() => {
    if (!isUpgradeMode || isProfileTrialViewPlans) {return null;}

    // Use explicit featureType from route params if provided, otherwise infer from requestedDuration
    const rawFeatureType = routeParams?.featureType || (fromDevotionalGating ? 'devotionals' : 'playbooks');
    const featureType = rawFeatureType === 'wisdom' ? 'wisdom' : rawFeatureType === 'devotionals' ? 'devotionals' : 'playbooks';

    // Test mode: use override values from route params if provided
    const testModeRemaining = routeParams?.testModeRemaining;
    const testModeLimit = routeParams?.testModeLimit;
    const testModeHasEverStartedTrial = routeParams?.testModeHasEverStartedTrial;

    // Compute remaining counts so we can distinguish "no remaining" vs "duration locked"
    const playbooksUsed = subscription?.playbooks_used || 0;
    const devotionalsUsed = subscription?.devotionals_used || 0;
    const wisdomUsed = (subscription as any)?.wisdom_count || 0;
    const playbooksLimit = subscription?.playbooks_limit || 0;
    const devotionalsLimit = subscription?.devotionals_limit || 0;
    const wisdomLimit = (subscription as any)?.wisdom_limit || 0;

    const remainingPlaybooks = playbooksLimit === -1 ? -1 : Math.max(0, playbooksLimit - playbooksUsed);
    const remainingDevotionals = devotionalsLimit === -1 ? -1 : Math.max(0, devotionalsLimit - devotionalsUsed);
    const remainingWisdom = wisdomLimit === -1 ? -1 : Math.max(0, wisdomLimit - wisdomUsed);

    const remaining = testModeRemaining !== undefined
      ? testModeRemaining
      : (featureType === 'wisdom'
        ? (remainingWisdom === -1 ? wisdomLimit : remainingWisdom)
        : featureType === 'playbooks'
          ? (remainingPlaybooks === -1 ? playbooksLimit : remainingPlaybooks)
          : (remainingDevotionals === -1 ? devotionalsLimit : remainingDevotionals));

    const limit = testModeLimit !== undefined
      ? testModeLimit
      : (featureType === 'wisdom' ? wisdomLimit : featureType === 'playbooks' ? playbooksLimit : devotionalsLimit);

    return generateSalesCopy({
      featureType,
      currentTier: effectiveCurrentUserTier as SubscriptionTier,
      remaining,
      limit,
      isOnTrial: effectiveIsCurrentlyOnTrial,
      trialChosenTier: effectiveTrialChosenTier,
      trialEndDate: effectiveTrialEndDate,
      subscriptionStartDate: subscription?.subscription_start_date,
      requestedDuration,
      hasEverStartedTrial: testModeHasEverStartedTrial !== undefined ? testModeHasEverStartedTrial : effectiveHasEverStartedTrial,
    });
  }, [isUpgradeMode, isProfileTrialViewPlans, subscription, effectiveCurrentUserTier, requestedDuration, fromDevotionalGating, routeParams?.featureType, routeParams?.testModeRemaining, routeParams?.testModeLimit, routeParams?.testModeHasEverStartedTrial, effectiveIsCurrentlyOnTrial, effectiveHasEverStartedTrial, effectiveTrialChosenTier, effectiveTrialEndDate]);

  const selectedBillingCycle = isAnnual ? 'annual' : 'monthly';
  const currentPaidPlanTier = normalizePaidPlanTier(effectiveCurrentUserTier);
  const currentPaidBillingCycle = normalizeBillingCycle(
    effectiveCurrentUserTier?.includes('_annual') || routeParams?.forceAnnualOnly
      ? 'annual'
      : routeParams?.testModeBillingCycle || (subscription as any)?.billing_cycle
  );
  const currentComparableTier = effectiveIsCurrentlyOnTrial ? effectiveTrialPlanTier : currentPaidPlanTier;
  const currentComparableBillingCycle = effectiveIsCurrentlyOnTrial
    ? normalizeBillingCycle(effectiveCurrentTrialBillingCycle)
    : currentPaidBillingCycle;
  const currentComparableRank = getPaidPlanRank(currentComparableTier);
  const selectedComparableRank = getPaidPlanRank(selectedPlanTier);
  const hasComparableCurrentPlan = Boolean(currentComparableTier) && currentComparableRank >= 0;
  const isCurrentSelection = hasComparableCurrentPlan
    && currentComparableTier === selectedPlanTier
    && currentComparableBillingCycle === selectedBillingCycle;
  const isHigherTierSelection = hasComparableCurrentPlan
    ? selectedComparableRank > currentComparableRank
    : selectedComparableRank >= 0;
  const shouldDisableUnlockButton = isCurrentSelection && !dynamicSalesCopy?.closeOnPrimaryCta;

  // Debug trial eligibility
  logger.debug('Trial eligibility debug', {
    subscription,
    hasEverStartedTrial,
    isCurrentlyOnTrial,
    canOfferTrial,
    onboardingFlow: routeParams?.onboardingFlow,
    isUpgradeMode,
    skipNotificationPreference: routeParams?.skipNotificationPreference,
  });

  // Safety check: Wait for user to load on hot reload instead of redirecting
  // Redirecting causes black screen during hot reload
  useEffect(() => {
    if (!user?.id) {
      logger.warn('No user found, waiting for auth to load...');
      // Don't redirect - just wait for auth context to initialize
      return;
    }
    logger.debug('User loaded', { userId: user.id });
  }, [user?.id]);

  // Load location-adjusted pricing and currency
  const handleSuccessModalContinue = React.useCallback(() => {
    logger.info('Success modal continue button pressed');
    setShowSuccessModal(false);
    setLastPurchasedTier(null);

    // Re-enable faith points notifications after modal is hidden
    notificationService.suppressPointsNotifications(false);

    setTimeout(() => {
      if (routeParams?.onboardingFlow) {
        logger.debug('Navigating to notification setup for onboarding flow');
        navigateToNotificationSetup('paid');
      } else if (routeParams?.source === 'profile_upgrade') {
        resetToUserInput();
      } else if (routeParams?.dismissBehavior === 'goBack' || routeParams?.source === 'wisdom_limit') {
        goBackOrFallback('userInput');
      } else {
        // The purchase success modal CTA is the intentional "Process another moment" path.
        resetToUserInput();
      }
    }, 100);
  }, [goBackOrFallback, navigateToNotificationSetup, resetToUserInput, routeParams]);

  // Pre-fetch available products on mount to avoid delays during purchase
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const paymentService = PlatformPaymentService.getInstance();
        await paymentService.initialize();
        const products = await paymentService.getAvailableProducts();
        if (isMounted) {
          setCachedProducts(products);
          logger.debug('✅ Products pre-cached', { count: products.length });
        }
      } catch (error) {
        logger.error('Failed to pre-cache products', error as Error);
      }
    };
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadPricing = async () => {
      try {
        let tiers: PricingTier[];

        if (isUpgradeMode) {
          // In upgrade mode, only show tiers higher than current user tier
          // However, if isCurrentTier is set (paid user hit limits), show all tiers to include current tier
          // Trial plan browsing also starts from all tiers so we can show the current trial tier
          // after "See All Plans" is opened while still preselecting the next upgrade.
          if (dynamicSalesCopy?.isCurrentTier || shouldUseTrialPlanSwitcher) {
            logger.debug('Loading all tiers for current/trial tier display', {
              currentUserTier,
              effectiveCurrentUserTier,
              isCurrentTier: dynamicSalesCopy?.isCurrentTier,
              shouldUseTrialPlanSwitcher,
            });
            tiers = await pricingService.getLocationAdjustedPricing();
            logger.debug('All tiers loaded for current/trial tier display', { count: tiers.length });
          } else {
            const upgradeTier = normalizePaidPlanTier(effectiveCurrentUserTier) || effectiveCurrentUserTier;
            logger.debug('Loading upgrade tiers for', { currentUserTier, effectiveCurrentUserTier, upgradeTier });
            tiers = await pricingService.getLocationAdjustedUpgradeTiers(upgradeTier);
            logger.debug('Upgrade tiers loaded', { count: tiers.length, tiers: tiers.map(t => t.id) });
          }
        } else {
          // In onboarding mode, show all tiers
          tiers = await pricingService.getLocationAdjustedPricing();
          logger.debug('All tiers loaded', { count: tiers.length });
        }

        if (tiers.length === 0 && routeParams?.source === 'wisdom_limit') {
          const allTiers = await pricingService.getLocationAdjustedPricing();
          const fallbackTier = dynamicSalesCopy?.recommendedTier || 'growth';
          tiers = allTiers.filter(t => t.id === fallbackTier);
          if (tiers.length === 0) {
            tiers = allTiers.filter(t => t.id === 'growth' || t.id === 'transformation');
          }
          logger.debug('Wisdom limit fallback tiers loaded', {
            fallbackTier,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to only show selected tier in onboarding flow when collapsed (unless showAllPlans is true)
        if (routeParams?.onboardingFlow && !showAllPlans) {
          tiers = tiers.filter(t => t.id === selectedPlanTier);
          logger.debug('Filtered to show selected tier when collapsed in onboarding flow', {
            selectedTier: selectedPlanTier,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to only show selected tier in non-onboarding flow when collapsed (unless showAllPlans is true)
        if (!routeParams?.onboardingFlow && !showAllPlans && !isUpgradeMode) {
          tiers = tiers.filter(t => t.id === selectedPlanTier);
          logger.debug('Filtered to show selected tier when collapsed in non-onboarding flow', {
            selectedTier: selectedPlanTier,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter tiers based on current trial tier to prevent downgrades.
        // Keep the current trial tier available when the user expands all plans.
        if (shouldUseTrialPlanSwitcher && effectiveTrialPlanTier) {
          const trialIndex = PAID_PLAN_ORDER.indexOf(effectiveTrialPlanTier);
          tiers = tiers.filter(t => {
            const tierIndex = PAID_PLAN_ORDER.indexOf(t.id as PaidPlanTier);
            return tierIndex >= trialIndex;
          });
          logger.debug('Filtered tiers for trial plan browsing', {
            trialTier: effectiveTrialPlanTier,
            trialIndex,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to only show selected tier for Seeker/trial users in upgrade mode when collapsed (unless showAllPlans is true)
        if (isUpgradeMode && (effectiveIsSeekerTier || shouldUseTrialPlanSwitcher) && !showAllPlans) {
          tiers = tiers.filter(t => t.id === selectedPlanTier);
          logger.debug('Filtered to show selected tier when collapsed in upgrade mode', {
            selectedTier: selectedPlanTier,
            effectiveIsSeekerTier,
            shouldUseTrialPlanSwitcher,
            remainingTiers: tiers.map(t => t.id),
          });
        }


        // Filter to only show Transformation annual when forced (unless showAllPlans is true)
        if (routeParams?.forceTransformationAnnual && !showAllPlans) {
          tiers = tiers.filter(t => t.id === 'transformation');
          logger.debug('Filtered to only show Transformation annual', {
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to show only annual plans at or above current tier when forced (unless showAllPlans is true)
        if (routeParams?.forceAnnualOnly && currentUserTier && currentUserTier !== 'seeker') {
          const baseTier = normalizePaidPlanTier(currentUserTier);
          const currentTierIndex = baseTier ? PAID_PLAN_ORDER.indexOf(baseTier) : -1;

          // Show current tier and higher tiers (allow upgrades, prevent downgrades)
          tiers = tiers.filter(t => {
            const tierIndex = PAID_PLAN_ORDER.indexOf(t.id as PaidPlanTier);
            return tierIndex >= currentTierIndex;
          });

          logger.debug('Filtered to show annual plans at or above current tier', {
            currentUserTier,
            baseTier,
            currentTierIndex,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        if (tiers.length === 0 && routeParams?.source === 'wisdom_limit') {
          const allTiers = await pricingService.getLocationAdjustedPricing();
          const fallbackTier = dynamicSalesCopy?.recommendedTier || selectedPlanTier || 'growth';
          tiers = allTiers.filter(t => t.id === fallbackTier);
          if (tiers.length === 0) {
            tiers = allTiers.filter(t => t.id === 'growth');
          }
          logger.debug('Wisdom limit post-filter fallback tiers loaded', {
            fallbackTier,
            selectedPlanTier,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        const currency = await pricingService.getCurrencyInfo();
        logger.debug('Currency info loaded', { currency });
        logger.debug('Sample tier prices', tiers[0] ? {
          tier: tiers[0].id,
          monthly: tiers[0].monthlyPrice,
          annual: tiers[0].annualPrice,
          symbol: currency.symbol,
        } : { status: 'No tiers' });

        // Keep all tiers visible; selection logic will prefer an appropriate tier based on requestedDuration

        if (isMounted) {
          setPricingTiers(tiers);
          setCurrencyInfo(currency);

          // Default selection:
          // - If coming from profile with paid tier, select current tier
          // - If user requested a 7-day devotional, prefer 'transformation' tier, then any tier that unlocks the request
          // - Else prefer POPULAR, then 'growth', then first available
          if (!hasManualTierSelection && tiers.length > 0) {
            let chosen: PricingTier | undefined;

            if (routeParams?.selectedTier) {
              const routeSelectedTier = normalizePaidPlanTier(routeParams.selectedTier) || routeParams.selectedTier;
              chosen = tiers.find(t => t.id === routeSelectedTier);
              logger.debug('Route selected tier - selecting explicitly requested tier', { selectedTier: routeSelectedTier, found: chosen?.id });
            }

            if (!chosen && shouldUseTrialPlanSwitcher) {
              chosen = tiers.find(t => t.id === trialUpgradeTier);
              logger.debug('Trial plan browsing - selecting next upgrade tier', {
                currentTrialTier: effectiveTrialPlanTier,
                trialUpgradeTier,
                found: chosen?.id,
              });
            }

            // If coming from profile with paid tier, select current tier
            if (isFromProfile && currentUserTier && currentUserTier !== 'seeker') {
              chosen = tiers.find(t => t.id === currentUserTier);
              logger.debug('Profile mode - selecting current tier', { currentUserTier, found: chosen?.id });
            }

            if (!chosen && requestedDuration === 7) {
              chosen = tiers.find(t => t.id === 'transformation')
                || tiers.find(t => !isDevotionalDurationLocked(t.id as SubscriptionTier, requestedDuration))
                || tiers[0];
            }
            if (!chosen) {
              const popularTier = tiers.find(t => (t as any).isPopular === true);
              const growthTier = tiers.find(t => t.id === 'growth');
              chosen = popularTier || growthTier || tiers[0];
            }
            setSelectedTier(chosen.id);
          }
        }
      } catch (e) {
        Logger.error('Failed to load pricing', e as Error, { component: 'OnboardingSalesOfferScreen' });
      }
    };

    loadPricing();
    return () => {
      isMounted = false;
    };
  }, [hasManualTierSelection, isUpgradeMode, currentUserTier, effectiveCurrentUserTier, effectiveIsSeekerTier, effectiveTrialPlanTier, requestedDuration, isFromProfile, route.params, routeParams?.onboardingFlow, routeParams?.selectedTier, routeParams?.forceAnnualOnly, routeParams?.forceTransformationAnnual, showAllPlans, selectedPlanTier, dynamicSalesCopy?.isCurrentTier, dynamicSalesCopy?.recommendedTier, shouldUseTrialPlanSwitcher, trialUpgradeTier]);

  // Cleanup navigation guard on unmount
  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Ensure 7-day requests always highlight Transformation when tiers already cached
  useEffect(() => {
    if (!hasManualTierSelection && requestedDuration === 7 && pricingTiers.length > 0) {
      const transformationTier = pricingTiers.find(t => t.id === 'transformation');
      const fallbackTier = pricingTiers.find(t => !isDevotionalDurationLocked(t.id as SubscriptionTier, requestedDuration));
      const target = transformationTier || fallbackTier;
      if (target && selectedTier !== target.id) {
        setSelectedTier(target.id);
      }
    }
  }, [hasManualTierSelection, requestedDuration, pricingTiers, selectedTier, setSelectedTier]);

  // Preselect recommended tier for paid users who hit limits
  useEffect(() => {
    if (!hasManualTierSelection && dynamicSalesCopy?.recommendedTier && isUpgradeMode && !shouldUseTrialPlanSwitcher) {
      const recommendedTier = dynamicSalesCopy.recommendedTier;
      const tierExists = pricingTiers.find(t => t.id === recommendedTier);
      if (tierExists && selectedTier !== recommendedTier) {
        setSelectedTier(recommendedTier);
      }
    }
  }, [hasManualTierSelection, dynamicSalesCopy?.recommendedTier, isUpgradeMode, pricingTiers, selectedTier, shouldUseTrialPlanSwitcher]);

  // Auto-collapse all expanded feature sections when billing period changes
  useEffect(() => {
    setExpandedCards(new Set());
  }, [isAnnual]);


  const handleClose = async () => {
    try { triggerLightHaptic(); } catch {}

    logger.info('Sales offer cancelled - navigating based on context');
    logger.debug('Sales offer cancel debug state', {
      routeParams,
      isUpgradeMode,
      currentUserTier,
      requestedDuration,
      selectedTier,
      subscriptionTier: subscription?.tier,
    });

    // Reset subscription to seeker only when an unpaid seeker cancels the onboarding sales offer.
    // Do not mark a just-purchased trial/paid Apple subscription as cancelled on modal close.
    if (!isUpgradeMode && user?.id) {
      try {
        const currentSubscription = await NewSubscriptionService.getUserSubscription(user.id, true);
        const canCancelAsSeeker =
          currentSubscription?.tier === 'seeker' &&
          !currentSubscription?.platform_subscription_id &&
          !currentSubscription?.trial_start_date;

        if (canCancelAsSeeker) {
          logger.debug('Keeping cancelled onboarding sales offer on seeker plan');
        } else {
          logger.debug('Skipping seeker reset because user already has subscription state', {
            tier: currentSubscription?.tier,
            hasPlatformSubscriptionId: !!currentSubscription?.platform_subscription_id,
            hasTrialStartDate: !!currentSubscription?.trial_start_date,
          });
        }

        // Reset UI state immediately to prevent any race conditions
        // Preserve the user's initial selection or manual selection instead of forcing spark
        setSelectedTier(hasManualTierSelection ? selectedTier : initialSelectedTier);
        logger.debug('Reset UI selectedTier to preserved selection:', { tier: hasManualTierSelection ? selectedTier : initialSelectedTier });

        // Suppress faith points notifications temporarily to prevent duplicates
        notificationService.suppressPointsNotifications(true);
        logger.debug('Suppressed faith points notifications to prevent duplicates');

        setTimeout(() => {
          notificationService.suppressPointsNotifications(false);
        }, 3000);
      } catch (error) {
        logger.error('Failed to reset subscription to seeker:', error as Error);
        // Continue to navigation even if reset fails
      }
    }

    // Default navigation based on context
    logger.info('Dismissing sales offer based on origin context');
    setTimeout(() => {
      if (routeParams?.dismissBehavior === 'userInput') {
        resetToUserInput();
        return;
      }

      if (routeParams?.dismissBehavior === 'notificationSetup') {
        navigateToNotificationSetup('freemium', { fromCancelledSales: true });
        return;
      }

      if (routeParams?.dismissBehavior === 'goBack') {
        goBackOrFallback('userInput');
        return;
      }

      if (routeParams?.context === 'timeblock' && routeParams?.returnParams) {
        navigation.goBack();
        setTimeout(() => {
          notificationDeepLinkService.navigateTo('TimeBlockEditorModal', routeParams.returnParams);
        }, 700);
        return;
      }

      if (routeParams?.onboardingFlow) {
        // During onboarding flow, go to notification setup
        logger.debug('Onboarding flow - navigating to notification setup');
        navigateToNotificationSetup('freemium', { fromCancelledSales: true });
        return;
      }

      goBackOrFallback('userInput');
    }, 100);
  };

  const handleRestorePurchase = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to restore purchases');
      return;
    }

    try {
      triggerLightHaptic();
    } catch {}

    Alert.alert(
      'Restore Purchases',
      'This will restore any previous purchases made with this Apple ID.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              Alert.alert('Restoring...', 'Please wait while we restore your purchases.');

              const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
              const storeKit = AppleStoreKitService.getInstance();

              const result = await storeKit.restorePurchases(user.id);

              if (result.success) {
                await refreshNewSubscription();

                // Auto-dismiss loading alert and show success
                setTimeout(() => {
                  Alert.alert('Success', result.message, [{ text: 'OK' }]);
                }, 100);
              } else {
                Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
              }
            } catch (error) {
              Logger.error('Restore purchases error', error as Error, {
                component: 'OnboardingSalesOfferScreen',
              });
              Alert.alert(
                'Restore Failed',
                'Unable to restore purchases. Please try again later or contact support.',
                [{ text: 'OK' }],
              );
            }
          },
        },
      ],
    );
  };

  const handleTermsOfService = () => {
    try {
      triggerLightHaptic();
      logger.info('Terms of Service requested');
      // Match Terms of Service URL used in UserProfileScreen
      Linking.openURL('https://sifia.app/legal/terms');
    } catch (error) {
      logger.error('Error opening terms of service', error as Error);
    }
  };

  const handleUnlockPlan = async () => {
    logger.info('🚀 FUNCTION CALLED: handleUnlockPlan started', {
      isPurchasing,
      isUpgradeMode,
      selectedTier,
      isAnnual,
      timestamp: new Date().toISOString(),
    });

    // Prevent multiple simultaneous purchases
    if (isPurchasing) {
      logger.debug('Purchase already in progress, ignoring');
      return;
    }

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      logger.error('⚠️ Purchase timeout - resetting state');
      setIsPurchasing(false);
      setLoadingStep('processing');
      Alert.alert('Timeout', 'Purchase took too long. Please try again.');
    }, 30000); // 30 second timeout

    try {
      triggerLightHaptic();
      const purchaseTier = selectedPlanTier;
      setIsPurchasing(true);
      setShowSuccessModal(false);
      setPurchaseValidated(false);
      setLoadingStep('processing');

      logger.debug('handleUnlockPlan called', {
        isUpgradeMode,
        selectedTier,
        isAnnual,
        price: getCurrentPrice(),
      });

      // Get payment service instance (already imported at top)
      const paymentService = PlatformPaymentService.getInstance();

      // Determine product ID based on billing period (always uses .freetrial SKUs)
      let productId: string;
      const billing = isAnnual ? 'annual' : 'monthly';

      logger.debug('Product ID selection:', {
        selectedTier,
        billing,
        canOfferTrial,
        isUpgradeMode,
        hasEverStartedTrial,
      });

      // Use cached products if available, otherwise fetch
      logger.info('📦 STEP A: Getting available products', {
        cachedCount: cachedProducts.length,
        willFetch: cachedProducts.length === 0,
        timestamp: new Date().toISOString(),
      });

      let products;
      try {
        // CRITICAL: Initialize payment service before getting products
        if (cachedProducts.length === 0) {
          logger.info('🔧 STEP A.1: Initializing payment service', {
            timestamp: new Date().toISOString(),
          });
          await paymentService.initialize();
          logger.info('✅ STEP A.2: Payment service initialized', {
            timestamp: new Date().toISOString(),
          });
        }

        products = cachedProducts.length > 0 ? cachedProducts : await paymentService.getAvailableProducts(true);

        logger.info('📦 STEP B: Products retrieved successfully', {
          count: products.length,
          cached: cachedProducts.length > 0,
          timestamp: new Date().toISOString(),
        });
      } catch (productError) {
        logger.error('❌ STEP B: Failed to get products', productError as Error, {
          cachedCount: cachedProducts.length,
          timestamp: new Date().toISOString(),
        });
        throw new Error('Failed to load products. Please try again.');
      }

      // DEBUG: Log all available products to verify App Store Connect configuration
      logger.debug('📦 Using products for purchase:', {
        count: products.length,
        cached: cachedProducts.length > 0,
        products: products.map(p => ({
          id: p.productId,
          tier: p.tier,
          price: p.localizedPrice,
        })),
      });

      // CRITICAL: Always use .freetrial products (only product type in App Store Connect)
      // App Store enforces trial eligibility - users already on trial will be charged
      // validate-receipt will detect upgrade vs new trial based on user's current tier
      let trialProduct = products.find(p =>
        p.tier === selectedPlanTier &&
        p.productId.includes(billing) &&
        p.productId.includes('.freetrial')
      );

      if (!trialProduct) {
        logger.warn('⚠️ Selected product missing from cached list; forcing fresh App Store product fetch', {
          selectedTier: selectedPlanTier,
          billing,
          productCount: products.length,
        });

        const refreshedProducts = await paymentService.getAvailableProducts(true);
        if (refreshedProducts.length > 0) {
          products = refreshedProducts;
          trialProduct = products.find(p =>
            p.tier === selectedPlanTier &&
            p.productId.includes(billing) &&
            p.productId.includes('.freetrial')
          );
        }
      }

      if (trialProduct) {
        productId = trialProduct.productId;
        logger.debug('✅ Using .freetrial product', {
          productId,
          shouldUseTrialProduct,
          userTier: subscription?.tier,
          isUpgrade: subscription?.tier === 'free_trial' && !shouldUseTrialProduct,
        });
      } else {
        const expectedProductId = `app.sifia.com.${selectedPlanTier}.${billing}.freetrial`;
        logger.error('❌ App Store product unavailable; aborting before native purchase request', new Error('Product unavailable'), {
          component: 'OnboardingSalesOfferScreen',
          expectedProductId,
          selectedTier: selectedPlanTier,
          billing,
          availableProductIds: products.map(p => p.productId),
        });
        throw new Error('This subscription is not available from Apple yet. Please try again in a moment.');
      }

      if (isUpgradeMode) {
        // In upgrade mode, purchase and show success modal before going back

        try {
          logger.info('🛒 SCREEN STEP 1: Initiating purchase', {
            productId,
            userId: user?.id,
            selectedTier,
            billing,
            timestamp: new Date().toISOString(),
          });

          if (Platform.OS === 'ios') {
            try {
              const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
              const storeKit = AppleStoreKitService.getInstance();
              storeKit.setPurchaseEligibility(shouldUseTrialProduct);
            } catch (error) {
              logger.warn('Failed to set purchase eligibility before iOS purchase', { error: error as Error });
            }
          }

          const result = await paymentService.purchaseSubscription(productId, user?.id || '');

          logger.info('📦 SCREEN STEP 2: Purchase result received from service', {
            success: result.success,
            hasTransactionId: !!result.transactionId,
            transactionId: result.transactionId?.substring(0, 10) + '...',
            error: result.error ? { message: result.error, name: 'PurchaseError' } : undefined,
            timestamp: new Date().toISOString(),
          });

          if (result.success) {
            setLoadingStep('validating');
            triggerSuccessHaptic();

            // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
            if (!result.transactionId) {
              logger.error('❌ Upgrade missing transaction ID - possible stale state');
              throw new Error('Invalid purchase - no transaction ID');
            }

            logger.debug('Upgrade transaction verification:', {
              timestamp: new Date().toISOString(),
            });

            // PHASE 3A: Create trial if user is trial-eligible (UPGRADE MODE)
            if (shouldUseTrialProduct && result.transactionId) {
              logger.info('🎯 Creating free trial subscription (UPGRADE MODE)', {
                userId: user?.id,
                chosenTier: selectedPlanTier,
                transactionId: result.transactionId,
                billingCycle: isAnnual ? 'annual' : 'monthly',
              });

              await NewSubscriptionService.startFreeTrial({
                user_id: user?.id || '',
                duration_days: 3,
                trial_chosen_tier: selectedPlanTier as SubscriptionTier,
                billing_cycle: isAnnual ? 'annual' : 'monthly',
                platform_transaction_id: result.transactionId,
                original_transaction_id: result.transactionId,
                platform_subscription_id: result.transactionId,
              });

              logger.info('✅ Trial created successfully (UPGRADE MODE)', {
                tier: 'free_trial',
                chosenTier: selectedPlanTier,
              });
            }

            // Verify the subscription was updated by checking the database
            logger.info('🔄 SCREEN STEP 5: Verifying subscription update in database (UPGRADE MODE)', {
              userId: user?.id,
              selectedTier,
              isAnnual,
              timestamp: new Date().toISOString(),
            });

            // Retry logic to handle race conditions with database updates
            const expectedTier = shouldUseTrialProduct
              ? 'free_trial'
              : isAnnual ? `${selectedPlanTier}_annual` : selectedPlanTier;

            let updatedSubscription;
            let retryCount = 0;
            const maxRetries = 10;

            while (retryCount < maxRetries) {
              // Force fresh read from database, bypassing any cache
              updatedSubscription = await NewSubscriptionService.getUserSubscription(user?.id || '', true);

              if (updatedSubscription?.tier === expectedTier) {
                break; // Success!
              }

              retryCount++;
              if (retryCount < maxRetries) {
                logger.info(`⏳ Subscription not yet updated, retrying (${retryCount}/${maxRetries})...`, {
                  expectedTier,
                  actualTier: updatedSubscription?.tier,
                  updatedAt: updatedSubscription?.updated_at,
                });
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
              }
            }

            // Final verification
            if (!updatedSubscription || updatedSubscription.tier !== expectedTier) {
              Logger.error('❌ Subscription not updated after purchase', new Error('Subscription update failed'), {
                component: 'OnboardingSalesOfferScreen',
                expectedTier,
                actualTier: updatedSubscription?.tier,
                userId: user?.id,
                shouldUseTrialProduct,
                isAnnual,
                retries: retryCount,
              });
              throw new Error('Subscription update failed. Please contact support.');
            }

            logger.info('✅ Subscription verified in database (UPGRADE MODE)', {
              tier: updatedSubscription.tier,
              status: updatedSubscription.status,
              isTrial: shouldUseTrialProduct,
              isAnnual,
            });

            logger.info('✅ Database upgrade completed, starting cache refresh');

            updatedSubscription = await NewSubscriptionService.resetUsageCounters(user?.id || '');
            DeviceEventEmitter.emit('wisdomUsageReset', {
              wisdomCount: 0,
              wisdomLimit: updatedSubscription.wisdom_limit,
              tier: updatedSubscription.tier,
            });

            // CRITICAL: Force immediate cache refresh for subscription queries
            queryClient.invalidateQueries({
              queryKey: ['subscription'],
              refetchType: 'all',
            });

            // OPTIMIZED: Parallel refresh of all subscription-related data
            await Promise.all([
              devotionalGating.refreshSubscription(),
              refreshNewSubscription().catch(() => {}),
            ]);

            logger.info('✅ Cache refresh completed, preparing success modal');

            // Show success modal immediately after validation
            setLoadingStep('completing');
            setPurchaseValidated(true);
            setLastPurchasedTier(purchaseTier);
            setIsPurchasing(false); // Hide loading modal
            await new Promise(resolve => setTimeout(resolve, 200)); // Minimal wait for loading modal to hide

            logger.info('🎉 Showing success modal for upgrade', {
              purchaseTier,
              source: routeParams?.source,
              dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
            });

            setShowSuccessModal(true);

            // Success modal will stay visible until user clicks continue button
            // This gives users time to read the success message
          } else {
            throw new Error(result.error || 'Purchase failed');
          }
        } catch (purchaseError: any) {
          logger.error('Upgrade purchase failed:', purchaseError);

          // Check if user cancelled
          const isCancelled =
            purchaseError?.message === 'USER_CANCELLED' ||
            purchaseError?.code === 'USER_CANCELLED' ||
            purchaseError?.message?.toLowerCase().includes('cancel') ||
            purchaseError?.message?.toLowerCase().includes('timeout');

          if (isCancelled) {
            logger.debug('User cancelled upgrade - silently continuing');
            setIsPurchasing(false);
            setLoadingStep('processing');
            return;
          }

          // Check if it's a database update error (purchase succeeded but DB failed)
          const isDatabaseError =
            purchaseError?.code === 'DATABASE_UPDATE_FAILED' ||
            purchaseError?.message?.includes('database update failed');

          if (isDatabaseError) {
            logger.error('Database update error - showing user-friendly message', purchaseError);
            Alert.alert(
              'Purchase Successful',
              'Your payment was processed successfully, but we had trouble updating your account. Please restart the app to access your subscription. If the issue persists, please contact support.',
              [{ text: 'OK', onPress: () => setIsPurchasing(false) }]
            );
            return;
          }

          // For other errors, show a clear reason instead of making the tap look dead.
          logger.error('Purchase error (silent):', purchaseError?.message || 'Unknown error');
          Alert.alert(
            'Purchase Unavailable',
            purchaseError?.message || 'Apple could not start the purchase. Please try again in a moment.'
          );
          setIsPurchasing(false);
          setLoadingStep('processing');
        }
      } else {
        // In onboarding mode, use StoreKit to purchase subscription
        // This matches production behavior - Apple handles the payment UI

        logger.debug('Onboarding mode - initiating StoreKit purchase', {
          selectedTier,
          isAnnual,
          price: getCurrentPrice(),
          productId,
        });

        try {
          // Show Apple's payment sheet and process purchase
          logger.debug('Calling purchaseSubscription', {});
          if (Platform.OS === 'ios') {
            try {
              const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
              const storeKit = AppleStoreKitService.getInstance();
              storeKit.setPurchaseEligibility(shouldUseTrialProduct);
            } catch (error) {
              logger.warn('Failed to set purchase eligibility before iOS purchase', { error: error as Error });
            }
          }
          const result = await paymentService.purchaseSubscription(productId, user?.id || '');

          logger.debug('Purchase result', {
            success: result.success,
            error: result.error ? { message: result.error, name: 'PurchaseError' } : undefined,
            hasResult: !!result,
          });

          if (result.success) {
            setLoadingStep('validating');
            logger.info('✅ Purchase successful!');
            triggerSuccessHaptic();

            // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
            if (!result.transactionId) {
              logger.error('❌ Purchase missing transaction ID - possible stale state');
              throw new Error('Invalid purchase - no transaction ID');
            }

            logger.debug('Transaction verification', {
              hasTransactionId: !!result.transactionId,
              transactionId: result.transactionId?.substring(0, 10) + '...',
            });

            // CRITICAL: Wait for AppleStoreKitService to complete server-side validation
            // The service already handles server validation in handlePurchaseUpdate
            logger.info('⏳ Waiting for AppleStoreKitService to complete validation', {
              userId: user?.id,
              selectedTier,
              transactionId: result.transactionId?.substring(0, 10) + '...',
            });

            // Give the service a moment to complete validation
            await new Promise(resolve => setTimeout(resolve, 2000));

            // PHASE 3B: Create trial if user is trial-eligible (ONBOARDING MODE)
            if (shouldUseTrialProduct && result.transactionId) {
              logger.info('🎯 Creating free trial subscription (ONBOARDING MODE)', {
                userId: user?.id,
                chosenTier: selectedPlanTier,
                transactionId: result.transactionId,
                billingCycle: isAnnual ? 'annual' : 'monthly',
              });

              await NewSubscriptionService.startFreeTrial({
                user_id: user?.id || '',
                duration_days: 3,
                trial_chosen_tier: selectedPlanTier as SubscriptionTier,
                billing_cycle: isAnnual ? 'annual' : 'monthly',
                platform_transaction_id: result.transactionId,
                original_transaction_id: result.transactionId,
                platform_subscription_id: result.transactionId,
              });

              logger.info('✅ Trial created successfully (ONBOARDING MODE)', {
                tier: 'free_trial',
                chosenTier: selectedPlanTier,
              });
            }

            // Verify the subscription was updated by checking the database
            logger.info('🔄 Verifying subscription update in database', {
              userId: user?.id,
              selectedTier,
              isAnnual,
            });

            // Retry logic to handle race conditions with database updates
            const expectedTier = shouldUseTrialProduct
              ? 'free_trial'
              : isAnnual ? `${selectedPlanTier}_annual` : selectedPlanTier;

            let updatedSubscription;
            let retryCount = 0;
            const maxRetries = 10;

            while (retryCount < maxRetries) {
              // Force fresh read from database, bypassing any cache
              updatedSubscription = await NewSubscriptionService.getUserSubscription(user?.id || '', true);

              if (updatedSubscription?.tier === expectedTier) {
                break; // Success!
              }

              retryCount++;
              if (retryCount < maxRetries) {
                logger.info(`⏳ Subscription not yet updated, retrying (${retryCount}/${maxRetries})...`, {
                  expectedTier,
                  actualTier: updatedSubscription?.tier,
                  updatedAt: updatedSubscription?.updated_at,
                });
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
              }
            }

            // Final verification
            if (!updatedSubscription || updatedSubscription.tier !== expectedTier) {
              Logger.error('❌ Subscription not updated after purchase', new Error('Subscription update failed'), {
                component: 'OnboardingSalesOfferScreen',
                expectedTier,
                actualTier: updatedSubscription?.tier,
                userId: user?.id,
                shouldUseTrialProduct,
                isAnnual,
                retries: retryCount,
              });
              throw new Error('Subscription update failed. Please contact support.');
            }

            logger.info('✅ Subscription verified in database (ONBOARDING MODE)', {
              tier: updatedSubscription.tier,
              status: updatedSubscription.status,
              isTrial: shouldUseTrialProduct,
              isAnnual,
            });

            // OPTIMIZED: Single cache invalidation with parallel refresh
            logger.debug('Refreshing subscription cache...');
            try {
              updatedSubscription = await NewSubscriptionService.resetUsageCounters(user?.id || '');
              DeviceEventEmitter.emit('wisdomUsageReset', {
                wisdomCount: 0,
                wisdomLimit: updatedSubscription.wisdom_limit,
                tier: updatedSubscription.tier,
              });

              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ['subscription', user?.id],
                  refetchType: 'active',
                }),
                devotionalGating.refreshSubscription(),
                refreshNewSubscription().catch(() => {}),
              ]);
              logger.info('✅ Subscription state refreshed');
            } catch (refreshError) {
              logger.error('Failed to update subscription', refreshError as Error);
              // Continue to success modal even if refresh fails - purchase succeeded
            }

          setLoadingStep('completing');
          setPurchaseValidated(true);
          setLastPurchasedTier(purchaseTier);
          setIsPurchasing(false); // Hide loading modal
          await new Promise(resolve => setTimeout(resolve, 200)); // Minimal wait for loading modal to hide

          // CRITICAL: Suppress faith points notifications during success modal to prevent z-index conflicts
          notificationService.suppressPointsNotifications(true);
          setShowSuccessModal(true);

          // Success modal will stay visible until user clicks continue button
          // This gives users time to read the success message
        } else {
          logger.debug('❌ Purchase not successful, throwing error');
          throw new Error(result.error || 'Purchase failed');
        }
        } catch (purchaseError: any) {
          logger.error('Purchase failed:', purchaseError);

          // Check if user cancelled (multiple ways to detect)
          const isCancelled =
            purchaseError?.message === 'USER_CANCELLED' ||
            purchaseError?.code === 'USER_CANCELLED' ||
            purchaseError?.message?.toLowerCase().includes('cancel') ||
            purchaseError?.message?.toLowerCase().includes('timeout') ||
            purchaseError?.message === 'STALE_PURCHASE_CACHE';

          if (isCancelled) {
            logger.debug('User cancelled purchase - silently continuing');
            // CRITICAL: Reset ALL purchase state to prevent stale/cached validation
            setIsPurchasing(false);
            setLoadingStep('processing');
            return;
          }

          // Check if it's a database update error (purchase succeeded but DB failed)
          const isDatabaseError =
            purchaseError?.code === 'DATABASE_UPDATE_FAILED' ||
            purchaseError?.message?.includes('database update failed');

          if (isDatabaseError) {
            logger.error('Database update error - showing user-friendly message', purchaseError);
            Alert.alert(
              'Purchase Successful',
              'Your payment was processed successfully, but we had trouble updating your account. Please restart the app to access your subscription. If the issue persists, please contact support.',
              [{ text: 'OK', onPress: () => setIsPurchasing(false) }]
            );
            return;
          }

          // For other errors, show a clear reason instead of making the tap look dead.
          logger.error('Purchase error (silent):', purchaseError?.message || 'Unknown error');
          Alert.alert(
            'Purchase Unavailable',
            purchaseError?.message || 'Apple could not start the purchase. Please try again in a moment.'
          );
          setIsPurchasing(false);
          setLoadingStep('processing');
        }
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsPurchasing(false);
    }
  };

  const getCurrentPrice = () => {
    const tier = pricingTiers.find(t => t.id === selectedPlanTier);
    return tier ? (isAnnual ? tier.annualPrice : tier.monthlyPrice) : 0;
  };

  const getSelectedPlanActionLabel = () => {
    if (isCurrentSelection) {
      return effectiveIsCurrentlyOnTrial ? 'Current Trial' : 'Current Plan';
    }

    const action = isHigherTierSelection ? 'Upgrade to' : 'Switch to';
    const billingSuffix = selectedBillingCycle === 'annual' ? ' Annual' : (!isHigherTierSelection ? ' Monthly' : '');
    return `${action} ${getTierDisplayName(selectedPlanTier)}${billingSuffix}`;
  };

  const getUnlockButtonLabel = () => {
    if (isPurchasing) {
      return 'Processing...';
    }

    if (dynamicSalesCopy?.closeOnPrimaryCta) {
      return dynamicSalesCopy.primaryCta;
    }

    if (shouldUseTrialProduct && !effectiveHasEverStartedTrial) {
      return 'Start 3-Day Free Trial';
    }

    if (isCurrentSelection) {
      return getSelectedPlanActionLabel();
    }

    if (routeParams?.forceTransformationAnnual) {
      return getSelectedPlanActionLabel();
    }

    if (routeParams?.forceAnnualOnly) {
      return getSelectedPlanActionLabel();
    }

    const shouldShowDynamicUpgradeLabel =
      shouldUseTrialProduct ||
      fromExportRestriction ||
      isUpgradeMode ||
      fromPlanningLock ||
      (fromRepeatOptionsLock || fromRepeatUpgradePrompt) ||
      fromCalendarAutoSync ||
      fromCopyTodosLock ||
      fromGuidedPromptsLock;

    if (shouldShowDynamicUpgradeLabel) {
      return getSelectedPlanActionLabel();
    }

    if (dynamicSalesCopy?.primaryCta) {
      return dynamicSalesCopy.primaryCta;
    }

    return 'Continue My Journey';
  };

  const renderPricingCard = (tier: PricingTier) => {
    const isSelected = selectedPlanTier === tier.id;
    const cardBillingCycle = isAnnual ? 'annual' : 'monthly';
    const isCurrentTrialCard = shouldUseTrialPlanSwitcher
      && effectiveTrialPlanTier === tier.id
      && normalizeBillingCycle(effectiveCurrentTrialBillingCycle) === cardBillingCycle;
    const isCurrentPaidPlanCard = !effectiveIsCurrentlyOnTrial
      && normalizePaidPlanTier(dynamicSalesCopy?.isCurrentTier) === tier.id
      && currentComparableBillingCycle === cardBillingCycle;
    // Only highlight the currently selected tier, not always the growth tier
    const isFocused = isSelected; // Remove hardcoded growth tier focus
    const tierDescription = tier.id === 'spark'
      ? 'For getting started'
      : tier.id === 'growth'
        ? 'For steady growth'
        : tier.id === 'transformation'
          ? 'For ongoing use'
          : tier.description;

    return (
      <View key={tier.id} style={styles.cardWrapper}>
        <TouchableOpacity
          style={[
          styles.pricingCard,
          isSelected && styles.selectedCard,
          isFocused && styles.focusedCard,
        ]}
        onPress={(e) => {
          // Prevent event from bubbling up to parent handlers and prevent default
          e?.preventDefault?.();
          e?.stopPropagation?.();
          try { triggerLightHaptic(); } catch {}
          logger.debug('Tier card tapped', {
            tierId: tier.id,
            previousTier: selectedTier,
            isAnnual,
            billing: isAnnual ? 'annual' : 'monthly',
          });
          setSelectedTier(tier.id);
          setHasManualTierSelection(true);
        }}
        activeOpacity={0.8}
      >
        {isSelected && (
          <View
            pointerEvents="none"
            style={[
              styles.selectedOverlay,
            ]}
          />
        )}
        {null}

        <View style={styles.cardHeader}>
          <ThemedText weight="semiBold" style={[styles.tierName, isSelected && styles.selectedText]}>
            {tier.name}
          </ThemedText>
          {isCurrentPaidPlanCard ? (
            <View style={styles.recommendedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.alertCoral} style={{ marginRight: 4 }} />
              <ThemedText style={styles.recommendedText}>Current Plan</ThemedText>
            </View>
          ) : isCurrentTrialCard ? (
            <View style={styles.recommendedBadge}>
              <Ionicons name="time-outline" size={14} color={Colors.alertCoral} style={{ marginRight: 4 }} />
              <ThemedText style={styles.recommendedText}>Current Trial</ThemedText>
            </View>
          ) : dynamicSalesCopy?.isCurrentTrial
            && tier.id === dynamicSalesCopy?.recommendedTier
            && normalizeBillingCycle(effectiveCurrentTrialBillingCycle) === cardBillingCycle ? (
            <View style={styles.recommendedBadge}>
              <Ionicons name="time-outline" size={14} color={Colors.alertCoral} style={{ marginRight: 4 }} />
              <ThemedText style={styles.recommendedText}>Current Trial</ThemedText>
            </View>
          ) : dynamicSalesCopy?.recommendedTier && tier.id === dynamicSalesCopy?.recommendedTier ? (
            <View style={styles.recommendedBadge}>
              <Ionicons name="sparkles" size={14} color={Colors.alertCoral} style={{ marginRight: 4 }} />
              <ThemedText style={styles.recommendedText}>Recommended</ThemedText>
            </View>
          ) : tier.id === 'growth' && !dynamicSalesCopy?.recommendedTier && (
            <View style={styles.recommendedBadge}>
              <Ionicons name="sparkles" size={14} color={Colors.alertCoral} style={{ marginRight: 4 }} />
              <ThemedText style={styles.recommendedText}>Recommended</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.priceContainer}>
          <ThemedText weight="bold" style={[styles.currentPrice, isSelected && styles.selectedText]} numberOfLines={1}>
            {(() => {
              const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
              const formatted = (currencyInfo?.currency === 'PHP' && price % 1 === 0) ? Math.floor(price) : price.toFixed(2);
              return `${currencyInfo?.symbol || '$'}${formatted}/${isAnnual ? 'year' : 'month'}`;
            })()}
          </ThemedText>
        </View>

        <ThemedText weight="semiBold" style={[styles.tierDescription, isSelected && styles.selectedText]}>
          {tierDescription}
        </ThemedText>

        {tier.secondaryDescription && (
          <ThemedText style={[styles.tierSecondaryDescription, isSelected && styles.selectedText]}>
            {tier.secondaryDescription}
          </ThemedText>
        )}

        <View style={styles.featuresContainer}>
          {(() => {
            // Default formatting for all tiers
            const processed: string[] = [];
            const first = tier.features[0]?.trim() || '';
            const m = first.match(/^(\d+)\s*playbooks\s*&\s*(\d+)\s*devotionals\s*each\s*month$/i);
            if (m) {
              processed.push(`${m[1]} playbooks each month`);
              processed.push(`${m[2]} devotionals each month`);
              // Add devotional access info based on tier
              if (tier.id === 'seeker') {
                processed.push('All devotional durations locked');
              } else if (tier.id === 'spark') {
                processed.push('Access 1-day & 3-day devotionals');
              } else if (tier.id === 'transformation') {
                processed.push('Access all devotional durations (1-7 days)');
              } else if (tier.id === 'growth') {
                processed.push('Access all devotional durations (1-7 days)');
              }
              // POST-LAUNCH: || tier.id === 'family'
              // No extra line for transformation as requested (no unlocked text)
              processed.push(...tier.features.slice(1));
            } else if (/^Unlimited\s+playbooks\s*&\s*devotionals/i.test(first)) {
              processed.push('60 playbooks each month');
              processed.push('60 devotionals each month');
              processed.push('Access all devotional durations (1-7 days)');
              processed.push(...tier.features.slice(1));
            } else {
              processed.push(...tier.features);
            }
            return processed.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="heart" size={16} color={Colors.alertCoral} style={styles.iconMarginRight} />
                <ThemedText style={styles.featureText}>{feature}</ThemedText>
              </View>
            ));
          })()}
        </View>

      </TouchableOpacity>
      </View>
    );
  };

  // Show loading state while pricing tiers are loading
  if (pricingTiers.length === 0 || !currencyInfo) {
    logger.debug('Showing loading state', {
      tiersLength: pricingTiers.length,
      hasCurrency: !!currencyInfo,
      currencyInfo,
    });
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} animated />
        <TouchableOpacity style={styles.closeButtonTopRight} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
        <View style={styles.centeredContainer}>
          <ThemedText style={styles.loadingText}>
            Loading pricing options...
          </ThemedText>
          <ThemedText style={styles.loadingSubtext}>
            Tiers: {pricingTiers.length}, Currency: {currencyInfo ? 'loaded' : 'loading...'}
          </ThemedText>
        </View>
      </View>
    );
  }

  Logger.info('[OnboardingSalesOfferScreen] Exiting loading state, rendering main content', {
    tiersLength: pricingTiers.length,
    hasCurrency: !!currencyInfo,
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent animated />
      {/* ENTERPRISE IMPROVEMENT: Loading Modal */}
      <PurchaseLoadingModal
        visible={isPurchasing}
        step={loadingStep}
      />

      <PurchaseSuccessModal
        visible={showSuccessModal}
        tier={lastPurchasedTier || selectedTier}
        isTrial={shouldUseTrialProduct}
        isAnnual={isAnnual}
        isValidated={purchaseValidated}
        isOnboarding={!!routeParams?.onboardingFlow}
        onContinue={handleSuccessModalContinue}
      />

      {/* Close button - absolute positioned at top */}
      <TouchableOpacity
        style={[styles.closeButtonTopRight, { top: insets.top + 12 }]}
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
      </TouchableOpacity>

      {/* Pricing Cards - Scrollable */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.pricingScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContentPadding,
          { paddingHorizontal: 24, paddingTop: insets.top + 8, paddingBottom: Math.max(styles.scrollContentPadding.paddingBottom || 0, footerHeight + 24) },
        ]}
        scrollIndicatorInsets={{ bottom: footerHeight + 24 }}
        snapToStart={true}
        snapToEnd={true}
      >
          {/* Main Content that should scroll under the sticky toggle */}
          <ThemedText weight="bold" style={styles.mainTitle}>
            {isProfileTrialViewPlans
              ? customProfileTrialTitle
              : dynamicSalesCopy
              ? dynamicSalesCopy.title
              : isUpgradeMode
                ? 'Keep walking—grace for the next step'
                : fromPlanningLock
                  ? 'Unlock Plan Ahead'
                  : fromCopyTodosLock
                    ? 'Unlock Copy To-Dos & More'
                    : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                      ? 'Unlock Recurring Time Blocks'
                      : fromCalendarAutoSync
                        ? 'Unlock Calendar Auto-Sync'
                        : fromGuidedPromptsLock
                          ? 'Unlock Guided Prompts'
                          : fromExportRestriction
                            ? 'Save your reflection\nas a PDF'
                              : routeParams?.forceTransformationAnnual
                                ? 'Upgrade to annual for maximum savings'
                                : routeParams?.forceAnnualOnly
                                  ? 'Continue with annual billing for maximum savings'
                                  : 'Unlock more room\nto keep going'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isProfileTrialViewPlans
              ? customProfileTrialSubtitle
              : dynamicSalesCopy
              ? dynamicSalesCopy.message
              : routeParams?.forceTransformationAnnual
                ? 'Save the equivalent of 2 months when you choose annual billing. Continue your spiritual journey with all premium features.'
                : routeParams?.forceAnnualOnly
                  ? 'You are currently on an annual plan. Continue with the same great value and maximum savings.'
                  : isUpgradeMode
                  ? 'Choose a plan that meets you where you are and helps you go deeper.'
                : fromPlanningLock
                  ? 'Gently prepare for what\'s ahead with guided planning inside your journal.'
                  : fromCopyTodosLock
                    ? `Copy ${incompleteTodosCount} incomplete to-do${incompleteTodosCount === 1 ? '' : 's'} to future dates, and unlock advanced planning features, playbooks, and devotionals.`
                    : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                      ? 'Create recurring time blocks to build steady rhythms in your week. With an upgrade, you’ll also have more room for playbooks and devotionals.'
                      : fromCalendarAutoSync
                        ? 'Automatically sync your time blocks to your device calendar so what you plan is easier to follow through on.'
                        : fromGuidedPromptsLock
                          ? 'Access guided reflection prompts to help you slow down, reflect more deeply, and keep going with clarity. With an upgrade, you’ll also unlock more room for playbooks and devotionals.'
                          : fromExportRestriction
                              ? 'Export your playbooks and devotionals as PDF documents so you can return to them later, print them, or save them for future reflection.\n\nPDF export is available with Growth and Transformation.'
                              : routeParams?.onboardingFlow
                                ? 'Return with new moments, bring them before God, and know how to move forward faithfully.'
                                : 'Get more space for playbooks, devotionals, and guided reflection as new moments come up.'}
          </ThemedText>
          {isProfileTrialViewPlans && (
            <View style={styles.profileTrialNoteBox}>
              <ThemedText weight="semiBold" style={styles.profileTrialNoteTitle}>
                Note
              </ThemedText>
              <ThemedText style={styles.profileTrialNoteText}>
                {customProfileTrialNote}
              </ThemedText>
            </View>
          )}
          {fromExportRestriction && (
            <View style={styles.exportGrowthSection}>
              <ThemedText weight="semiBold" style={styles.exportGrowthTitle}>
                What Growth includes
              </ThemedText>
              {[
                'More playbooks and devotionals for ongoing situations',
                'Smart journaling to help you reflect and notice patterns',
                'Gentle guidance for faithful next steps',
                'A consistent space to return to when moments resurface',
              ].map((item) => (
                <View key={item} style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Growth Plan Benefits - show only for registration onboarding flow */}
          {routeParams?.onboardingFlow && (
            <View />
          )}

          {/* Feature Bullets - hide for onboarding flow */}
          {!routeParams?.onboardingFlow && (
          <View style={styles.featuresSection}>
            {isUpgradeMode ? (
              // Upgrade mode benefits - removed per user request
              <></>
            ) : (
              // Onboarding benefits (limit to 3, aligned copy)
              fromPlanningLock ? (
                <>
                  <ThemedText weight="semiBold" style={styles.featureBulletLabel}>
                  With Plan Ahead, you can:
                </ThemedText>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Prepare for upcoming days without rushing or pressure
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Hold decisions and to-dos in a calm, guided structure
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Map out what's ahead with more clarity
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Return to your plans as the week unfolds
                  </ThemedText>
                </View>
                <ThemedText style={styles.extraLine}>
                  With an upgrade, you'll also unlock more playbooks and devotionals each month.
                </ThemedText>
                </>
              ) : fromCopyTodosLock ? (
                <>
                  {/* Stats section for copy todos */}
                  <View style={styles.statsSection}>
                    <View style={styles.statItem}>
                      <ThemedText weight="bold" style={styles.statNumber}>
                        {incompleteTodosPercentage}%
                      </ThemedText>
                      <ThemedText style={styles.statLabel}>Incomplete</ThemedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <ThemedText weight="bold" style={styles.statNumber}>
                        {incompleteTodosCount}
                      </ThemedText>
                      <ThemedText style={styles.statLabel}>To Copy</ThemedText>
                    </View>
                  </View>

                  <View style={styles.featureBullet}>
                    <Ionicons name="copy-outline" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Copy incomplete to-dos to future dates and stay organized.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Plan ahead with unlimited future planning and time blocks.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="book-outline" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Create more devotionals and return to spiritual content that helps guide your journey.
                    </ThemedText>
                  </View>
                </>
              ) : null
            )}
          </View>
          )}


          <View style={styles.cardsContainer}>
            {pricingTiers.length > 0 ? (
              pricingTiers.map(renderPricingCard)
            ) : (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>
                  Loading pricing options...
                </ThemedText>
              </View>
            )}
          </View>

          {/* Bottom Links */}
          <View style={styles.bottomLinksContainer}>
            {/* See All Plans Button - show when in filtered mode, hide for "Got it" scenarios */}
            {(routeParams?.onboardingFlow || (!routeParams?.onboardingFlow && !isUpgradeMode) || (isUpgradeMode && (effectiveIsSeekerTier || shouldUseTrialPlanSwitcher)) || routeParams?.forceTransformationAnnual || routeParams?.forceAnnualOnly) && !isCurrentTransformationPlan && !dynamicSalesCopy?.closeOnPrimaryCta && (
              <TouchableOpacity
                style={styles.seeAllPlansButton}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setShowAllPlans(!showAllPlans);
                  scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.seeAllPlansText}>{showAllPlans ? 'Show Less' : 'See All Plans'}</ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.seeAllPlansButton}
              onPress={handleTermsOfService}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.seeAllPlansText}>Terms of Service</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.seeAllPlansButton}
              onPress={handleRestorePurchase}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.seeAllPlansText}>Restore Purchases</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>

      {/* Fixed Footer CTA */}
      <View
        style={styles.footerContainer}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.height;
          if (next && next !== footerHeight) {
            setFooterHeight(next);
          }
        }}
      >
        {/* Growth Price Display - hide for "Got it" scenarios */}
        {!dynamicSalesCopy?.closeOnPrimaryCta && (
          <View style={styles.footerPriceSection}>
          {/* Monthly/Annual Toggle */}
          <View style={styles.footerToggleContainer}>
            <Animated.View style={{ transform: [{ scale: monthlyScale }] }}>
              <TouchableOpacity
                style={[styles.footerToggleButton, !isAnnual && styles.activeFooterToggle]}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setIsAnnual(false);
                }}
              >
                <ThemedText weight={!isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, !isAnnual && styles.activeFooterToggleText]}>Monthly</ThemedText>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ transform: [{ scale: annualScale }] }}>
              <TouchableOpacity
                style={[styles.footerToggleButton, isAnnual && styles.activeFooterToggle]}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setIsAnnual(true);
                }}
              >
                <ThemedText weight={isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, isAnnual && styles.activeFooterToggleText]}>Annual</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {(() => {
            const tier = pricingTiers.find(t => t.id === selectedPlanTier)
              || pricingTiers.find(t => t.id === 'growth')
              || pricingTiers[0];
            if (!tier) {return null;}

            const formatValue = (value: number) => {
              if (currencyInfo?.currency === 'PHP' && value % 1 === 0) {
                return Math.floor(value).toString();
              }
              return value.toFixed(2);
            };

            const symbol = currencyInfo?.symbol || '$';

            if (isAnnual) {
              const annualPrice = tier.annualPrice;
              const monthlyPrice = tier.monthlyPrice;
              const monthlyYearly = monthlyPrice * 12;

              return (
                <>
                  <ThemedText weight="bold" style={styles.footerPriceMain}>
                    {`${symbol}${formatValue(annualPrice)}/year`}
                  </ThemedText>
                  <ThemedText style={styles.footerPriceSub}>
                    <ThemedText style={{ textDecorationLine: 'line-through', opacity: 0.6 }}>{`${symbol}${formatValue(monthlyYearly)}`}</ThemedText>
                    {' · Save 2 months'}
                  </ThemedText>
                  <ThemedText style={styles.footerPriceApprox}>
                    Pay once, grow all year.
                  </ThemedText>
                </>
              );
            }

            const monthlyPrice = tier.monthlyPrice;
            return (
              <>
                <ThemedText weight="bold" style={styles.footerPriceMain}>
                  {`${symbol}${formatValue(monthlyPrice)}/month`}
                </ThemedText>
              </>
            );
          })()}
        </View>
        )}

        <TouchableOpacity
          style={[
            styles.unlockButton,
            (isPurchasing || shouldDisableUnlockButton) && styles.dimmedOpacity,
          ]}
          onPress={() => {
            try { triggerLightHaptic(); } catch {} // Immediate button press feedback
            logger.info('🔥 BUTTON TAPPED: Unlock Plan button pressed', {
              isPurchasing,
              selectedTier: selectedPlanTier,
              isAnnual,
              selectedBillingCycle,
              isCurrentSelection,
              timestamp: new Date().toISOString(),
            });

            if (isPurchasing) {
              logger.debug('Button disabled - purchase already in progress');
              return;
            }

            if (shouldDisableUnlockButton) {
              logger.debug('Button disabled - selected plan is already current', {
                selectedTier: selectedPlanTier,
                selectedBillingCycle,
                currentTier: currentComparableTier,
                currentBillingCycle: currentComparableBillingCycle,
              });
              return;
            }

            // Check if this is a "Got it" scenario that should close the modal
            if (dynamicSalesCopy?.closeOnPrimaryCta) {
              logger.info('Closing modal - closeOnPrimaryCta is true');
              handleClose();
              return;
            }

            try { triggerSuccessHaptic(); } catch {} // Success feedback for action completion

            // Debug: Log button press and trial eligibility
            logger.info('Button pressed - checking trial eligibility', {
              shouldUseTrialProduct,
              canOfferTrial,
              isCurrentlyOnTrial: effectiveIsCurrentlyOnTrial,
              hasEverStartedTrial: effectiveHasEverStartedTrial,
              isSeekerTier: effectiveIsSeekerTier,
              currentUserTier: effectiveCurrentUserTier,
              buttonText: getUnlockButtonLabel(),
            });

            // Navigate to trial offer screen if user is eligible for trial and hasn't used it yet
            if (shouldUseTrialProduct && !effectiveHasEverStartedTrial) {
              logger.info('Navigating to trial offer screen - user is trial eligible');
              try {
                (navigation as any).navigate('OnboardingTrialOffer', {
                  selectedTierId: selectedPlanTier,
                  billing: isAnnual ? 'annual' : 'monthly',
                  skipNotificationPreference: routeParams?.skipNotificationPreference,
                  onboardingFlow: routeParams?.onboardingFlow,
                  source: routeParams?.source,
                  feature: routeParams?.feature,
                  returnTo: routeParams?.returnTo,
                  context: routeParams?.context,
                  dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
                  dismissBehavior: routeParams?.dismissBehavior,
                  isTrialEligible: true,
                });
                logger.info('Navigation to trial offer screen initiated successfully');
              } catch (navError) {
                logger.error('Navigation to trial offer screen failed', navError as Error);
                // Fallback to regular purchase flow
                handleUnlockPlan();
              }
            } else {
              logger.info('Not trial eligible - proceeding with regular purchase flow');
              handleUnlockPlan();
            }
          }}
          activeOpacity={0.9}
          disabled={isPurchasing || shouldDisableUnlockButton}
        >
          <ThemedText weight="bold" style={styles.unlockButtonText}>
            {getUnlockButtonLabel()}
          </ThemedText>
        </TouchableOpacity>

        {!dynamicSalesCopy?.closeOnPrimaryCta && (
          <View style={styles.footerRow}>
          {!isAnnual && <Ionicons name="shield-checkmark" size={16} color={Colors.hopeWhite} style={styles.footerShield} />}
          {isAnnual ? (
            <ThemedText style={styles.footerText}>Billed yearly after trial unless cancelled.</ThemedText>
          ) : (
            <>
              <ThemedText style={styles.footerText}>No Payment Now.</ThemedText>
              <ThemedText style={styles.footerText}> Cancel Anytime</ThemedText>
            </>
          )}
        </View>
        )}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  closeButtonTopRight: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    zIndex: 10,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 24,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
  },
  logoHeart: {
    fontSize: 16,
    color: Colors.alertCoral,
    marginLeft: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignSelf: 'center',
    width: '100%',
    minHeight: '100%',
  },
  pricingScroll: {
    flex: 1,
  },
  stickyToggleHeader: {
    backgroundColor: Colors.anchorBlue,
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 24,
    zIndex: 2,
    elevation: 2,
  },
  mainTitle: {
    fontSize: 28,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
    marginBottom: 16,
    lineHeight: 24,
  },
  smallMotivationalText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  growthPlanSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    padding: 20,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  growthPlanDuplicateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 24,
    padding: 22,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  growthPlanTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 0,
    flex: 1,
    flexGrow: 1,
  },
  growthPlanToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 12,
  },
  growthPlanSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  growthPlanDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  growthPlanDuplicateSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginTop: 16,
    marginBottom: 8,
  },
  growthPlanDuplicateDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 8,
  },
  growthPlanListLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 8,
  },
  featureCategory: {
    marginBottom: 16,
  },
  featureCategoryTitle: {
    fontSize: 14,
    color: Colors.growthGreen,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBulletLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
    marginTop: 8,
  },
  exportGrowthSection: {
    marginTop: 16,
    padding: 0,
  },
  exportGrowthTitle: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.hopeWhite,
  },
  bulletText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 12,
  },
  extraLine: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 16,
    fontStyle: 'italic',
  },
  trialBenefitText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  trialSupportingTextContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  trialSupportingTextContainerFirst: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  trialSupportingText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.8,
    lineHeight: 18,
    textAlign: 'center',
  },
  textLeftAlign: {
    textAlign: 'left',
  },
  trialDivider: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 12,
  },
  additionalFollowupText: {
    marginTop: 8,
    marginBottom: 0,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 24,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 16,
  },
  activeToggle: {
    backgroundColor: Colors.growthGreen,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    // weight handled by ThemedText
  },
  activeToggleText: {
    color: Colors.hopeWhite,
    // weight handled by ThemedText
  },
  profileTrialNoteBox: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 0,
  },
  profileTrialNoteTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 6,
  },
  profileTrialNoteText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.82,
    lineHeight: 21,
  },
  cardsContainer: {
    marginBottom: 16,
    marginTop: 16,
  },
  seeAllPlansButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    minWidth: 280,
  },
  seeAllPlansText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    // weight handled by ThemedText
  },
  pricingCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  selectedCard: {
    borderColor: 'rgba(255, 107, 107, 0.6)',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  focusedCard: {
    // removed alert coral color
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 30,
    opacity: 0.14,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 11,
    color: Colors.hopeWhite,
    letterSpacing: 0.6,
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: Colors.hopeWhite,
    fontSize: 12,
    marginTop: 8,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
  },
  dimmedOpacity: {
    opacity: 0.6,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeader: {
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 20,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    lineHeight: 28,
  },
  growthTierName: {
    fontSize: 20,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    lineHeight: 28,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tierDuration: {
    fontSize: 16,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginLeft: 8,
    lineHeight: 20,
  },
  tierDescription: {
    fontSize: 18,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    marginBottom: 4,
    opacity: 0.9,
    lineHeight: 24,
  },
  tierSecondaryDescription: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 6,
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
    lineHeight: 24,
  },
  priceContainer: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'flex-start',
  },
  priceLeft: {
    flexShrink: 0,
    width: 'auto',
  },
  priceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    flexShrink: 0,
    justifyContent: 'flex-end',
    // allow content width
  },
  currentPrice: {
    fontSize: 24,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    marginRight: 4,
    flexShrink: 0,
    lineHeight: 32,
  },
  growthCurrentPrice: {
    fontSize: 26,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    marginRight: 4,
    flexShrink: 0,
    lineHeight: 34,
  },
  originalPrice: {
    fontSize: 16,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    flexShrink: 0,
    marginRight: 4,
    lineHeight: 20,
  },
  monthlyEquivalent: {
    fontSize: 14,
    color: Colors.hopeWhite,
    // weight handled by ThemedText
    marginLeft: 'auto',
    flexShrink: 0,
    textAlign: 'right',
  },
  originalPriceBelow: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  detailsToggleText: {
    fontSize: 10,
    color: Colors.faithGold,
    marginRight: 4,
  },
  selectedText: {
    color: Colors.hopeWhite,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  unlockButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 15,
    borderRadius: 50,
    marginBottom: 10,
    width: '100%',
    maxWidth: 720,
  },
  unlockButtonText: {
    fontSize: 18,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  restoreButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    borderRadius: 50,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: '100%',
    maxWidth: 720,
  },
  restoreButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
  },
  footerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerPriceSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  footerPriceBadge: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerPriceMain: {
    fontSize: 22,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerPriceSub: {
    fontSize: 14,
    color: Colors.faithGold,
    textAlign: 'center',
    marginTop: 4,
  },
  footerPriceApprox: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
    flexWrap: 'nowrap',
  },
  footerText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 0,
  },
  footerDot: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginHorizontal: 6,
  },
  footerShield: {
    marginRight: 4,
    opacity: 0.8,
  },
  cardWrapper: {
    marginBottom: 0,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerRight: {
    flex: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  expandButtonText: {
    fontSize: 14,
    color: Colors.faithGold,
    marginRight: 4,
    // weight handled by ThemedText
  },
  iconMarginRight: {
    marginRight: 8,
  },
  scrollContentPadding: {
    paddingBottom: 120,
  },
  // Copy todos stats styles
  statsSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    color: Colors.alertCoral,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
  },
  // Trial benefits styles
  trialBenefitsContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 30,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  trialBenefitsTitle: {
    fontSize: 16,
    color: Colors.growthGreen,
    marginBottom: 12,
    textAlign: 'center',
  },
  trialPricingText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
  },
  trialBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bottomLinksContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: -12,
    marginBottom: 32,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  // Footer toggle styles
  footerToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  footerToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  activeFooterToggle: {
    backgroundColor: Colors.growthGreen,
  },
  footerToggleText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  activeFooterToggleText: {
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(OnboardingSalesOfferScreen, 'OnboardingSalesOfferScreen');
