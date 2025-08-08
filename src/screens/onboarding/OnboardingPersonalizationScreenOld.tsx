// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * OnboardingPersonalizationScreen.tsx
 * Multi-step personalization screen matching exact design
 */

import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

// const { width } = Dimensions.get('window');

interface FaithJourney {
  id: string;
  title: string;
  description: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  examples?: string[];
}

const ageGroups: AgeGroup[] = [
  { value: 'teen', label: '13-17 (Teen)' },
  { value: 'young-adult', label: '18-25 (Young Adult)' },
  { value: 'adult', label: '26-35 (Adult)' },
  { value: 'mid-adult', label: '36-45 (Mid Adult)' },
  { value: 'mature-adult', label: '46-55 (Mature Adult)' },
  { value: 'senior', label: '56-65 (Senior)' },
  { value: 'elder', label: '65+ (Elder)' },
];

const faithJourneys: FaithJourney[] = [
  {
    id: 'exploring',
    title: 'Exploring Faith',
    description: 'Curious about faith and seeking answers',
    icon: 'search-outline',
  },
  {
    id: 'new-believer',
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
    icon: 'star-outline',
  },
];

const challenges: Challenge[] = [
  {
    id: 'grief',
    title: 'Grief & Loss',
    description: 'Death, loss, major life changes, mourning',
    icon: 'heart-outline',
    examples: ['Death of loved one', 'Job loss', 'Relationship end', 'Major life changes'],
  },
  {
    id: 'relationships',
    title: 'Relationships & Family',
    description: 'Marriage, parenting, friendships, conflict resolution',
    icon: 'people-outline',
    examples: ['Marriage issues', 'Parenting struggles', 'Family conflicts', 'Friendship problems'],
  },
  {
    id: 'anxiety',
    title: 'Anxiety & Stress',
    description: 'Worry, fear, overwhelm, mental health',
    icon: 'heart-circle-outline',
    examples: ['Work stress', 'Health anxiety', 'Financial worry', 'Social anxiety'],
  },
  {
    id: 'purpose',
    title: 'Purpose & Direction',
    description: 'Career decisions, life calling, major transitions',
    icon: 'compass-outline',
    examples: ['Career change', 'Life purpose', 'Major decisions', 'Spiritual calling'],
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness & Healing',
    description: 'Past hurts, trauma, letting go, emotional healing',
    icon: 'heart-half-outline',
    examples: ['Past trauma', 'Betrayal', 'Self-forgiveness', 'Emotional wounds'],
  },
  {
    id: 'financial',
    title: 'Financial Stewardship',
    description: 'Money management, debt, generosity, contentment',
    icon: 'card-outline',
    examples: ['Debt management', 'Budgeting', 'Generosity', 'Financial planning'],
  },
];

interface PersonalizationData {
  name: string;
  ageGroup: string;
  faithJourney: string;
  challenge: string;
  challengeDetails: string;
}

const OnboardingPersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState(0); // 0: name, 1: age, 2: faith journey, 3: challenge
  const [isLoading, setIsLoading] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [data, setData] = useState<PersonalizationData>({
    name: '',
    ageGroup: '',
    faithJourney: '',
    challenge: '',
    challengeDetails: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const totalSteps = 4;

  useEffect(() => {
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

  const canContinue = () => {
    switch (currentStep) {
      case 0: return data.name.trim().length > 0;
      case 1: return data.ageGroup.length > 0;
      case 2: return data.faithJourney.length > 0;
      case 3: return data.challenge.length > 0;
      default: return false;
    }
  };

  const handleContinue = async () => {
    if (!canContinue()) {return;}

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Final step - navigate to playbook creation
    setIsLoading(true);
    try {
      console.log('🎯 Personalization completed:', data);
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigation.navigate('OnboardingChallengeSelection' as any, { personalizationData: data });
    } catch (error) {
      Alert.alert('Error', 'Unable to save your information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 0: return "What's your name?";
      case 1: return "What's your age group?";
      case 2: return 'Where are you in your faith journey?';
      case 3: return "What's your biggest challenge right now?";
      default: return 'Tell us about yourself';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 0: return 'Help us craft your personalized faith journey with siFia: Faith in Action';
      case 1: return 'This helps us provide age-appropriate guidance and content';
      case 2: return 'Understanding your spiritual background helps us tailor your experience';
      case 3: return "Choose the area where you need the most guidance, and we'll create a personalized playbook just for you";
      default: return 'Help us craft your personalized faith journey with siFia: Faith in Action';
    }
  };

  const renderAgeModal = () => (
    <Modal
      visible={showAgeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAgeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Age Group</Text>
            <TouchableOpacity onPress={() => setShowAgeModal(false)}>
              <Ionicons name="close" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {ageGroups.map((group) => (
              <TouchableOpacity
                key={group.value}
                style={[
                  styles.modalOption,
                  data.ageGroup === group.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setData({ ...data, ageGroup: group.value });
                  setShowAgeModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  data.ageGroup === group.value && styles.modalOptionTextSelected,
                ]}>
                  {group.label}
                </Text>
                {data.ageGroup === group.value && (
                  <Ionicons name="checkmark" size={20} color={Colors.alertCoral} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={data.name}
              onChangeText={(text) => setData({ ...data, name: text })}
              autoFocus
            />
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <TouchableOpacity
              style={[
                styles.selectionButton,
                data.ageGroup && styles.selectionButtonSelected,
              ]}
              onPress={() => setShowAgeModal(true)}
            >
              <Text style={[
                styles.selectionButtonText,
                data.ageGroup && styles.selectionButtonTextSelected,
              ]}>
                {data.ageGroup ? ageGroups.find(g => g.value === data.ageGroup)?.label : 'Select age group'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {faithJourneys.map((journey) => (
                <TouchableOpacity
                  key={journey.id}
                  style={[
                    styles.optionCard,
                    data.faithJourney === journey.id && styles.optionCardSelected,
                  ]}
                  onPress={() => setData({ ...data, faithJourney: journey.id })}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={journey.icon} size={24} color={Colors.alertCoral} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{journey.title}</Text>
                    <Text style={styles.optionDescription}>{journey.description}</Text>
                  </View>
                  {data.faithJourney === journey.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.alertCoral} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {challenges.map((challenge) => (
                <TouchableOpacity
                  key={challenge.id}
                  style={[
                    styles.optionCard,
                    data.challenge === challenge.id && styles.optionCardSelected,
                  ]}
                  onPress={() => setData({ ...data, challenge: challenge.id })}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={challenge.icon} size={24} color={Colors.alertCoral} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{challenge.title}</Text>
                    <Text style={styles.optionDescription}>{challenge.description}</Text>
                  </View>
                  {data.challenge === challenge.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.alertCoral} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {data.challenge && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsTitle}>Tell us more about your specific situation:</Text>
                <Text style={styles.examplesText}>Examples:</Text>
                <View style={styles.exampleTags}>
                  {challenges.find(c => c.id === data.challenge)?.examples?.map((example, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.exampleTag}
                      onPress={() => setData({ ...data, challengeDetails: example })}
                    >
                      <Text style={styles.exampleTagText}>{example}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.detailsInput}
                  placeholder="Describe your specific challenge..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={data.challengeDetails}
                  onChangeText={(text) => setData({ ...data, challengeDetails: text })}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentStep + 1) / totalSteps) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{currentStep + 1} of {totalSteps}</Text>
      </View>

      {/* Logo and Title Section */}
      <View style={styles.topSection}>
        <Image
          source={require('../../../assets/icons/siFiaTransparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.mainTitle}>{getStepTitle()}</Text>
        <Text style={styles.subtitle}>{getStepSubtitle()}</Text>
      </View>

      {/* Content */}
      <View style={styles.contentSection}>
        {renderStepContent()}
      </View>

      {/* Continue Button */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            canContinue() ? styles.continueButtonActive : styles.continueButtonInactive,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue() || isLoading}
        >
          <Text style={[
            styles.continueButtonText,
            canContinue() ? styles.continueButtonTextActive : styles.continueButtonTextInactive,
          ]}>
            {isLoading ? 'Loading...' : currentStep === totalSteps - 1 ? 'Create My Playbook' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>

      {renderAgeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.alertCoral,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontFamily: Fonts.regular,
  },
  topSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginTop: 20,
  },
  selectionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  selectionButtonSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: Colors.alertCoral,
  },
  selectionButtonText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  selectionButtonTextSelected: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  optionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: Colors.alertCoral,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  detailsSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  detailsTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  examplesText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  exampleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  exampleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  exampleTagText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
  },
  detailsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    minHeight: 80,
  },
  buttonSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  continueButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.medium,
  },
  continueButtonTextActive: {
    color: Colors.hopeWhite,
  },
  continueButtonTextInactive: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#274674',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
  },
  modalOptionTextSelected: {
    fontWeight: '600',
  },
});

export default OnboardingPersonalizationScreen;
