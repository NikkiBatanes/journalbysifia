/**
 * OnboardingFeatureShowcaseScreen.tsx
 * Transform Your Life Through Faith-Driven Action
 * Feature showcase with clean design
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const features: Feature[] = [
  {
    id: 'guidance',
    title: 'Personalized Guidance',
    description: 'AI-powered biblical wisdom tailored to your specific life challenges',
    icon: 'book-outline',
    color: '#FF6B6B',
  },
  {
    id: 'growth',
    title: 'Actionable Growth Plans',
    description: 'Step-by-step playbooks that turn spiritual insights into daily actions',
    icon: 'trending-up-outline',
    color: '#4ECDC4',
  },
  {
    id: 'journaling',
    title: 'Smart Journaling',
    description: 'Track your spiritual growth with guided reflection and progress insights',
    icon: 'create-outline',
    color: '#45B7D1',
  },
];

const OnboardingFeatureShowcaseScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [currentFeature, setCurrentFeature] = useState(0);
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

  const animateFeatureChange = (direction: 'next' | 'prev') => {
    const slideValue = direction === 'next' ? -30 : 30;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: slideValue,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleNext = () => {
    if (currentFeature < features.length - 1) {
      animateFeatureChange('next');
      setCurrentFeature(currentFeature + 1);
    } else {
      handleContinue();
    }
  };

  const handlePrevious = () => {
    if (currentFeature > 0) {
      animateFeatureChange('prev');
      setCurrentFeature(currentFeature - 1);
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      console.log('🎯 Feature showcase completed, proceeding to account creation');

      // Navigate to account creation
      navigation.navigate('OnboardingPersonalization' as any);
    } catch (error) {
      console.error('Error proceeding to account creation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentFeatureData = features[currentFeature];

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
          <Text style={styles.transformTitle}>Transform Your Life</Text>
          <Text style={styles.transformTitle}>Through Faith-Driven Action</Text>
          
          <Text style={styles.transformSubtitle}>
            Get personalized biblical guidance{"\n"}for real-world challenges
          </Text>

          {/* Features List */}
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name={feature.icon} size={24} color={feature.color} style={styles.featureIcon} />
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureItemTitle}>{feature.title}</Text>
                  <Text style={styles.featureItemDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.startButton, isLoading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={styles.startButtonText}>
              {isLoading ? 'Starting...' : 'Start Your Journey'}
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
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  featureIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  featureIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.3,
  },
  featureIndicatorActive: {
    opacity: 1,
    backgroundColor: Colors.white,
    width: 24,
  },
  featureContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  featureIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  featureDescription: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  demoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  demoText: {
    fontSize: 14,
    color: Colors.lightBlue,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  benefitsList: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginLeft: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: Colors.anchorBlue,
    lineHeight: 20,
    opacity: 0.8,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  primaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressStep5: {
    width: '83%',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  mainContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  transformTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  transformSubtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresList: {
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureIcon: {
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  featureItemDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  startButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  trialText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
});

export default OnboardingFeatureShowcaseScreen;
