/**
 * OnboardingTrialSetupScreen.tsx
 * Phase 5: Trial Setup with Real Pricing from Codebase
 * 3-day trial, actual subscription tiers, payment setup
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { PRICING_US } from '../../interfaces/subscription';

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  popular?: boolean;
  description: string;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: PRICING_US.starter.amount / 100, // Convert cents to dollars
    annualPrice: PRICING_US.starter_annual.amount / 100,
    description: 'Perfect for beginning your faith journey',
    features: [
      '5 playbooks per month',
      'Basic progress tracking',
      'Journal integration',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: PRICING_US.growth.amount / 100,
    annualPrice: PRICING_US.growth_annual.amount / 100,
    description: 'Ideal for consistent spiritual development',
    popular: true,
    features: [
      '15 playbooks per month',
      'Advanced analytics',
      'Devotional generation',
      'Priority support',
      'Goal setting tools',
    ],
  },
  {
    id: 'transformation',
    name: 'Transformation',
    monthlyPrice: PRICING_US.transformation.amount / 100,
    annualPrice: PRICING_US.transformation_annual.amount / 100,
    description: 'For serious spiritual transformation',
    features: [
      'Unlimited playbooks',
      'AI-powered insights',
      'Custom affirmations',
      'Advanced journaling',
      'Phone support',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    monthlyPrice: PRICING_US.family.amount / 100,
    annualPrice: PRICING_US.family_annual.amount / 100,
    description: 'Share the journey with your loved ones',
    features: [
      'Everything in Transformation',
      'Up to 6 family members',
      'Family devotionals',
      'Shared progress tracking',
      'Family challenges',
    ],
  },
];

const OnboardingTrialSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const [selectedTier, setSelectedTier] = useState('growth'); // Default to popular tier
  const [isAnnual, setIsAnnual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const calculateSavings = (tier: PricingTier) => {
    const monthlyTotal = tier.monthlyPrice * 12;
    const savings = monthlyTotal - tier.annualPrice;
    const percentage = Math.round((savings / monthlyTotal) * 100);
    return { savings, percentage };
  };

  const handleStartTrial = async () => {
    setIsLoading(true);

    try {
      const selectedTierData = pricingTiers.find(t => t.id === selectedTier);
      const price = isAnnual ? selectedTierData?.annualPrice : selectedTierData?.monthlyPrice;

      console.log('💳 Starting trial setup:', {
        tier: selectedTier,
        isAnnual,
        price,
      });

      // Simulate payment setup
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Trial Started!',
        'Your 3-day free trial has begun. You can cancel anytime before it ends to avoid charges.',
        [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('OnboardingPersonalization' as any),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Unable to start trial. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTierData = pricingTiers.find(t => t.id === selectedTier);
  const currentPrice = isAnnual ? selectedTierData?.annualPrice : selectedTierData?.monthlyPrice;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Start Your 3-Day Free Trial</Text>
            <Text style={styles.subtitle}>
              Experience the full power of siFia with unlimited access to all features
            </Text>
          </View>

          {/* Trial benefits */}
          <View style={styles.trialBenefitsSection}>
            <Text style={styles.trialBenefitsTitle}>What you get in your trial:</Text>
            <View style={styles.trialBenefitsList}>
              <View style={styles.trialBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.trialBenefitText}>Create unlimited personalized playbooks</Text>
              </View>
              <View style={styles.trialBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.trialBenefitText}>Generate devotionals from your playbooks</Text>
              </View>
              <View style={styles.trialBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.trialBenefitText}>Track your spiritual growth progress</Text>
              </View>
              <View style={styles.trialBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.lightBlue} />
                <Text style={styles.trialBenefitText}>Access all premium features</Text>
              </View>
            </View>
          </View>

          {/* Billing toggle */}
          <View style={styles.billingToggleSection}>
            <Text style={styles.billingToggleTitle}>Choose your plan:</Text>
            <View style={styles.billingToggle}>
              <TouchableOpacity
                style={[styles.billingOption, !isAnnual && styles.billingOptionActive]}
                onPress={() => setIsAnnual(false)}
              >
                <Text style={[styles.billingOptionText, !isAnnual && styles.billingOptionTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.billingOption, isAnnual && styles.billingOptionActive]}
                onPress={() => setIsAnnual(true)}
              >
                <Text style={[styles.billingOptionText, isAnnual && styles.billingOptionTextActive]}>
                  Annual
                </Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>Save 17%</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pricing tiers */}
          <View style={styles.pricingSection}>
            {pricingTiers.map((tier) => {
              const isSelected = selectedTier === tier.id;
              const tierPrice = isAnnual ? tier.annualPrice : tier.monthlyPrice;
              const tierSavings = calculateSavings(tier);

              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[
                    styles.pricingCard,
                    isSelected && styles.pricingCardSelected,
                    tier.popular && styles.pricingCardPopular,
                  ]}
                  onPress={() => setSelectedTier(tier.id)}
                >
                  {tier.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Most Popular</Text>
                    </View>
                  )}

                  <View style={styles.pricingHeader}>
                    <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                      {tier.name}
                    </Text>
                    <Text style={[styles.tierDescription, isSelected && styles.tierDescriptionSelected]}>
                      {tier.description}
                    </Text>
                  </View>

                  <View style={styles.pricingDetails}>
                    <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                      ${tierPrice.toFixed(2)}
                    </Text>
                    <Text style={[styles.tierInterval, isSelected && styles.tierIntervalSelected]}>
                      /{isAnnual ? 'year' : 'month'}
                    </Text>
                    {isAnnual && (
                      <Text style={[styles.tierSavings, isSelected && styles.tierSavingsSelected]}>
                        Save ${tierSavings.savings.toFixed(2)}/year
                      </Text>
                    )}
                  </View>

                  <View style={styles.tierFeatures}>
                    {tier.features.slice(0, 3).map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={isSelected ? Colors.anchorBlue : Colors.lightBlue}
                        />
                        <Text style={[
                          styles.featureText,
                          isSelected && styles.featureTextSelected,
                        ]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                    {tier.features.length > 3 && (
                      <Text style={[
                        styles.moreFeatures,
                        isSelected && styles.moreFeaturesSelected,
                      ]}>
                        +{tier.features.length - 3} more features
                      </Text>
                    )}
                  </View>

                  {isSelected && (
                    <View style={styles.selectedIndicator}>
                      <Ionicons name="checkmark-circle" size={24} color={Colors.anchorBlue} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Trial details */}
          <View style={styles.trialDetailsSection}>
            <Text style={styles.trialDetailsTitle}>Trial Details:</Text>
            <Text style={styles.trialDetailsText}>
              • Your trial starts immediately and lasts 3 days{'\n'}
              • You'll be charged ${currentPrice?.toFixed(2)} {isAnnual ? 'annually' : 'monthly'} after the trial{'\n'}
              • Cancel anytime before the trial ends to avoid charges{'\n'}
              • No hidden fees or commitments
            </Text>
          </View>

          {/* Start trial button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.startTrialButton, isLoading && styles.buttonDisabled]}
              onPress={handleStartTrial}
              disabled={isLoading}
            >
              <Text style={styles.startTrialButtonText}>
                {isLoading ? 'Setting up...' : 'Start 3-Day Free Trial'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={Colors.anchorBlue}
                style={styles.buttonIcon}
              />
            </TouchableOpacity>

            <Text style={styles.paymentNote}>
              You'll be asked to add a payment method on the next screen
            </Text>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Almost done!</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, styles.progressAlmostComplete]} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  trialBenefitsSection: {
    marginBottom: 32,
  },
  trialBenefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 16,
  },
  trialBenefitsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
  },
  trialBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trialBenefitText: {
    fontSize: 14,
    color: Colors.white,
    marginLeft: 12,
    flex: 1,
  },
  billingToggleSection: {
    marginBottom: 24,
  },
  billingToggleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  billingOptionActive: {
    backgroundColor: Colors.white,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  billingOptionTextActive: {
    color: Colors.anchorBlue,
  },
  savingsBadge: {
    backgroundColor: Colors.lightBlue,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  pricingSection: {
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  pricingCardSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.lightBlue,
  },
  pricingCardPopular: {
    borderColor: Colors.lightBlue,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: Colors.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  pricingHeader: {
    marginBottom: 16,
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  tierNameSelected: {
    color: Colors.anchorBlue,
  },
  tierDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  tierDescriptionSelected: {
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  pricingDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  tierPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tierPriceSelected: {
    color: Colors.anchorBlue,
  },
  tierInterval: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 4,
  },
  tierIntervalSelected: {
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  tierSavings: {
    fontSize: 12,
    color: Colors.lightBlue,
    marginLeft: 8,
    fontWeight: '600',
  },
  tierSavingsSelected: {
    color: Colors.anchorBlue,
  },
  tierFeatures: {
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.white,
    marginLeft: 8,
    flex: 1,
  },
  featureTextSelected: {
    color: Colors.anchorBlue,
  },
  moreFeatures: {
    fontSize: 12,
    color: Colors.lightBlue,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  moreFeaturesSelected: {
    color: Colors.anchorBlue,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  trialDetailsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  trialDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
  trialDetailsText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  startTrialButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  startTrialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  paymentNote: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
});

export default OnboardingTrialSetupScreen;
