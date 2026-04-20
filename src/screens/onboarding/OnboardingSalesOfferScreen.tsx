import React, { useState, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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

// removed Dimensions width as unused

// Use PricingTier from pricingService to avoid drift
type PricingTier = ServicePricingTier;

interface RouteParams {
  upgradeMode?: boolean;
  currentTier?: string;
  requestedDuration?: number; // when user tapped a locked duration (e.g., 7 days)
  featureType?: 'playbooks' | 'devotionals'; // explicitly mark which feature triggered the upgrade
  // Navigation context flags
  source?: string; // e.g., 'planning_lock', 'copy_todos_lock', 'guided_prompts_lock', 'calendar_auto_sync'
  feature?: string; // e.g., 'future_planning', 'copy_todos', 'guided_prompts'
  tier?: string; // caller-reported tier
  skipNotificationPreference?: boolean;
  context?: string; // e.g., 'profile_settings', 'timeblock'
  returnTo?: string; // e.g., 'UserProfile' - screen to return to on close
  returnToReflection?: boolean; // when launched from reflection editor
  dismissBothModalsOnClose?: boolean; // when both modals should be dismissed on close
  forceTransformationAnnual?: boolean; // Show only annual transformation option
  forceAnnualOnly?: boolean; // Show only annual plans for current tier
  onboardingFlow?: boolean; // True when in initial registration onboarding
  // Copy todos specific data
  incompleteTodosCount?: number;
  incompleteTodosPercentage?: number;
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

  const [isAnnual, setIsAnnual] = useState((route.params as any)?.forceTransformationAnnual || (route.params as any)?.forceAnnualOnly || false);

  // Check if we're in upgrade mode (from devotional modal) or onboarding mode
  const routeParams = route.params as RouteParams | undefined;
  const isUpgradeMode = routeParams?.upgradeMode || false;

  // Check if coming from profile to preselect current tier
  const isFromProfile = (route.params as any)?.source === 'profile';

  const currentUserTier = isFromProfile ? (routeParams?.currentTier || routeParams?.tier || 'seeker') :
                              (routeParams?.currentTier || routeParams?.tier || devotionalGating.tier || 'seeker') as string;
  const initialSelectedTier = (route.params as any)?.forceTransformationAnnual ? 'transformation' :
                              (route.params as any)?.forceAnnualOnly ? currentUserTier :
                              isFromProfile && currentUserTier && currentUserTier !== 'seeker' ? currentUserTier :
                              (route.params as any)?.selectedTier ? (route.params as any).selectedTier :
                              (route.params as any)?.requestedDuration === 7 ? 'transformation' :
                              (route.params as any)?.requestedDuration ? 'growth' :
                              'spark'; // Default to spark

  // Debug logging
  logger.debug('Sales offer screen debug', {
    isFromProfile,
    currentUserTier,
    initialSelectedTier,
    routeParams: route.params,
    requestedDuration: (route.params as any)?.requestedDuration,
  });
  const [selectedTier, setSelectedTier] = useState(initialSelectedTier);
  const [hasManualTierSelection, setHasManualTierSelection] = useState(false);
  const [preservedTier, setPreservedTier] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);
  const [lastPurchasedTier, setLastPurchasedTier] = useState<string | null>(null);
  const requestedDuration = routeParams?.requestedDuration;
  const [isAboutGrowthExpanded, setIsAboutGrowthExpanded] = useState(false);
  const fromPlanningLock = !isUpgradeMode && routeParams?.source === 'planning_lock' && routeParams?.feature === 'future_planning' && (currentUserTier === 'seeker' || !currentUserTier);
  const fromCopyTodosLock = !isUpgradeMode && routeParams?.source === 'copy_todos_lock' && routeParams?.feature === 'copy_todos';
  const fromGuidedPromptsLock = !isUpgradeMode && routeParams?.source === 'guided_prompts_lock' && routeParams?.feature === 'guided_prompts' && currentUserTier === 'seeker';
  const fromSmartJournalingLock = !isUpgradeMode && routeParams?.source === 'smart_journaling_lock' && routeParams?.feature === 'smart_journaling';
  const fromExportRestriction = !isUpgradeMode && (routeParams?.source === 'pdf_export_restriction' || routeParams?.source === 'docx_export_restriction') && (routeParams?.feature === 'export_pdf' || routeParams?.feature === 'export_docx');
  const fromRepeatOptionsLock = !isUpgradeMode && routeParams?.source === 'repeat_options';
  const fromRepeatUpgradePrompt = !isUpgradeMode && routeParams?.source === 'repeat_upgrade_prompt';
  const fromCalendarAutoSync = !isUpgradeMode && routeParams?.source === 'calendar_auto_sync';
  const incompleteTodosCount = routeParams?.incompleteTodosCount || 0;
  const incompleteTodosPercentage = routeParams?.incompleteTodosPercentage || 0;

  // Derived: trial eligibility (only offer trial if user hasn't started one yet AND is currently on Seeker tier)
  const subscription = devotionalGating.subscription;
  const hasEverStartedTrial = Boolean(subscription?.trial_start_date);
  const isCurrentlyOnTrial = subscription?.tier === 'free_trial';
  const isSeekerTier = currentUserTier === 'seeker' || !currentUserTier; // !currentUserTier treats undefined as seeker
  const canOfferTrial = !isCurrentlyOnTrial && !hasEverStartedTrial && isSeekerTier;
  const shouldUseTrialProduct = canOfferTrial;

  // Detect if coming from devotional gating
  // Use explicit featureType if provided, otherwise fall back to requestedDuration logic
  const fromDevotionalGating = isUpgradeMode && (routeParams?.featureType === 'devotionals' || (!routeParams?.featureType && requestedDuration));

  // Detect if coming from Growth+ only features (smart journaling or export)
  const fromGrowthOnlyFeature = fromSmartJournalingLock || fromExportRestriction;
  const growthOnlyFeatureName = fromExportRestriction
    ? (routeParams?.feature === 'export_pdf' ? 'PDF Export' : 'Word Export')
    : 'Smart Journaling';

  // Generate dynamic sales copy for playbook/devotional gating
  const dynamicSalesCopy = React.useMemo(() => {
    if (!isUpgradeMode || !subscription) {return null;}

    // Use explicit featureType from route params if provided, otherwise infer from requestedDuration
    const featureType = routeParams?.featureType || (fromDevotionalGating ? 'devotionals' : 'playbooks');
    const isOnTrial = subscription.tier === 'free_trial';

    // Compute remaining counts so we can distinguish "no remaining" vs "duration locked"
    const playbooksUsed = subscription.playbooks_used || 0;
    const devotionalsUsed = subscription.devotionals_used || 0;
    const playbooksLimit = subscription.playbooks_limit || 0;
    const devotionalsLimit = subscription.devotionals_limit || 0;

    const remainingPlaybooks = playbooksLimit === -1 ? -1 : Math.max(0, playbooksLimit - playbooksUsed);
    const remainingDevotionals = devotionalsLimit === -1 ? -1 : Math.max(0, devotionalsLimit - devotionalsUsed);

    const remaining = featureType === 'playbooks'
      ? (remainingPlaybooks === -1 ? playbooksLimit : remainingPlaybooks)
      : (remainingDevotionals === -1 ? devotionalsLimit : remainingDevotionals);

    const limit = featureType === 'playbooks'
      ? playbooksLimit
      : devotionalsLimit;

    return generateSalesCopy({
      featureType,
      currentTier: currentUserTier as SubscriptionTier,
      remaining,
      limit,
      isOnTrial,
      trialChosenTier: subscription.trial_chosen_tier as SubscriptionTier,
      trialEndDate: subscription.trial_end_date,
      subscriptionStartDate: subscription.subscription_start_date,
      requestedDuration,
    });
  }, [isUpgradeMode, subscription, currentUserTier, requestedDuration, fromDevotionalGating, routeParams?.featureType]);

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
      if (isUpgradeMode) {
        // In upgrade mode, handle navigation based on context
        const source = routeParams?.source;
        const returnTo = routeParams?.returnTo;
        const returnToReflection = routeParams?.returnToReflection;
        const dismissBothModalsOnClose = routeParams?.dismissBothModalsOnClose;

        // Handle special navigation cases
        if (returnTo) {
          // Navigate to specific screen
          (navigation as any).navigate(returnTo);
        } else if (returnToReflection) {
          // Go back to reflection editor
          navigation.goBack();
        } else if (dismissBothModalsOnClose) {
          // Dismiss both modals (e.g., from export restriction upgrade)
          logger.debug('Dismissing both modals for export restriction upgrade');
          navigation.goBack();
          setTimeout(() => {
            logger.debug('Dismissing second modal (export options modal)');
            navigation.goBack();
          }, 100);
        } else if (source === 'repeat_options' || source === 'calendar_upgrade_prompt' || source === 'repeat_upgrade_prompt' || source === 'calendar_sync') {
          // Go back multiple times to return to TimeBlock screen
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 100);
        } else {
          // Default go back
          navigation.goBack();
        }
      } else if (routeParams?.onboardingFlow || !routeParams?.skipNotificationPreference) {
        // In onboarding flow or when skipNotificationPreference is false, navigate to notification setup
        logger.debug('Navigating to notification setup for onboarding flow');
        (navigation as any).navigate('OnboardingNotificationSetup', { userType: 'paid' });
      } else {
        // When skipNotificationPreference is true (feature gating / special flows), just go back
        logger.debug('Skipping notification setup, going back');
        navigation.goBack();
      }
    }, 100);
  }, [navigation, isUpgradeMode, routeParams]);

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
          logger.debug('Loading upgrade tiers for', { currentUserTier });
          tiers = await pricingService.getLocationAdjustedUpgradeTiers(currentUserTier);
          logger.debug('Upgrade tiers loaded', { count: tiers.length, tiers: tiers.map(t => t.id) });
        } else {
          // In onboarding mode, show all tiers
          tiers = await pricingService.getLocationAdjustedPricing();
          logger.debug('All tiers loaded', { count: tiers.length });
        }

        // Filter to only show Spark tier in onboarding flow
        if (routeParams?.onboardingFlow) {
          tiers = tiers.filter(t => t.id === 'spark');
          logger.debug('Filtered to only show Spark tier for onboarding flow', {
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter out Spark tier if coming from Growth+ only features
        if (fromGrowthOnlyFeature) {
          tiers = tiers.filter(t => t.id !== 'spark');
          logger.debug('Filtered out Spark tier for Growth+ feature', {
            feature: growthOnlyFeatureName,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to only show Transformation annual when forced
        if ((route.params as any)?.forceTransformationAnnual) {
          tiers = tiers.filter(t => t.id === 'transformation');
          logger.debug('Filtered to only show Transformation annual', {
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter to show only annual plans at or above current tier when forced
        if ((route.params as any)?.forceAnnualOnly && currentUserTier && currentUserTier !== 'seeker') {
          const baseTier = currentUserTier.replace('_annual', '');
          const tierHierarchy = ['spark', 'growth', 'transformation'];
          const currentTierIndex = tierHierarchy.indexOf(baseTier);

          // Show current tier and higher tiers (allow upgrades, prevent downgrades)
          tiers = tiers.filter(t => {
            const tierIndex = tierHierarchy.indexOf(t.id);
            return tierIndex >= currentTierIndex;
          });

          logger.debug('Filtered to show annual plans at or above current tier', {
            currentUserTier,
            baseTier,
            currentTierIndex,
            remainingTiers: tiers.map(t => t.id),
          });
        }

        // Filter tiers based on current trial tier to prevent downgrades
        if (isUpgradeMode && subscription?.tier === 'free_trial' && subscription?.trial_chosen_tier) {
          const trialTier = subscription.trial_chosen_tier;
          const tierHierarchy = ['spark', 'growth', 'transformation'];
          const trialIndex = tierHierarchy.indexOf(trialTier);
          if (trialIndex !== -1) {
            // Only show tiers at or above the current trial tier
            tiers = tiers.filter(t => {
              const tierIndex = tierHierarchy.indexOf(t.id);
              return tierIndex >= trialIndex;
            });
            logger.debug('Filtered tiers for trial upgrade mode', {
              trialTier,
              trialIndex,
              remainingTiers: tiers.map(t => t.id),
            });
          }
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
  }, [hasManualTierSelection, isUpgradeMode, currentUserTier, subscription?.tier, subscription?.trial_chosen_tier, requestedDuration, fromGrowthOnlyFeature, growthOnlyFeatureName, isFromProfile, route.params, routeParams?.onboardingFlow]);

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
  }, [hasManualTierSelection, requestedDuration, pricingTiers, selectedTier]);

  // Auto-collapse all expanded feature sections when billing period changes
  useEffect(() => {
    setExpandedCards(new Set());
  }, [isAnnual]);

  // Preserve selected tier when navigating to trial offer and restore when returning
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // When screen comes back into focus, if we have a preserved tier, restore it
      if (preservedTier && selectedTier === 'spark') {
        logger.debug('Restoring preserved tier from trial offer', { preservedTier, currentTier: selectedTier });
        setSelectedTier(preservedTier);
        setPreservedTier(null); // Clear preserved tier after restoration
      }
    });

    return unsubscribe;
  }, [navigation, preservedTier, selectedTier]);

  // Preserve tier before navigating to trial offer
  useEffect(() => {
    if (shouldUseTrialProduct && !preservedTier && selectedTier !== 'spark') {
      logger.debug('Preserving selected tier before trial offer', { selectedTier });
      setPreservedTier(selectedTier);
    }
  }, [shouldUseTrialProduct, preservedTier, selectedTier]);

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

    // Reset subscription to seeker when user cancels sales offer (only in onboarding, not upgrade)
    if (!isUpgradeMode && user?.id) {
      try {
        logger.debug('Resetting subscription to seeker for cancelled sales offer');

        // Reset user to seeker tier using cancelSubscription method
        await NewSubscriptionService.cancelSubscription(user.id);
        logger.debug('Successfully reset subscription to seeker');

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

    // Check if we came from a specific screen (e.g., UserProfile) - prioritize returning there
    if (routeParams?.returnTo === 'UserProfile' || routeParams?.context === 'profile_settings') {
      logger.info('Returning to user profile from feature gating');
      setTimeout(() => {
        navigation.goBack();
      }, 50);
      return;
    }

    // Default navigation based on context
    logger.info('Navigating based on skipNotificationPreference');
    setTimeout(() => {
      if (isUpgradeMode) {
        // In feature gating / upgrade mode, never open notification setup again
        // Simply go back to the previous screen or modal stack
        navigation.goBack();
        return;
      }

      if (!routeParams?.skipNotificationPreference) {
        // During onboarding flow, go to notification setup
        logger.debug('Onboarding flow - navigating to notification setup');
        (navigation as any).navigate('OnboardingNotificationSetup', {
          userType: 'freemium',
          fromCancelledSales: true,
        });
      } else {
        // If skip pref set, go back
        navigation.goBack();
      }
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
      const purchaseTier = selectedTier;

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

        products = cachedProducts.length > 0 ? cachedProducts : await paymentService.getAvailableProducts();

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
      const trialProduct = products.find(p =>
        p.tier === selectedTier &&
        p.productId.includes(billing) &&
        p.productId.includes('.freetrial')
      );

      if (trialProduct) {
        productId = trialProduct.productId;
        logger.debug('✅ Using .freetrial product', {
          productId,
          shouldUseTrialProduct,
          userTier: subscription?.tier,
          isUpgrade: subscription?.tier === 'free_trial' && !shouldUseTrialProduct,
        });
      } else {
        // Construct trial product ID
        productId = `app.sifia.com.${selectedTier}.${billing}.freetrial`;
        logger.warn('⚠️ No .freetrial product found, using constructed ID', { productId });
      }

      // NOW show loading modal right before Apple sheet
      setIsPurchasing(true);
      setShowSuccessModal(false);
      setPurchaseValidated(false);
      setLoadingStep('processing');

      // CRITICAL: Wait for modal to render before starting purchase
      await new Promise(resolve => setTimeout(resolve, 100));

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
                chosenTier: selectedTier,
                transactionId: result.transactionId,
                billingCycle: isAnnual ? 'annual' : 'monthly',
              });

              await NewSubscriptionService.startFreeTrial({
                user_id: user?.id || '',
                duration_days: 3,
                trial_chosen_tier: selectedTier as SubscriptionTier,
                billing_cycle: isAnnual ? 'annual' : 'monthly',
                platform_transaction_id: result.transactionId,
                original_transaction_id: result.transactionId,
                platform_subscription_id: result.transactionId,
              });

              logger.info('✅ Trial created successfully (UPGRADE MODE)', {
                tier: 'free_trial',
                chosenTier: selectedTier,
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
              : isAnnual ? `${selectedTier}_annual` : selectedTier;

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

          // For other errors, log silently instead of showing alert
          logger.error('Purchase error (silent):', purchaseError?.message || 'Unknown error');
          setIsPurchasing(false);
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
                chosenTier: selectedTier,
                transactionId: result.transactionId,
                billingCycle: isAnnual ? 'annual' : 'monthly',
              });

              await NewSubscriptionService.startFreeTrial({
                user_id: user?.id || '',
                duration_days: 3,
                trial_chosen_tier: selectedTier as SubscriptionTier,
                billing_cycle: isAnnual ? 'annual' : 'monthly',
                platform_transaction_id: result.transactionId,
                original_transaction_id: result.transactionId,
                platform_subscription_id: result.transactionId,
              });

              logger.info('✅ Trial created successfully (ONBOARDING MODE)', {
                tier: 'free_trial',
                chosenTier: selectedTier,
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
              : isAnnual ? `${selectedTier}_annual` : selectedTier;

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

          // For other errors, log silently instead of showing alert
          logger.error('Purchase error (silent):', purchaseError?.message || 'Unknown error');
          setIsPurchasing(false);
        }
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsPurchasing(false);
    }
  };

  const getCurrentPrice = () => {
    const tier = pricingTiers.find(t => t.id === selectedTier);
    return tier ? (isAnnual ? tier.annualPrice : tier.monthlyPrice) : 0;
  };


  const getMonthlyEquivalent = (tier: PricingTier) => {
    const price = isAnnual ? (tier.annualPrice / 12) : tier.monthlyPrice;
    // Remove .00 for PHP whole numbers
    if (currencyInfo?.currency === 'PHP' && price % 1 === 0) {
      return Math.floor(price).toString();
    }
    return price.toFixed(2);
  };

  const toggleCardExpansion = (tierId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(tierId)) {
      newExpanded.delete(tierId);
    } else {
      newExpanded.add(tierId);
    }
    setExpandedCards(newExpanded);
  };


  const renderPricingCard = (tier: PricingTier) => {
    const isSelected = selectedTier === tier.id;
    // Only highlight the currently selected tier, not always the growth tier
    const isFocused = isSelected; // Remove hardcoded growth tier focus
    const isExpanded = expandedCards.has(tier.id);

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
              { backgroundColor: isFocused ? Colors.alertCoral : Colors.growthGreen },
            ]}
          />
        )}
        {null}

        <View style={styles.cardHeader}>
          <ThemedText weight="bold" style={[styles.tierName, isSelected && styles.selectedText]}>
            {tier.name}
          </ThemedText>
          {isAnnual && (
            <ThemedText weight="semiBold" style={[styles.tierDuration, isSelected && styles.selectedText]}>
              -{tier.duration}
            </ThemedText>
          )}
        </View>

        <ThemedText weight="semiBold" style={[styles.tierDescription, isSelected && styles.selectedText]}>
          {tier.description}
        </ThemedText>

        {isExpanded && (
          <View style={styles.featuresContainer}>
            {(() => {
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
                } else if (tier.id === 'growth') {
                  processed.push('Access 1-day, 3-day & 5-day devotionals');
                } else if (tier.id === 'transformation') {
                  processed.push('Access all devotional durations (1-7 days)');
                }
                // POST-LAUNCH: || tier.id === 'family'
                // No extra line for transformation as requested (no unlocked text)
                processed.push(...tier.features.slice(1));
              } else if (/^Unlimited\s+playbooks\s*&\s*devotionals/i.test(first)) {
                processed.push('Unlimited playbooks each month');
                processed.push('Unlimited devotionals each month');
                // Do not add any unlocked duration text
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
        )}

        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <ThemedText weight="bold" style={[styles.currentPrice, isSelected && styles.selectedText]}>
                {(() => {
                  const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
                  const formatted = (currencyInfo?.currency === 'PHP' && price % 1 === 0) ? Math.floor(price) : price.toFixed(2);
                  return `${currencyInfo?.symbol || '$'}${formatted}`;
                })()}
              </ThemedText>
              {(() => {
                const original = isAnnual ? tier.annualOriginal : tier.monthlyOriginal;
                const current = isAnnual ? tier.annualPrice : tier.monthlyPrice;
                return original && original > current ? (
                  <ThemedText weight="semiBold" style={styles.originalPrice}>
                    {(() => {
                      const formatted = (currencyInfo?.currency === 'PHP' && original % 1 === 0) ? Math.floor(original) : original.toFixed(2);
                      return `${currencyInfo?.symbol || '$'}${formatted}`;
                    })()}
                  </ThemedText>
                ) : null;
              })()}
            </View>
            <View style={styles.priceRight}
              onStartShouldSetResponder={() => false}
              onStartShouldSetResponderCapture={() => false}
            >
              <ThemedText weight="semiBold" style={styles.monthlyEquivalent}>
                {(currencyInfo?.symbol || '$')}{getMonthlyEquivalent(tier)}/month
              </ThemedText>
              <View
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                style={styles.detailsToggle}
              >
                <TouchableOpacity
                  style={styles.detailsToggle}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  delayPressIn={0}
                  onPressIn={(e: any) => {
                    if (e?.stopPropagation) {e.stopPropagation();}
                  }}
                  onPress={(e: any) => {
                    // prevent parent card onPress from firing
                    if (e?.stopPropagation) {e.stopPropagation();}
                    try { triggerLightHaptic(); } catch {}
                    toggleCardExpansion(tier.id);
                  }}
                  onPressOut={(e: any) => {
                    if (e?.stopPropagation) {e.stopPropagation();}
                  }}
                  activeOpacity={0.8}
                >
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.faithGold}
                />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* original price now shown inline next to current price */}
        </View>

        {isSelected && (
          <View style={styles.selectionIndicator}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
          </View>
        )}
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
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} animated />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButtonTopRight} onPress={handleClose} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContainer}>
          <ThemedText style={styles.loadingText}>
            Loading pricing options...
          </ThemedText>
          <ThemedText style={styles.loadingSubtext}>
            Tiers: {pricingTiers.length}, Currency: {currencyInfo ? 'loaded' : 'loading...'}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} animated />
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
        onContinue={handleSuccessModalContinue}
      />

      {/* Header */}
      <View style={styles.header}>
        {/* Close button top-right */}
        <TouchableOpacity style={styles.closeButtonTopRight} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {/* Body content: sticky toggle header + scrollable content */}
      <View style={styles.content}>
        {/* Pricing Cards - Scrollable with sticky toggle */}
        <ScrollView
          style={styles.pricingScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContentPadding,
            { paddingBottom: Math.max(styles.scrollContentPadding.paddingBottom || 0, footerHeight + 24) },
          ]}
          scrollIndicatorInsets={{ bottom: footerHeight + 24 }}
        >
          {/* Main Content that should scroll under the sticky toggle */}
          <ThemedText weight="bold" style={styles.mainTitle}>
            {dynamicSalesCopy
              ? dynamicSalesCopy.title
              : isUpgradeMode
                ? 'Keep walking—grace for the next step'
                : fromPlanningLock
                  ? 'Upgrade to Plan Ahead'
                  : fromCopyTodosLock
                    ? 'Unlock Copy To-Dos & More'
                    : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                      ? 'Unlock Recurring Time Blocks'
                      : fromCalendarAutoSync
                        ? 'Unlock Calendar Auto-Sync'
                        : fromGuidedPromptsLock
                          ? 'Unlock Unlimited Guided Prompts'
                          : fromSmartJournalingLock
                            ? 'Upgrade to Unlock Smart Journaling'
                            : fromExportRestriction
                              ? 'Save your reflection as a PDF'
                              : (route.params as any)?.forceTransformationAnnual
                                ? 'Upgrade to Annual Plan for maximum savings!'
                                : (route.params as any)?.forceAnnualOnly
                                  ? 'Continue with annual billing for maximum savings!'
                                  : 'Continue walking with intention'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {dynamicSalesCopy
              ? dynamicSalesCopy.message
              : (route.params as any)?.forceTransformationAnnual
                ? 'Save the equivalent of 2 months when you choose annual billing. Continue your spiritual journey with all premium features.'
                : (route.params as any)?.forceAnnualOnly
                  ? 'You are currently on an annual plan. Continue with the same great value and maximum savings.'
                  : isUpgradeMode
                  ? 'Choose a plan that meets you where you are and helps you go deeper.'
                : fromPlanningLock
                  ? 'Gently prepare for what’s ahead with guided journaling, playbooks, and devotionals.'
                  : fromCopyTodosLock
                    ? `Copy ${incompleteTodosCount} incomplete to-do${incompleteTodosCount === 1 ? '' : 's'} to future dates, plus unlock advanced planning features, playbooks, and devotionals.`
                    : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                      ? 'Create recurring time blocks to build consistent rhythms. Also unlock generating playbooks and devotionals, calendar sync, and more powerful planning features.'
                      : fromCalendarAutoSync
                        ? 'Automatically sync your time blocks to your device calendar. Never miss what matters most, plus unlock recurring time blocks, playbooks, and devotionals.'
                        : fromGuidedPromptsLock
                          ? 'Access guided reflection prompts to deepen your walk with God, plus playbooks and devotionals.'
                          : fromSmartJournalingLock
                            ? 'Track time blocks, gratitude, prayers, and reflections to deepen your walk with God. Plus unlock playbooks, devotionals, and guided prompts.'
                            : fromExportRestriction
                              ? 'Export your playbooks and devotionals as PDF documents so you can return to them later, print them, or keep them as part of your faith journey.\n\nPDF export is available with Growth and Transformation plans.'
                              : routeParams?.onboardingFlow
                                ? '\nsiFia is designed for moments that return.\nWhen another situation arises, this space remains open to you.\n\nYou don’t have to resolve everything at once.\nYou can come back, slow down, and respond with care. Again and again.\n\nThis isn’t about fixing yourself.\nIt’s about having a steady place to pause, reflect, and stay faithful when things feel tangled.'
                                : 'Gentle structure for faithful living'}
          </ThemedText>
          {fromExportRestriction && (
            <View style={styles.exportGrowthSection}>
              <ThemedText weight="semiBold" style={styles.exportGrowthTitle}>
                What Growth includes
              </ThemedText>
              {[
                'More playbooks and devotionals for ongoing situations',
                'Smart journaling to help you reflect and notice patterns',
                'Gentle guidance for faithful next steps',
                'A consistent space to return when moments resurface',
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
            <View>
              <View style={styles.growthPlanSection}>
                <ThemedText style={styles.growthPlanListLabel}>
                  What staying supported includes
                </ThemedText>

                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Ongoing discernment support for emotionally complex moments
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Space for reflection, prayer, and Scripture
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    A place to pause before responding instead of reacting
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Gentle structure that supports faithfulness without pressure
                  </ThemedText>
                </View>
              </View>

              {shouldUseTrialProduct && (
                <View style={styles.trialBenefitsContainer}>
                  {(() => {
                    return (
                      <>
                        <ThemedText weight="semiBold" style={styles.trialBenefitsTitle}>
                          Start with a free 3-day trial
                        </ThemedText>
                        <View style={styles.trialSupportingTextContainerFirst}>
                          <ThemedText style={styles.trialSupportingText}>
                            This trial lets you experience the full siFia flow in real situations,
                            so you can discern whether this structure serves your current season.
                          </ThemedText>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}

              <View style={styles.growthPlanDuplicateCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setIsAboutGrowthExpanded(prev => !prev);
                  }}
                  style={styles.growthPlanToggleRow}
                >
                  <ThemedText weight="semiBold" style={styles.growthPlanTitle}>
                    About the Spark plan
                  </ThemedText>
                  <Ionicons
                    name={isAboutGrowthExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.hopeWhite}
                  />
                </TouchableOpacity>
                {isAboutGrowthExpanded && (
                  <>
                    <ThemedText style={[styles.trialSupportingText, styles.textLeftAlign]}>
                      The Spark plan is for everyday moments when you want gentle structure without pressure.
                    </ThemedText>
                    <ThemedText style={[styles.trialSupportingText, styles.textLeftAlign]}>
                      {'\n'}It gives you continued access to playbooks and devotionals, so you can return when situations resurface instead of starting over each time.
                    </ThemedText>
                    {shouldUseTrialProduct && (
                      <>
                        <View style={styles.trialDivider} />
                        <ThemedText style={[styles.trialSupportingText, styles.textLeftAlign, styles.additionalFollowupText]}>
                          After the trial, the Spark plan includes access to a monthly set of guided playbooks and devotionals.
                        </ThemedText>
                      </>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* Feature Bullets - hide for onboarding flow */}
          {!routeParams?.onboardingFlow && (
          <View style={styles.featuresSection}>
            {isUpgradeMode ? (
              // Upgrade mode benefits (pastoral, limit to 4)
              <>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Ongoing playbooks for moments that return
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Devotionals that meet you where you are
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    A steady structure for prayer, reflection and next steps
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Space to journal honestly and respond with wisdom
                  </ThemedText>
                </View>
              </>
            ) : (
              // Onboarding benefits (limit to 3, aligned copy)
              fromPlanningLock ? (
                <>
                  <ThemedText style={styles.featureBulletLabel}>
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
                    Hold decisions and to-dos in a calm, prayerful structure
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Build steady rhythms through guided journaling
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Return to playbooks and devotionals as situations unfold
                  </ThemedText>
                </View>
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
                      Unlimited devotionals and spiritual content to guide your journey.
                    </ThemedText>
                  </View>
                </>
              ) : null
            )}
          </View>
          )}

          {/* Trial Benefits Section - show whenever user is trial-eligible */}
          {!routeParams?.onboardingFlow && shouldUseTrialProduct && (
            <View style={styles.trialBenefitsContainer}>
              {(() => {
                return (
                  <>
                    <ThemedText weight="semiBold" style={styles.trialBenefitsTitle}>
                      Start with a free 3-day trial
                    </ThemedText>
                    <View style={styles.trialSupportingTextContainer}>
                      <ThemedText style={styles.trialSupportingText}>
                        This trial lets you experience the full siFia flow in real situations,
                        so you can discern whether this structure serves your current season.
                      </ThemedText>
                    </View>
                  </>
                );
              })()}
            </View>
          )}

          {!routeParams?.onboardingFlow && (
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
        )}

          {/* Bottom Links */}
          <View style={styles.bottomLinksContainer}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleRestorePurchase}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.linkText}>Restore Purchase</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleTermsOfService}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.linkText}>Terms of Service</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

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
        {/* Growth Price Display */}
        <View style={styles.footerPriceSection}>
          {/* Monthly/Annual Toggle */}
          <View style={styles.footerToggleContainer}>
            <TouchableOpacity
              style={[styles.footerToggleButton, !isAnnual && styles.activeFooterToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(false);
              }}
            >
              <ThemedText weight={!isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, !isAnnual && styles.activeFooterToggleText]}>Monthly</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerToggleButton, isAnnual && styles.activeFooterToggle]}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setIsAnnual(true);
              }}
            >
              <ThemedText weight={isAnnual ? 'semiBold' : 'medium'} style={[styles.footerToggleText, isAnnual && styles.activeFooterToggleText]}>Annual</ThemedText>
            </TouchableOpacity>
          </View>

          {(() => {
            const tier = pricingTiers.find(t => t.id === selectedTier)
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

              return (
                <>
                  <ThemedText weight="bold" style={styles.footerPriceMain}>
                    {`${symbol}${formatValue(annualPrice)}/year`}
                  </ThemedText>
                  <ThemedText style={styles.footerPriceSub}>Save 2 months free</ThemedText>
                  <ThemedText style={styles.footerPriceApprox}>
                    Annual plan saves you 2 months.
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

        <TouchableOpacity
          style={[
            styles.unlockButton,
            isPurchasing && styles.dimmedOpacity,
          ]}
          onPress={() => {
            try { triggerLightHaptic(); } catch {} // Immediate button press feedback
            logger.info('🔥 BUTTON TAPPED: Unlock Plan button pressed', {
              isPurchasing,
              selectedTier,
              isAnnual,
              timestamp: new Date().toISOString(),
            });

            if (isPurchasing) {
              logger.debug('Button disabled - purchase already in progress');
              return;
            }
            try { triggerSuccessHaptic(); } catch {} // Success feedback for action completion

            // Debug: Log button press and trial eligibility
            logger.info('Button pressed - checking trial eligibility', {
              shouldUseTrialProduct,
              canOfferTrial,
              isCurrentlyOnTrial,
              hasEverStartedTrial,
              isSeekerTier,
              currentUserTier,
              buttonText: shouldUseTrialProduct ? 'Start 3-Day Free Trial' : 'Regular purchase',
            });

            // If it's a trial button, navigate to trial offer screen instead of processing directly
            if (shouldUseTrialProduct) {
              logger.info('Navigating to trial offer screen for trial flow');
              try {
                // When coming from onboarding flow (StreakPlanScreen), don't pass source/returnTo so trial screen recognizes it as registration onboarding
                const isFromOnboarding = routeParams?.onboardingFlow === true;
                (navigation as any).navigate('OnboardingTrialOffer', {
                  selectedTierId: selectedTier,
                  billing: isAnnual ? 'annual' : 'monthly',
                  skipNotificationPreference: routeParams?.skipNotificationPreference,
                  returnTo: isFromOnboarding ? undefined : routeParams?.returnTo,
                  context: routeParams?.context,
                  source: isFromOnboarding ? undefined : routeParams?.source,
                  feature: isFromOnboarding ? undefined : routeParams?.feature,
                  dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
                  onboardingFlow: true,
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
          disabled={isPurchasing}
        >
          <ThemedText weight="bold" style={styles.unlockButtonText}>
            {isPurchasing
              ? 'Processing...'
              : shouldUseTrialProduct
                ? 'Start 3-Day Free Trial'
                : fromExportRestriction
                  ? `Upgrade to ${routeParams?.feature === 'export_pdf' ? 'PDF' : 'Word'} Export`
                  : fromSmartJournalingLock
                    ? 'Upgrade to Smart Journaling'
                    : isUpgradeMode
                      ? 'Upgrade and Continue'
                      : fromPlanningLock
                        ? 'Start Planning Ahead'
                        : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                          ? 'Upgrade to Repeat Options'
                          : fromCalendarAutoSync
                            ? 'Upgrade to Auto-Sync'
                            : fromCopyTodosLock
                              ? 'Upgrade to Copy To-Dos'
                              : (route.params as any)?.forceTransformationAnnual
                                ? 'Upgrade Plan to Annual'
                                : (route.params as any)?.forceAnnualOnly
                                  ? 'Continue with Annual Plan'
                                  : 'Continue My Journey'}
          </ThemedText>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.hopeWhite} style={styles.footerShield} />
          <ThemedText style={styles.footerText}>No Payment Now.</ThemedText>
          <ThemedText style={styles.footerText}> Cancel Anytime</ThemedText>
        </View>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  closeButtonTopRight: {
    position: 'absolute',
    top: 0,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
    marginTop: 4,
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
    fontSize: 24,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginTop: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: 22,
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
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
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
  cardsContainer: {
    marginBottom: 16,
  },
  pricingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30,
    padding: 16,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  selectedCard: {
    borderColor: Colors.growthGreen,
    // base background remains; selection tint is provided by selectedOverlay
  },
  focusedCard: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
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
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 18,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
  },
  tierDuration: {
    fontSize: 16,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginLeft: 8,
  },
  tierDescription: {
    fontSize: 16,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    marginBottom: 8,
    opacity: 0.9,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
    lineHeight: 20,
  },
  priceContainer: {
    alignItems: 'flex-start',
    width: '100%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'space-between',
    width: '100%',
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    flexGrow: 0,
    flex: 1,
    minWidth: 140,
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
    fontSize: 20,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    marginRight: 4,
    flexShrink: 0,
  },
  originalPrice: {
    fontSize: 16,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    flexShrink: 0,
    marginRight: 4,
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerPriceSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
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
    marginBottom: 6,
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
    marginBottom: 16,
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
