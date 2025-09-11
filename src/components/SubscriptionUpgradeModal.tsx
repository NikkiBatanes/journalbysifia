import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import { SubscriptionTier } from '../types/subscription';
import { usePlatformSubscription } from '../hooks/usePlatformSubscription';
import { useDevotionalGating } from '../hooks/useDevotionalGating';
import ThemedText from './common/ThemedText';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../utils/haptics';

interface SubscriptionUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  targetTier: SubscriptionTier;
  targetBilling: 'monthly' | 'annual';
  requestedDuration?: number; // For devotional context
  onUpgradeSuccess?: () => void;
}

const SubscriptionUpgradeModal: React.FC<SubscriptionUpgradeModalProps> = ({
  visible,
  onClose,
  targetTier,
  targetBilling,
  requestedDuration,
  onUpgradeSuccess,
}) => {
  const {
    products,
    isLoading,
    upgradeSubscription,
    requestDowngrade,
    getProduct,
    isValidUpgrade,
    isValidDowngrade,
  } = usePlatformSubscription();
  
  const devotionalGating = useDevotionalGating();
  const [isProcessing, setIsProcessing] = useState(false);
  const [upgradeType, setUpgradeType] = useState<'upgrade' | 'downgrade' | null>(null);

  const currentTier = devotionalGating.tier;
  const currentBilling = devotionalGating.subscription?.subscription_end_date ? 'annual' : 'monthly';
  
  const targetProduct = getProduct(targetTier, targetBilling);
  const currentProduct = getProduct(currentTier as SubscriptionTier, currentBilling);

  // Determine if this is an upgrade or downgrade
  useEffect(() => {
    if (isValidUpgrade(currentTier as SubscriptionTier, targetTier)) {
      setUpgradeType('upgrade');
    } else if (isValidDowngrade(currentTier as SubscriptionTier, targetTier)) {
      setUpgradeType('downgrade');
    } else {
      setUpgradeType(null);
    }
  }, [currentTier, targetTier, isValidUpgrade, isValidDowngrade]);

  const handleUpgrade = async () => {
    if (!targetProduct || !currentProduct) {
      Alert.alert('Error', 'Product information not available');
      return;
    }

    try {
      triggerLightHaptic();
      setIsProcessing(true);

      const upgradeRequest = {
        currentProductId: currentProduct.productId,
        targetProductId: targetProduct.productId,
        currentTier: currentTier as SubscriptionTier,
        targetTier,
        billing: targetBilling,
      };

      console.log('[SubscriptionUpgradeModal] Starting upgrade:', upgradeRequest);
      
      const result = await upgradeSubscription(upgradeRequest);
      
      if (result.success) {
        triggerSuccessHaptic();
        
        Alert.alert(
          'Upgrade Successful!',
          `You now have access to ${targetTier} features. ${requestedDuration ? `You can now create ${requestedDuration}-day devotionals.` : ''}`,
          [
            {
              text: 'Continue',
              onPress: () => {
                onClose();
                onUpgradeSuccess?.();
              }
            }
          ]
        );
      } else {
        throw new Error('Upgrade failed');
      }
      
    } catch (error) {
      console.error('[SubscriptionUpgradeModal] Upgrade failed:', error);
      triggerErrorHaptic();
      
      Alert.alert(
        'Upgrade Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDowngrade = async () => {
    try {
      triggerLightHaptic();
      setIsProcessing(true);

      const result = await requestDowngrade(currentTier as SubscriptionTier, targetTier, targetBilling);
      
      if (result.requiresPlatformAction) {
        Alert.alert(
          'Manage Subscription',
          result.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: Platform.OS === 'ios' ? 'Open Settings' : 'Open Play Store',
              onPress: () => {
                // TODO: Open platform subscription management
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Downgrade Scheduled',
          result.message,
          [
            {
              text: 'OK',
              onPress: onClose
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('[SubscriptionUpgradeModal] Downgrade request failed:', error);
      triggerErrorHaptic();
      
      Alert.alert(
        'Request Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrimaryAction = () => {
    if (upgradeType === 'upgrade') {
      handleUpgrade();
    } else if (upgradeType === 'downgrade') {
      handleDowngrade();
    }
  };

  const getPrimaryButtonText = () => {
    if (isProcessing) {
      return upgradeType === 'upgrade' ? 'Upgrading...' : 'Processing...';
    }
    
    if (upgradeType === 'upgrade') {
      return `Upgrade to ${targetTier}`;
    } else if (upgradeType === 'downgrade') {
      return `Request ${targetTier}`;
    }
    
    return 'Continue';
  };

  const getModalTitle = () => {
    if (upgradeType === 'upgrade') {
      return requestedDuration 
        ? `Unlock ${requestedDuration}-day devotionals`
        : `Upgrade to ${targetTier}`;
    } else if (upgradeType === 'downgrade') {
      return `Change to ${targetTier}`;
    }
    
    return 'Subscription Change';
  };

  const getDescription = () => {
    if (upgradeType === 'upgrade') {
      return requestedDuration
        ? `To create ${requestedDuration}-day devotionals, you'll need ${targetTier}. The platform will handle billing automatically with fair proration.`
        : `Upgrade to ${targetTier} for more features and higher limits. The platform will handle billing automatically with fair proration.`;
    } else if (upgradeType === 'downgrade') {
      return Platform.OS === 'ios'
        ? 'Downgrades are managed through your Apple ID settings. We\'ll guide you there.'
        : 'We\'ll help you change your subscription. Some changes may take effect at your next billing cycle.';
    }
    
    return 'Manage your subscription plan.';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <ThemedText weight="bold" style={styles.title}>
            {getModalTitle()}
          </ThemedText>

          {/* Description */}
          <ThemedText style={styles.description}>
            {getDescription()}
          </ThemedText>

          {/* Current vs Target Comparison */}
          <View style={styles.comparisonContainer}>
            <View style={styles.planCard}>
              <ThemedText weight="semiBold" style={styles.planTitle}>Current Plan</ThemedText>
              <ThemedText weight="bold" style={styles.planName}>
                {currentTier} {currentBilling}
              </ThemedText>
              {currentProduct && (
                <ThemedText style={styles.planPrice}>
                  {currentProduct.localizedPrice}
                </ThemedText>
              )}
            </View>

            <View style={styles.arrowContainer}>
              <Ionicons 
                name={upgradeType === 'upgrade' ? 'arrow-up' : 'arrow-down'} 
                size={24} 
                color={upgradeType === 'upgrade' ? Colors.growthGreen : Colors.alertCoral} 
              />
            </View>

            <View style={[styles.planCard, styles.targetPlanCard]}>
              <ThemedText weight="semiBold" style={styles.planTitle}>
                {upgradeType === 'upgrade' ? 'Upgrade to' : 'Change to'}
              </ThemedText>
              <ThemedText weight="bold" style={styles.planName}>
                {targetTier} {targetBilling}
              </ThemedText>
              {targetProduct && (
                <ThemedText style={styles.planPrice}>
                  {targetProduct.localizedPrice}
                </ThemedText>
              )}
            </View>
          </View>

          {/* Platform Notice */}
          <View style={styles.noticeContainer}>
            <Ionicons name="information-circle" size={20} color={Colors.faithGold} />
            <ThemedText style={styles.noticeText}>
              {Platform.OS === 'ios' 
                ? 'Billing is handled securely by Apple with automatic proration.'
                : 'Billing is handled securely by Google Play with automatic proration.'
              }
            </ThemedText>
          </View>

          {/* Features Preview (for upgrades) */}
          {upgradeType === 'upgrade' && requestedDuration && (
            <View style={styles.featuresContainer}>
              <ThemedText weight="semiBold" style={styles.featuresTitle}>
                What you'll unlock:
              </ThemedText>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
                <ThemedText style={styles.featureText}>
                  {requestedDuration}-day devotional experiences
                </ThemedText>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
                <ThemedText style={styles.featureText}>
                  All features from {targetTier} tier
                </ThemedText>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (isProcessing || isLoading) && styles.disabledButton
            ]}
            onPress={handlePrimaryAction}
            disabled={isProcessing || isLoading || !upgradeType}
          >
            <ThemedText weight="bold" style={styles.primaryButtonText}>
              {getPrimaryButtonText()}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onClose}
            disabled={isProcessing}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.9,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  targetPlanCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: Colors.growthGreen,
  },
  arrowContainer: {
    marginHorizontal: 16,
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.7,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  planName: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  planPrice: {
    fontSize: 14,
    color: Colors.faithGold,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    lineHeight: 20,
  },
  featuresContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
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
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 20,
  },
  primaryButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.5)',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.7,
  },
});

export default SubscriptionUpgradeModal;
