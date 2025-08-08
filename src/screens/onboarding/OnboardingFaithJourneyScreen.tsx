/**
 * OnboardingFaithJourneyScreen.tsx
 * Phase 2.2: Faith Journey Assessment for Personalization
 * Individual focus, data collection for AI playbook generation
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
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';

interface FaithStage {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const faithStages: FaithStage[] = [
  {
    id: 'exploring',
    title: 'Exploring Faith',
    description: 'Curious about spirituality and seeking answers',
    icon: 'compass-outline',
  },
  {
    id: 'new_believer',
    title: 'New Believer',
    description: 'Recently committed to faith, eager to learn',
    icon: 'leaf-outline',
  },
  {
    id: 'growing',
    title: 'Growing in Faith',
    description: 'Established believer seeking deeper understanding',
    icon: 'trending-up-outline',
  },
  {
    id: 'mature',
    title: 'Mature Believer',
    description: 'Strong foundation, focused on service and discipleship',
    icon: 'library-outline',
  },
  {
    id: 'struggling',
    title: 'Going Through Struggles',
    description: 'Facing challenges, need encouragement and guidance',
    icon: 'heart-outline',
  },
  {
    id: 'returning',
    title: 'Returning to Faith',
    description: 'Coming back after a period of distance',
    icon: 'return-up-back-outline',
  },
];

const OnboardingFaithJourneyScreen: React.FC = () => {
  const navigation = useNavigation();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
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

  const handleStageSelect = (stageId: string) => {
    setSelectedStage(stageId);
  };

  const handleContinue = async () => {
    if (!selectedStage) {return;}

    setIsLoading(true);

    try {
      console.log('📊 Faith journey stage selected:', selectedStage);

      // Save faith journey data for personalization
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate to value demonstration
      navigation.navigate('OnboardingChallengeSelection' as any);
    } catch (error) {
      console.error('Error saving faith journey:', error);
    } finally {
      setIsLoading(false);
    }
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Where are you in your faith journey?</Text>
            <Text style={styles.subtitle}>
              Help us personalize your experience with guidance that meets you exactly where you are
            </Text>
          </View>

          {/* Faith stages */}
          <View style={styles.stagesContainer}>
            {faithStages.map((stage) => (
              <TouchableOpacity
                key={stage.id}
                style={[
                  styles.stageCard,
                  selectedStage === stage.id && styles.stageCardSelected,
                ]}
                onPress={() => handleStageSelect(stage.id)}
              >
                <View style={styles.stageIconContainer}>
                  <Ionicons
                    name={stage.icon as any}
                    size={24}
                    color={selectedStage === stage.id ? Colors.anchorBlue : Colors.white}
                  />
                </View>

                <View style={styles.stageTextContainer}>
                  <Text style={[
                    styles.stageTitle,
                    selectedStage === stage.id && styles.stageTitleSelected,
                  ]}>
                    {stage.title}
                  </Text>
                  <Text style={[
                    styles.stageDescription,
                    selectedStage === stage.id && styles.stageDescriptionSelected,
                  ]}>
                    {stage.description}
                  </Text>
                </View>

                {selectedStage === stage.id && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={20} color={Colors.anchorBlue} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Continue button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                !selectedStage && styles.buttonDisabled,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!selectedStage || isLoading}
            >
              <Text style={[
                styles.continueButtonText,
                !selectedStage && styles.buttonTextDisabled,
              ]}>
                {isLoading ? 'Personalizing...' : 'Continue'}
              </Text>
              {selectedStage && !isLoading && (
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={Colors.anchorBlue}
                  style={styles.buttonIcon}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Step 2 of 6</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, styles.progressStep2]} />
            </View>
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
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  stagesContainer: {
    marginBottom: 32,
  },
  stageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stageCardSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.lightBlue,
  },
  stageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stageTextContainer: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  stageTitleSelected: {
    color: Colors.anchorBlue,
  },
  stageDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  stageDescriptionSelected: {
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    marginBottom: 32,
  },
  continueButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: Colors.anchorBlue,
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
  progressStep2: {
    width: '33.33%',
  },
});

export default OnboardingFaithJourneyScreen;
