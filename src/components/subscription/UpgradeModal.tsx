/**
 * Upgrade Modal Component
 * Beautiful subscription upgrade interface with clear tier benefits
 * Focuses on simple value proposition (generations, not costs)
 */

import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  // Dimensions - removed as unused
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription, useSubscriptionUpgrade } from '../../hooks/useSubscription';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  currentTier?: string;
  suggestedTier?: string;
  context?: 'limit_reached' | 'feature_locked' | 'general';
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  period: string;
  playbooks: number | 'Unlimited';
  devotionals: number | 'Unlimited';
  features: string[];
  popular?: boolean;
  gradient: string[];
  description: string;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$4.99',
    period: '/month',
    playbooks: 8,
    devotionals: 8,
    description: 'Perfect for getting started',
    gradient: ['#10B981', '#059669'],
    features: [
      '8 Playbooks per month',
      '8 Devotionals per month',
      'Unlimited journaling',
      'Basic export features',
      'Email support',
    ],
  },
  {
    id: 'lite',
    name: 'Lite',
    price: '$9.99',
    period: '/month',
    playbooks: 20,
    devotionals: 20,
    description: 'Great for regular users',
    gradient: ['#3B82F6', '#1D4ED8'],
    popular: true,
    features: [
      '20 Playbooks per month',
      '20 Devotionals per month',
      'AI-Enhanced personalization',
      'Advanced export options',
      'Priority support',
      'Content recommendations',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19.99',
    period: '/month',
    playbooks: 'Unlimited',
    devotionals: 'Unlimited',
    description: 'For power users and leaders',
    gradient: ['#7C3AED', '#5B21B6'],
    features: [
      'Unlimited Playbooks',
      'Unlimited Devotionals',
      'Advanced AI personalization',
      'Premium export formats',
      'Priority queue processing',
      'Advanced analytics',
      'Custom content themes',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: '$29.99',
    period: '/month',
    playbooks: 'Unlimited',
    devotionals: 'Unlimited',
    description: 'Perfect for families and small groups',
    gradient: ['#F59E0B', '#D97706'],
    features: [
      'Everything in Pro',
      'Up to 6 family members',
      'Shared content library',
      'Family progress tracking',
      'Group devotionals',
      'Parental controls',
    ],
  },
];

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  onClose,
  currentTier = 'free_trial',
  suggestedTier,
  context = 'general',
}) => {
  const { subscription } = useSubscription();
  const { upgradeFlow } = useSubscriptionUpgrade();
  const [selectedTier, setSelectedTier] = useState(suggestedTier || 'lite');
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async (tierId: string) => {
    try {
      setUpgrading(true);
      await upgradeFlow(tierId);

      Alert.alert(
        'Upgrade Successful! 🎉',
        `Welcome to ${SUBSCRIPTION_TIERS.find(t => t.id === tierId)?.name}! Your new limits are active immediately.`,
        [{ text: 'Continue', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(
        'Upgrade Failed',
        'There was an issue processing your upgrade. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUpgrading(false);
    }
  };

  const getContextMessage = () => {
    switch (context) {
      case 'limit_reached':
        return {
          title: "You've reached your limit! 📚",
          subtitle: 'Upgrade to continue creating amazing content',
        };
      case 'feature_locked':
        return {
          title: 'Unlock Premium Features! ✨',
          subtitle: 'Get AI-enhanced personalization and more',
        };
      default:
        return {
          title: 'Upgrade Your Experience! 🚀',
          subtitle: 'Choose the perfect plan for your spiritual journey',
        };
    }
  };

  const contextMessage = getContextMessage();

  const renderTierCard = (tier: SubscriptionTier) => {
    const isSelected = selectedTier === tier.id;
    const isCurrent = currentTier === tier.id;

    return (
      <TouchableOpacity
        key={tier.id}
        style={[
          styles.tierCard,
          isSelected && styles.selectedTierCard,
          isCurrent && styles.currentTierCard,
        ]}
        onPress={() => setSelectedTier(tier.id)}
        disabled={isCurrent}
      >
        {tier.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}

        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentText}>Current Plan</Text>
          </View>
        )}

        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>{tier.name}</Text>
          <Text style={styles.tierDescription}>{tier.description}</Text>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>{tier.price}</Text>
            <Text style={styles.period}>{tier.period}</Text>
          </View>
        </View>

        <View style={styles.limitsContainer}>
          <View style={styles.limitItem}>
            <Ionicons name="book" size={16} color="#4F46E5" />
            <Text style={styles.limitText}>
              {tier.playbooks === 'Unlimited' ? 'Unlimited' : tier.playbooks} Playbooks
            </Text>
          </View>
          <View style={styles.limitItem}>
            <Ionicons name="heart" size={16} color="#7C3AED" />
            <Text style={styles.limitText}>
              {tier.devotionals === 'Unlimited' ? 'Unlimited' : tier.devotionals} Devotionals
            </Text>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {!isCurrent && (
          <TouchableOpacity
            style={[
              styles.selectButton,
              isSelected && styles.selectedButton,
            ]}
            onPress={() => handleUpgrade(tier.id)}
            disabled={upgrading}
          >
            <LinearGradient
              colors={isSelected ? tier.gradient : ['#F3F4F6', '#E5E7EB']}
              style={styles.selectGradient}
            >
              <Text style={[
                styles.selectText,
                isSelected && styles.selectedText,
              ]}>
                {upgrading && selectedTier === tier.id ? 'Upgrading...' : 'Select Plan'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.title}>{contextMessage.title}</Text>
            <Text style={styles.subtitle}>{contextMessage.subtitle}</Text>
          </View>
        </View>

        {/* Current usage info */}
        {subscription && (
          <View style={styles.currentUsageContainer}>
            <Text style={styles.currentUsageTitle}>Current Plan: {subscription.tier_display_name}</Text>
            <View style={styles.usageRow}>
              <Text style={styles.usageText}>
                Playbooks: {subscription.usage?.playbooks_used || 0} used this month
              </Text>
              <Text style={styles.usageText}>
                Devotionals: {subscription.usage?.devotionals_used || 0} used this month
              </Text>
            </View>
          </View>
        )}

        {/* Subscription tiers */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {SUBSCRIPTION_TIERS.map(renderTierCard)}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            • Cancel anytime • 7-day free trial • Secure payment
          </Text>
          <Text style={styles.footerSubtext}>
            All plans include unlimited journaling and basic export features
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  currentUsageContainer: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
  },
  currentUsageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  usageText: {
    fontSize: 12,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  selectedTierCard: {
    borderColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  currentTierCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  currentBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tierHeader: {
    marginBottom: 16,
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  period: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  selectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  selectedButton: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  footerText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
