import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserState } from '../hooks/useUserState';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
  showUpgradePrompt?: boolean;
  upgradeMessage?: string;
}

const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallbackComponent,
  showUpgradePrompt = true,
  upgradeMessage = 'Upgrade to access this feature',
}) => {
  const { userState, canAccessFeature } = useUserState();
  const navigation = useNavigation();

  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const handleUpgrade = () => {
    if (userState.tier === 'seeker') {
      // Navigate to sales offer screen for upgrade
      navigation.navigate('OnboardingSalesOffer' as never);
    } else {
      // Navigate to subscription management
      navigation.navigate('SubscriptionManagement' as never);
    }
  };

  return (
    <View style={styles.gateContainer}>
      <View style={styles.lockIcon}>
        <Ionicons name="lock-closed" size={24} color={Colors.trustGrey} />
      </View>
      <Text style={styles.upgradeTitle}>Premium Feature</Text>
      <Text style={styles.upgradeMessage}>{upgradeMessage}</Text>
      <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
        <Text style={styles.upgradeButtonText}>
          {(userState.tier === 'basic' || userState.tier === 'seeker') ? 'Start Free Trial' : 'Upgrade Now'}
        </Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  gateContainer: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 20,
    margin: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.trustGrey,
    borderStyle: 'dashed',
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  upgradeMessage: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
});

export default FeatureGate;
