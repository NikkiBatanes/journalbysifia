/**
 * OnboardingPersonalizationScreen.tsx
 * Multi-step personalization screen matching exact design
 */

import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { OnboardingStyles } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

// const { width } = Dimensions.get('window'); // unused

interface FaithJourney {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  examples?: string[];
}

interface AgeGroup {
  value: string;
  label: string;
}

const ageGroups: AgeGroup[] = [
  { value: 'teen', label: '13-17' },
  { value: 'young-adult', label: '18-25' },
  { value: 'adult', label: '26-35' },
  { value: 'mid-adult', label: '36-45' },
  { value: 'mature-adult', label: '46-55' },
  { value: 'senior', label: '56-65' },
  { value: 'elder', label: '65+' },
];

const faithJourneyOptions: FaithJourney[] = [
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

const challengeOptions: Challenge[] = [
  {
    id: 'relationships',
    title: 'Relationships & Family',
    description: 'Marriage, parenting, friendships, conflict resolution',
    icon: 'people-outline',
    examples: ['Marriage struggles', 'Parenting challenges', 'Friendship conflicts', 'Family tensions'],
  },
  {
    id: 'anxiety',
    title: 'Anxiety & Stress',
    description: 'Worry, fear, overwhelm, mental health',
    icon: 'heart-circle-outline',
    examples: ['Work stress', 'Financial worry', 'Health anxiety', 'General overwhelm'],
  },
  {
    id: 'purpose',
    title: 'Purpose & Direction',
    description: 'Career decisions, life calling, major transitions',
    icon: 'compass-outline',
    examples: ['Career change', 'Life purpose', 'Major decisions', 'Feeling lost'],
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness & Healing',
    description: 'Past hurts, trauma, letting go, emotional healing',
    icon: 'heart-circle-outline',
    examples: ['Past trauma', 'Unforgiveness', 'Emotional wounds', 'Letting go'],
  },
  {
    id: 'financial',
    title: 'Financial Stewardship',
    description: 'Money management, debt, generosity, contentment',
    icon: 'card-outline',
    examples: ['Debt struggles', 'Budgeting', 'Generosity', 'Financial anxiety'],
  },
  {
    id: 'spiritual',
    title: 'Spiritual Growth',
    description: 'Prayer life, Bible study, spiritual disciplines',
    icon: 'book-outline',
    examples: ['Prayer struggles', 'Bible reading', 'Spiritual dryness', 'Growing closer to God'],
  },
  {
    id: 'addiction',
    title: 'Addiction & Habits',
    description: 'Breaking bad habits, overcoming addictions',
    icon: 'refresh-outline',
    examples: ['Social media addiction', 'Bad habits', 'Substance issues', 'Behavioral patterns'],
  },
  {
    id: 'grief',
    title: 'Grief & Loss',
    description: 'Death, loss, major life changes, mourning',
    icon: 'flower-outline',
    examples: ['Death of loved one', 'Job loss', 'Relationship end', 'Major life changes'],
  },
];

import { useRoute } from '@react-navigation/native';

const OnboardingPersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  // Determine if we need to show name input step based on registration method
  const [registrationMethod, setRegistrationMethod] = useState<'email' | 'oauth'>('email');
  const [showNameStep, setShowNameStep] = useState(false);

  // Start at step 1 (name input for OAuth, age group for email)
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('');

  // Debug effect for step rendering
  React.useEffect(() => {
    console.log('[OnboardingPersonalization] Render State - currentStep:', currentStep, 'showNameStep:', showNameStep, 'registrationMethod:', registrationMethod);
  }, [currentStep, showNameStep, registrationMethod]);

  // Handle route params and determine registration method
  React.useEffect(() => {
    console.log('[OnboardingPersonalization] Route params:', route.params);
    if (route.params && typeof route.params === 'object') {
      // Get registration method
      const method = (route.params as any).registrationMethod || 'email';
      console.log('[OnboardingPersonalization] Registration method:', method);
      setRegistrationMethod(method);

      // For OAuth users, show name step; for email users, skip it
      const needsNameStep = method === 'oauth';
      console.log('[OnboardingPersonalization] Show name step:', needsNameStep);
      setShowNameStep(needsNameStep);

      // Set name if provided
      if ('name' in route.params && route.params.name) {
        const providedName = route.params.name as string;
        setName(providedName);

        // If name is provided and it's OAuth, we might still want to show the step
        // so users can edit it if needed
      }

      console.log('📝 Registration method:', method, 'Show name step:', needsNameStep);
    }
  }, [route.params]);

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');
  const [selectedFaithJourney, setSelectedFaithJourney] = useState<string>('');
  const [selectedChallenge, setSelectedChallenge] = useState<string>('');
  const [challengeDetails, setChallengeDetails] = useState('');
  const [scrollY, setScrollY] = useState(0);

  // Dynamic total steps based on whether we show name step
  const totalSteps = showNameStep ? 5 : 4; // Name + Age + Faith + Challenge + Details OR Age + Faith + Challenge + Details

  const handleBack = () => {
    // On age group step, don't go back
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        // Mark onboarding as completed
        if (user) {
          console.log('[OnboardingPersonalization] Marking onboarding as completed for user:', user.id);
          const { error } = await supabase
            .from('user_profiles')
            .update({ onboarding_completed: true })
            .eq('id', user.id);

          if (error) {
            console.error('[OnboardingPersonalization] Error updating onboarding status:', error);
          } else {
            console.log('[OnboardingPersonalization] Onboarding marked as completed');
          }
        }

        // Use main playbook generation UI with onboarding data
        const userInput = `I am a ${selectedAgeGroup} on a ${selectedFaithJourney} faith journey, struggling with ${selectedChallenge}. ${challengeDetails || ''}`.trim();

        // Present GeneratingPlaybook as modal within onboarding flow
        (navigation as any).navigate('GeneratingPlaybook', {
          userInput,
          userName: name || 'Friend',
          isFromOnboarding: true,
          onboardingData: {
            ageGroup: selectedAgeGroup,
            faithJourney: selectedFaithJourney,
            challenge: selectedChallenge,
            challengeDetails,
          },
        });
      } catch (error) {
        console.error('[OnboardingPersonalization] Error in handleContinue:', error);
        // Continue with navigation even if onboarding update fails
        const userInput = `I am a ${selectedAgeGroup} on a ${selectedFaithJourney} faith journey, struggling with ${selectedChallenge}. ${challengeDetails || ''}`.trim();
        (navigation as any).navigate('GeneratingPlaybook', {
          userInput,
          userName: name || 'Friend',
          isFromOnboarding: true,
          onboardingData: {
            ageGroup: selectedAgeGroup,
            faithJourney: selectedFaithJourney,
            challenge: selectedChallenge,
            challengeDetails,
          },
        });
      }
    }
  };

  const canContinue = () => {
    if (showNameStep) {
      // With name step: Name(1) -> Age(2) -> Faith(3) -> Challenge(4) -> Details(5)
      switch (currentStep) {
        case 1:
          return name.trim().length > 0;
        case 2:
          return selectedAgeGroup !== '';
        case 3:
          return selectedFaithJourney !== '';
        case 4:
          return selectedChallenge !== '';
        case 5:
          return challengeDetails.trim().length > 0;
        default:
          return false;
      }
    } else {
      // Without name step: Age(1) -> Faith(2) -> Challenge(3) -> Details(4)
      switch (currentStep) {
        case 1:
          return selectedAgeGroup !== '';
        case 2:
          return selectedFaithJourney !== '';
        case 3:
          return selectedChallenge !== '';
        case 4:
          return challengeDetails.trim().length > 0;
        default:
          return false;
      }
    }
  };

  const handleScroll = (event: any) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepSubtitle}>
        Help us personalize your faith journey experience
      </Text>
      <View style={styles.nameInputContainer}>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your first name"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </View>
  );

  const renderAgeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your age group?</Text>
      <View style={styles.ageOptionsContainer}>
        {ageGroups.map((ageGroup) => (
          <TouchableOpacity
            key={ageGroup.value}
            style={[
              styles.ageOption,
              selectedAgeGroup === ageGroup.value && styles.selectedAgeOption,
            ]}
            onPress={() => setSelectedAgeGroup(ageGroup.value)}
          >
            <Text style={styles.ageOptionTitle}>{ageGroup.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFaithJourneyStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where are you in your{'\n'}faith journey?</Text>
      <View style={styles.optionsContainer}>
        {faithJourneyOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.faithOption,
              selectedFaithJourney === option.id && styles.selectedFaithOption,
            ]}
            onPress={() => setSelectedFaithJourney(option.id)}
          >
            <View style={styles.faithOptionIcon}>
              <Ionicons name={option.icon} size={24} color={Colors.alertCoral} />
            </View>
            <View style={styles.faithOptionText}>
              <Text style={styles.faithOptionTitle}>{option.title}</Text>
              <Text style={styles.faithOptionDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderChallengeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your biggest{'\n'}challenge right now?</Text>
      <Text style={styles.stepSubtitle}>
        Choose the area where you need the most guidance,{'\n'}
        and we'll create a personalized playbook just for you
      </Text>

      <View style={styles.challengeOptionsContainer}>
        {challengeOptions.map((challenge) => (
          <TouchableOpacity
            key={challenge.id}
            style={[
              styles.challengeOption,
              selectedChallenge === challenge.id && styles.selectedChallengeOption,
            ]}
            onPress={() => setSelectedChallenge(challenge.id)}
          >
            <View style={styles.challengeOptionIcon}>
              <Ionicons name={challenge.icon} size={24} color={Colors.white} />
            </View>
            <View style={styles.challengeOptionText}>
              <Text style={styles.challengeOptionTitle}>{challenge.title}</Text>
              <Text style={styles.challengeOptionDescription}>{challenge.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderChallengeDetailsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tell us about your{'\n'}specific situation</Text>

      {selectedChallenge && (
        <View style={styles.challengeCard}>
          <View style={styles.challengeCardIcon}>
            <Ionicons
              name={challengeOptions.find(c => c.id === selectedChallenge)?.icon || 'help-outline'}
              size={24}
              color={Colors.alertCoral}
            />
          </View>
          <View style={styles.challengeCardText}>
            <Text style={styles.challengeCardTitle}>
              {challengeOptions.find(c => c.id === selectedChallenge)?.title}
            </Text>
            <Text style={styles.challengeCardDescription}>
              {challengeOptions.find(c => c.id === selectedChallenge)?.description}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.exampleTags}>
        {challengeOptions.find(c => c.id === selectedChallenge)?.examples?.map((example, index) => (
          <TouchableOpacity
            key={index}
            style={styles.exampleTag}
            onPress={() => setChallengeDetails(example)}
          >
            <Text style={styles.exampleTagText}>{example}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.detailsInput}
        placeholder="Share more about your situation..."
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        value={challengeDetails}
        onChangeText={setChallengeDetails}
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={OnboardingStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={[styles.header, { backgroundColor: scrollY > 50 ? 'transparent' : Colors.anchorBlue }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={OnboardingStyles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.titleContainer}>
        {name ? (
          <Text style={[OnboardingStyles.subtitle, { fontWeight: 'bold', fontSize: 18, marginBottom: 8 }]}>Hi, {name}.</Text>
        ) : null}
        <Text style={OnboardingStyles.mainTitle}>Tell us about yourself</Text>
        <Text style={OnboardingStyles.subtitle}>
          Help us craft your personalized faith{'\n'}journey with siFia: Faith in Action
        </Text>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalBackButton}
            onPress={handleBack}
            disabled={currentStep === 1} // Age group is now step 1
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentStep === 1 ? 'transparent' : Colors.white}
            />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {Array.from({ length: totalSteps }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  index < currentStep ? styles.progressSegmentActive : styles.progressSegmentInactive,
                ]}
              />
            ))}
          </View>

          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Conditional rendering based on whether name step is shown */}
          {showNameStep && currentStep === 1 && renderNameStep()}
          {currentStep === (showNameStep ? 2 : 1) && renderAgeStep()}
          {currentStep === (showNameStep ? 3 : 2) && renderFaithJourneyStep()}
          {currentStep === (showNameStep ? 4 : 3) && renderChallengeStep()}
          {currentStep === (showNameStep ? 5 : 4) && renderChallengeDetailsStep()}

          {/* Fallback with better debugging */}
          {!((showNameStep && currentStep === 1) ||
             currentStep === (showNameStep ? 2 : 1) ||
             currentStep === (showNameStep ? 3 : 2) ||
             currentStep === (showNameStep ? 4 : 3) ||
             currentStep === (showNameStep ? 5 : 4)) && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Debug: Step Not Found</Text>
              <Text style={styles.stepSubtitle}>
                Current Step: {currentStep}, Show Name: {showNameStep ? 'Yes' : 'No'}, Method: {registrationMethod}
              </Text>
              <Text style={styles.stepSubtitle}>Expected step range: {showNameStep ? '1-5' : '1-4'}</Text>
              {/* Force show first step as fallback */}
              {currentStep === 1 && !showNameStep && renderAgeStep()}
              {currentStep === 1 && showNameStep && renderNameStep()}
            </View>
          )}
        </ScrollView>

        <View style={styles.continueButtonContainer}>
          <TouchableOpacity
            style={[styles.continueButton, canContinue() && styles.continueButtonActive]}
            onPress={handleContinue}
            disabled={!canContinue()}
          >
            <Text style={styles.continueButtonText}>
              {currentStep === totalSteps ? 'Create My Playbook' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    backgroundColor: Colors.anchorBlue,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  modalBackButton: {
    padding: 8,
  },
  spacer: {
    width: 32,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  progressSegment: {
    width: 25,
    height: 6,
    borderRadius: 6,
  },
  progressSegmentActive: {
    backgroundColor: Colors.growthGreen,
  },
  progressSegmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
    backgroundColor: Colors.anchorBlue,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.modalBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 40,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
    lineHeight: 20,
  },
  nameInputContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  ageOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  ageOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    alignItems: 'center',
  },
  selectedAgeOption: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  ageOptionTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  optionsContainer: {
    gap: 16,
  },
  faithOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedFaithOption: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  faithOptionIcon: {
    marginRight: 16,
  },
  faithOptionText: {
    flex: 1,
  },
  faithOptionTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  faithOptionDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  challengeOptionsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  challengeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedChallengeOption: {
    borderColor: Colors.alertCoral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  challengeOptionIcon: {
    marginRight: 16,
  },
  challengeOptionText: {
    flex: 1,
  },
  challengeOptionTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  challengeOptionDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.8,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  challengeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 85, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  challengeCardText: {
    flex: 1,
  },
  challengeCardTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  challengeCardDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailsSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  examplesLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    marginBottom: 12,
  },
  exampleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  exampleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exampleTagText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.white,
  },
  detailsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  continueButtonContainer: {
    backgroundColor: 'transparent',
    padding: 20,
  },
  continueButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
});

export default OnboardingPersonalizationScreen;
