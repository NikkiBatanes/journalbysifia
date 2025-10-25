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
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme';

const { width, height } = Dimensions.get('window');

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
  const theme = useTheme();
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
  }, [visible]);

  const getTierInfo = () => {
    const tierMap: Record<string, { name: string; color: string; benefits: string[] }> = {
      spark: {
        name: 'Spark',
        color: Colors.alertCoral,
        benefits: [
          '3 Playbooks per month',
          '3 Devotionals per month',
          'Basic prayer tracking',
          'Community access',
        ],
      },
      growth: {
        name: 'Growth',
        color: Colors.alertCoral,
        benefits: [
          '10 Playbooks per month',
          '10 Devotionals per month',
          'Advanced prayer tracking',
          'Priority support',
        ],
      },
      transformation: {
        name: 'Transformation',
        color: Colors.alertCoral,
        benefits: [
          'Unlimited Playbooks',
          'Unlimited Devotionals',
          'Premium features',
          'VIP support',
        ],
      },
      free_trial: {
        name: 'Free Trial',
        color: Colors.alertCoral,
        benefits: [
          '3 days free access',
          'All Spark features',
          'Cancel anytime',
          'No commitment',
        ],
      },
    };

    return tierMap[tier] || tierMap.spark;
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
          <Text style={[styles.title, { color: Colors.hopeWhite }]}>
            {isTrial ? 'Trial Started!' : 'Purchase Successful!'}
          </Text>

          <Text style={[styles.subtitle, { color: Colors.hopeWhite }]}>
            Welcome to {tierInfo.name}
          </Text>

          {/* Validation Badge */}
          {isValidated && (
            <View style={styles.validationBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <Text style={styles.validationText}>Verified by Apple</Text>
            </View>
          )}

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            <Text style={[styles.benefitsTitle, { color: Colors.hopeWhite }]}>
              What's Included:
            </Text>
            {tierInfo.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={tierInfo.color} />
                <Text style={[styles.benefitText, { color: Colors.hopeWhite }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          {/* Trial Notice */}
          {isTrial && (
            <View style={[styles.trialNotice, { backgroundColor: Colors.anchorBlue }]}>
              <Ionicons name="information-circle" size={20} color="#FFD93D" />
              <Text style={[styles.trialNoticeText, { color: Colors.hopeWhite }]}>
                Your trial starts now. Cancel anytime before it ends.
              </Text>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: tierInfo.color }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
