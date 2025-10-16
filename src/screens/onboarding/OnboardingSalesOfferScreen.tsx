import React, { useState, useEffect } from 'react';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import Ionicons from 'react-native-vector-icons/Ionicons';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { Colors } from '../../theme';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import pricingService, { LocationPricing, PricingTier as ServicePricingTier } from '../../services/pricingService';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { useDevotionalGating } from '../../hooks/useDevotionalGating';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { isDevotionalDurationLocked } from '../../utils/tierLockingRules';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import type { SubscriptionTier } from '../../types/subscription';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import PlatformPaymentService from '../../services/PlatformPaymentService';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import DynamicPricingModal from '../../components/DynamicPricingModal';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import ThemedText from '../../components/common/ThemedText';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { PurchaseLoadingModal } from '../../components/PurchaseLoadingModal';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';
import { logger } from '../../utils/logger';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';

// removed Dimensions width as unused

// Use PricingTier from pricingService to avoid drift
type PricingTier = ServicePricingTier;

interface RouteParams {
  upgradeMode?: boolean;
  currentTier?: string;
  requestedDuration?: number; // when user tapped a locked duration (e.g., 7 days)
  // Navigation context flags
  source?: string; // e.g., 'planning_lock', 'copy_todos_lock', 'guided_prompts_lock'
  feature?: string; // e.g., 'future_planning', 'copy_todos', 'guided_prompts'
  tier?: string; // caller-reported tier
  skipNotificationPreference?: boolean;
  // Copy todos specific data
  incompleteTodosCount?: number;
  incompleteTodosPercentage?: number;
}

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const devotionalGating = useDevotionalGating();


  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTier, setSelectedTier] = useState('growth');
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'processing' | 'validating' | 'activating' | 'completing'>('processing');

  // Check if we're in upgrade mode (from devotional modal) or onboarding mode
  const routeParams = route.params as RouteParams | undefined;
  const isUpgradeMode = routeParams?.upgradeMode || false;
  const currentUserTier = (routeParams?.currentTier || routeParams?.tier || devotionalGating.tier) as string;
  const requestedDuration = routeParams?.requestedDuration;
  const fromPlanningLock = !isUpgradeMode && routeParams?.source === 'planning_lock' && routeParams?.feature === 'future_planning' && (currentUserTier === 'seeker' || !currentUserTier);
  const fromCopyTodosLock = !isUpgradeMode && routeParams?.source === 'copy_todos_lock' && routeParams?.feature === 'copy_todos';
  const fromGuidedPromptsLock = !isUpgradeMode && routeParams?.source === 'guided_prompts_lock' && routeParams?.feature === 'guided_prompts' && currentUserTier === 'seeker';
  const incompleteTodosCount = routeParams?.incompleteTodosCount || 0;
  const incompleteTodosPercentage = routeParams?.incompleteTodosPercentage || 0;

  // Derived: trial eligibility (only offer trial if user hasn't started one yet)
  const subscription = devotionalGating.subscription;
  const hasEverStartedTrial = Boolean(subscription?.trial_start_date);
  const isCurrentlyOnTrial = subscription?.tier === 'free_trial';
  const canOfferTrial = !isCurrentlyOnTrial && !hasEverStartedTrial;

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

        const currency = await pricingService.getCurrencyInfo();
        logger.debug('Currency info loaded', { currency });
        logger.debug('Sample tier prices', tiers[0] ? {
          tier: tiers[0].id,
          monthly: tiers[0].monthlyPrice,
          annual: tiers[0].annualPrice,
          symbol: currency.symbol,
        } : { status: 'No tiers' });

        // If a specific devotional duration was requested, only show tiers that UNLOCK it
        if (requestedDuration && tiers.length > 0) {
          const unlocked = tiers.filter(t => {
            // pricingService tier ids align with SubscriptionTier ids for paid plans
            const tierId = t.id as SubscriptionTier;
            return !isDevotionalDurationLocked(tierId, requestedDuration);
          });
          if (unlocked.length > 0) {
            tiers = unlocked;
          }
        }

        if (isMounted) {
          setPricingTiers(tiers);
          setCurrencyInfo(currency);

          // FORCE Philippine currency in development for testing
          if (__DEV__) {
            console.log('[SalesOfferScreen] 🔧 DEV MODE: Forcing Philippine currency symbol');
            setCurrencyInfo({ currency: 'PHP', symbol: '₱', multiplier: 1.0 });
          }

          // Default selection: prefer POPULAR, then 'growth', then first
          if (tiers.length > 0) {
            const popularTier = tiers.find(t => (t as any).isPopular === true);
            const growthTier = tiers.find(t => t.id === 'growth');
            const fallback = tiers[0];
            const chosen = popularTier || growthTier || fallback;
            setSelectedTier(chosen.id);
          }
        }
      } catch (e) {
        console.error('Failed to load pricing:', e);
      }
    };
    loadPricing();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpgradeMode, currentUserTier]); // requestedDuration intentionally excluded - only run on mode/tier change

  // Auto-collapse all expanded feature sections when billing period changes
  useEffect(() => {
    setExpandedCards(new Set());
  }, [isAnnual]);

  const handleClose = async () => {
    try { triggerLightHaptic(); } catch {}

    // For Seeker users in upgrade mode, just go back immediately
    const currentTier = routeParams?.currentTier;
    if (currentTier === 'seeker' && isUpgradeMode) {
      logger.debug('Seeker user closing - going back to previous screen');
      navigation.goBack();
      return;
    }

    logger.info('Sales offer cancelled - navigating to notification setup');

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

      const discount = await pricingService.getDynamicDiscount(
        user?.id,
        selectedTier,
        isAnnual ? 'annual' : 'monthly'
      );

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

    // Always show trial if eligible for cancelled sales offer
    logger.info('Sales offer cancelled - checking trial eligibility');
    if (canOfferTrial) {
      logger.info('User eligible for trial - navigating to trial offer');
      setTimeout(() => {
        (navigation as any).navigate('OnboardingTrialOffer', {
          selectedTierId: selectedTier,
          billing: isAnnual ? 'annual' : 'monthly',
          skipNotificationPreference: routeParams?.skipNotificationPreference,
        });
      }, 100);
    } else {
      logger.info('No trial eligible - navigating to notification setup');
      setTimeout(() => {
        if (!routeParams?.skipNotificationPreference) {
          // During onboarding flow, go to notification setup
          logger.debug('Onboarding flow - navigating to notification setup');
          (navigation as any).navigate('OnboardingNotificationSetup', {
            userType: 'freemium',
            fromCancelledSales: true
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

    try {
      setIsPurchasing(true);
      triggerLightHaptic();

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

      try {
        const products = await paymentService.getAvailableProducts();
        // Match BOTH tier AND billing period to ensure correct product selection
        const targetProduct = products.find(p =>
          p.tier === selectedTier &&
          p.productId.includes(billing)
        );

        if (targetProduct) {
          productId = targetProduct.productId;
          console.log(`[OnboardingSalesOffer] ✅ Found matching product: ${productId}`);
          console.log(`[OnboardingSalesOffer] Product details:`, {
            tier: targetProduct.tier,
            price: targetProduct.price,
            title: targetProduct.title,
          });
        } else {
          // Construct product ID - NO trial suffix for sales offer (always paid)
          productId = `app.sifia.com.${selectedTier}.${billing}`;
          console.warn(`[OnboardingSalesOffer] ⚠️ No product found for tier ${selectedTier} with billing ${billing}, using constructed ID: ${productId}`);
        }
      } catch (error) {
        // Fallback: construct product ID - NO trial suffix for sales offer
        productId = `app.sifia.com.${selectedTier}.${billing}`;
        console.warn(`[OnboardingSalesOffer] ⚠️ Failed to get products, using constructed ID: ${productId}`);
      }

      console.log(`[OnboardingSalesOffer] 🛒 INITIATING PURCHASE:`, {
        productId,
        selectedTier,
        billing,
        isUpgradeMode,
        userId: user?.id,
      });
      console.log(`[OnboardingSalesOffer] ⚠️ IMPORTANT: Apple payment sheet MUST show now!`);
      console.log(`[OnboardingSalesOffer] If payment sheet doesn't show, check AppleStoreKitService`);


      if (isUpgradeMode) {
        // In upgrade mode, purchase and go back to previous screen

        try {
          setIsPurchasing(true);
          setLoadingStep('processing');
          const result = await paymentService.purchaseSubscription(productId, user?.id || '');
          if (result.success) {
            setLoadingStep('validating');
            triggerSuccessHaptic();
            // Refresh subscription and close
            await devotionalGating.refreshSubscription();

            // CRITICAL: Verify this is a genuine new purchase, not cached/stale state
            if (!result.transactionId) {
              logger.error('❌ Upgrade missing transaction ID - possible stale state');
              throw new Error('Invalid purchase - no transaction ID');
            }

            logger.debug('Upgrade transaction verification:', {
              hasTransactionId: !!result.transactionId,
              transactionId: result.transactionId?.substring(0, 10) + '...',
            });

            // Navigate back to the original context instead of just going back
            const source = routeParams?.source;
            if (source === 'repeat_options' || source === 'calendar_upgrade_prompt' || source === 'repeat_upgrade_prompt') {
              // Go back multiple times to return to TimeBlock screen
              navigation.goBack();
              setTimeout(() => navigation.goBack(), 100);
            } else {
              navigation.goBack();
            }
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
          setIsPurchasing(true);
          setLoadingStep('processing');

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

            // CRITICAL: Wait for subscription to refresh BEFORE navigating
            logger.debug('Syncing subscription with Apple...');
            try {
              const { AppleStoreKitService } = await import('../../services/AppleStoreKitService');
              const storeKitService = AppleStoreKitService.getInstance();

              // CRITICAL FIX: Check if this is a cached purchase from previous attempt
              const RNIap = await import('react-native-iap');
              const availablePurchases = await RNIap.default.getAvailablePurchases();
              const currentPurchase = availablePurchases?.find((p: any) =>
                p.productId.includes(selectedTier) &&
                p.productId.includes(isAnnual ? 'annual' : 'monthly')
              );

              if (currentPurchase && currentPurchase.transactionDate) {
                // Check if this purchase is recent (within last 2 minutes)
                const purchaseTime = new Date(currentPurchase.transactionDate).getTime();
                const now = Date.now();
                const twoMinutesAgo = now - (2 * 60 * 1000);

                if (purchaseTime < twoMinutesAgo) {
                  logger.warn('⚠️ Found old cached purchase - ignoring and requiring fresh payment');
                  throw new Error('STALE_PURCHASE_CACHE');
                }
              }

              await storeKitService.checkAndSyncSubscriptionStatus(user?.id || '');
              logger.info('✅ Subscription synced with Apple');

              // Also refresh local state
              await devotionalGating.refreshSubscription();
              logger.info('✅ Local subscription state refreshed');

              // Verify the subscription was actually updated
              const newTier = devotionalGating.tier;
              logger.debug('New tier after refresh', { newTier });

              if (newTier === 'seeker') {
                logger.warn('⚠️ Still showing seeker after purchase!');
                logger.warn('This means the database was not updated by the purchase listener');
                logger.warn('Attempting manual purchase restoration...');

                // Try to restore purchases to trigger the listener
                try {
                  const { AppleStoreKitService: AppleStoreKit } = await import('../../services/AppleStoreKitService');
                  const storeKit = AppleStoreKit.getInstance();
                  await storeKit.restorePurchases(user?.id || '');
                  logger.info('Restore purchases completed');
                } catch (restoreError) {
                  logger.error('Restore failed', restoreError as Error);
                }

                // Give it one more second and try again
                await new Promise(resolve => setTimeout(resolve, 2000));
                await devotionalGating.refreshSubscription();
                logger.debug('Second refresh - tier', { tier: devotionalGating.tier });
              }
            } catch (refreshError) {
              logger.error('Failed to refresh subscription', refreshError as Error);
              // Continue to navigation even if refresh fails
            }

            // ALWAYS navigate after successful purchase, even if refresh failed
            logger.debug('Navigating to OnboardingNotificationSetup');
            setTimeout(() => {
              (navigation as any).navigate('OnboardingNotificationSetup', { userType: 'paid' });
            }, 100);
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
      setIsPurchasing(false);
    }
  };


  const getCurrentPrice = () => {
    const tier = pricingTiers.find(t => t.id === selectedTier);
    return tier ? (isAnnual ? tier.annualPrice : tier.monthlyPrice) : 0;
  };

  const getMonthlyEquivalent = (tier: PricingTier) => {
    if (isAnnual) {
      return (tier.annualPrice / 12).toFixed(2);
    }
    return tier.monthlyPrice.toFixed(2);
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
        onPress={() => {
          try { triggerLightHaptic(); } catch {}
          setSelectedTier(tier.id);
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
                } else if (tier.id === 'transformation' || tier.id === 'family') {
                  processed.push('Access all devotional durations (1-7 days)');
                }
                // No extra line for transformation/family as requested (no unlocked text)
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
                {(currencyInfo?.symbol || '$')}{isAnnual ? tier.annualPrice.toFixed(2) : tier.monthlyPrice.toFixed(2)}
              </ThemedText>
              {(() => {
                const original = isAnnual ? tier.annualOriginal : tier.monthlyOriginal;
                const current = isAnnual ? tier.annualPrice : tier.monthlyPrice;
                return original && original > current ? (
                  <ThemedText weight="semiBold" style={styles.originalPrice}>
                    {(currencyInfo?.symbol || '$')}{original.toFixed(2)}
                  </ThemedText>
                ) : null;
              })()}
            </View>
            <View style={styles.priceRight}
              onStartShouldSetResponder={() => false}
              onStartShouldSetResponderCapture={() => false}
            >
              <ThemedText weight="semiBold" style={styles.monthlyEquivalent}>
                {(currencyInfo?.symbol || '$')}{isAnnual ? getMonthlyEquivalent(tier) : tier.monthlyPrice.toFixed(2)}/month
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButtonTopRight} onPress={handleClose} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ThemedText style={{ color: Colors.hopeWhite, fontSize: 16 }}>
            Loading pricing options...
          </ThemedText>
          <ThemedText style={{ color: Colors.hopeWhite, fontSize: 12, marginTop: 8 }}>
            Tiers: {pricingTiers.length}, Currency: {currencyInfo ? 'loaded' : 'loading...'}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ENTERPRISE IMPROVEMENT: Loading Modal */}
      <PurchaseLoadingModal
        visible={isPurchasing}
        step={loadingStep}
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
            {isUpgradeMode
              ? 'Keep walking—grace for the next step'
              : fromPlanningLock
                ? 'Upgrade to Plan Ahead'
                : fromCopyTodosLock
                  ? 'Unlock Copy To-Dos & More'
                  : fromGuidedPromptsLock
                    ? 'Unlock Unlimited Guided Prompts'
                    : "You've taken your first step!"}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isUpgradeMode
              ? 'Choose a plan that meets you where you are and helps you go deeper.'
              : fromPlanningLock
                ? 'Unlock future planning—plus guided journaling, playbooks, and devotionals to support your journey.'
                : fromCopyTodosLock
                  ? `Copy ${incompleteTodosCount} incomplete to-do${incompleteTodosCount === 1 ? '' : 's'} to future dates, plus unlock advanced planning features and unlimited devotionals.`
                  : fromGuidedPromptsLock
                    ? 'Access unlimited guided reflection prompts to deepen your spiritual practice, plus playbooks and devotionals.'
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
                    Simple, guided journaling to help you hear and respond to God.
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
                      Track growth with smart journaling and deeper reflections over time.
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
          <View style={styles.cardsContainer}>
            {pricingTiers.length > 0 ? (
              pricingTiers.map(renderPricingCard)
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ThemedText style={{ color: Colors.hopeWhite, textAlign: 'center' }}>
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
            isPurchasing && { opacity: 0.6 },
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
            {isPurchasing ? 'Processing...' : (isUpgradeMode ? 'Upgrade and Continue' : (fromPlanningLock ? 'Start Planning Ahead' : fromCopyTodosLock ? 'Upgrade to Copy To-Dos' : 'Continue My Journey'))}
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
              navigation.navigate('OnboardingTrialOffer' as any, {
                selectedTierId: selectedTier,
                billing: isAnnual ? 'annual' : 'monthly',
                skipNotificationPreference: routeParams?.skipNotificationPreference,
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
    paddingBottom: 60,
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

export default OnboardingSalesOfferScreen;
