import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';

interface RouteParams {
  userType: 'trial' | 'paid' | 'freemium';
  selectedTier?: string;
}

const OnboardingPaymentConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userType, selectedTier } = route.params as RouteParams;

  useEffect(() => {
    // Here you would typically:
    // 1. Update user subscription status in database
    // 2. Grant access to features based on tier
    // 3. Set up trial countdown if applicable
    console.log(`✅ User subscription confirmed: ${userType}, tier: ${selectedTier}`);
  }, [userType, selectedTier]);

  const handleContinue = () => {
    navigation.navigate('OnboardingNotificationSetup' as any, { userType });
  };

  const getWelcomeMessage = () => {
    switch (userType) {
      case 'trial':
        return {
          title: 'Welcome to Your 3-Day Journey!',
          subtitle: 'Your free trial has started. Experience the full power of siFia.',
          icon: '🎉',
        };
      case 'paid':
        return {
          title: 'Welcome to the siFia Family!',
          subtitle: 'Thank you for joining us. Your spiritual growth journey begins now.',
          icon: '🙏',
        };
      case 'freemium':
        return {
          title: 'Welcome to siFia!',
          subtitle: 'Start your spiritual journey with our free features.',
          icon: '✨',
        };
      default:
        return {
          title: 'Welcome to siFia!',
          subtitle: 'Your spiritual growth journey begins now.',
          icon: '🌟',
        };
    }
  };

  const getFeaturesList = () => {
    if (userType === 'freemium') {
      return [
        'Access to basic spiritual content',
        'Daily affirmations and verses',
        'Basic journaling features',
        'Community support',
      ];
    }

    return [
      'Unlimited personalized playbooks',
      'AI-powered devotionals',
      'Advanced smart journaling',
      'Progress tracking & insights',
      'Priority customer support',
      'Exclusive spiritual content',
    ];
  };

  const welcomeData = getWelcomeMessage();
  const features = getFeaturesList();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>siFia</Text>
          <Text style={styles.logoHeart}>❤</Text>
        </View>

        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.successIcon}>{welcomeData.icon}</Text>
        </View>

        {/* Welcome Message */}
        <Text style={styles.welcomeTitle}>{welcomeData.title}</Text>
        <Text style={styles.welcomeSubtitle}>{welcomeData.subtitle}</Text>

        {/* Access Granted Section */}
        <View style={styles.accessSection}>
          <View style={styles.accessHeader}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.growthGreen} />
            <Text style={styles.accessTitle}>Access Granted</Text>
          </View>
          <Text style={styles.accessDescription}>
            You now have full access to the features in your {userType === 'freemium' ? 'free' : selectedTier || 'selected'} plan.
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>What's included:</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark" size={20} color={Colors.growthGreen} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Trial Specific Info */}
        {userType === 'trial' && (
          <View style={styles.trialInfo}>
            <View style={styles.trialHeader}>
              <Ionicons name="time" size={20} color={Colors.alertCoral} />
              <Text style={styles.trialTitle}>Trial Reminder</Text>
            </View>
            <Text style={styles.trialText}>
              Your 3-day free trial will automatically convert to a paid subscription unless cancelled. 
              We'll send you a reminder before it ends.
            </Text>
          </View>
        )}

        {/* Subscription Management */}
        <View style={styles.managementSection}>
          <Text style={styles.managementTitle}>Subscription Management</Text>
          <Text style={styles.managementText}>
            You can manage or cancel your subscription anytime through your device's subscription settings 
            or in the app's account section.
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue Setup</Text>
        </TouchableOpacity>

        {/* Support Note */}
        <Text style={styles.supportNote}>
          Need help? We're here to support you on your spiritual journey.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  logoHeart: {
    fontSize: 16,
    color: Colors.alertCoral,
    marginLeft: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 64,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.9,
    lineHeight: 24,
  },
  accessSection: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  accessDescription: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    opacity: 0.9,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  trialInfo: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  trialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  trialText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    opacity: 0.9,
  },
  managementSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  managementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  managementText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    opacity: 0.8,
  },
  continueButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  supportNote: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 40,
  },
});

export default OnboardingPaymentConfirmationScreen;
