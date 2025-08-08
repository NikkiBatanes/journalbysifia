import React, { useState } from 'react';
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

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

const OnboardingPricingShowcaseScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { activateFreeTrial, updateOnboardingStep } = useUserState();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  // Track pricing viewed on component mount
  React.useEffect(() => {
    updateOnboardingStep('pricing_viewed', 5);
  }, [updateOnboardingStep]);

  const pricingPlans = {
    annual: [
      {
        tier: 'starter_annual',
        name: 'Starter',
        price: '$59',
        period: '/year',
        savings: 'Save 30%',
        features: ['8 Playbooks/month', '8 Devotionals/month', 'Smart Journaling', 'Calendar Sync', '10 Exports/month'],
        popular: false,
      },
      {
        tier: 'growth_annual',
        name: 'Growth',
        price: '$119',
        period: '/year',
        savings: 'Save 35%',
        features: ['20 Playbooks/month', '20 Devotionals/month', 'Advanced Intelligence', 'Advanced Analytics', 'Priority Support', '50 Exports/month'],
        popular: true,
      },
      {
        tier: 'transformation_annual',
        name: 'Transformation',
        price: '$179',
        period: '/year',
        savings: 'Save 40%',
        features: ['Unlimited Playbooks', 'Unlimited Devotionals', 'Premium Intelligence', 'Expounding Features', 'VIP Support', 'Unlimited Exports'],
        popular: false,
      },
    ],
    monthly: [
      {
        tier: 'starter',
        name: 'Starter',
        price: '$6.99',
        period: '/month',
        savings: '',
        features: ['8 Playbooks/month', '8 Devotionals/month', 'Smart Journaling', 'Calendar Sync', '10 Exports/month'],
        popular: false,
      },
      {
        tier: 'growth',
        name: 'Growth',
        price: '$15.99',
        period: '/month',
        savings: '',
        features: ['20 Playbooks/month', '20 Devotionals/month', 'Advanced Intelligence', 'Advanced Analytics', 'Priority Support', '50 Exports/month'],
        popular: true,
      },
      {
        tier: 'transformation',
        name: 'Transformation',
        price: '$24.99',
        period: '/month',
        savings: '',
        features: ['Unlimited Playbooks', 'Unlimited Devotionals', 'Premium Intelligence', 'Expounding Features', 'VIP Support', 'Unlimited Exports'],
        popular: false,
      },
    ],
  };

  const handleStartFreeTrial = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to start your free trial');
      return;
    }

    setIsStartingTrial(true);
    try {
      const success = await activateFreeTrial();

      if (success) {
        updateOnboardingStep('trial_started', 5);
        console.log('✅ Free trial started successfully');
        navigation.navigate('OnboardingComplete');
      } else {
        throw new Error('Failed to activate trial');
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
    <View key={plan.tier} style={[styles.pricingCard, plan.popular && styles.popularCard]}>
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
    </View>
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
          {pricingPlans[selectedPlan].map(renderPricingCard)}
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
