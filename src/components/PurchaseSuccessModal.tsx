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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import { useTheme } from '../theme/ThemeContext'; // Unused
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
  isAnnual?: boolean; // Add isAnnual prop for proper display
  onContinue: () => void;
}

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  visible,
  tier,
  isTrial,
  isValidated,
  isAnnual = false,
  onContinue,
}) => {
  // const theme = useTheme(); // Unused
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);

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
    
    // Build display name with billing cycle from prop
    const billingCycle = isAnnual ? ' Annual' : '';
    const baseDisplayName = `siFia ${baseName}${billingCycle}`;

    // Get tier features from pricing service (use base tier, not annual variant)
    const currentTier = pricingTiers.find(t => t.id === baseTierKey);

    if (isTrial) {
      const benefits: string[] = [];

      // Use pricing service features for trial
      if (currentTier) {
        benefits.push(`3 days free access to the ${baseName}${billingCycle} plan`);
        benefits.push('Generate 2 Playbooks during the trial');
        benefits.push('Generate 2 Devotionals during the trial');

        // Add key features from pricing service
        if (currentTier.features.length > 0) {
          // Show first 2 features to give them a taste
          const keyFeatures = currentTier.features.slice(0, 2);
          benefits.push(...keyFeatures);
        }
      } else {
        // Fallback if pricing not loaded
        benefits.push(`3 days free access to the ${baseName}${billingCycle} plan`);
        benefits.push('Generate 2 Playbooks during the trial');
        benefits.push('Generate 2 Devotionals during the trial');
      }

      benefits.push('Cancel anytime');
      benefits.push('No commitment');

      return {
        // e.g. "siFia Spark Annual Trial" or "siFia Growth Trial"
        name: `${baseDisplayName} Trial`,
        color: Colors.alertCoral,
        benefits,
      };
    }

    // For paid plans, use pricing service features
    if (currentTier) {
      return {
        name: baseDisplayName,
        color: Colors.alertCoral,
        benefits: currentTier.features,
      };
    }

    // Fallback if pricing not loaded yet
    if (effectiveTierKey === 'spark') {
      return {
        name: baseDisplayName,
        color: Colors.alertCoral,
        benefits: [
          '8 playbooks & 8 devotionals each month',
          'Gentle reminders to keep you on track',
          'Track your progress week by week',
          'Basic journaling tools',
          'Calendar Sync to stay on track',
          'Copy To-Dos to other dates for flexibility',
        ],
      };
    }

    if (effectiveTierKey === 'growth') {
      return {
        name: baseDisplayName,
        color: Colors.alertCoral,
        benefits: [
          'All in Spark, plus:',
          '20 playbooks & 20 devotionals each month',
          'Access 1-day, 3-day & 5-day devotionals',
          'Advanced reflection prompts',
          'Smart Journaling for personalized reflection',
          'Export to PDF for sharing and printing',
        ],
      };
    }

    if (effectiveTierKey === 'transformation') {
      return {
        name: baseDisplayName,
        color: Colors.alertCoral,
        benefits: [
          'All in Growth, plus:',
          'Unlimited playbooks & devotionals',
          '7-day devotionals for deep reflection',
          'Priority support',
          'Export to Word for professional use',
        ],
      };
    }

    return {
      name: baseDisplayName,
      color: Colors.alertCoral,
      benefits: ['Full access to siFia features'],
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
            <Ionicons name="checkmark" size={60} color="#FFFFFF" />
          </Animated.View>

          {/* Success Message */}
          <ThemedText style={[styles.title, { color: Colors.hopeWhite }]}
          >
            {isTrial ? 'Trial Started!' : 'Purchase Successful!'}
          </ThemedText>

          <ThemedText style={[styles.subtitle, { color: Colors.hopeWhite }]}
          >
            Welcome to {tierInfo.name}
          </ThemedText>

          {/* Validation Badge */}
          {isValidated ? (
            <View style={styles.validationBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <ThemedText style={styles.validationText}>Verified by Apple</ThemedText>
            </View>
          ) : (
            <View style={styles.validationBadge}>
              <Ionicons name="warning" size={16} color="#FFA500" />
              <ThemedText style={[styles.validationText, styles.warningText]}>Processing payment...</ThemedText>
            </View>
          )}

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            <ThemedText style={[styles.benefitsTitle, { color: Colors.hopeWhite }]}
            >
              What's Included:
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
            <View style={[styles.trialNotice, { backgroundColor: Colors.anchorBlue }]}>
              <Ionicons name="information-circle" size={20} color="#FFD93D" />
              <ThemedText style={[styles.trialNoticeText, { color: Colors.hopeWhite }]}
              >
                Your trial starts now. Cancel anytime before it ends.
              </ThemedText>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: tierInfo.color }]}
            onPress={() => {
              triggerLightHaptic();
              onContinue();
            }}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.continueButtonText}>Continue</ThemedText>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
    padding: 20,
  },
  modalContainer: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  checkmarkContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
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
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
});
