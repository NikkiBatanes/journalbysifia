import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import pricingService from '../services/pricingService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';

const { width } = Dimensions.get('window');

interface DynamicPricingModalProps {
  visible: boolean;
  onClose: () => void;
  discountPercentage: number;
  originalPrice: number;
  tier: string;
  isAnnual: boolean;
}

const DynamicPricingModal: React.FC<DynamicPricingModalProps> = ({
  visible,
  onClose,
  discountPercentage,
  originalPrice,
  tier,
  isAnnual,
}) => {
  const navigation = useNavigation();
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const { user } = useAuth();
  const giftScale = useRef(new Animated.Value(1)).current;
  const giftOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, onClose]);

  // Gentle pulsing animation for the gift icon
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(giftScale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(giftOpacity, { toValue: 0.95, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(giftScale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
          Animated.timing(giftOpacity, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, giftScale, giftOpacity]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const discountedPrice = originalPrice * (1 - discountPercentage / 100);
  const savings = originalPrice - discountedPrice;

  const handleGetOffer = async () => {
    // Mark discount as redeemed for this user/device
    try {
      await pricingService.markDiscountRedeemed(user?.id, discountPercentage);
    } catch (e) {
      // non-blocking
      console.warn('Failed to mark discount redeemed', e);
    }
    onClose();
    navigation.navigate('OnboardingPaymentProcessing' as any, {
      selectedTier: tier,
      isAnnual,
      price: discountedPrice,
      isDiscounted: true,
      discountPercentage,
    });
  };

  const getTierDisplayName = (tierName: string) => {
    switch (tierName) {
      case 'starter': return 'Starter';
      case 'growth': return 'Growth';
      case 'transformation': return 'Transformation';
      case 'family': return 'Family';
      default: return 'Growth';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>

          {/* Animated Gift Icon */}
          <Animated.View style={[
            styles.giftIconContainer,
            { transform: [{ scale: giftScale }], opacity: giftOpacity }
          ]}>
            <Ionicons name="gift" size={26} color={Colors.hopeWhite} />
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>A Ministry Gift to {'\n'}Help You Begin</Text>
            <Text style={styles.headerSubtitle}>We’re committed to serving people at every stage. A limited gifted rate is available to help you start strong.</Text>
          </View>

          {/* Gifted Rate Badge */}
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercentage}% Gifted Rate</Text>
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            <Ionicons name="time" size={24} color={Colors.alertCoral} />
            <Text style={styles.timerText}>Reserved for {formatTime(timeLeft)}</Text>
          </View>

          {/* Pricing */}
          <View style={styles.pricingContainer}>
            <Text style={styles.planName}>{getTierDisplayName(tier)} Plan</Text>
            <Text style={styles.billingPeriod}>{isAnnual ? 'Annual' : 'Monthly'} Billing</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
              <Text style={styles.discountedPrice}>${discountedPrice.toFixed(2)}</Text>
            </View>
            
            <Text style={styles.savingsText}>You save ${savings.toFixed(2)}!</Text>

            {/* First-term only note */}
            {isAnnual ? (
              <Text style={[styles.footerText, styles.firstTermNote]}>
                Gifted rate applies to the first year. {'\n'}Renews at the standard annual price.
              </Text>
            ) : (
              <Text style={[styles.footerText, styles.firstTermNote]}>
                Gifted rate applies to the first month. {'\n'}Renews at the standard monthly price.
              </Text>
            )}
          </View>

          {/* Features Highlight */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>What you get:</Text>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              <Text style={styles.featureText}>Unlimited personalized playbooks</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              <Text style={styles.featureText}>AI-powered devotionals</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              <Text style={styles.featureText}>Practical tools for steady growth</Text>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleGetOffer}>
            <Text style={styles.ctaButtonText}>Accept Gifted Rate</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerText}>Shown once per plan during onboarding.</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  giftIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.85,
    textAlign: 'center',
  },
  discountBadge: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  discountText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 24,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.alertCoral,
    marginLeft: 8,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  billingPeriod: {
    fontSize: 14,
    color: Colors.hopeWhite,
    opacity: 0.85,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 18,
    color: Colors.hopeWhite,
    opacity: 0.6,
    textDecorationLine: 'line-through',
    marginRight: 12,
  },
  discountedPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.alertCoral,
  },
  savingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.growthGreen,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 12,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
  },
  ctaButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.75,
    textAlign: 'center',
    lineHeight: 16,
  },
  firstTermNote: {
    marginTop: 10,
  },
});

export default DynamicPricingModal;
