/**
 * OnboardingTrialSetupScreen.tsx
 * Phase 5: Trial Setup with Real Pricing from Codebase
 * 3-day trial, actual subscription tiers, payment setup
 */

import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

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
  const { user } = useAuth();
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

      // Mark onboarding as complete
      if (user?.id) {
        try {
          await supabase
            .from('user_profiles')
            .update({ onboarding_completed: true })
            .eq('id', user.id);
          console.log('✅ Onboarding marked as complete');
        } catch (error) {
          console.error('Error marking onboarding complete:', error);
        }
      }

      Alert.alert(
        'Welcome to siFia!',
        'Your 3-day free trial has begun. You can cancel anytime before it ends to avoid charges.',
        [
          {
            text: 'Get Started',
            onPress: () => {
              // Navigate to notification permission screen
              console.log('🎉 Trial setup complete, proceeding to notification permission');
              navigation.navigate('OnboardingNotificationPermission' as any);
            },
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

  const handleSkipTrial = async () => {
    // Mark onboarding as complete and skip trial
    if (user?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
        console.log('✅ Onboarding completed without trial');
        navigation.navigate('MainTabs' as any);
      } catch (error: any) {
        console.error('Error completing onboarding:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleSkipTrial}>
        <Ionicons name="close" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>

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
          <Text style={styles.title}>Skeptical? Try siFia PRO</Text>
          <Text style={styles.titleHighlight}>free for 7 days.</Text>
          <Text style={styles.subtitle}>
            How your free trial works:
          </Text>
        </View>

        {/* Simple Timeline */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineItem}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Today – Free trial starts</Text>
              <Text style={styles.timelineDescription}>Enjoy full access free for 7 days</Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <Ionicons name="mail" size={24} color="rgba(255, 255, 255, 0.6)" />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Aug 11 – Email reminder</Text>
              <Text style={styles.timelineDescription}>We'll let you know when your trial is ending</Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <Ionicons name="heart" size={24} color="#FF6B6B" />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Aug 13 – Become a member</Text>
              <Text style={styles.timelineDescription}>Your trial ends unless canceled. Enjoy!</Text>
            </View>
          </View>
        </View>

        {/* Simple Pricing Display */}
        <View style={styles.simplePricingSection}>
          <Text style={styles.pricingText}>7 days free, then ₱6,990.00 per year</Text>
          <Text style={styles.pricingSubtext}>Only ₱133.96 / week</Text>
        </View>

        {/* Start trial button */}
        <TouchableOpacity
          style={[styles.startTrialButton, isLoading && styles.buttonDisabled]}
          onPress={handleStartTrial}
          disabled={isLoading}
        >
          <Text style={styles.startTrialButtonText}>
            {isLoading ? 'Setting up...' : 'Start your free 7-day trial'}
          </Text>
        </TouchableOpacity>

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark" size={16} color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.footerText}>Cancel anytime. Secure with App Store.</Text>
        </View>
      </Animated.View>
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
  progressAlmostComplete: {
    width: '90%',
  },
  // New styles for redesigned screen
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  titleHighlight: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.growthGreen,
    textAlign: 'center',
    marginBottom: 16,
  },
  timelineSection: {
    marginVertical: 40,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  simplePricingSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  pricingText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  pricingSubtext: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
  },
});

export default OnboardingTrialSetupScreen;
