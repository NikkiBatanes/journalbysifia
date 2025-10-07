import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import { useNewSubscription } from '../../hooks/useNewSubscription';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import ThemedText from '../../components/common/ThemedText';

const OnboardingPaymentProcessingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { upgradeSubscription, startTrial } = useNewSubscription(user?.id || '');

  const [isProcessing, setIsProcessing] = useState(true);
  const [processingStatus, setProcessingStatus] = useState('Initializing payment...');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);

  // Get parameters from navigation
  const selectedTier = route?.params?.selectedTier || 'spark';
  const isAnnual = route?.params?.isAnnual || true;
  const isTrial = route?.params?.isTrial || false;
  const trialDays = route?.params?.trialDays || 3;
  const price = route?.params?.price || 0;

  const processPayment = useCallback(async () => {
    try {
      setHasProcessed(true); // Mark as processed to prevent re-runs on hot reload
      setProcessingStatus('Processing payment...');

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (isTrial) {
        // Process free trial
        setProcessingStatus('Activating free trial...');
        await startTrial({
          user_id: user?.id || '',
          duration_days: trialDays,
          trial_chosen_tier: selectedTier as any, // Pass the selected tier from route params
        });

        setProcessingStatus('Trial activated successfully!');
        setPaymentSuccess(true);

        // Navigate to notification setup after trial activation
        setTimeout(() => {
          navigation.navigate('OnboardingNotificationSetup' as never);
        }, 1500);

      } else {
        // Process paid subscription
        setProcessingStatus('Activating subscription...');

        // For local testing, simulate successful payment
        await upgradeSubscription({
          platform: 'local_test', // Will be 'apple_pay' or 'google_play' in production
          target_tier: selectedTier as any,
          billing_cycle: isAnnual ? 'annual' : 'monthly',
          subscription_start_date: new Date().toISOString(),
        });

        setProcessingStatus('Subscription activated successfully!');
        setPaymentSuccess(true);

        // Navigate to notification setup after subscription activation
        setTimeout(() => {
          navigation.navigate('OnboardingNotificationSetup' as never);
        }, 1500);
      }

      setIsProcessing(false);

    } catch (error) {
      console.error('Payment processing error:', error);
      setPaymentError('Payment failed. Please try again.');
      setProcessingStatus('Payment failed');
      setIsProcessing(false);
    }
  }, [isTrial, startTrial, user?.id, trialDays, selectedTier, upgradeSubscription, isAnnual, navigation]);

  // Safety check and process payment on mount
  useEffect(() => {
    // Skip if already processed (prevents re-run on hot reload)
    if (hasProcessed) {
      console.log('[OnboardingPaymentProcessing] Already processed, skipping');
      return;
    }

    if (!user?.id) {
      console.warn('[OnboardingPaymentProcessing] No user found, waiting for auth...');
      // Don't redirect immediately - wait for auth to load
      return;
    }
    
    // Only process payment if we have a valid user and haven't processed yet
    console.log('[OnboardingPaymentProcessing] Screen mounted with user:', user.id);
    console.log('[OnboardingPaymentProcessing] Route params:', route.params);
    processPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hasProcessed]); // Run when user loads or hasProcessed changes

  const handleRetry = () => {
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(false);
    processPayment();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'seeker': return 'siFia SEEKER';
      case 'spark': return 'siFia SPARK';
      case 'growth': return 'siFia GROWTH';
      case 'transformation': return 'siFia TRANSFORMATION';
      case 'family': return 'siFia FAMILY';
      default: return tier.toUpperCase();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText weight="bold" style={styles.title}>
            {isTrial ? 'Starting Free Trial' : 'Processing Payment'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isTrial
              ? `Activating your ${trialDays}-day free trial`
              : `Subscribing to ${getTierDisplayName(selectedTier)}`
            }
          </ThemedText>
        </View>

        {/* Processing Animation */}
        <View style={styles.processingContainer}>
          {isProcessing && (
            <ActivityIndicator
              size="large"
              color={Colors.anchorBlue}
              style={styles.spinner}
            />
          )}

          {paymentSuccess && (
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color={Colors.growthGreen} />
            </View>
          )}

          {paymentError && (
            <View style={styles.errorIcon}>
              <Ionicons name="close-circle" size={80} color={Colors.error} />
            </View>
          )}
        </View>

        {/* Status Text */}
        <View style={styles.statusContainer}>
          <ThemedText weight="semiBold" style={[
            styles.statusText,
            paymentSuccess && styles.successText,
            paymentError && styles.errorText,
          ]}>
            {processingStatus}
          </ThemedText>

          {!isTrial && price > 0 && (
            <ThemedText style={styles.priceText}>
              ${price.toFixed(2)} {isAnnual ? 'annually' : 'monthly'}
            </ThemedText>
          )}
        </View>

        {/* Action Buttons */}
        {paymentError && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <ThemedText weight="bold" style={styles.retryButtonText}>Try Again</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <ThemedText weight="medium" style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Message */}
        {isProcessing && (
          <ThemedText style={styles.loadingMessage}>
            Please don't close this screen while we process your {isTrial ? 'trial activation' : 'payment'}...
          </ThemedText>
        )}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  processingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  spinner: {
    transform: [{ scale: 1.5 }],
  },
  successIcon: {
    alignItems: 'center',
  },
  errorIcon: {
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    color: Colors.growthGreen,
  },
  errorText: {
    color: Colors.error,
  },
  priceText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  retryButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingMessage: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

export default OnboardingPaymentProcessingScreen;
