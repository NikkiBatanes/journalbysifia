/**
 * Retention Modal Component
 *
 * Displays dynamic retention offers with personalized pricing
 * and messaging based on user value and behavior.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
// import { retentionService } from '../services/retentionService'; // unused

export interface RetentionOffer {
  discount: number;
  duration: 'first_month' | 'first_year';
  title: string;
  message: string;
  cta: string;
  userValueScore?: number;
  pricingStrategy?: 'static' | 'dynamic';
  testGroup?: string;
  originalPrice?: number;
  discountedPrice?: number;
}

interface RetentionModalProps {
  visible: boolean;
  offer: RetentionOffer | null;
  onClose: () => void;
  onAccept: (offer: RetentionOffer) => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export const RetentionModal: React.FC<RetentionModalProps> = ({
  visible,
  offer,
  onClose,
  onAccept,
  onDecline,
  isLoading = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!offer) {return null;}

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(offer);
    } catch (error) {
      Alert.alert('Error', 'Failed to process offer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    onDecline();
    onClose();
  };

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const savings = offer.originalPrice && offer.discountedPrice
    ? offer.originalPrice - offer.discountedPrice
    : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.wisdomIndigo} />
              <Text style={styles.loadingText}>Personalizing your offer...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Offer Badge */}
              <View style={styles.badgeContainer}>
                <LinearGradient
                  colors={[Colors.wisdomIndigo, Colors.mysticalViolet]}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>{offer.discount}% OFF</Text>
                </LinearGradient>
              </View>

              {/* Title and Message */}
              <View style={styles.content}>
                <Text style={styles.title}>{offer.title}</Text>
                <Text style={styles.message}>{offer.message}</Text>

                {/* Pricing Display */}
                {offer.originalPrice && offer.discountedPrice && (
                  <View style={styles.pricingContainer}>
                    <View style={styles.priceRow}>
                      <Text style={styles.originalPrice}>
                        {formatPrice(offer.originalPrice)}
                      </Text>
                      <Text style={styles.discountedPrice}>
                        {formatPrice(offer.discountedPrice)}
                      </Text>
                    </View>
                    <Text style={styles.savingsText}>
                      Save {formatPrice(savings)} {offer.duration === 'first_year' ? 'in your first year' : 'in your first month'}
                    </Text>
                  </View>
                )}

                {/* Duration Info */}
                <View style={styles.durationContainer}>
                  <Ionicons name="time-outline" size={16} color={Colors.wisdomIndigo} />
                  <Text style={styles.durationText}>
                    {offer.duration === 'first_year'
                      ? 'First year discount, then regular pricing'
                      : 'First month discount, then regular pricing'
                    }
                  </Text>
                </View>

                {/* Value Proposition */}
                <View style={styles.featuresContainer}>
                  <Text style={styles.featuresTitle}>What you'll get:</Text>
                  <View style={styles.featuresList}>
                    <FeatureItem
                      icon="book-outline"
                      text="Unlimited spiritual playbooks"
                    />
                    <FeatureItem
                      icon="heart-outline"
                      text="Daily devotionals & reflections"
                    />
                    <FeatureItem
                      icon="download-outline"
                      text="Export your content"
                    />
                    <FeatureItem
                      icon="analytics-outline"
                      text="Track your spiritual growth"
                    />
                  </View>
                </View>

                {/* Urgency Element */}
                <View style={styles.urgencyContainer}>
                  <Ionicons name="flash" size={16} color={Colors.warningAmber} />
                  <Text style={styles.urgencyText}>
                    Limited time offer - expires in 24 hours
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleAccept}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>{offer.cta}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleDecline}
                  disabled={isProcessing}
                >
                  <Text style={styles.secondaryButtonText}>
                    Maybe later
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Trust Indicators */}
              <View style={styles.trustContainer}>
                <Text style={styles.trustText}>
                  ✓ Cancel anytime  ✓ 30-day money back guarantee
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

interface FeatureItemProps {
  icon: string;
  text: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Ionicons name={icon as any} size={16} color={Colors.wisdomIndigo} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 34, // Safe area padding
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  pricingContainer: {
    backgroundColor: Colors.sanctuaryWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 18,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 12,
  },
  discountedPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  savingsText: {
    fontSize: 14,
    color: Colors.prosperityGreen,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sanctuaryWhite,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  durationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6366F1',
    flex: 1,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.guidanceText,
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sanctuaryWhite,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  urgencyText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.warningAmber,
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.wisdomIndigo,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.gentleBorder,
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  trustContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  trustText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
