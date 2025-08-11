import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService, { LocationPricing, PricingTier as ServicePricingTier } from '../../services/pricingService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import DynamicPricingModal from '../../components/DynamicPricingModal';

// removed Dimensions width as unused

// Use PricingTier from pricingService to avoid drift
type PricingTier = ServicePricingTier;

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTier, setSelectedTier] = useState('growth');
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);

  // Load location-adjusted pricing and currency
  useEffect(() => {
    let isMounted = true;
    const loadPricing = async () => {
      try {
        const [tiers, currency] = await Promise.all([
          pricingService.getLocationAdjustedPricing(),
          pricingService.getCurrencyInfo(),
        ]);
        if (isMounted) {
          setPricingTiers(tiers);
          setCurrencyInfo(currency);
          // Ensure default selection exists
          const recommended = pricingService.getRecommendedTier();
          setSelectedTier(recommended);
        }
      } catch (e) {
        console.error('Failed to load pricing:', e);
      }
    };
    loadPricing();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-collapse all expanded feature sections when billing period changes
  useEffect(() => {
    if (expandedCards.size > 0) {
      setExpandedCards(new Set());
    }
  }, [isAnnual]);

  const handleClose = async () => {
    // Track user opt-out and check if dynamic discount should be shown
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

    navigation.navigate('OnboardingTrialOffer' as any, {
      selectedTierId: selectedTier,
      billing: isAnnual ? 'annual' : 'monthly',
    });
  };

  const handleUnlockPlan = () => {
    // Navigate to payment processing
    navigation.navigate('OnboardingPaymentProcessing' as any, {
      selectedTier,
      isAnnual,
      price: getCurrentPrice()
    });
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
    
    return (
      <View key={tier.id} style={styles.cardWrapper}>
        <TouchableOpacity
          style={[
          styles.pricingCard,
          isSelected && styles.selectedCard,
          isFocused && styles.focusedCard
        ]}
        onPress={() => setSelectedTier(tier.id)}
        activeOpacity={0.8}
      >
        {tier.isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>POPULAR</Text>
          </View>
        )}
        
        <View style={styles.cardHeader}>
          <Text style={[styles.tierName, isSelected && styles.selectedText]}>
            {tier.name}
          </Text>
          {isAnnual && (
            <Text style={[styles.tierDuration, isSelected && styles.selectedText]}>
              -{tier.duration}
            </Text>
          )}
        </View>
        
        <Text style={[styles.tierDescription, isSelected && styles.selectedText]}>
          {tier.description}
        </Text>
        
        {isExpanded && (
          <View style={styles.featuresContainer}>
            {(() => {
              const processed: string[] = [];
              const first = tier.features[0]?.trim() || '';
              const m = first.match(/^(\d+)\s*playbooks\s*&\s*(\d+)\s*devotionals\s*each\s*month$/i);
              if (m) {
                processed.push(`${m[1]} playbooks each month`);
                processed.push(`${m[2]} devotionals each month`);
                processed.push(...tier.features.slice(1));
              } else if (/^Unlimited\s+playbooks\s*&\s*devotionals/i.test(first)) {
                processed.push('Unlimited playbooks each month');
                processed.push('Unlimited devotionals each month');
                processed.push(...tier.features.slice(1));
              } else {
                processed.push(...tier.features);
              }
              return processed.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Ionicons name="heart" size={16} color={Colors.alertCoral} style={{ marginRight: 8 }} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ));
            })()}
          </View>
        )}
        
        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={[styles.currentPrice, isSelected && styles.selectedText]}>
                {(currencyInfo?.symbol || '$')}{isAnnual ? tier.annualPrice.toFixed(2) : tier.monthlyPrice.toFixed(2)}
              </Text>
              {(() => {
                const original = isAnnual ? tier.annualOriginal : tier.monthlyOriginal;
                const current = isAnnual ? tier.annualPrice : tier.monthlyPrice;
                return original && original > current ? (
                  <Text style={styles.originalPrice}>
                    {(currencyInfo?.symbol || '$')}{original.toFixed(2)}
                  </Text>
                ) : null;
              })()}
            </View>
            <View style={styles.priceRight}>
              <Text style={styles.monthlyEquivalent}>
                {(currencyInfo?.symbol || '$')}{isAnnual ? getMonthlyEquivalent(tier) : tier.monthlyPrice.toFixed(2)}/month
              </Text>
              <TouchableOpacity 
                style={styles.detailsToggle}
                onPress={() => toggleCardExpansion(tier.id)}
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

      {/* Body content (fixed top + scrollable pricing) */}
      <View style={styles.content}>
        {/* Main Content */}
        <Text style={styles.mainTitle}>You've taken your first step!</Text>
        <Text style={styles.subtitle}>Keep walking, one faithful step at a time.</Text>

        {/* Feature Bullets */}
        <View style={styles.featuresSection}>
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Personalized playbooks and devotionals created just for you delivered at a pace that fits your plan.
            </Text>
          </View>
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Track your growth with smart journaling and unlock deeper reflections on higher tiers.
            </Text>
          </View>
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Picture walking daily with God, growing stronger with every step.
            </Text>
          </View>
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>Your journey, your pace.</Text>
          </View>
        </View>

        {/* Toggle Button */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.activeToggleText]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual && styles.activeToggleText]}>Annual</Text>
          </TouchableOpacity>
        </View>

        {/* Pricing Cards - Scrollable only */}
        <ScrollView
          style={styles.pricingScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          scrollIndicatorInsets={{ bottom: 60 }}
        >
          <View style={styles.cardsContainer}>{pricingTiers.map(renderPricingCard)}</View>
        </ScrollView>
      </View>

      {/* Fixed Footer CTA */}
      <View style={styles.footerContainer}>
        <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockPlan} activeOpacity={0.9}>
          <Text style={styles.unlockButtonText}>Continue My Journey</Text>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.hopeWhite} style={styles.footerShield} />
          <Text style={styles.footerText}>Cancel anytime.</Text>
          <Text style={styles.footerText}> Secure checkout</Text>
        </View>
      </View>

      {/* Dynamic Pricing Modal */}
      {dynamicDiscount && (
        <DynamicPricingModal
          visible={showDynamicModal}
          onClose={() => {
            setShowDynamicModal(false);
            navigation.navigate('OnboardingTrialOffer' as any, {
              selectedTierId: selectedTier,
              billing: isAnnual ? 'annual' : 'monthly',
            });
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
    fontWeight: 'bold',
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
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
    fontWeight: '500',
  },
  activeToggleText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  cardsContainer: {
    marginBottom: 16,
  },
  pricingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 6,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectedCard: {
    borderColor: Colors.growthGreen,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  focusedCard: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: Colors.growthGreen,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  cardHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  tierDuration: {
    fontSize: 16,
    fontWeight: 'semibold',
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginLeft: 8,
  },
  tierDescription: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginRight: 4,
    flexShrink: 0,
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    flexShrink: 0,
    marginRight: 4,
  },
  monthlyEquivalent: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
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
    fontWeight: 'bold',
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
    fontWeight: '500',
  },
});

export default OnboardingSalesOfferScreen;
