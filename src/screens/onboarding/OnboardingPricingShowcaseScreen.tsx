import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,

  ScrollView,
  Alert,

  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useUserState } from '../../hooks/useUserState';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { Colors } from '../../theme';
import { TrialBillingService, SelectedPlan } from '../../services/trialBillingService';
import { SubscriptionTier } from '../../interfaces/subscription';
import pricingService, { PricingTier, LocationPricing } from '../../services/pricingService';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

const OnboardingPricingShowcaseScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { activateFreeTrial, updateOnboardingStep } = useUserState();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [tiers, setTiers] = useState<PricingTier[] | null>(null);
  const [currencyInfo, setCurrencyInfo] = useState<LocationPricing | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>('growth');
  const [isLoadingPricing, setIsLoadingPricing] = useState<boolean>(true);

  // Track pricing viewed on component mount
  React.useEffect(() => {
    updateOnboardingStep('pricing_viewed', 5);
  }, [updateOnboardingStep]);

  // Load dynamic pricing
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoadingPricing(true);
        const [adjTiers, curr] = await Promise.all([
          pricingService.getLocationAdjustedPricing(),
          pricingService.getCurrencyInfo(),
        ]);
        if (!mounted) {return;}
        setTiers(adjTiers);
        setCurrencyInfo(curr);
        // Default selection to popular (growth) if present
        const hasGrowth = adjTiers.some(t => t.id === 'growth');
        setSelectedTierId(hasGrowth ? 'growth' : adjTiers[0]?.id || 'growth');
      } catch (e) {
        console.error('Failed to load pricing:', e);
      } finally {
        if (mounted) setIsLoadingPricing(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const pricingPlans = useMemo(() => {
    if (!tiers || !currencyInfo) {
      return { annual: [] as any[], monthly: [] as any[] };
    }
    const symbol = currencyInfo.symbol;
    const fmt = (n: number) => `${symbol}${n.toFixed(0)}`; // display rounded whole for year, monthly keeps as-is
    const computeSavings = (original?: number, current?: number) => {
      if (!original || !current || original <= current) {return '';} 
      const pct = Math.round(((original - current) / original) * 100);
      return `Save ${pct}%`;
    };
    const annual = tiers.map(t => ({
      tier: `${t.id}_annual`,
      id: t.id,
      name: t.name,
      price: fmt(t.annualPrice),
      period: '/year',
      savings: computeSavings(t.annualOriginal, t.annualPrice),
      features: t.features,
      popular: !!t.isPopular,
    }));
    const monthly = tiers.map(t => ({
      tier: t.id,
      id: t.id,
      name: t.name,
      price: `${symbol}${t.monthlyPrice.toFixed(2)}`,
      period: '/month',
      savings: '',
      features: t.features,
      popular: !!t.isPopular,
    }));
    return { annual, monthly };
  }, [tiers, currencyInfo]);

  const handleStartFreeTrial = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to start your free trial');
      return;
    }

    setIsStartingTrial(true);
    try {
      if (!tiers || !currencyInfo) {
        throw new Error('Pricing not loaded');
      }
      const chosen = tiers.find(t => t.id === selectedTierId) || tiers[0];
      const tierCode: SubscriptionTier = (selectedPlan === 'annual' ? `${chosen.id}_annual` : chosen.id) as SubscriptionTier;
      const priceNumber = selectedPlan === 'annual' ? chosen.annualPrice : chosen.monthlyPrice;
      const priceCents = Math.round(priceNumber * 100);
      const pendingPlan: SelectedPlan = {
        tier: tierCode,
        displayName: `${chosen.name} ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'}`,
        billing: selectedPlan,
        price: priceCents,
        currency: (currencyInfo.currency || 'USD').toLowerCase(),
        features: chosen.features,
      };

      const result = await TrialBillingService.startTrialWithPendingBilling(user.id, pendingPlan);
      const success = result.success;

      if (success) {
        updateOnboardingStep('trial_started', 5);
        console.log('✅ Free trial started successfully');
        navigation.navigate('OnboardingComplete');
      } else {
        // Fallback to legacy trial activation without pending billing
        const fallback = await activateFreeTrial();
        if (fallback) {
          navigation.navigate('OnboardingComplete');
        } else {
          throw new Error(result.error || 'Failed to activate trial');
        }
      }
    } catch (error) {
      console.error('❌ Error starting free trial:', error);
      Alert.alert(
        'Error',
        'Failed to start your free trial. Please try again.'
      );
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleContinueAsBasic = () => {
    navigation.navigate('OnboardingComplete');
  };

  const renderPricingCard = (plan: any) => (
    <TouchableOpacity
      key={plan.tier}
      activeOpacity={0.9}
      onPress={() => setSelectedTierId(plan.id)}
      style={[styles.pricingCard, plan.popular && styles.popularCard, selectedTierId === plan.id && styles.selectedCard]}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      <Text style={styles.planName}>{plan.name}</Text>

      <View style={styles.priceContainer}>
        <Text style={styles.price}>{plan.price}</Text>
        <Text style={styles.period}>{plan.period}</Text>
      </View>

      {plan.savings && (
        <Text style={styles.savings}>{plan.savings}</Text>
      )}

      <View style={styles.featuresContainer}>
        {plan.features.map((feature: string, index: number) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <OnboardingProgressIndicator compact />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Unlock Your Full Potential</Text>
          <Text style={styles.subtitle}>
            You've experienced the power of siFia. Ready to transform your spiritual journey?
          </Text>
        </View>

        {/* Plan Toggle */}
        <View style={styles.planToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, selectedPlan === 'monthly' && styles.activeToggle]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'monthly' && styles.activeToggleText]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, selectedPlan === 'annual' && styles.activeToggle]}
            onPress={() => setSelectedPlan('annual')}
          >
            <Text style={[styles.toggleText, selectedPlan === 'annual' && styles.activeToggleText]}>
              Annual
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pricing Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
          snapToInterval={width * 0.8}
          decelerationRate="fast"
        >
          {(pricingPlans as any)[selectedPlan].map(renderPricingCard)}
        </ScrollView>

        {/* Free Trial CTA */}
        <View style={styles.trialSection}>
          <View style={styles.trialHighlight}>
            <Ionicons name="star" size={16} color={Colors.faithGold} />
            <Text style={styles.trialTitle}>Start Your 3-Day Free Trial</Text>
          </View>
          <Text style={styles.trialDescription}>
            Experience all premium features with no commitment. Cancel anytime.
          </Text>

          <TouchableOpacity
            style={[styles.trialButton, isStartingTrial && styles.disabledButton]}
            onPress={handleStartFreeTrial}
            disabled={isStartingTrial}
          >
            <Text style={styles.trialButtonText}>
              {isStartingTrial ? 'Starting Trial...' : 'Start Free Trial'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue as Basic */}
        <TouchableOpacity style={styles.basicButton} onPress={handleContinueAsBasic}>
          <Text style={styles.basicButtonText}>Continue with Basic (Free Forever)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  planToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 24,
    marginBottom: 32,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 21,
  },
  activeToggle: {
    backgroundColor: Colors.anchorBlue,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textGray,
  },
  activeToggleText: {
    color: Colors.hopeWhite,
  },
  cardsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  pricingCard: {
    width: width * 0.75,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: Colors.trustGrey,
    position: 'relative',
  },
  selectedCard: {
    borderColor: Colors.anchorBlue,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  popularCard: {
    borderColor: Colors.faithGold,
    transform: [{ scale: 1.05 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    backgroundColor: Colors.faithGold,
    paddingVertical: 6,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  popularText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  period: {
    fontSize: 16,
    color: Colors.textGray,
    marginLeft: 4,
  },
  savings: {
    fontSize: 14,
    color: Colors.growthGreen,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.textDark,
    flex: 1,
  },
  trialSection: {
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  trialHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  trialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  trialDescription: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  trialButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  basicButton: {
    marginHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  basicButtonText: {
    fontSize: 16,
    color: Colors.textGray,
    textDecorationLine: 'underline',
  },
});

export default OnboardingPricingShowcaseScreen;
