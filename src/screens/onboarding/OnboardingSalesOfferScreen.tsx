import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService from '../../services/pricingService';
import DynamicPricingModal from '../../components/DynamicPricingModal';

const { width } = Dimensions.get('window');

interface PricingTier {
  id: string;
  name: string;
  duration: string;
  description: string;
  features: string[];
  monthlyPrice: number;
  annualPrice: number;
  monthlyOriginal?: number;
  annualOriginal?: number;
  isPopular?: boolean;
}

const OnboardingSalesOfferScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTier, setSelectedTier] = useState('growth');
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Pricing tiers with Family tier included
  const pricingTiers: PricingTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      duration: '12 months',
      description: 'For consistent encouragement',
      features: [
        '8 playbooks & 8 devotionals each month',
        'Gentle reminders to keep you on track',
        'Track your progress week by week'
      ],
      monthlyPrice: 49.99,
      annualPrice: 49.99,
      monthlyOriginal: 83.88,
      annualOriginal: 83.88,
    },
    {
      id: 'growth',
      name: 'Growth',
      duration: '12 months',
      description: 'For deeper transformation',
      features: [
        '20 playbooks & 20 devotionals each month',
        'Advanced reflection prompts',
        'Seasonal challenges for breakthrough'
      ],
      monthlyPrice: 129.99,
      annualPrice: 129.99,
      monthlyOriginal: 155.88,
      annualOriginal: 155.88,
      isPopular: true,
    },
    {
      id: 'transformation',
      name: 'Transformation',
      duration: '12 months',
      description: 'For complete spiritual renewal',
      features: [
        'Unlimited playbooks & devotionals',
        'Personal spiritual mentor access',
        'Custom prayer & meditation guides',
        'Priority support & guidance'
      ],
      monthlyPrice: 199.99,
      annualPrice: 199.99,
      monthlyOriginal: 249.99,
      annualOriginal: 249.99,
    },
    {
      id: 'family',
      name: 'Family',
      duration: '12 months',
      description: 'For the whole family\'s growth',
      features: [
        'Everything in Transformation',
        'Up to 6 family member accounts',
        'Family devotionals & activities',
        'Parental guidance resources'
      ],
      monthlyPrice: 299.99,
      annualPrice: 299.99,
      monthlyOriginal: 359.99,
      annualOriginal: 359.99,
    }
  ];

  const handleClose = () => {
    // Track user opt-out and check if dynamic discount should be shown
    const shouldShowDiscount = pricingService.trackUserOptOut();
    
    if (shouldShowDiscount) {
      const discount = pricingService.getDynamicDiscount();
      if (discount) {
        setDynamicDiscount(discount);
        setShowDynamicModal(true);
        return;
      }
    }
    
    navigation.navigate('OnboardingTrialOffer' as any);
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
            <Text style={styles.popularText}>Popular</Text>
          </View>
        )}
        
        <View style={styles.cardHeader}>
          <Text style={[styles.tierName, isSelected && styles.selectedText]}>
            {tier.name}
          </Text>
          <Text style={[styles.tierDuration, isSelected && styles.selectedText]}>
            -{tier.duration}
          </Text>
        </View>
        
        <Text style={[styles.tierDescription, isSelected && styles.selectedText]}>
          {tier.description}
        </Text>
        
        <View style={styles.featuresContainer}>
          {(isExpanded ? tier.features : tier.features.slice(0, 2)).map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={[styles.featureIcon, { color: Colors.growthGreen }]}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          {tier.features.length > 2 && (
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => toggleCardExpansion(tier.id)}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Show Less' : `Show ${tier.features.length - 2} More Features`}
              </Text>
              <Ionicons 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color={Colors.faithGold} 
              />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, isSelected && styles.selectedText]}>
              ${isAnnual ? tier.annualPrice : tier.monthlyPrice}
            </Text>
            {(isAnnual ? tier.annualOriginal : tier.monthlyOriginal) && (
              <Text style={styles.originalPrice}>
                ${isAnnual ? tier.annualOriginal : tier.monthlyOriginal}
              </Text>
            )}
          </View>
          <Text style={[styles.monthlyEquivalent, isSelected && styles.selectedText]}>
            ${getMonthlyEquivalent(tier)}/month
          </Text>
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
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>siFia</Text>
          <Text style={styles.logoHeart}>❤</Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Main Content */}
        <Text style={styles.mainTitle}>You've taken your first step!</Text>
        <Text style={styles.subtitle}>Keep walking, one faithful step at a time.</Text>

        {/* Feature Bullets */}
        <View style={styles.featuresSection}>
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Personalized playbooks and devotionals created just for you delivered at a pace that fits your plan.
            </Text>
          </View>
          
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Track your growth with smart journaling and unlock deeper reflections on higher tiers.
            </Text>
          </View>
          
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Picture walking daily with God, growing stronger with every step.
            </Text>
          </View>
          
          <View style={styles.featureBullet}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <Text style={styles.bulletText}>
              Your journey, your pace.
            </Text>
          </View>
        </View>

        {/* Toggle Button */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.activeToggleText]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual && styles.activeToggleText]}>
              Annual
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pricing Cards - Vertical Layout */}
        <View style={styles.cardsContainer}>
          {pricingTiers.map(renderPricingCard)}
        </View>

        {/* Unlock Button */}
        <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockPlan}>
          <Text style={styles.unlockButtonText}>Unlock My Plan</Text>
        </TouchableOpacity>

        {/* Footer Text */}
        <Text style={styles.footerText}>
          Cancel anytime. We're here to walk with you. Secure checkout.
        </Text>
      </ScrollView>

      {/* Dynamic Pricing Modal */}
      {dynamicDiscount && (
        <DynamicPricingModal
          visible={showDynamicModal}
          onClose={() => {
            setShowDynamicModal(false);
            navigation.navigate('OnboardingTrialOffer' as any);
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
    paddingTop: 20,
    paddingBottom: 20,
    position: 'relative',
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
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bulletText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
    alignSelf: 'center',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: Colors.growthGreen,
  },
  toggleText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  activeToggleText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  cardsContainer: {
    marginBottom: 32,
  },
  pricingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    borderWidth: 2,
    borderColor: 'transparent',
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
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  tierDuration: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  tierDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 16,
    opacity: 0.9,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  monthlyEquivalent: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  unlockButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 40,
  },
  cardWrapper: {
    marginBottom: 16,
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
