/**
 * ENTERPRISE IMPROVEMENT: Purchase Success Modal
 *
 * Explanation: This modal provides clear visual confirmation after successful payment.
 * Benefits:
 * - Builds user confidence (they know payment worked)
 * - Shows what they purchased (tier + benefits)
 * - Prevents confusion and support tickets
 * - Creates positive emotional moment with celebration
 * - Required for enterprise-grade UX
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import { triggerLightHaptic } from '../utils/haptics';
import { pricingService, type PricingTier } from '../services/pricingService';

const { width } = Dimensions.get('window');

interface PurchaseSuccessModalProps {
  visible: boolean;
  tier: string;
  isTrial: boolean;
  isValidated: boolean;
  isAnnual?: boolean;
  isOnboarding?: boolean;
  onContinue: () => void;
}

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  visible,
  tier,
  isTrial,
  isValidated,
  isAnnual = false,
  isOnboarding = false,
  onContinue,
}) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const paymentProvider = Platform.OS === 'android' ? 'Google Play' : 'Apple';

  useEffect(() => {
    // Load pricing tiers when component mounts
    pricingService.getLocationAdjustedPricing().then(tiers => {
      setPricingTiers(tiers);
    });
  }, []);

  useEffect(() => {
    if (visible) {
      // Animate modal entrance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate checkmark with delay
      setTimeout(() => {
        Animated.spring(checkmarkScale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }, 200);
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      checkmarkScale.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim, checkmarkScale]);

  const getTierInfo = () => {
    const planNames: Record<string, string> = {
      seeker: 'Seeker',
      spark: 'Spark',
      spark_annual: 'Spark',
      growth: 'Growth',
      growth_annual: 'Growth',
      transformation: 'Transformation',
      transformation_annual: 'Transformation',
      family: 'Family',
      family_annual: 'Family',
      free_trial: 'Free Trial',
    };

    // Use isAnnual prop to determine billing cycle display
    const effectiveTierKey = isTrial ? tier.replace('_trial', '') : tier;
    const baseTierKey = effectiveTierKey.replace('_annual', ''); // Get base tier for pricing lookup
    const baseName = planNames[effectiveTierKey] || planNames[baseTierKey] || effectiveTierKey;

    // Build display names
    const billingCycle = isAnnual ? ' Annual' : '';
    const canonicalName = `siFia ${planNames[baseTierKey] || baseName}`;

    // Get tier features from pricing service (use base tier, not annual variant)
    const currentTier = pricingTiers.find(t => t.id === baseTierKey);

    if (isTrial) {
      const trialLimitByTier: Record<string, { playbooks: number }> = {
        spark: { playbooks: 5 },
        growth: { playbooks: 15 },
        transformation: { playbooks: 25 },
      };
      const trialLimits = trialLimitByTier[baseTierKey] || trialLimitByTier.growth;
      const benefits = [
        `Explore siFia ${baseName}${billingCycle} for 3 days`,
        `Create ${trialLimits.playbooks} playbooks during your trial`,
        'Return anytime when a new moment comes up',
        'Cancel anytime before your trial ends',
      ];

      return {
        name: canonicalName,
        color: Colors.alertCoral,
        benefits,
      };
    }

    // For paid plans, use the consistent “What you can do next” list
    const paidBenefits = [
      'Create playbooks for the moments you\'re carrying',
      'Return to Scripture with greater clarity and peace',
      'Take one faithful step at a time',
      'Use journaling and prayer tools when you need them',
    ];

    if (currentTier) {
      return {
        name: canonicalName,
        color: Colors.alertCoral,
        benefits: paidBenefits,
      };
    }

    // Fallback if pricing not loaded yet
    return {
      name: canonicalName,
      color: Colors.alertCoral,
      benefits: paidBenefits,
    };
  };

  const tierInfo = getTierInfo();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: Colors.anchorBlue,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Success Checkmark */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                backgroundColor: tierInfo.color,
                transform: [{ scale: checkmarkScale }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={36} color="#FFFFFF" />
          </Animated.View>

          {/* Success Message */}
          <ThemedText style={[styles.title, { color: Colors.hopeWhite }]}
          >
            {isTrial ? 'Your free trial has started' : "You're all set"}
          </ThemedText>

          <ThemedText style={[styles.subtitle, { color: Colors.hopeWhite }]}
          >
            Welcome to {tierInfo.name}
          </ThemedText>

          {/* Validation Badge */}
          {isValidated ? (
            <View style={styles.validationBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <ThemedText style={styles.validationText}>Confirmed by {paymentProvider}</ThemedText>
            </View>
          ) : (
            <View style={styles.validationBadge}>
              <Ionicons name="hourglass-outline" size={16} color="#FFA500" />
              <ThemedText style={[styles.validationText, styles.warningText]}>Confirming with {paymentProvider}...</ThemedText>
            </View>
          )}

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            <ThemedText style={[styles.benefitsTitle, { color: Colors.hopeWhite }]}
            >
              What you can do next
            </ThemedText>
            {tierInfo.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={tierInfo.color} />
                <ThemedText style={[styles.benefitText, { color: Colors.hopeWhite }]}
                >
                  {benefit}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Trial Notice */}
          {isTrial && (
            <View style={[styles.trialNotice, { backgroundColor: Colors.anchorBlue }]}
            >
              <Ionicons name="information-circle" size={20} color="#FFD93D" />
              <ThemedText style={[styles.trialNoticeText, { color: Colors.hopeWhite }]}
              >
                Your trial begins today. You can cancel anytime before it ends.
              </ThemedText>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => {
              triggerLightHaptic();
              onContinue();
            }}
            activeOpacity={0.85}
          >
            <ThemedText style={[styles.continueButtonText, { fontFamily: theme.fontFamily, fontWeight: '600' }]}>
              {isTrial || isOnboarding ? 'Continue with siFia' : 'Process another moment'}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: width - 60,
    maxWidth: 360,
    borderRadius: 40,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  checkmarkContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 24,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
  },
  warningText: {
    color: '#FFA500',
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  trialNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  trialNoticeText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 12,
  },
  continueButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});
