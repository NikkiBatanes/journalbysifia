import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import ThemedText from '../../components/common/ThemedText';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';

/**
 * OnboardingFamilyPlanScreen
 *
 * Presents family subscription pricing and benefits
 * Allows user to select between monthly and annual billing
 * Navigates to family setup after selection
 */

const OnboardingFamilyPlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentFont } = useTheme();
  const { width } = useWindowDimensions();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts, width), [fonts, width]);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const handleContinue = () => {
    // Navigate to family setup with selected billing cycle
    (navigation as any).navigate('OnboardingFamilySetup', {
      billingCycle,
      selectedTier: 'family',
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const monthlyPrice = 44.99;
  const annualPrice = 449.99;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savings = ((1 - annualPrice / (monthlyPrice * 12)) * 100).toFixed(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Family Plan</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={48} color={Colors.anchorBlue} />
          </View>
          <ThemedText style={styles.title}>siFia Family</ThemedText>
          <ThemedText style={styles.subtitle}>
            Grow together in faith with unlimited access for your whole family
          </ThemedText>
        </View>

        {/* Billing Toggle */}
        <View style={styles.billingToggleContainer}>
          <TouchableOpacity
            style={[
              styles.billingToggle,
              billingCycle === 'monthly' && styles.billingToggleActive,
            ]}
            onPress={() => setBillingCycle('monthly')}
          >
            <ThemedText
              style={[
                styles.billingToggleText,
                billingCycle === 'monthly' && styles.billingToggleTextActive,
              ]}
            >
              Monthly
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingToggle,
              billingCycle === 'annual' && styles.billingToggleActive,
            ]}
            onPress={() => setBillingCycle('annual')}
          >
            <View style={styles.saveBadge}>
              <ThemedText style={styles.saveBadgeText}>Save {savings}%</ThemedText>
            </View>
            <ThemedText
              style={[
                styles.billingToggleText,
                billingCycle === 'annual' && styles.billingToggleTextActive,
              ]}
            >
              Annual
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          <View style={styles.priceContainer}>
            <ThemedText style={styles.currency}>$</ThemedText>
            <ThemedText style={styles.price}>
              {billingCycle === 'monthly' ? monthlyPrice : annualMonthly}
            </ThemedText>
            <ThemedText style={styles.period}>/month</ThemedText>
          </View>
          {billingCycle === 'annual' && (
            <ThemedText style={styles.billedAnnually}>
              Billed ${annualPrice} annually
            </ThemedText>
          )}
          <ThemedText style={styles.memberCount}>Up to 5 family members</ThemedText>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          <ThemedText style={styles.featuresTitle}>What's Included</ThemedText>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Unlimited Everything</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Unlimited playbooks, devotionals, and smart journaling for all members
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="people-circle" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Up to 5 Members</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Invite family members with individual accounts and personalized experiences
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Admin Controls</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Manage members, view usage analytics, and control family settings
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="stats-chart" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Family Analytics</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Track family engagement and spiritual growth together
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="heart" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Priority Support</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Get help when you need it with dedicated family support
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="calendar" size={24} color={Colors.anchorBlue} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Calendar Sync</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Keep everyone on track with shared spiritual goals
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Comparison Section */}
        <View style={styles.comparisonSection}>
          <ThemedText style={styles.comparisonTitle}>Compare Plans</ThemedText>

          <View style={styles.comparisonTable}>
            <View style={styles.comparisonRow}>
              <ThemedText style={styles.comparisonLabel}>Individual Plan</ThemedText>
              <ThemedText style={styles.comparisonValue}>$24.99/mo</ThemedText>
            </View>
            <View style={styles.comparisonRow}>
              <ThemedText style={styles.comparisonLabel}>5 Individual Plans</ThemedText>
              <ThemedText style={styles.comparisonValue}>$124.95/mo</ThemedText>
            </View>
            <View style={[styles.comparisonRow, styles.comparisonRowHighlight]}>
              <ThemedText style={styles.comparisonLabelHighlight}>Family Plan</ThemedText>
              <ThemedText style={styles.comparisonValueHighlight}>
                ${billingCycle === 'monthly' ? monthlyPrice : annualMonthly}/mo
              </ThemedText>
            </View>
          </View>

          <View style={styles.savingsBox}>
            <Ionicons name="trending-down" size={24} color={Colors.growthGreen} />
            <ThemedText style={styles.savingsText}>
              Save ${(124.95 - (billingCycle === 'monthly' ? monthlyPrice : parseFloat(annualMonthly))).toFixed(2)}/month vs individual plans
            </ThemedText>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <ThemedText style={styles.faqTitle}>Frequently Asked Questions</ThemedText>

          <View style={styles.faqItem}>
            <ThemedText style={styles.faqQuestion}>Can I add more than 5 members?</ThemedText>
            <ThemedText style={styles.faqAnswer}>
              Contact our support team to discuss custom family plans for larger households.
            </ThemedText>
          </View>

          <View style={styles.faqItem}>
            <ThemedText style={styles.faqQuestion}>Can members have separate accounts?</ThemedText>
            <ThemedText style={styles.faqAnswer}>
              Yes! Each family member gets their own personalized account with individual progress tracking.
            </ThemedText>
          </View>

          <View style={styles.faqItem}>
            <ThemedText style={styles.faqQuestion}>What happens if I cancel?</ThemedText>
            <ThemedText style={styles.faqAnswer}>
              All family members will lose access at the end of the billing period. You can reactivate anytime.
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <ThemedText style={styles.continueButtonText}>Continue to Setup</ThemedText>
          <Ionicons name="arrow-forward" size={20} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <ThemedText style={styles.footerNote}>
          30-day money-back guarantee • Cancel anytime
        </ThemedText>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any, _width: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 120,
    },
    heroSection: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.anchorBlue + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 32,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
      lineHeight: 24,
    },
    billingToggleContainer: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: Colors.lightGray,
      borderRadius: 12,
      padding: 4,
    },
    billingToggle: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      position: 'relative',
    },
    billingToggleActive: {
      backgroundColor: Colors.hopeWhite,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    billingToggleText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: Colors.textGray,
    },
    billingToggleTextActive: {
      color: Colors.anchorBlue,
      fontFamily: fonts.semiBold,
    },
    saveBadge: {
      position: 'absolute',
      top: -8,
      right: 8,
      backgroundColor: Colors.growthGreen,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    saveBadgeText: {
      fontSize: 10,
      fontFamily: fonts.bold,
      color: Colors.hopeWhite,
    },
    pricingCard: {
      marginHorizontal: 24,
      marginBottom: 32,
      padding: 24,
      backgroundColor: Colors.anchorBlue + '10',
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: Colors.anchorBlue,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    currency: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginTop: 8,
    },
    price: {
      fontSize: 56,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
    },
    period: {
      fontSize: 18,
      fontFamily: fonts.medium,
      color: Colors.textGray,
      marginTop: 16,
    },
    billedAnnually: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginBottom: 8,
    },
    memberCount: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    featuresSection: {
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    featuresTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginBottom: 20,
    },
    featureItem: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    featureIcon: {
      marginRight: 16,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      lineHeight: 20,
    },
    comparisonSection: {
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    comparisonTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginBottom: 16,
    },
    comparisonTable: {
      backgroundColor: Colors.lightGray,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    comparisonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.hopeWhite,
    },
    comparisonRowHighlight: {
      backgroundColor: Colors.anchorBlue + '15',
      marginHorizontal: -16,
      paddingHorizontal: 16,
      borderBottomWidth: 0,
      borderRadius: 8,
      marginTop: 8,
    },
    comparisonLabel: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    comparisonValue: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.text,
    },
    comparisonLabelHighlight: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    comparisonValueHighlight: {
      fontSize: 16,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
    },
    savingsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.growthGreen + '15',
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    savingsText: {
      flex: 1,
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.growthGreen,
    },
    faqSection: {
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    faqTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      marginBottom: 16,
    },
    faqItem: {
      marginBottom: 20,
    },
    faqQuestion: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginBottom: 8,
    },
    faqAnswer: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      lineHeight: 20,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: Colors.lightGray,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.anchorBlue,
      borderRadius: 12,
      paddingVertical: 16,
      marginBottom: 12,
      gap: 8,
    },
    continueButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.hopeWhite,
    },
    footerNote: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
    },
  });

export default withErrorBoundary(OnboardingFamilyPlanScreen, 'OnboardingFamilyPlanScreen');
