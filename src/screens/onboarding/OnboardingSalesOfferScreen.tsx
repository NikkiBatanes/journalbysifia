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
import DynamicPricingModal from '../../components/DynamicPricingModal';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { PurchaseLoadingModal } from '../../components/PurchaseLoadingModal';
import { PurchaseSuccessModal } from '../../components/PurchaseSuccessModal';
import { logger } from '../../utils/logger';
import { generateSalesCopy } from '../../utils/dynamicSalesCopy';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useScreenStatusBar } from '../../hooks/useScreenStatusBar';
import { useQueryClient } from '@tanstack/react-query';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';

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
  // Copy todos specific data
  incompleteTodosCount?: number;
  incompleteTodosPercentage?: number;
}

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const devotionalGating = useDevotionalGating();
  const { refreshSubscription: refreshNewSubscription } = useNewSubscription(user?.id || '');
  const queryClient = useQueryClient();

  // Always show light status bar (white icons) on this screen
  useScreenStatusBar('light', Colors.hopeWhite);

  const [isAnnual, setIsAnnual] = useState(false);
  const initialSelectedTier = (route.params as any)?.requestedDuration === 7 ? 'transformation' : 'growth';
  const [selectedTier, setSelectedTier] = useState(initialSelectedTier);
  const [hasManualTierSelection, setHasManualTierSelection] = useState(false);
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseValidated, setPurchaseValidated] = useState(false);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);
  const [lastPurchasedTier, setLastPurchasedTier] = useState<string | null>(null);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);

  // Check if we're in upgrade mode (from devotional modal) or onboarding mode
  const routeParams = route.params as RouteParams | undefined;
  const isUpgradeMode = routeParams?.upgradeMode || false;
  const currentUserTier = (routeParams?.currentTier || routeParams?.tier || devotionalGating.tier) as string;
  const requestedDuration = routeParams?.requestedDuration;
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

  // Derived: trial eligibility (only offer trial if user hasn't started one yet)
  const subscription = devotionalGating.subscription;
  const hasEverStartedTrial = Boolean(subscription?.trial_start_date);
  const isCurrentlyOnTrial = subscription?.tier === 'free_trial';
  const canOfferTrial = !isCurrentlyOnTrial && !hasEverStartedTrial;

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
    if (isNavigatingAway) {
      logger.debug('Already navigating away, ignoring duplicate call');
      return;
    }

    setIsNavigatingAway(true);
    setShowSuccessModal(false);
    setLastPurchasedTier(null);

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
      } else {
        // In onboarding mode, navigate to notification setup
        (navigation as any).navigate('OnboardingNotificationSetup', { userType: 'paid' });
      }
    }, 100);
  }, [navigation, isUpgradeMode, routeParams, isNavigatingAway]);

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

        // Filter out Spark tier if coming from Growth+ only features
        if (fromGrowthOnlyFeature) {
          tiers = tiers.filter(t => t.id !== 'spark');
          logger.debug('Filtered out Spark tier for Growth+ feature', {
            feature: growthOnlyFeatureName,
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
          // - If user requested a 7-day devotional, prefer 'transformation' tier, then any tier that unlocks the request
          // - Else prefer POPULAR, then 'growth', then first available
          if (!hasManualTierSelection && tiers.length > 0) {
            let chosen: PricingTier | undefined;
            if (requestedDuration === 7) {
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
  }, [hasManualTierSelection, isUpgradeMode, currentUserTier, requestedDuration, fromGrowthOnlyFeature, growthOnlyFeatureName]);

  // Cleanup navigation guard on unmount
  useEffect(() => {
    return () => {
      setIsNavigatingAway(false);
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

  const handleClose = async () => {
    try { triggerLightHaptic(); } catch {}

    // Note: Even for seeker users in upgrade mode, we continue to trial logic below if eligible

    logger.info('Sales offer cancelled - navigating to notification setup');

    // CRITICAL: Capture current state values before any async operations
    // This ensures we pass the correct tier/billing to trial screen
    const currentSelectedTier = selectedTier;
    const currentBilling = isAnnual ? 'annual' : 'monthly';
    logger.debug('Captured state for navigation', { currentSelectedTier, currentBilling });

    // If we're in onboarding flow, skip dynamic pricing and go straight to Trial/Notifications
    const isOnboardingFlow = (routeParams as any)?.onboardingFlow === true;
    if (isOnboardingFlow) {
      if (canOfferTrial) {
        setTimeout(() => {
          (navigation as any).navigate('OnboardingTrialOffer', {
            selectedTierId: currentSelectedTier,
            billing: currentBilling,
            onboardingFlow: true,
          });
        }, 50);
      } else {
        setTimeout(() => {
          (navigation as any).navigate('OnboardingNotificationSetup', { userType: 'freemium', fromCancelledSales: true });
        }, 50);
      }
      return;
    }

    // Check for dynamic discount eligibility first
    try {
      logger.debug('Checking dynamic discount eligibility:', {
        userId: user?.id,
        selectedTier,
        billing: isAnnual ? 'annual' : 'monthly',
        isUpgradeMode,
      });

      // First, track this opt-out to increment the count
      await pricingService.trackOptOut(user?.id);
      logger.debug('Tracked opt-out, checking discount...');

      const discount = await pricingService.getDynamicDiscount();

      logger.debug('Dynamic discount result', { discount });

      if (discount && !isUpgradeMode) {
        logger.info('Showing dynamic discount modal');
        setDynamicDiscount(discount);
        setShowDynamicModal(true);
        return;
      } else {
        logger.debug('No discount or upgrade mode - proceeding to notification');
      }
    } catch (error) {
      logger.error('Error checking dynamic discount', error as Error);
      // Continue to navigation even if discount check fails
    }

    // Check if we came from a specific screen (e.g., UserProfile) - prioritize returning there
    if (routeParams?.returnTo === 'UserProfile' || routeParams?.context === 'profile_settings') {
      logger.info('Returning to user profile from feature gating');
      // Check if user is eligible for trial and should see trial before returning to profile
      if (canOfferTrial) {
        logger.info('User eligible for trial - showing trial before returning to profile', {
          currentSelectedTier,
          currentBilling,
          dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
        });
        setTimeout(() => {
          (navigation as any).navigate('OnboardingTrialOffer', {
            selectedTierId: currentSelectedTier,
            billing: currentBilling,
            skipNotificationPreference: routeParams?.skipNotificationPreference,
            closeAllOnDismiss: true,
            onboardingFlow: (routeParams as any)?.onboardingFlow === true,
            returnTo: routeParams?.returnTo,
            context: routeParams?.context,
            dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
          });
        }, 100);
        return;
      } else {
        // No trial eligible, just go back to profile
        logger.info('No trial eligible - returning directly to profile');
        setTimeout(() => {
          navigation.goBack();
        }, 50);
        return;
      }
    }

    // Always show trial if eligible for cancelled sales offer (regardless of upgrade/onboarding)
    logger.info('Sales offer cancelled - checking trial eligibility');
    if (canOfferTrial) {
      logger.info('User eligible for trial - navigating to trial offer', {
        selectedTierId: currentSelectedTier,
        billing: currentBilling,
      });
      setTimeout(() => {
        (navigation as any).navigate('OnboardingTrialOffer', {
          selectedTierId: currentSelectedTier,
          billing: currentBilling,
          skipNotificationPreference: routeParams?.skipNotificationPreference,
          // Always close both Trial and Sales Offer when user cancels Sales Offer
          closeAllOnDismiss: true,
          // Forward onboarding flow flag so Trial can route to Notifications on dismiss
          onboardingFlow: (routeParams as any)?.onboardingFlow === true,
          returnTo: routeParams?.returnTo,
          context: routeParams?.context,
          // Forward the dismissBothModalsOnClose flag from profile usage counter
          dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
        });
      }, 100);
    } else {
      logger.info('No trial eligible - checking navigation context');
      setTimeout(() => {
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
    }
  };

  const handleUnlockPlan = async () => {
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

      // Determine product ID based on trial eligibility and billing period
      let productId: string;
      const billing = isAnnual ? 'annual' : 'monthly';

      // Check if user is eligible for free trial (only in onboarding, not upgrade)
      const isEligibleForTrial = canOfferTrial && !isUpgradeMode;

      logger.debug('Product ID selection:', {
        selectedTier,
        billing,
        isEligibleForTrial,
        canOfferTrial,
        isUpgradeMode,
      });

      // Use cached products if available, otherwise fetch
      const products = cachedProducts.length > 0 ? cachedProducts : await paymentService.getAvailableProducts();

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

      // CRITICAL: Sales Offer Screen must EXCLUDE .freetrial products
      // Match tier AND billing period AND ensure NO .freetrial suffix
      const targetProduct = products.find(p =>
        p.tier === selectedTier &&
        p.productId.includes(billing) &&
        !p.productId.includes('.freetrial')
      );

      if (targetProduct) {
        productId = targetProduct.productId;
        logger.debug('✅ Found non-trial product for Sales Offer', { productId });
      } else {
        // Log what we were looking for and what we found
        logger.warn('❌ No non-trial product found!', {
          lookingFor: {
            tier: selectedTier,
            billing,
            pattern: `app.sifia.com.${selectedTier}.${billing}`,
          },
          matchingTier: products.filter(p => p.tier === selectedTier).map(p => p.productId),
          matchingBilling: products.filter(p => p.productId.includes(billing)).map(p => p.productId),
        });

        // Construct product ID - NO trial suffix for sales offer (always paid)
        productId = `app.sifia.com.${selectedTier}.${billing}`;
        Logger.warn(`[OnboardingSalesOffer] ⚠️ No product found for tier ${selectedTier} with billing ${billing}, using constructed ID: ${productId}`, {
        component: 'OnboardingSalesOfferScreen',
      });
      }

      // NOW show loading modal right before Apple sheet
      setIsPurchasing(true);
      setShowSuccessModal(false);
      setPurchaseValidated(false);
      setLoadingStep('processing');
      setIsNavigatingAway(false); // Reset navigation guard for new purchase

      if (isUpgradeMode) {
        // In upgrade mode, purchase and show success modal before going back

        try {
          const result = await paymentService.purchaseSubscription(productId, user?.id || '');
          if (result.success) {
            setLoadingStep('validating');
            triggerSuccessHaptic();

            // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
            if (!result.transactionId) {
              logger.error('❌ Upgrade missing transaction ID - possible stale state');
              throw new Error('Invalid purchase - no transaction ID');
            }

            logger.debug('Upgrade transaction verification:', {
              hasTransactionId: !!result.transactionId,
              transactionId: result.transactionId?.substring(0, 10) + '...',
            });

            // OPTIMIZED: Direct database update with transaction ID (skip Apple sync)
            // We already have the transaction ID from successful purchase - no need to query Apple again
            logger.info('🔄 Starting database subscription upgrade', {
              userId: user?.id,
              selectedTier,
              transactionId: result.transactionId?.substring(0, 10) + '...'
            });

            await NewSubscriptionService.upgradeSubscription(user?.id || '', {
              target_tier: selectedTier as any,
              platform: 'apple',
              platform_subscription_id: result.transactionId,
            });

            logger.info('✅ Database upgrade completed, starting cache refresh');

            // OPTIMIZED: Single cache invalidation and parallel refresh
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ['subscription', user?.id],
                refetchType: 'active',
              }),
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

            // Auto-dismiss sales offer screen after successful payment
            // Auto-navigate after a short delay to show success briefly
            setTimeout(() => {
              logger.info('Auto-dismissing success modal and navigating back');
              handleSuccessModalContinue();
            }, 2000); // Show success for 2 seconds then auto-dismiss
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
          const result = await paymentService.purchaseSubscription(productId, user?.id || '');

          logger.debug('Purchase result', {
            success: result.success,
            error: result.error,
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

            // OPTIMIZED: Direct database update with transaction ID (skip Apple sync)
            // We already have the transaction ID from successful purchase - no need to query Apple again
            logger.debug('Updating subscription directly with transaction ID...');
            try {
              await NewSubscriptionService.upgradeSubscription(user?.id || '', {
                target_tier: selectedTier as any,
                platform: 'apple',
                platform_subscription_id: result.transactionId,
              });
              logger.info('✅ Subscription upgraded in database');

              // OPTIMIZED: Single cache invalidation with parallel refresh
              logger.debug('Refreshing subscription cache...');
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
          setShowSuccessModal(true);

          // Auto-dismiss sales offer screen after successful payment
          // Auto-navigate after a short delay to show success briefly
          setTimeout(() => {
            handleSuccessModalContinue();
          }, 2000); // Show success for 2 seconds then auto-dismiss
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

          // For other errors, log silently instead of showing alert
          logger.error('Purchase error (silent):', purchaseError?.message || 'Unknown error');
          setIsPurchasing(false);
        }
      }
    } catch (error) {
      logger.error('Error in handleUnlockPlan', error as Error);
      Alert.alert(
        'Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
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
    const growthVisible = pricingTiers.some(t => t.id === 'growth');

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
        {(tier.isPopular || (tier.id === 'transformation' && !growthVisible)) && (
          <View style={styles.popularBadge}>
            <ThemedText weight="semiBold" style={styles.popularText}>POPULAR</ThemedText>
          </View>
        )}

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
        isTrial={false}
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
          contentContainerStyle={styles.scrollContentPadding}
          scrollIndicatorInsets={{ bottom: 60 }}
          stickyHeaderIndices={[0]}
        >
          {/* Sticky header: Monthly / Annual toggle */}
          <View style={styles.stickyToggleHeader}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, !isAnnual && styles.activeToggle]}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setIsAnnual(false);
                }}
              >
                <ThemedText weight={!isAnnual ? 'semiBold' : 'medium'} style={[styles.toggleText, !isAnnual && styles.activeToggleText]}>Monthly</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, isAnnual && styles.activeToggle]}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setIsAnnual(true);
                }}
              >
                <ThemedText weight={isAnnual ? 'semiBold' : 'medium'} style={[styles.toggleText, isAnnual && styles.activeToggleText]}>Annual</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

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
                              ? `Unlock ${routeParams?.feature === 'export_pdf' ? 'PDF' : 'Word'} Export`
                              : "You've taken your first step!"}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {dynamicSalesCopy
              ? dynamicSalesCopy.message
              : isUpgradeMode
                ? 'Choose a plan that meets you where you are and helps you go deeper.'
                : fromPlanningLock
                  ? 'Unlock future planning—plus guided journaling, playbooks, and devotionals to support your journey.'
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
                              ? `Export your playbooks and devotionals as ${routeParams?.feature === 'export_pdf' ? 'PDF' : 'Word'} documents. Available exclusively with Growth or Transformation plans.`
                              : 'Keep walking, one faithful step at a time.'}
          </ThemedText>

          {/* Feature Bullets */}
          <View style={styles.featuresSection}>
            {isUpgradeMode ? (
              // Upgrade mode benefits (pastoral, limit to 3)
              <>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Devotionals at the pace you’re ready for—longer paths when you want to linger.
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    More monthly devotionals and playbooks to support steady, faithful rhythms.
                  </ThemedText>
                </View>
                <View style={styles.featureBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                  <ThemedText style={styles.bulletText}>
                    Simple, guided journaling tools to help you hear and respond to God.
                  </ThemedText>
                </View>
              </>
            ) : (
              // Onboarding benefits (limit to 3, aligned copy)
              fromPlanningLock ? (
                <>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Plan days ahead with clear focus, to-dos, and time blocks.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Stay consistent with guided journaling that builds faithful rhythms.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Gain momentum with personalized playbooks and devotionals.
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
              ) : (
                <>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Personalized playbooks and devotionals delivered at a pace that fits your plan.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>
                      Track growth with journaling tools and deeper reflections over time.
                    </ThemedText>
                  </View>
                  <View style={styles.featureBullet}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                    <ThemedText style={styles.bulletText}>Your journey, your pace.</ThemedText>
                  </View>
                </>
              )
            )}
          </View>
          {isAnnual && (
            <View style={styles.freeBannerContainer}>
              <ThemedText weight="semiBold" style={styles.freeBannerText}>2 months free</ThemedText>
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
        </ScrollView>
      </View>

      {/* Fixed Footer CTA */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[
            styles.unlockButton,
            isPurchasing && styles.dimmedOpacity,
          ]}
          onPress={() => {
            if (isPurchasing) {
              return;
            }
            try { triggerSuccessHaptic(); } catch {}
            handleUnlockPlan();
          }}
          activeOpacity={0.9}
          disabled={isPurchasing}
        >
          <ThemedText weight="bold" style={styles.unlockButtonText}>
            {isPurchasing
              ? 'Processing...'
              : fromExportRestriction
                ? `Upgrade to ${routeParams?.feature === 'export_pdf' ? 'PDF' : 'Word'} Export`
                : fromSmartJournalingLock
                  ? 'Upgrade to Smart Journaling'
                  : isUpgradeMode
                    ? 'Upgrade and Continue'
                    : fromPlanningLock
                      ? 'Start Planning Ahead'
                      : fromCopyTodosLock
                        ? 'Upgrade to Copy To-Dos'
                        : (fromRepeatOptionsLock || fromRepeatUpgradePrompt)
                          ? 'Upgrade to Repeat Options'
                          : fromCalendarAutoSync
                            ? 'Upgrade to Auto-Sync'
                            : 'Continue My Journey'}
          </ThemedText>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.hopeWhite} style={styles.footerShield} />
          <ThemedText style={styles.footerText}>Cancel anytime.</ThemedText>
          <ThemedText style={styles.footerText}> Secure checkout</ThemedText>
        </View>
      </View>

      {/* Dynamic Pricing Modal */}
      {dynamicDiscount && (
        <DynamicPricingModal
          visible={showDynamicModal}
          onClose={() => {
            setShowDynamicModal(false);
            if (isUpgradeMode) {
              // No trial in upgrade mode
              const source = routeParams?.source;
              if (source === 'guided_prompts_lock') {
                navigation.navigate('Dashboard' as any);
              } else {
                navigation.goBack();
              }
            } else if (canOfferTrial) {
              // Capture current state before navigation
              const currentSelectedTier = selectedTier;
              const currentBilling = isAnnual ? 'annual' : 'monthly';
              navigation.navigate('OnboardingTrialOffer' as any, {
                selectedTierId: currentSelectedTier,
                billing: currentBilling,
                skipNotificationPreference: routeParams?.skipNotificationPreference,
                closeAllOnDismiss: true,
                source: routeParams?.source,
                feature: routeParams?.feature,
                returnTo: routeParams?.returnTo,
                context: routeParams?.context,
                dismissBothModalsOnClose: routeParams?.dismissBothModalsOnClose,
              });
            } else {
              const source = routeParams?.source;
              if (source === 'guided_prompts_lock') {
                navigation.navigate('Dashboard' as any);
              } else {
                navigation.goBack();
              }
            }
          }}
          discountPercentage={dynamicDiscount.percentage}
          originalPrice={getCurrentPrice()}
          tier={selectedTier}
          isAnnual={isAnnual}
        />
      )}

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
    maxWidth: 720,
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
    opacity: 0.8,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
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
    fontSize: 12,
    // weight handled by ThemedText
    color: Colors.hopeWhite,
  },
  freeBadgeSmall: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  freeBadgeSmallText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  loadingSubtext: {
    color: Colors.hopeWhite,
    fontSize: 12,
    marginTop: 8,
  },
  freeBannerContainer: {
    alignSelf: 'center',
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 16,
  },
  freeBannerText: {
    fontSize: 14,
    color: Colors.hopeWhite,
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
    paddingVertical: 16,
    borderRadius: 12,
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
    paddingBottom: 80,
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
});

export default withErrorBoundary(OnboardingSalesOfferScreen, 'OnboardingSalesOfferScreen');
