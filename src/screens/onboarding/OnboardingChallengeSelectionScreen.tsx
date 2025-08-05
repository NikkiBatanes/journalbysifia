/**
 * OnboardingChallengeSelectionScreen.tsx
 * Phase 3.2: Challenge Selection for Real Playbook Generation
 * 8 core categories, real user input collection
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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  examples: string[];
}

const challenges: Challenge[] = [
  {
    id: 'relationships',
    title: 'Relationships & Family',
    description: 'Marriage, parenting, friendships, conflict resolution',
    icon: 'people',
    examples: ['Marriage struggles', 'Parenting challenges', 'Friendship conflicts', 'Family tensions'],
  },
  {
    id: 'anxiety_stress',
    title: 'Anxiety & Stress',
    description: 'Worry, fear, overwhelm, mental health',
    icon: 'heart-outline',
    examples: ['Work stress', 'Financial worry', 'Health anxiety', 'General overwhelm'],
  },
  {
    id: 'purpose_direction',
    title: 'Purpose & Direction',
    description: 'Career decisions, life calling, major transitions',
    icon: 'compass',
    examples: ['Career change', 'Life purpose', 'Major decisions', 'Feeling lost'],
  },
  {
    id: 'forgiveness_healing',
    title: 'Forgiveness & Healing',
    description: 'Past hurts, trauma, letting go, emotional healing',
    icon: 'heart-circle',
    examples: ['Past trauma', 'Unforgiveness', 'Emotional wounds', 'Letting go'],
  },
  {
    id: 'financial_stewardship',
    title: 'Financial Stewardship',
    description: 'Money management, debt, generosity, contentment',
    icon: 'card',
    examples: ['Debt struggles', 'Budgeting', 'Generosity', 'Financial anxiety'],
  },
  {
    id: 'spiritual_growth',
    title: 'Spiritual Growth',
    description: 'Prayer life, Bible study, spiritual disciplines',
    icon: 'book',
    examples: ['Prayer struggles', 'Bible reading', 'Spiritual dryness', 'Growing closer to God'],
  },
  {
    id: 'addiction_habits',
    title: 'Addiction & Habits',
    description: 'Breaking bad habits, overcoming addictions',
    icon: 'refresh',
    examples: ['Social media addiction', 'Bad habits', 'Substance issues', 'Behavioral patterns'],
  },
  {
    id: 'grief_loss',
    title: 'Grief & Loss',
    description: 'Death, loss, major life changes, mourning',
    icon: 'flower',
    examples: ['Death of loved one', 'Job loss', 'Relationship end', 'Major life changes'],
  },
];

const OnboardingChallengeSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [specificChallenge, setSpecificChallenge] = useState('');
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

  const handleChallengeSelect = (challengeId: string) => {
    setSelectedChallenge(challengeId);
    setSpecificChallenge(''); // Reset specific challenge when category changes
  };

  const handleContinue = async () => {
    if (!selectedChallenge || !specificChallenge.trim()) {return;}

    setIsLoading(true);

    try {
      const selectedChallengeData = challenges.find(c => c.id === selectedChallenge);
      console.log('🎯 Challenge selected for playbook generation:', {
        category: selectedChallengeData?.title,
        specific: specificChallenge,
      });

      // Navigate to real playbook generation with challenge data
      navigation.navigate('OnboardingPlaybookGeneration' as any, {
        challengeCategory: selectedChallengeData?.title,
        specificChallenge: specificChallenge.trim(),
        userInput: `I'm struggling with ${specificChallenge.trim()} in the area of ${selectedChallengeData?.title}`,
      });
    } catch (error) {
      console.error('Error proceeding to playbook generation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedChallengeData = challenges.find(c => c.id === selectedChallenge);

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
            <Text style={styles.title}>What's your biggest challenge right now?</Text>
            <Text style={styles.subtitle}>
              Choose the area where you need the most guidance, and we'll create a personalized playbook just for you
            </Text>
          </View>

          {/* Challenge categories */}
          <View style={styles.challengesContainer}>
            {challenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={[
                  styles.challengeCard,
                  selectedChallenge === challenge.id && styles.challengeCardSelected,
                ]}
                onPress={() => handleChallengeSelect(challenge.id)}
              >
                <View style={styles.challengeIconContainer}>
                  <Ionicons
                    name={challenge.icon as any}
                    size={24}
                    color={selectedChallenge === challenge.id ? Colors.anchorBlue : Colors.white}
                  />
                </View>

                <View style={styles.challengeTextContainer}>
                  <Text style={[
                    styles.challengeTitle,
                    selectedChallenge === challenge.id && styles.challengeTitleSelected,
                  ]}>
                    {challenge.title}
                  </Text>
                  <Text style={[
                    styles.challengeDescription,
                    selectedChallenge === challenge.id && styles.challengeDescriptionSelected,
                  ]}>
                    {challenge.description}
                  </Text>
                </View>

                {selectedChallenge === challenge.id && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={20} color={Colors.anchorBlue} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Specific challenge input */}
          {selectedChallenge && (
            <Animated.View style={styles.specificChallengeSection}>
              <Text style={styles.specificChallengeLabel}>
                Tell us more about your specific situation:
              </Text>

              {selectedChallengeData && (
                <View style={styles.examplesContainer}>
                  <Text style={styles.examplesLabel}>Examples:</Text>
                  <View style={styles.examplesList}>
                    {selectedChallengeData.examples.map((example, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.exampleChip}
                        onPress={() => setSpecificChallenge(example)}
                      >
                        <Text style={styles.exampleText}>{example}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TextInput
                style={styles.specificChallengeInput}
                placeholder="Describe your specific challenge..."
                placeholderTextColor={Colors.hopeWhite}
                value={specificChallenge}
                onChangeText={setSpecificChallenge}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Animated.View>
          )}

          {/* Continue button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!selectedChallenge || !specificChallenge.trim()) && styles.buttonDisabled,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!selectedChallenge || !specificChallenge.trim() || isLoading}
            >
              <Text style={[
                styles.continueButtonText,
                (!selectedChallenge || !specificChallenge.trim()) && styles.buttonTextDisabled,
              ]}>
                {isLoading ? 'Creating Playbook...' : 'Create My Playbook'}
              </Text>
              {selectedChallenge && specificChallenge.trim() && !isLoading && (
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
            <Text style={styles.progressText}>Step 4 of 6</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, styles.progressStep4]} />
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
  challengesContainer: {
    marginBottom: 24,
  },
  challengeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  challengeCardSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.lightBlue,
  },
  challengeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeTextContainer: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  challengeTitleSelected: {
    color: Colors.anchorBlue,
  },
  challengeDescription: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 18,
  },
  challengeDescriptionSelected: {
    color: Colors.anchorBlue,
    opacity: 0.8,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specificChallengeSection: {
    marginBottom: 24,
  },
  specificChallengeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 16,
  },
  examplesContainer: {
    marginBottom: 16,
  },
  examplesLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  examplesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exampleChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 12,
    color: Colors.white,
  },
  specificChallengeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 80,
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
  progressStep4: {
    width: '66.67%',
  },
});

export default OnboardingChallengeSelectionScreen;
