import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserState } from '../hooks/useUserState';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme';
import UsageTracker from './UsageTracker';

interface SubscriptionDashboardProps {
  compact?: boolean;
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
  compact = false,
}) => {
  const { userState, getFeatureLimits } = useUserState();
  const navigation = useNavigation();

  const { tier, subscription } = userState;
  const featureLimits = getFeatureLimits();

  const getTierDisplayName = () => {
    const tierMappings = {
      // Free tier
      'free_trial': 'Free Trial',
      
      // Seeker (free forever)
      'seeker': 'siFia SEEKER',
      'basic': 'siFia SEEKER',
      
      // Spark (entry paid)
      'spark': 'siFia SPARK',
      'spark_annual': 'siFia SPARK',
      'starter': 'siFia SPARK',
      'starter_annual': 'siFia SPARK',
      
      // Growth (mid tier)
      'growth': 'siFia GROWTH',
      'growth_annual': 'siFia GROWTH',
      
      // Transformation (premium)
      'transformation': 'siFia TRANSFORMATION',
      'transformation_annual': 'siFia TRANSFORMATION',
      
      // Family (top tier)
      'family': 'siFia FAMILY',
      'family_annual': 'siFia FAMILY'
    };
    
    return tierMappings[tier as keyof typeof tierMappings] || 'Unknown';
  };

  const getTierColor = () => {
    const tierColors = {
      // Free tier
      'free_trial': Colors.faithGold,
      
      // Seeker (free forever)
      'seeker': Colors.textGray,
      'basic': Colors.textGray,
      
      // Spark (entry paid)
      'spark': Colors.anchorBlue,
      'spark_annual': Colors.anchorBlue,
      'starter': Colors.anchorBlue,
      'starter_annual': Colors.anchorBlue,
      
      // Growth (mid tier)
      'growth': Colors.growthGreen,
      'growth_annual': Colors.growthGreen,
      
      // Transformation (premium)
      'transformation': Colors.faithGold,
      'transformation_annual': Colors.faithGold,
      
      // Family (top tier)
      'family': Colors.alertCoral,
      'family_annual': Colors.alertCoral
    };
    
    return tierColors[tier as keyof typeof tierColors] || Colors.textGray;
  };

  const handleManageSubscription = () => {
    if (tier === 'seeker') {
      navigation.navigate('OnboardingPricingShowcase' as never);
    } else {
      navigation.navigate('SubscriptionManagement' as never);
    }
  };

  const isTrialExpiringSoon = () => {
    if (tier !== 'free_trial' || !subscription?.trialEndDate) {return false;}

    const trialEnd = new Date(subscription.trialEndDate);
    const now = new Date();
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysRemaining <= 1;
  };

  const getTrialDaysRemaining = () => {
    if (tier !== 'free_trial' || !subscription?.trialEndDate) {return 0;}

    const trialEnd = new Date(subscription.trialEndDate);
    const now = new Date();
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, daysRemaining);
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={[styles.tierBadge, { backgroundColor: getTierColor() }]}>
            <Text style={styles.tierBadgeText}>{getTierDisplayName()}</Text>
          </View>
          {tier === 'free_trial' && (
            <Text style={styles.trialText}>
              {getTrialDaysRemaining()} days left
            </Text>
          )}
        </View>

        {featureLimits && (
          <View style={styles.compactUsage}>
            <UsageTracker feature="playbooks" compact />
            <UsageTracker feature="devotionals" compact />
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.planInfo}>
          <Text style={styles.planTitle}>Current Plan</Text>
          <View style={styles.planRow}>
            <View style={[styles.tierBadge, { backgroundColor: getTierColor() }]}>
              <Text style={styles.tierBadgeText}>{getTierDisplayName()}</Text>
            </View>
            {tier.includes('annual') && (
              <View style={styles.annualBadge}>
                <Text style={styles.annualText}>Annual</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
          <Text style={styles.manageButtonText}>
            {tier === 'seeker' ? 'Upgrade' : 'Manage'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {tier === 'free_trial' && (
        <View style={[styles.trialAlert, isTrialExpiringSoon() && styles.trialAlertUrgent]}>
          <Ionicons
            name={isTrialExpiringSoon() ? 'warning' : 'time'}
            size={20}
            color={isTrialExpiringSoon() ? Colors.alertCoral : Colors.faithGold}
          />
          <View style={styles.trialInfo}>
            <Text style={[styles.trialTitle, isTrialExpiringSoon() && styles.trialTitleUrgent]}>
              {isTrialExpiringSoon() ? 'Trial Ending Soon!' : 'Free Trial Active'}
            </Text>
            <Text style={styles.trialDescription}>
              {getTrialDaysRemaining()} {getTrialDaysRemaining() === 1 ? 'day' : 'days'} remaining
            </Text>
          </View>
        </View>
      )}

      {featureLimits && (
        <View style={styles.usageSection}>
          <Text style={styles.sectionTitle}>Usage & Limits</Text>

          <View style={styles.usageGrid}>
            <UsageTracker feature="playbooks" />
            <UsageTracker feature="devotionals" />
            <UsageTracker feature="exports" />
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Available Features</Text>
            <View style={styles.featuresList}>
              {Object.entries(featureLimits.features).map(([feature, enabled]) => (
                <View key={feature} style={styles.featureItem}>
                  <Ionicons
                    name={enabled ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={enabled ? Colors.growthGreen : Colors.textGray}
                  />
                  <Text style={[styles.featureText, !enabled && styles.featureTextDisabled]}>
                    {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {tier === 'seeker' && (
        <View style={styles.upgradePrompt}>
          <Text style={styles.upgradeTitle}>Unlock Premium Features</Text>
          <Text style={styles.upgradeDescription}>
            Start your free trial to access unlimited playbooks, devotionals, and advanced features.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={handleManageSubscription}>
            <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  compactContainer: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactUsage: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.hopeWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.textLight,
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  annualBadge: {
    backgroundColor: Colors.growthGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  annualText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  trialText: {
    fontSize: 12,
    color: Colors.faithGold,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  trialAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.faithGold,
    gap: 12,
  },
  trialAlertUrgent: {
    borderColor: Colors.alertCoral,
    backgroundColor: '#FFF5F5',
  },
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.faithGold,
    marginBottom: 2,
  },
  trialTitleUrgent: {
    color: Colors.alertCoral,
  },
  trialDescription: {
    fontSize: 12,
    color: Colors.textGray,
  },
  usageSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 12,
  },
  usageGrid: {
    gap: 8,
    marginBottom: 24,
  },
  featuresSection: {
    marginTop: 8,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 14,
    color: Colors.textDark,
  },
  featureTextDisabled: {
    color: Colors.textGray,
  },
  upgradePrompt: {
    margin: 16,
    padding: 20,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.faithGold,
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: 8,
  },
  upgradeDescription: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 24,
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

export default SubscriptionDashboard;
