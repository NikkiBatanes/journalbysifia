import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserState } from '../hooks/useUserState';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';

interface UsageTrackerProps {
  feature: 'playbooks' | 'devotionals' | 'exports';
  compact?: boolean;
  showUpgradeButton?: boolean;
}

const UsageTracker: React.FC<UsageTrackerProps> = ({
  feature,
  compact = false,
  showUpgradeButton = true,
}) => {
  const { userState, checkUsageLimit } = useUserState();
  const navigation = useNavigation();

  const usage = checkUsageLimit(feature);
  const { canUse, remaining, limit } = usage;

  const getFeatureIcon = () => {
    switch (feature) {
      case 'playbooks':
        return 'book-outline';
      case 'devotionals':
        return 'heart-outline';
      case 'exports':
        return 'download-outline';
      default:
        return 'analytics-outline';
    }
  };

  const getFeatureLabel = () => {
    switch (feature) {
      case 'playbooks':
        return 'Playbooks';
      case 'devotionals':
        return 'Devotionals';
      case 'exports':
        return 'Exports';
      default:
        return 'Feature';
    }
  };

  const handleUpgrade = () => {
    if (userState.tier === 'basic') {
      navigation.navigate('OnboardingPricingShowcase' as never);
    } else {
      navigation.navigate('SubscriptionManagement' as never);
    }
  };

  const getUsagePercentage = () => {
    if (limit === -1) {return 100;} // Unlimited
    if (limit === 0) {return 0;}
    const used = limit - remaining;
    return (used / limit) * 100;
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) {return Colors.alertCoral;}
    if (percentage >= 70) {return Colors.faithGold;}
    return Colors.growthGreen;
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name={getFeatureIcon()} size={16} color={Colors.textGray} />
        <Text style={styles.compactText}>
          {limit === -1 ? 'Unlimited' : `${remaining}/${limit}`} {getFeatureLabel()}
        </Text>
        {!canUse && (
          <Ionicons name="warning" size={16} color={Colors.alertCoral} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name={getFeatureIcon()} size={20} color={Colors.textDark} />
          <Text style={styles.title}>{getFeatureLabel()}</Text>
        </View>
        {!canUse && showUpgradeButton && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.usageInfo}>
        {limit === -1 ? (
          <Text style={styles.unlimitedText}>Unlimited Access</Text>
        ) : (
          <>
            <Text style={styles.usageText}>
              {remaining} of {limit} remaining
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${getUsagePercentage()}%`,
                    backgroundColor: getUsageColor(),
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>

      {!canUse && (
        <View style={styles.limitReached}>
          <Ionicons name="warning" size={16} color={Colors.alertCoral} />
          <Text style={styles.limitText}>
            You've reached your {getFeatureLabel().toLowerCase()} limit
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: Colors.textLight,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
  },
  compactText: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '500',
  },
  upgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  usageInfo: {
    marginBottom: 4,
  },
  usageText: {
    fontSize: 12,
    color: Colors.textGray,
    marginBottom: 4,
  },
  unlimitedText: {
    fontSize: 12,
    color: Colors.growthGreen,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.textLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  limitReached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  limitText: {
    fontSize: 11,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
});

export default UsageTracker;
