import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../theme';

interface RouteParams {
  selectedTier: string;
  isAnnual: boolean;
  price: number;
  isTrial?: boolean;
  trialDays?: number;
}

const OnboardingPaymentProcessingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedTier, isAnnual, price, isTrial, trialDays } = route.params as RouteParams;

  const [processingStep, setProcessingStep] = useState(0);

  const processingSteps = [
    'Securing your payment...',
    'Setting up your account...',
    'Preparing your spiritual journey...',
    'Almost ready...',
  ];

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Simulate payment processing steps
        for (let i = 0; i < processingSteps.length; i++) {
          setProcessingStep(i);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const handlePayment = async () => {
          // Apple will handle the actual payment processing
          // This is just UI simulation for the flow
          setProcessingStep(1);

          setTimeout(() => {
            setProcessingStep(2);
            setTimeout(() => {
              setProcessingStep(3);
              setTimeout(() => {
                // Navigate to confirmation
                // In real implementation, this would be triggered by Apple's payment success callback
                navigation.navigate('OnboardingPaymentConfirmation' as any, {
                  userType: 'paid',
                  selectedTier: route.params?.selectedTier || 'growth',
                  isAnnual: route.params?.isAnnual || false,
                });
              }, 1000);
            }, 1000);
          }, 1500);
        };
        handlePayment();

      } catch (error) {
        console.error('Payment processing error:', error);
        Alert.alert(
          'Payment Error',
          'There was an issue processing your payment. Please try again.',
          [
            {
              text: 'Try Again',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    };

    processPayment();
  }, [navigation, processingSteps.length, route.params?.isAnnual, route.params?.selectedTier]);

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'seeker':
      case 'basic': return 'siFia SEEKER';
      case 'spark':
      case 'starter': return 'siFia SPARK';
      case 'growth': return 'siFia GROWTH';
      case 'transformation': return 'siFia TRANSFORMATION';
      case 'family': return 'siFia FAMILY';
      default: return tier;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>siFia</Text>
          <Text style={styles.logoHeart}>❤</Text>
        </View>

        {/* Processing Animation */}
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.alertCoral} />
          <Text style={styles.processingTitle}>
            {isTrial ? 'Starting Your Free Trial' : 'Processing Payment'}
          </Text>
          <Text style={styles.processingStep}>
            {processingSteps[processingStep]}
          </Text>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan:</Text>
            <Text style={styles.summaryValue}>{getTierDisplayName(selectedTier)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Billing:</Text>
            <Text style={styles.summaryValue}>{isAnnual ? 'Annual' : 'Monthly'}</Text>
          </View>

          {isTrial && trialDays && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Trial Period:</Text>
              <Text style={styles.summaryValue}>{trialDays} days free</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>
              {isTrial ? 'Today\'s Charge:' : 'Total:'}
            </Text>
            <Text style={styles.totalValue}>
              {isTrial ? '$0.00' : `$${price.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Security Note */}
        <Text style={styles.securityNote}>
          🔒 Your payment is secured with industry-standard encryption
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  logoHeart: {
    fontSize: 20,
    color: Colors.alertCoral,
    marginLeft: 4,
  },
  processingContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  processingStep: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
  },
  orderSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  summaryValue: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    color: Colors.hopeWhite,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    color: Colors.alertCoral,
    fontWeight: 'bold',
  },
  securityNote: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default OnboardingPaymentProcessingScreen;
