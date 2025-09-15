import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { usePlatformPayment } from '../../hooks/usePlatformPayment';
import ThemedText from '../../components/common/ThemedText';

const { width, height } = Dimensions.get('window');

interface OnboardingPaymentConfirmationScreenProps {
  route?: {
    params?: {
      tier?: string;
      platform?: string;
      transactionId?: string;
    };
  };
}

const OnboardingPaymentConfirmationScreen: React.FC<OnboardingPaymentConfirmationScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useNewSubscription(user?.id ?? '');
  const { subscriptionStatus, refreshSubscriptionStatus } = usePlatformPayment();
  const params = route?.params || {};
  const { tier = 'spark', platform = 'local_test', transactionId } = params;

  useEffect(() => {
    // Refresh subscription data to get the latest status
    refreshSubscription();
  }, [refreshSubscription]);

  const handleContinue = () => {
    // Navigate to notification setup
    navigation.navigate('OnboardingNotificationSetup' as never);
  };

  const handleSkipToApp = () => {
    // Skip notification setup and go directly to main app
    navigation.navigate('MainTabs' as never);
  };

  const getTierDisplayName = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'spark':
        return 'Spark';
      case 'growth':
        return 'Growth';
      case 'transformation':
        return 'Transformation';
      case 'family':
        return 'Family';
      default:
        return 'Premium';
    }
  };

  const getTierBenefits = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'spark':
        return [
          '8 Playbooks & Devotionals per month',
          'Smart Journaling with AI insights',
          'Personalized spiritual guidance',
          'Priority customer support'
        ];
      case 'growth':
        return [
          '20 Playbooks & Devotionals per month',
          'Smart Journaling with AI insights',
          'Advanced spiritual analytics',
          'Priority customer support',
          'Exclusive content library'
        ];
      case 'transformation':
        return [
          'Unlimited Playbooks & Devotionals',
          'Smart Journaling with AI insights',
          'Advanced spiritual analytics',
          'Priority customer support',
          'Exclusive content library',
          'Personal spiritual coach access'
        ];
      case 'family':
        return [
          'Unlimited access for up to 6 members',
          'Family spiritual dashboard',
          'Shared prayer requests',
          'Family devotional plans',
          'All premium features included'
        ];
      default:
        return [
          'Premium spiritual content',
          'Enhanced features',
          'Priority support'
        ];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.growthGreen} />
        </View>

        {/* Success Message */}
        <ThemedText weight="bold" style={styles.title}>Payment Successful!</ThemedText>
        <ThemedText style={styles.subtitle}>
          Welcome to siFia {getTierDisplayName(tier)}
        </ThemedText>

        {/* Subscription Details */}
        <View style={styles.subscriptionCard}>
          <ThemedText weight="semiBold" style={styles.subscriptionTitle}>Your Subscription</ThemedText>
          <ThemedText weight="bold" style={styles.tierName}>{getTierDisplayName(tier)} Plan</ThemedText>
          
          {transactionId && (
            <ThemedText style={styles.transactionId}>
              Transaction ID: {transactionId}
            </ThemedText>
          )}
          
          <ThemedText style={styles.platformInfo}>
            Platform: {platform === 'local_test' ? 'Local Test' : platform}
          </ThemedText>
        </View>

        {/* Benefits List */}
        <View style={styles.benefitsContainer}>
          <ThemedText weight="semiBold" style={styles.benefitsTitle}>What's included:</ThemedText>
          {getTierBenefits(tier).map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <Ionicons name="checkmark" size={20} color={Colors.growthGreen} />
              <ThemedText style={styles.benefitText}>{benefit}</ThemedText>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <ThemedText weight="bold" style={styles.primaryButtonText}>Set Up Notifications</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSkipToApp}>
            <ThemedText weight="medium" style={styles.secondaryButtonText}>Skip for Now</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <ThemedText style={styles.footerText}>
          You can manage your subscription anytime in Settings
        </ThemedText>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 32,
  },
  subscriptionCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
  },
  subscriptionTitle: {
    fontSize: 16,
    color: Colors.textGray,
    marginBottom: 8,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  transactionId: {
    fontSize: 12,
    color: Colors.textGray,
    marginBottom: 4,
  },
  platformInfo: {
    fontSize: 12,
    color: Colors.textGray,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  secondaryButtonText: {
    color: Colors.textGray,
    fontSize: 16,
    fontWeight: '500',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default OnboardingPaymentConfirmationScreen;
