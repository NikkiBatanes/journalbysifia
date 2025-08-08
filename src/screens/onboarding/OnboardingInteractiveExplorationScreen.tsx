import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUserState } from '../../hooks/useUserState';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

interface ExplorationFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  demoAction: string;
  interactive: boolean;
}

const explorationFeatures: ExplorationFeature[] = [
  {
    id: 'ai_insights',
    title: 'AI-Powered Insights',
    description: 'Experience personalized spiritual guidance tailored to your journey',
    icon: 'bulb-outline',
    demoAction: 'Try AI Guidance',
    interactive: true,
  },
  {
    id: 'daily_devotionals',
    title: 'Daily Devotionals',
    description: 'Start each day with meaningful scripture and reflection',
    icon: 'book-outline',
    demoAction: 'Read Sample',
    interactive: true,
  },
  {
    id: 'prayer_tracker',
    title: 'Prayer Tracking',
    description: 'Keep track of your prayers and see how God answers',
    icon: 'heart-outline',
    demoAction: 'Add Prayer',
    interactive: true,
  },
  {
    id: 'community',
    title: 'Faith Community',
    description: 'Connect with others on similar spiritual journeys',
    icon: 'people-outline',
    demoAction: 'Explore Community',
    interactive: true,
  },
];

const OnboardingInteractiveExplorationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { updateOnboardingStep } = useUserState();
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [completedDemos, setCompletedDemos] = useState<Set<string>>(new Set());
  const [showContinue, setShowContinue] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Show continue button after trying at least 2 features
    if (completedDemos.size >= 2 && !showContinue) {
      setShowContinue(true);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [completedDemos.size]);

  const handleFeatureDemo = (featureId: string) => {
    setActiveFeature(featureId);
    
    // Simulate interactive demo
    setTimeout(() => {
      setCompletedDemos(prev => new Set([...prev, featureId]));
      setActiveFeature(null);
    }, 2000);
  };

  const handleContinue = async () => {
    await updateOnboardingStep(6);
    navigation.navigate('OnboardingHandsOnDemo' as never);
  };

  const renderFeatureCard = (feature: ExplorationFeature, index: number) => {
    const isActive = activeFeature === feature.id;
    const isCompleted = completedDemos.has(feature.id);
    
    return (
      <Animated.View
        key={feature.id}
        style={[
          styles.featureCard,
          isActive && styles.activeFeatureCard,
          isCompleted && styles.completedFeatureCard,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.featureHeader}>
          <View style={[styles.iconContainer, isCompleted && styles.completedIconContainer]}>
            <Ionicons
              name={isCompleted ? 'checkmark' : feature.icon}
              size={24}
              color={isCompleted ? Colors.hopeWhite : Colors.anchorBlue}
            />
          </View>
          <View style={styles.featureInfo}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.demoButton,
            isActive && styles.activeDemoButton,
            isCompleted && styles.completedDemoButton,
          ]}
          onPress={() => !isActive && !isCompleted && handleFeatureDemo(feature.id)}
          disabled={isActive || isCompleted}
        >
          <Text style={[
            styles.demoButtonText,
            isActive && styles.activeDemoButtonText,
            isCompleted && styles.completedDemoButtonText,
          ]}>
            {isActive ? 'Exploring...' : isCompleted ? 'Completed' : feature.demoAction}
          </Text>
          {isActive && (
            <Animated.View style={styles.loadingIndicator}>
              <Ionicons name="refresh" size={16} color={Colors.hopeWhite} />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
      
      <OnboardingProgressIndicator currentStep={5} totalSteps={7} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Explore Your Faith Journey</Text>
            <Text style={styles.subtitle}>
              Try these interactive features to see how siFia can transform your spiritual life
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            {explorationFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </View>

          <View style={styles.progressSection}>
            <Text style={styles.progressText}>
              {completedDemos.size} of {explorationFeatures.length} features explored
            </Text>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${(completedDemos.size / explorationFeatures.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {showContinue && (
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: progressAnim,
              transform: [
                {
                  translateY: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue Your Journey</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    shadowColor: Colors.anchorBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activeFeatureCard: {
    borderColor: Colors.anchorBlue,
    shadowOpacity: 0.2,
  },
  completedFeatureCard: {
    borderColor: Colors.successGreen,
    backgroundColor: '#f8fffe',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completedIconContainer: {
    backgroundColor: Colors.successGreen,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  demoButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDemoButton: {
    backgroundColor: Colors.primaryDark,
  },
  completedDemoButton: {
    backgroundColor: Colors.successGreen,
  },
  demoButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  activeDemoButtonText: {
    marginRight: 8,
  },
  completedDemoButtonText: {
    color: Colors.hopeWhite,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  progressSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 2,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.anchorBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default OnboardingInteractiveExplorationScreen;
