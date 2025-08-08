import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTrialCountdown } from '../hooks/useTrialAccess';
import { useNavigation } from '@react-navigation/native';

interface TrialStatusBannerProps {
  onUpgradePress?: () => void;
}

export const TrialStatusBanner: React.FC<TrialStatusBannerProps> = ({ onUpgradePress }) => {
  const { message, urgencyLevel, daysRemaining, isActive } = useTrialCountdown();
  const navigation = useNavigation();

  if (!isActive || !message) {return null;}

  const handleUpgradePress = () => {
    if (onUpgradePress) {
      onUpgradePress();
    } else {
      navigation.navigate('UserProfile' as never);
    }
  };

  const getBannerStyle = () => {
    switch (urgencyLevel) {
      case 'high':
        return [styles.banner, styles.bannerHigh];
      case 'medium':
        return [styles.banner, styles.bannerMedium];
      default:
        return [styles.banner, styles.bannerLow];
    }
  };

  const getButtonText = () => {
    if (daysRemaining === 0) {return 'Upgrade Now';}
    if (daysRemaining === 1) {return 'Upgrade Today';}
    return 'View Plans';
  };

  return (
    <View style={getBannerStyle()}>
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePress}>
          <Text style={styles.upgradeButtonText}>{getButtonText()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerLow: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  bannerMedium: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  bannerHigh: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
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
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
