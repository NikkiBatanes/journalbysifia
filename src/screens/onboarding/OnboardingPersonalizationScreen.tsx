/**
 * OnboardingPersonalizationScreen.tsx
 * Multi-step personalization screen matching exact design
 */

import React, { useState, useRef, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { OnboardingStyles } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useUserState } from '../../hooks/useUserState';
import { supabase } from '../../services/supabaseClient';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, StatusBar, KeyboardAvoidingView, Platform, TextInput, InteractionManager, Animated, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';

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
    description: 'Curious and seeking answers',
    icon: 'search-outline',
  },
  {
    id: 'new-believer',
    title: 'New Believer',
    description: 'Recently committed, eager to learn',
    icon: 'leaf-outline',
  },
  {
    id: 'growing',
    title: 'Growing in Faith',
    description: 'Hungry for deeper understanding',
    icon: 'trending-up-outline',
  },
  {
    id: 'mature',
    title: 'Mature Believer',
    description: 'Living out your calling',
    icon: 'library-outline',
  },
  {
    id: 'struggling',
    title: 'Going Through Struggles',
    description: 'Needing strength and encouragement',
    icon: 'heart-outline',
  },
  {
    id: 'returning',
    title: 'Returning to Faith',
    description: 'Coming back after time away',
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
  const { updateOnboardingStep } = useUserState();
  const insets = useSafeAreaInsets();
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
  const detailsInputRef = useRef<TextInput>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const askBoxYRef = useRef(0);
  // Animate the rounded-top container when keyboard opens (details step only)
  const containerTranslateY = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Tooltip for input guidance (mirrors UserInputScreen)
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(6)).current;
  const inputBorderWidth = useRef(new Animated.Value(1.5)).current;
  const onPressHint = useCallback(() => {
    try { triggerLightHaptic(); } catch {}
    setShowTooltip((prev) => {
      const next = !prev;
      if (next) {
        Animated.parallel([
          Animated.timing(tooltipOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(tooltipTranslateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      return next;
    });
  }, [tooltipOpacity, tooltipTranslateY]);

  const handleDetailsFocus = useCallback(() => {
    Animated.timing(inputBorderWidth, {
      toValue: 2,
      duration: 120,
      useNativeDriver: false,
    }).start();
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
      ]).start(() => setShowTooltip(false));
    }
  }, [inputBorderWidth, showTooltip, tooltipOpacity, tooltipTranslateY]);

  const handleDetailsBlur = useCallback(() => {
    Animated.timing(inputBorderWidth, {
      toValue: 1.5,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [inputBorderWidth]);

  const focusDetailsInput = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      // Small delay helps after layout/keyboard animations
      setTimeout(() => {
        detailsInputRef.current?.focus();
        const y = Math.max(askBoxYRef.current - 140, 0);
        scrollViewRef.current?.scrollTo({ y, animated: true });
      }, 100);
    });
  }, []);

  // When the user changes challenge, clear details so the new placeholder is visible
  React.useEffect(() => {
    setChallengeDetails('');
    // Do not auto-focus per UX requirement
  }, [selectedChallenge]);

  // Do not auto-focus when entering the details step per UX requirement
  React.useEffect(() => {
    // no-op
  }, [currentStep, showNameStep]);

  // Always show the top content when entering a new step/page
  React.useEffect(() => {
    // Slight delay to allow layout to settle before scrolling
    const id = setTimeout(() => {
      try {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [currentStep, showNameStep]);

  // Track keyboard visibility and (legacy) slide container up only on details step
  React.useEffect(() => {
    const isDetailsStep = currentStep === (showNameStep ? 5 : 4);

    const onShow = (e: any) => {
      setKeyboardVisible(true);
      if (!isDetailsStep) return;
      
      // Scroll to bottom when keyboard appears on details step
      setTimeout(() => {
        try {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        } catch {}
      }, 300);
      
      const kbHeight = e?.endCoordinates?.height ?? 0;
      const safeBottom = insets?.bottom ?? 0;
      // Translate only by the portion that overlaps the safe area, leaving a margin
      // Extra margin of 56 helps keep the sheet from overshooting above the keyboard
      let shift = Math.max(kbHeight - safeBottom - 56, 0);
      // Cap shift to avoid moving too far on small content screens
      shift = Math.min(shift, 240);
      Animated.timing(containerTranslateY, {
        toValue: -shift,
        duration: 180,
        useNativeDriver: true,
      }).start();
    };
    const onHide = () => {
      setKeyboardVisible(false);
      Animated.timing(containerTranslateY, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    };

    const subShow = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', onShow)
      : Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', onHide)
      : Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [currentStep, showNameStep, containerTranslateY, insets?.bottom]);

  // Dynamic total steps based on whether we show name step
  const totalSteps = showNameStep ? 5 : 4; // Name + Age + Faith + Challenge + Details OR Age + Faith + Challenge + Details

  const handleBack = () => {
    // On age group step, don't go back
    if (currentStep > 1) {
      try { triggerLightHaptic(); } catch {}
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = async () => {
    try { triggerLightHaptic(); } catch {}
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        // Update onboarding progress
        updateOnboardingStep('personalization_completed', 2);

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

        // Skip redundant screens and go directly to playbook generation
        console.log('[OnboardingPersonalization] Proceeding directly to Playbook Generation');
        (navigation as any).navigate('OnboardingPlaybookGeneration', {
          userName: name || 'Friend',
          userInput,
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
        console.log('[OnboardingPersonalization] Error occurred, but continuing to Playbook Generation');
        const userInput = `I am a ${selectedAgeGroup} on a ${selectedFaithJourney} faith journey, struggling with ${selectedChallenge}. ${challengeDetails || ''}`.trim();
        (navigation as any).navigate('OnboardingPlaybookGeneration', {
          userName: name || 'Friend',
          userInput,
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
      <Text style={styles.stepTitle}>Which stage of life are you in right now?</Text>
      <View style={styles.ageOptionsContainer}>
        {ageGroups.map((ageGroup) => (
          <TouchableOpacity
            key={ageGroup.value}
            style={[
              styles.ageOption,
              selectedAgeGroup === ageGroup.value && styles.selectedAgeOption,
            ]}
            onPress={() => { try { triggerLightHaptic(); } catch {}; setSelectedAgeGroup(ageGroup.value); }}
          >
            <Text style={styles.ageOptionTitle}>{ageGroup.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFaithJourneyStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where are you in your{`
`}walk with God?</Text>
      <Text
        style={styles.stepSubtitle}>
        There's no wrong answer. {'\n'}He welcomes you exactly as you are.
      </Text>
      <View style={styles.optionsContainer}>
        {faithJourneyOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.faithOption,
              selectedFaithJourney === option.id && styles.selectedFaithOption,
            ]}
            onPress={() => { try { triggerLightHaptic(); } catch {}; setSelectedFaithJourney(option.id); }}
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
            onPress={() => { try { triggerLightHaptic(); } catch {}; setSelectedChallenge(challenge.id); }}
          >
            <View style={styles.challengeOptionIcon}>
              <Ionicons name={challenge.icon} size={24} color={Colors.alertCoral} />
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
      <Text style={styles.stepTitle}>Tell us more, if you'd like.</Text>

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

      {/* Examples label */}
      {challengeOptions.find(c => c.id === selectedChallenge)?.examples && (
        <View style={styles.examplesLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.hopeWhite} style={styles.iconWithMarginAndOpacity} />
          <Text style={styles.examplesLabelText}>Suggested Prompts</Text>
        </View>
      )}

      <View style={styles.exampleTags}>
        {challengeOptions.find(c => c.id === selectedChallenge)?.examples?.map((example, index) => (
          <TouchableOpacity
            key={index}
            style={styles.exampleTag}
            onPress={() => { try { triggerLightHaptic(); } catch {}; setChallengeDetails(example); }}
          >
            <Text style={styles.exampleTagText}>{example}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View
        style={[styles.askBox, { borderWidth: inputBorderWidth }]}
        onLayout={(e) => { askBoxYRef.current = e.nativeEvent.layout.y; }}
        // Provide light haptic feedback when the ask box area is tapped
        onTouchStart={() => { try { triggerLightHaptic(); } catch {} }}
      >
        <TextInput
          ref={detailsInputRef}
          style={styles.askInput}
          placeholder={(
            (() => {
              const placeholders: Record<string, string> = {
                relationships: "I'm struggling with communication in my marriage. I'd like biblical guidance.",
                anxiety: 'I feel overwhelmed by work and worry. Help me find peace and trust.',
                purpose: "I'm unsure about my career path and want godly direction.",
                forgiveness: "I'm having trouble forgiving someone who hurt me. How do I begin?",
                financial: "I'm stressed about debt and budgeting. Teach me stewardship.",
                spiritual: 'I want to deepen prayer and Bible study habits.',
                addiction: "I'm trying to break a habit and need support and scripture.",
                grief: "I'm grieving a recent loss and need comfort and hope.",
              };
              if (selectedChallenge && placeholders[selectedChallenge]) {
                return placeholders[selectedChallenge];
              }
              return 'Describe your situation for this challenge (optional)';
            })()
          )}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          cursorColor={Colors.hopeWhite}
          selectionColor={Colors.hopeWhite}
          // No autoFocus: user must tap to activate cursor
          value={challengeDetails}
          onChangeText={setChallengeDetails}
          onTouchStart={focusDetailsInput}
          onFocus={handleDetailsFocus}
          onBlur={handleDetailsBlur}
          multiline
          textAlignVertical="top"
        />
        {/* Tooltip anchored above hint icon */}
        {showTooltip && (
          <Animated.View style={[
            styles.tooltip,
            { opacity: tooltipOpacity, transform: [{ translateY: tooltipTranslateY }] },
          ]} pointerEvents="box-none">
            <Text style={styles.tooltipKicker}>How Fia can help you.</Text>
            <Text style={styles.tooltipTitle}>Share what you're going through in detail. The more context, the better.</Text>
            <Text style={styles.tooltipSubtitle}>Helpful details to include:</Text>
            <View style={styles.tooltipList}>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><Text style={styles.tooltipBadgeText}>1</Text></View>
                <Text style={styles.tooltipItemText}>What happened</Text>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><Text style={styles.tooltipBadgeText}>2</Text></View>
                <Text style={styles.tooltipItemText}>Your pain</Text>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><Text style={styles.tooltipBadgeText}>3</Text></View>
                <Text style={styles.tooltipItemText}>A situation or struggle</Text>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><Text style={styles.tooltipBadgeText}>4</Text></View>
                <Text style={styles.tooltipItemText}>A decision you need to make</Text>
              </View>
            </View>
            <Text style={styles.tooltipFooter}>Then we'll turn this into a personalized playbook.</Text>
            <View style={styles.tooltipCaret} />
          </Animated.View>
        )}
        {/* Hint button */}
        <TouchableOpacity
          onPress={onPressHint}
          activeOpacity={0.9}
          style={[styles.askHintButton, !showTooltip && styles.disabledButton]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <MaterialCommunityIcons
            name="information"
            size={30}
            color={showTooltip ? Colors.alertCoral : 'rgba(255, 255, 255, 0.6)'}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={OnboardingStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={[styles.header, scrollY > 50 ? styles.headerTransparent : null]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={OnboardingStyles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={[
        styles.titleContainer,
        // Condense header further when keyboard is visible on details step to free vertical space
        (currentStep === (showNameStep ? 5 : 4) && keyboardVisible) ? { marginBottom: 0 } : null,
      ]}>
        {name ? (
          <Text style={styles.userGreeting}>Hi, {name}.</Text>
        ) : null}
        <Text style={OnboardingStyles.mainTitle}>Let's make this yours.</Text>
        <Text style={OnboardingStyles.subtitle}>
          Tell us a little about your season of life so we can create a playbook that speaks right to your heart.
        </Text>
      </View>

      <Animated.View style={[
        styles.contentContainer,
        // Nudge container upward more to expand vertically toward the title when keyboard is visible on details step
        (currentStep === (showNameStep ? 5 : 4) && keyboardVisible) ? { marginTop: -215 } : null,
      ]}>
        <View style={styles.modalHeader} pointerEvents="box-none">
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
            {/* Welcome-style dot pagination */}
            <View style={styles.dotsContainer}>
              {Array.from({ length: totalSteps }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    (index + 1) === currentStep && styles.activeDotGreen,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.spacer} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={
            (currentStep === (showNameStep ? 5 : 4) && keyboardVisible)
              ? { paddingBottom: 10 }
              : { paddingBottom: 10 }
          }
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
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

        <View
          style={[
            styles.continueButtonContainer,
            // Add safe-area-aware bottom padding for better spacing above home indicator
            keyboardVisible
              ? (currentStep === totalSteps
                  // Final step: "Create My Playbook" — minimal padding, safe-area only
                  ? { paddingBottom: Math.max(insets?.bottom ?? 0, 0) }
                  // Other steps: slightly reduced padding
                  : { paddingBottom: Math.max(insets?.bottom ?? 0, 4) })
              : { paddingBottom: Math.max(insets?.bottom ?? 0, 16) + 8 },
          ]}
        >
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
      </Animated.View>

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
  headerTransparent: {
    backgroundColor: 'transparent',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
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
  // Welcome-style dots pagination
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDotGreen: {
    backgroundColor: Colors.growthGreen,
    width: 20,
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
    paddingTop: 0,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 44, // leave space for absolute overlay header (chevron + progress)
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
    marginBottom: 20,
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
  userGreeting: {
    ...OnboardingStyles.subtitle,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
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
    gap: 16,
    // Align spacing with faith journey options
    // Remove extra bottom margin to keep uniform spacing across steps
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
  examplesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 0,
    alignSelf: 'flex-start',
  },
  examplesLabelText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    opacity: 0.85,
    textAlign: 'left',
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
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    borderRadius: 16,
    padding: 16,
    color: Colors.white,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  askBox: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
    paddingRight: 64, // space for info icon
    paddingBottom: 12,
    width: '100%',
    minHeight: 150,
    maxHeight: 300,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'column',
    position: 'relative',
    ...Platform.select({
      android: {
        paddingTop: 10,
      },
    }),
  },
  askHintButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  tooltip: {
    position: 'absolute',
    right: 10,
    bottom: 58,
    maxWidth: 280,
    backgroundColor: Colors.alertCoral,
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    zIndex: 20,
  },
  tooltipTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipKicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  tooltipSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  tooltipList: {
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  tooltipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tooltipBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 11,
    fontWeight: '700',
  },
  tooltipItemText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },
  tooltipFooter: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  tooltipCaret: {
    position: 'absolute',
    right: 24,
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.alertCoral,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.7,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  askInput: {
    color: Colors.hopeWhite,
    fontSize: 16,
    padding: 0,
    margin: 0,
    lineHeight: 24,
    backgroundColor: 'transparent',
    width: '100%',
    textAlign: 'left',
    includeFontPadding: true,
    textAlignVertical: 'top',
    flex: 1,
    ...Platform.select({
      ios: {
        paddingTop: 8,
      },
      android: {
        textAlignVertical: 'top',
        paddingTop: 6,
      },
    }),
  },
  continueButtonContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
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
  iconWithMarginAndOpacity: {
    marginRight: 6,
    opacity: 0.9,
  },
});

export default OnboardingPersonalizationScreen;
