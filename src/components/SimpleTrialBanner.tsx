// =====================================================
// SIMPLIFIED TRIAL BANNER COMPONENT
// =====================================================
// A simple trial countdown banner that works with your existing UI

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSimpleTrialAccess } from '../hooks/useSimpleTrialAccess';

interface SimpleTrialBannerProps {
  userId?: string;
  onUpgradePress?: () => void;
  style?: any;
}

export const SimpleTrialBanner: React.FC<SimpleTrialBannerProps> = ({
  userId,
  onUpgradePress,
  style,
}) => {
  const { trialStatus, hasActiveAccess, daysRemaining } = useSimpleTrialAccess(userId);

  if (!hasActiveAccess || trialStatus.isLoading) {
    return null;
  }

  const getUrgencyLevel = () => {
    if (daysRemaining <= 1) return 'high';
    if (daysRemaining <= 2) return 'medium';
    return 'low';
  };

  const getMessage = () => {
    if (daysRemaining === 0) {
      return 'Your trial expires today! Upgrade to keep full access.';
    } else if (daysRemaining === 1) {
      return 'Your trial expires tomorrow! Don\'t lose access to premium features.';
    } else {
      return `${daysRemaining} days left in your trial. Upgrade to continue your journey.`;
    }
  };

  const urgency = getUrgencyLevel();

  return (
    <View style={[styles.banner, styles[urgency], style]}>
      <View style={styles.content}>
        <Text style={styles.message}>{getMessage()}</Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgradePress}
        >
          <Text style={styles.upgradeText}>Upgrade Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  low: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  medium: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  high: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 12,
  },
  upgradeButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  upgradeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SimpleTrialBanner;
