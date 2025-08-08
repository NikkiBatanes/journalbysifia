/**
 * OnboardingTransformYourLifeScreen.tsx
 * Transform Your Life Through Faith-Driven Action
 * Introduction screen with key features overview
 */

import React, { useState, useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { OnboardingStyles, OnboardingTypography, OnboardingSpacing } from '../../theme/onboardingStyles';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const features: Feature[] = [
  {
    id: 'playbooks',
    title: 'AI-powered playbooks for your unique challenges',
    description: 'Personalized guidance tailored to your specific life situations',
    icon: 'book',
    color: Colors.alertCoral,
  },
  {
    id: 'devotionals',
    title: 'Custom devotionals to strengthen your faith',
    description: 'Daily spiritual nourishment designed just for you',
    icon: 'heart',
    color: Colors.alertCoral,
  },
  {
    id: 'journaling',
    title: 'Smart journaling to deepen your reflection',
    description: 'Guided reflection tools to track your spiritual growth',
    icon: 'pencil',
    color: Colors.alertCoral,
  },
];

const OnboardingTransformYourLifeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      console.log('🎯 Feature showcase completed, proceeding to welcome screen');

      // Navigate to welcome screen
      navigation.navigate('OnboardingWelcome' as any);
    } catch (error) {
      console.error('Error proceeding to welcome screen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <Text style={[OnboardingStyles.mainTitle, styles.transformTitle]}>Faith in Action, Every Day</Text>

          <Text style={[OnboardingStyles.subtitle, styles.transformSubtitle]}>
            Transform your life with personalized, biblically grounded tools.
          </Text>

          {/* Features List */}
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon} size={24} color={Colors.hopeWhite} />
                </View>
                <Text style={styles.featureItemTitle}>{feature.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[OnboardingStyles.primaryButton, styles.startButton, isLoading && OnboardingStyles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={[OnboardingStyles.primaryButtonText, styles.startButtonText]}>
              {isLoading ? 'Starting...' : 'Start your journey'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.trialText}>
            3-day free trial • No commitment Required
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: OnboardingStyles.container,
  content: OnboardingStyles.content,
  logoSection: {
    ...OnboardingStyles.logoSection,
    marginBottom: OnboardingSpacing.huge,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformTitle: {
    ...OnboardingTypography.heroTitle,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: OnboardingSpacing.md,
  },
  transformSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: OnboardingSpacing.huge,
  },
  featuresList: {
    width: '100%',
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIconContainer: OnboardingStyles.featureIconContainer,
  featureItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
    lineHeight: 22,
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  startButton: {
    // Additional custom styling if needed
  },
  startButtonText: {
    // Additional custom styling if needed
  },
  trialText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 10,
  },

});

export default OnboardingTransformYourLifeScreen;
