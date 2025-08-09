import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme';
import pricingService from '../../services/pricingService';
import DynamicPricingModal from '../../components/DynamicPricingModal';

const OnboardingTrialOfferScreen = () => {
  const navigation = useNavigation();
  const [isAnnual, setIsAnnual] = useState(false);
  const [wantsTrial, setWantsTrial] = useState(true);
  const [showDynamicModal, setShowDynamicModal] = useState(false);
  const [dynamicDiscount, setDynamicDiscount] = useState<any>(null);

  const handleClose = () => {
    // User becomes basic (freemium) user
    navigation.navigate('OnboardingNotificationSetup' as any, { userType: 'freemium' });
  };

  const handleStartTrial = () => {
    // Navigate to payment processing for trial
    navigation.navigate('OnboardingPaymentProcessing' as any, {
      selectedTier: 'growth',
      isAnnual: true,
      isTrial: true,
      trialDays: 3,
      price: 0 // Free trial
    });
  };

  const timelineItems = [
    {
      id: 1,
      title: 'Today - Free trial starts',
      description: 'Try Sifia free Growth for 3 days.\nNo pressure, no catch.\nExperience personalized guidance and see how it fits your story.',
      icon: 'checkmark-circle',
      iconColor: Colors.growthGreen,
      isCompleted: true,
    },
    {
      id: 2,
      title: 'Aug 11 - Email Reminder',
      description: 'We\'ll remind you before your trial ends, so you can decide with peace.',
      icon: 'mail',
      iconColor: Colors.alertCoral,
      isCompleted: false,
    },
    {
      id: 3,
      title: 'Aug 12 - Continue Your Journey',
      description: 'Your trial ends unless cancelled.',
      icon: 'heart',
      iconColor: Colors.alertCoral,
      isCompleted: false,
    }
  ];

  const renderTimelineItem = (item: any, index: number) => {
    const isLast = index === timelineItems.length - 1;
    
    return (
      <View key={item.id} style={styles.timelineItem}>
        <View style={styles.timelineIconContainer}>
          <View style={[styles.timelineIcon, { backgroundColor: item.iconColor }]}>
            <Ionicons name={item.icon} size={20} color={Colors.hopeWhite} />
          </View>
          {!isLast && <View style={styles.timelineLine} />}
        </View>
        
        <View style={styles.timelineContent}>
          <Text style={styles.timelineTitle}>{item.title}</Text>
          <Text style={styles.timelineDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>siFia</Text>
          <Text style={styles.logoHeart}>❤</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Main Content */}
        <Text style={styles.mainTitle}>Take the Next Step.</Text>
        <Text style={styles.subtitle}>No Pressure, Just Grace</Text>

        {/* Intro Text */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Not sure yet?</Text>
          <Text style={styles.introText}>
            That's okay. Starting something new can feel uncertain.
          </Text>
        </View>

        {/* How Trial Works */}
        <Text style={styles.sectionTitle}>So, how the trial works:</Text>

        {/* Toggle Button */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.activeToggleText]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isAnnual && styles.activeToggle]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual && styles.activeToggleText]}>
              Annual
            </Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          {timelineItems.map((item, index) => renderTimelineItem(item, index))}
        </View>

        {/* Pricing Summary */}
        <View style={styles.pricingSummary}>
          <Text style={styles.pricingTitle}>3 days free, then $129.99 per year</Text>
          <Text style={styles.pricingSubtitle}>Only $10.83/month</Text>
        </View>

        {/* Start Trial Button */}
        <TouchableOpacity style={styles.startTrialButton} onPress={handleStartTrial}>
          <Text style={styles.startTrialButtonText}>Start your free 3-day trial</Text>
        </TouchableOpacity>

        {/* Footer Text */}
        <Text style={styles.footerText}>
          Try 3 days free. No pressure. Cancel anytime
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
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
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '600',
  },
  introSection: {
    marginBottom: 32,
  },
  introTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 8,
    fontWeight: '600',
  },
  introText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    fontWeight: '600',
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 32,
    alignSelf: 'center',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: Colors.growthGreen,
  },
  toggleText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  activeToggleText: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  timelineContainer: {
    marginBottom: 32,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  timelineDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    opacity: 0.9,
  },
  pricingSummary: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  pricingSubtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  startTrialButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  startTrialButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 40,
  },
});

export default OnboardingTrialOfferScreen;
