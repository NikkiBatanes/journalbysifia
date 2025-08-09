import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const discountedPrice = originalPrice * (1 - discountPercentage / 100);
  const savings = originalPrice - discountedPrice;

  const handleGetOffer = () => {
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
            <Ionicons name="close" size={24} color={Colors.textDark} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Limited Time Offer</Text>
            <Text style={styles.headerSubtitle}>Don't miss this exclusive discount!</Text>
          </View>

          {/* Discount Badge */}
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercentage}% OFF</Text>
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            <Ionicons name="time" size={24} color={Colors.alertCoral} />
            <Text style={styles.timerText}>Expires in {formatTime(timeLeft)}</Text>
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
              <Text style={styles.featureText}>Advanced spiritual insights</Text>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleGetOffer}>
            <Text style={styles.ctaButtonText}>Get This Offer</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerText}>
            This discount won't be available again. Secure your spiritual growth journey now.
          </Text>
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
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
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
    color: Colors.textDark,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textDark,
    opacity: 0.7,
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
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
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
    color: Colors.textDark,
    marginBottom: 4,
  },
  billingPeriod: {
    fontSize: 14,
    color: Colors.textDark,
    opacity: 0.7,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 18,
    color: Colors.textDark,
    opacity: 0.5,
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
    color: Colors.textDark,
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
    color: Colors.textDark,
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
    color: Colors.textDark,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default DynamicPricingModal;
