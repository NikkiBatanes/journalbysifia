import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService, { LocationPricing, PricingTier as ServicePricingTier } from '../../services/pricingService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useDevotionalGating } from '../../hooks/useDevotionalGating';
import { usePlatformSubscription } from '../../hooks/usePlatformSubscription';
import { isDevotionalDurationLocked } from '../../utils/tierLockingRules';
import type { SubscriptionTier } from '../../types/subscription';
import DynamicPricingModal from '../../components/DynamicPricingModal';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

// removed Dimensions width as unused

// Use PricingTier from pricingService to avoid drift
type PricingTier = ServicePricingTier;

interface RouteParams {
  upgradeMode?: boolean;
  currentTier?: string;
  requestedDuration?: number; // when user tapped a locked duration (e.g., 7 days)
  // Navigation context flags
  source?: string; // e.g., 'planning_lock'
  feature?: string; // e.g., 'future_planning'
  tier?: string; // caller-reported tier
  skipNotificationPreference?: boolean;
}

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Theme integration - match Dashboard approach
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontRegular = getFontFamily(fontKey, 'regular');
  const fontMedium = getFontFamily(fontKey, 'medium');
  const fontSemiBold = getFontFamily(fontKey, 'semiBold');
  const fontBold = getFontFamily(fontKey, 'bold');
  
  // Use dynamic styles with current theme fonts - match Dashboard pattern
  const styles = useMemo(() => createStyles({
    regular: fontRegular,
    medium: fontMedium,
    semiBold: fontSemiBold,
    bold: fontBold,
  }), [fontRegular, fontMedium, fontSemiBold, fontBold]);
  
  const { upgradeSubscription } = useNewSubscription(user?.id || '');
  const devotionalGating = useDevotionalGating();
  const platformSubscription = usePlatformSubscription();
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTier, setSelectedTier] = useState('growth');
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  
  // Check if we're in upgrade mode (from devotional modal) or onboarding mode
  const routeParams = route.params as RouteParams | undefined;
  const isUpgradeMode = routeParams?.upgradeMode || false;
  const currentUserTier = (routeParams?.currentTier || routeParams?.tier || devotionalGating.tier) as string;
  const requestedDuration = routeParams?.requestedDuration;
  const fromPlanningLock = !isUpgradeMode && routeParams?.source === 'planning_lock' && routeParams?.feature === 'future_planning' && (currentUserTier === 'seeker' || !currentUserTier);

  // Derived: trial eligibility (only offer trial if user hasn't started one yet)
  const subscription = devotionalGating.subscription;
  const hasEverStartedTrial = Boolean(subscription?.trial_start_date);
  const isCurrentlyOnTrial = subscription?.tier === 'free_trial';
  const canOfferTrial = !isUpgradeMode && !isCurrentlyOnTrial && !hasEverStartedTrial;

  // Load location-adjusted pricing and currency
  useEffect(() => {
    let isMounted = true;
    const loadPricing = async () => {
      try {
        let tiers: PricingTier[];
        
        if (isUpgradeMode) {
          // In upgrade mode, only show tiers higher than current user tier
          tiers = await pricingService.getLocationAdjustedUpgradeTiers(currentUserTier);
        } else {
          // In onboarding mode, show all tiers
          tiers = await pricingService.getLocationAdjustedPricing();
        }
        
        const currency = await pricingService.getCurrencyInfo();

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
  }, [isUpgradeMode, currentUserTier]);

  // Auto-collapse all expanded feature sections when billing period changes
  useEffect(() => {
    setExpandedCards(new Set());
  }, [isAnnual]);

  const handleClose = async () => {
    try { triggerLightHaptic(); } catch {}
    
    if (isUpgradeMode) {
      // In upgrade mode, check for dynamic discount but don't show trial
      const shouldShowDiscount = await pricingService.trackUserOptOut(user?.id, selectedTier);

      if (shouldShowDiscount) {
        const discount = await pricingService.getDynamicDiscount(
          user?.id,
          selectedTier,
          isAnnual ? 'annual' : 'monthly'
        );
        if (discount) {
          setDynamicDiscount(discount);
          setShowDynamicModal(true);
          return;
        }
      }
      
      // In upgrade mode, just go back to previous screen
      navigation.goBack();
    } else {
      // In onboarding mode, show trial offer as before
      const shouldShowDiscount = await pricingService.trackUserOptOut(user?.id, selectedTier);

      if (shouldShowDiscount) {
        const discount = await pricingService.getDynamicDiscount(
          user?.id,
          selectedTier,
          isAnnual ? 'annual' : 'monthly'
        );
        if (discount) {
          setDynamicDiscount(discount);
          setShowDynamicModal(true);
          return;
        }
      }
      if (canOfferTrial) {
        navigation.navigate('OnboardingTrialOffer' as any, {
          selectedTierId: selectedTier,
          billing: isAnnual ? 'annual' : 'monthly',
        });
      } else {
        navigation.goBack();
      }
    }
  };

  const handleUnlockPlan = async () => {
    try {
      triggerLightHaptic();
      
      if (isUpgradeMode) {
        // In upgrade mode, go directly to platform subscription
        const PlatformPaymentService = (await import('../../services/PlatformPaymentService')).default;
        const paymentService = PlatformPaymentService.getInstance();
        
        // For development/testing, use a fallback approach since products may not be available
        let productId: string;
        
        try {
          const products = await paymentService.getAvailableProducts();
          const targetProduct = products.find(p => p.tier === selectedTier);
          
          if (targetProduct) {
            productId = targetProduct.productId;
          } else {
            // Fallback: construct expected product ID format
            productId = `com.yourcompany.sifia.${selectedTier}.monthly`;
            console.warn(`[OnboardingSalesOffer] No product found for tier ${selectedTier}, using fallback: ${productId}`);
          }
        } catch (error) {
          // Fallback if getAvailableProducts fails
          productId = `com.yourcompany.sifia.${selectedTier}.monthly`;
          console.warn(`[OnboardingSalesOffer] Failed to get products, using fallback: ${productId}`);
        }
        
        try {
          const result = await paymentService.purchaseSubscription(productId, user?.id || '');
          if (result.success) {
            triggerSuccessHaptic();
            // Refresh subscription and close
            await devotionalGating.refreshSubscription();
            navigation.goBack();
          } else {
            throw new Error(result.error || 'Purchase failed');
          }
        } catch (purchaseError: any) {
          console.error('Purchase failed:', purchaseError);
          Alert.alert('Purchase Failed', purchaseError?.message || 'Something went wrong. Please try again.');
        }
      } else {
        // In onboarding mode, use existing flow
        await upgradeSubscription({
          target_tier: selectedTier as any,
          platform: 'local_test',
          is_family_upgrade: selectedTier === 'family'
        });
        
        triggerSuccessHaptic();
        navigation.navigate('OnboardingPaymentConfirmation' as any, {
          selectedTier,
          isAnnual,
          price: getCurrentPrice(),
          success: true
        });
      }
    } catch (error) {
      console.error('Failed to process subscription:', error);
      if (!isUpgradeMode) {
        // Navigate to payment processing for real payment flow
        navigation.navigate('OnboardingPaymentProcessing' as any, {
          selectedTier,
          isAnnual,
          price: getCurrentPrice(),
        });
      }
    }
  };

  const handleUpgradeSuccess = () => {
    triggerSuccessHaptic();
    navigation.goBack();
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
    const isFocused = tier.id === 'growth'; // Growth tier always focused
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
              { backgroundColor: tier.id === 'growth' ? Colors.alertCoral : Colors.growthGreen },
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
                    if (e?.stopPropagation) e.stopPropagation();
                  }}
                  onPress={(e: any) => {
                    // prevent parent card onPress from firing
                    if (e?.stopPropagation) e.stopPropagation();
                    try { triggerLightHaptic(); } catch {}
                    toggleCardExpansion(tier.id);
                  }}
                  onPressOut={(e: any) => {
                    if (e?.stopPropagation) e.stopPropagation();
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

  return (
    <SafeAreaView style={styles.container}>
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
                : "You've taken your first step!"}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isUpgradeMode
              ? 'Choose a plan that meets you where you are and helps you go deeper.'
              : fromPlanningLock
                ? 'Unlock future planning—plus guided journaling, playbooks, and devotionals to support your journey.'
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
          <View style={styles.cardsContainer}>{pricingTiers.map(renderPricingCard)}</View>
        </ScrollView>
      </View>

      {/* Fixed Footer CTA */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={() => {
            try { triggerSuccessHaptic(); } catch {}
            handleUnlockPlan();
          }}
          activeOpacity={0.9}
        >
          <ThemedText weight="bold" style={styles.unlockButtonText}>
            {isUpgradeMode ? 'Upgrade and Continue' : (fromPlanningLock ? 'Start Planning Ahead' : 'Continue My Journey')}
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
              navigation.goBack();
            } else if (canOfferTrial) {
              navigation.navigate('OnboardingTrialOffer' as any, {
                selectedTierId: selectedTier,
                billing: isAnnual ? 'annual' : 'monthly',
              });
            } else {
              navigation.goBack();
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

// Create dynamic styles using theme fonts - match Dashboard pattern
const createStyles = (fonts: any) => StyleSheet.create({
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginTop: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.medium,
    color: Colors.hopeWhite,
  },
  activeToggleText: {
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
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
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
  },
  cardHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
  },
  tierDuration: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginLeft: 8,
  },
  tierDescription: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    color: Colors.hopeWhite,
    marginRight: 4,
    flexShrink: 0,
  },
  originalPrice: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    flexShrink: 0,
    marginRight: 4,
  },
  monthlyEquivalent: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: Colors.hopeWhite,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.medium,
  },
  iconMarginRight: {
    marginRight: 8,
  },
  scrollContentPadding: {
    paddingBottom: 60,
  },
});

export default OnboardingSalesOfferScreen;
