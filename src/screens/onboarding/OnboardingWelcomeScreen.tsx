/**
 * OnboardingWelcomeScreen.tsx
 * Phase 1.3: Welcome & Interest Capture
 * Individual growth focus, no community claims
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const OnboardingWelcomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
  }, [fadeAnim, slideAnim]);

  const handleStartJourney = async () => {
    setIsLoading(true);

    // Navigate to account creation
    setTimeout(() => {
      navigation.navigate('OnboardingAccountCreation' as any);
      setIsLoading(false);
    }, 500);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Hero section */}
          <View style={styles.heroSection}>
            <Text style={styles.mainTitle}>Transform Your Life Through Faith-Driven Action</Text>

            <Text style={styles.subtitle}>
              Get personalized biblical guidance for real-world challenges
            </Text>
          </View>

          {/* Value propositions */}
          <View style={styles.valuePropositions}>
            <View style={styles.valueItem}>
              <View style={styles.valueIconContainer}>
                <Ionicons name="book" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.valueTextContainer}>
                <Text style={styles.valueTitle}>Personalized Guidance</Text>
                <Text style={styles.valueDescription}>
                  AI-powered biblical wisdom tailored to your specific life challenges
                </Text>
              </View>
            </View>

            <View style={styles.valueItem}>
              <View style={styles.valueIconContainer}>
                <Ionicons name="trending-up" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.valueTextContainer}>
                <Text style={styles.valueTitle}>Actionable Growth Plans</Text>
                <Text style={styles.valueDescription}>
                  Step-by-step playbooks that turn spiritual insights into daily actions
                </Text>
              </View>
            </View>

            <View style={styles.valueItem}>
              <View style={styles.valueIconContainer}>
                <Ionicons name="journal" size={24} color={Colors.anchorBlue} />
              </View>
              <View style={styles.valueTextContainer}>
                <Text style={styles.valueTitle}>Smart Journaling</Text>
                <Text style={styles.valueDescription}>
                  Track your spiritual growth with guided reflection and progress insights
                </Text>
              </View>
            </View>
          </View>

          {/* Call to action */}
          <View style={styles.ctaSection}>
            <TouchableOpacity
              style={[styles.startButton, isLoading && styles.buttonDisabled]}
              onPress={handleStartJourney}
              disabled={isLoading}
            >
              <Text style={styles.startButtonText}>
                {isLoading ? 'Starting...' : 'Start Your Journey'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={Colors.anchorBlue}
                style={styles.buttonIcon}
              />
            </TouchableOpacity>

            <Text style={styles.freeTrialText}>
              3-day free trial • No commitment required
            </Text>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 48,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 26,
  },
  valuePropositions: {
    marginBottom: 48,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  valueIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  valueTextContainer: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  valueDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  ctaSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  startButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 200,
  },
  startButtonText: {
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
  freeTrialText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.3,
  },
  progressDotActive: {
    opacity: 1,
    backgroundColor: Colors.white,
  },
});

export default OnboardingWelcomeScreen;
