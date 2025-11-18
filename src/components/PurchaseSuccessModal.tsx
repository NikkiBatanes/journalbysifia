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

import React, { useEffect, useRef } from 'react';
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

const { width } = Dimensions.get('window');

interface PurchaseSuccessModalProps {
  visible: boolean;
  tier: string;
  isTrial: boolean;
  isValidated: boolean;
  onContinue: () => void;
}

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  visible,
  tier,
  isTrial,
  isValidated,
  onContinue,
}) => {
  // const theme = useTheme(); // Unused
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

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
      growth: 'Growth',
      transformation: 'Transformation',
      family: 'Family',
      free_trial: 'Free Trial',
    };

    const effectiveTierKey = isTrial ? tier : tier;
    const baseName = planNames[effectiveTierKey] || effectiveTierKey;
    const isFamily = effectiveTierKey === 'family';
    const isUnlimited = effectiveTierKey === 'transformation' || effectiveTierKey === 'family';

    const getPlanLimits = (key: string): { playbooks: number; devotionals: number } => {
      switch (key) {
        case 'spark':
          return { playbooks: 8, devotionals: 8 };
        case 'growth':
          return { playbooks: 20, devotionals: 20 };
        case 'transformation':
        case 'family':
          return { playbooks: -1, devotionals: -1 };
        default:
          return { playbooks: 0, devotionals: 0 };
      }
    };

    const limits = getPlanLimits(effectiveTierKey);
    const playbooksText = limits.playbooks === -1 ? 'unlimited playbooks' : `${limits.playbooks} playbooks`;
    const devotionalsText = limits.devotionals === -1 ? 'unlimited devotionals' : `${limits.devotionals} devotionals`;

    const renewalLine = limits.playbooks === 0 && limits.devotionals === 0
      ? ''
      : isFamily && isUnlimited
        ? `Will renew to the ${baseName} plan with ${playbooksText} and ${devotionalsText} for your whole family if not cancelled.`
        : `Will renew to the ${baseName} plan with ${playbooksText} and ${devotionalsText} if not cancelled.`;

    if (isTrial) {
      const benefits: string[] = [];

      if (isFamily) {
        benefits.push('3 days free access for your whole family');
        benefits.push('Up to 5 family members are included in your Family plan');
        benefits.push('Each family member can generate 2 Playbooks during the trial');
        benefits.push('Each family member can generate 2 Devotionals during the trial');
      } else {
        benefits.push(`3 days free access to the ${baseName} plan`);
        benefits.push('Generate 2 Playbooks during the trial');
        benefits.push('Generate 2 Devotionals during the trial');
      }

      benefits.push('Cancel anytime');
      benefits.push('No commitment');

      if (renewalLine) {
        benefits.push(renewalLine);
      }

      return {
        name: `${baseName} Trial`,
        color: Colors.alertCoral,
        benefits,
      };
    }

    if (effectiveTierKey === 'spark') {
      return {
        name: baseName,
        color: Colors.alertCoral,
        benefits: [
          '8 Playbooks per month',
          '8 Devotionals per month',
        ],
      };
    }

    if (effectiveTierKey === 'growth') {
      return {
        name: baseName,
        color: Colors.alertCoral,
        benefits: [
          '20 Playbooks per month',
          '20 Devotionals per month',
          'Priority support',
        ],
      };
    }

    if (effectiveTierKey === 'transformation') {
      return {
        name: baseName,
        color: Colors.alertCoral,
        benefits: [
          'Unlimited Playbooks',
          'Unlimited Devotionals',
          'Premium features',
          'VIP support',
        ],
      };
    }

    return {
      name: baseName,
      color: Colors.alertCoral,
      benefits: [
        'Cancel anytime',
        'No commitment',
      ],
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
          {isValidated && (
            <View style={styles.validationBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <ThemedText style={styles.validationText}>Verified by Apple</ThemedText>
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
            onPress={onContinue}
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
