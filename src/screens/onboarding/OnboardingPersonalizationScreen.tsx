/**
 * OnboardingPersonalizationScreen.tsx
 * Multi-step personalization screen matching exact design
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { OnboardingStyles } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { supabase } from '../../services/supabaseClient';
import { onboardingService } from '../../services/onboardingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedGenerationService } from '../../services/unifiedGenerationService';
import { faithPointsService } from '../../services/faithPointsService';
import { subscriptionService } from '../../services/subscriptionService';
import type { Playbook } from '../../interfaces/playbook';
import { Alert } from 'react-native';
import { triggerSuccessHaptic, triggerErrorHaptic } from '../../utils/haptics';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  InteractionManager,
  Animated,
  Keyboard,
  Dimensions,
  Modal,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../../components/common/ThemedText';
import ThemedTextInput from '../../components/common/ThemedTextInput';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';

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
  examples?: Array<{ label: string; template: string }>;
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
    examples: [
      { label: 'Marriage struggles', template: "I'm struggling with communication and connection in my marriage. We seem to be drifting apart and I need biblical guidance on how to rebuild intimacy and understanding." },
      { label: 'Parenting challenges', template: 'I want to grow as a parent and learn to respond to my children with grace. I need biblical guidance on nurturing their faith while managing my own emotions.' },
      { label: 'Friendship conflicts', template: "I'm dealing with conflict in a close friendship and don't know how to address it. I want to handle this situation with love and truth, but I'm not sure where to start." },
      { label: 'Family tensions', template: "There's ongoing tension in my family relationships that's causing me stress and pain. I need help navigating these difficult dynamics with wisdom and grace." },
    ],
  },
  {
    id: 'anxiety',
    title: 'Anxiety & Stress',
    description: 'Worry, fear, overwhelm, mental health',
    icon: 'heart-circle-outline',
    examples: [
      { label: 'Work stress', template: "I'm constantly stressed about work and feel like I'm drowning in responsibilities. The pressure is affecting my peace and I need help finding balance and trusting God with my career." },
      { label: 'Financial worry', template: "I'm anxious about my financial situation and can't stop worrying about money. The stress is consuming me and I need to learn how to trust God as my provider." },
      { label: 'Health anxiety', template: "I'm struggling with anxiety about my health or a loved one's health. The fear and worry are overwhelming and I need peace and faith to trust God with our wellbeing." },
      { label: 'General overwhelm', template: 'I feel completely overwhelmed by everything in my life right now. The stress and anxiety are paralyzing and I need help finding peace and clarity in the chaos.' },
    ],
  },
  {
    id: 'purpose',
    title: 'Purpose & Direction',
    description: 'Career decisions, life calling, major transitions',
    icon: 'compass-outline',
    examples: [
      { label: 'Career change', template: "I'm considering a major career change but I'm unsure if it's the right move. I need godly wisdom and clarity about my professional direction and calling." },
      { label: 'Life purpose', template: "I'm struggling to understand my life's purpose and feel lost about what God is calling me to do. I want to discover and walk in the unique plan He has for my life." },
      { label: 'Major decisions', template: "I'm facing a major life decision and feel paralyzed by uncertainty. I need wisdom and discernment to make the right choice that honors God." },
      { label: 'Feeling lost', template: "I feel lost and directionless in life right now. I'm not sure where I'm going or what I should be doing, and I need God's guidance to find my way." },
    ],
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness & Healing',
    description: 'Past hurts, trauma, letting go, emotional healing',
    icon: 'heart-circle-outline',
    examples: [
      { label: 'Past trauma', template: "I'm carrying pain from past trauma that continues to affect my present. I need healing and freedom from these wounds that keep holding me back." },
      { label: 'Unforgiveness', template: "I'm struggling to forgive someone who deeply hurt me. The bitterness and resentment are eating away at me and I want to experience the freedom of forgiveness." },
      { label: 'Emotional wounds', template: "I have deep emotional wounds from my past that I haven't fully healed from. I need God's healing touch and guidance on how to process and overcome this pain." },
      { label: 'Letting go', template: "I'm having trouble letting go of past hurts and moving forward. The pain keeps pulling me back and I need help releasing it to God and finding peace." },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Stewardship',
    description: 'Money management, debt, generosity, contentment',
    icon: 'card-outline',
    examples: [
      { label: 'Debt struggles', template: "I'm overwhelmed by debt and don't know how to get out of this financial hole. I need wisdom on managing money biblically and a plan to become debt-free." },
      { label: 'Budgeting', template: 'I struggle with budgeting and managing my finances wisely. Money seems to slip through my fingers and I need help developing better stewardship habits.' },
      { label: 'Generosity', template: "I want to be more generous but I'm held back by fear and scarcity mindset. I need help learning to trust God and give freely as He calls me to." },
      { label: 'Financial anxiety', template: "I'm constantly anxious about money and my financial future. The worry is consuming me and I need to learn contentment and trust in God's provision." },
    ],
  },
  {
    id: 'spiritual',
    title: 'Spiritual Growth',
    description: 'Prayer life, Bible study, spiritual disciplines',
    icon: 'book-outline',
    examples: [
      { label: 'Prayer struggles', template: 'I struggle to maintain a consistent prayer life and often feel like my prayers are empty or unanswered. I want to develop a deeper, more meaningful connection with God through prayer.' },
      { label: 'Bible reading', template: 'I want to read the Bible more consistently but struggle to make it a habit. I need help developing a sustainable Bible reading routine that brings life and understanding.' },
      { label: 'Spiritual dryness', template: "I'm experiencing spiritual dryness and feel distant from God. My faith feels stale and I desperately want to rekindle my passion and intimacy with Him." },
      { label: 'Growing closer to God', template: "I want to grow closer to God and deepen my relationship with Him, but I'm not sure how. I need guidance on spiritual disciplines and practices that will draw me nearer to His heart." },
    ],
  },
  {
    id: 'addiction',
    title: 'Addiction & Habits',
    description: 'Breaking bad habits, overcoming addictions',
    icon: 'refresh-outline',
    examples: [
      { label: 'Social media addiction', template: "I'm addicted to social media and it's consuming too much of my time and mental energy. I want to break free from this habit and use my time more purposefully." },
      { label: 'Bad habits', template: "I have bad habits that I keep falling back into no matter how hard I try to stop. I need God's strength and practical strategies to break these patterns for good." },
      { label: 'Substance issues', template: "I'm struggling with substance use and need help breaking free from this addiction. I want to find freedom and healing through God's power and grace." },
      { label: 'Behavioral patterns', template: "I'm stuck in unhealthy behavioral patterns that are hurting me and those around me. I need help identifying the root causes and developing new, godly habits." },
    ],
  },
  {
    id: 'grief',
    title: 'Grief & Loss',
    description: 'Death, loss, major life changes, mourning',
    icon: 'flower-outline',
    examples: [
      { label: 'Death of loved one', template: "I'm grieving the death of someone I love and the pain feels unbearable. I need comfort, hope, and guidance on how to navigate this loss while holding onto faith." },
      { label: 'Job loss', template: "I recently lost my job and I'm struggling with feelings of failure, uncertainty, and fear about the future. I need God's provision and direction during this difficult transition." },
      { label: 'Relationship end', template: "I'm grieving the end of a significant relationship and dealing with heartbreak and loss. I need healing and hope as I process this pain and move forward." },
      { label: 'Major life changes', template: "I'm going through major life changes that feel overwhelming and disorienting. I need stability, peace, and God's guidance as I navigate this new season." },
    ],
  },
];

import { useRoute } from '@react-navigation/native';
import { logger } from '../../utils/logger';

const OnboardingPersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as { name?: string; step?: number; rewriteData?: any } | undefined;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const detailsOnlyFlow = true;

  // Responsive dimensions for landscape/tablet support
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;
  const isVerySmallPhone = !isTablet && screenSize.height <= 700; // iPhone SE 2nd/3rd gen (667)
  const isSmallPhone = !isTablet && screenSize.height > 700 && screenSize.height <= 850; // iPhone 14 Pro (844) and similar
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.92, 720);

  // Track registration method for analytics only
  const [registrationMethod, setRegistrationMethod] = useState<'email' | 'oauth'>('email');

  // Always 4 steps: Age(1) → Faith(2) → Challenge(3) → Details(4)
  // Name step removed to comply with Apple guidelines
  // Note: Apple Private Relay ONLY hides email, NEVER names
  // "Friend" fallback only used when user explicitly chose "Hide My Name"
  const [currentStep, setCurrentStep] = useState(detailsOnlyFlow ? 1 : (routeParams?.step || 1));
  const [name, setName] = React.useState(routeParams?.name || '');
  const greetingName = React.useMemo(() => {
    if (!name) {return '';}
    const trimmed = name.trim();
    if (!trimmed) {return '';}
    return trimmed.split(/\s+/)[0];
  }, [name]);

  // Check for force navigation flag after successful auth
  React.useEffect(() => {
    let isActive = true;

    const checkForceNavigation = async () => {
      try {
        const forceNavigate = await AsyncStorage.getItem('force_navigate_to_main');
        if (forceNavigate !== 'true') {return;}

        const userId = user?.id;
        if (!userId) {
          Logger.debug('Force navigation flag present but user missing; clearing flag to avoid unintended redirect');
          await AsyncStorage.removeItem('force_navigate_to_main');
          return;
        }

        const hasCompleted = await onboardingService.hasCompletedOnboarding(userId);
        if (!isActive) {return;}

        if (hasCompleted) {
          Logger.debug('Force navigation flag confirmed with completed onboarding. Redirecting to UserInput (new main screen).');
          await AsyncStorage.removeItem('force_navigate_to_main');
          (navigation as any).reset({
            index: 0,
            routes: [{ name: 'UserInput' }],
          });
        } else {
          Logger.debug('Force navigation flag found but onboarding incomplete. Clearing flag and staying in onboarding.');
          await AsyncStorage.removeItem('force_navigate_to_main');
        }
      } catch (e) {
        Logger.warn('⚠️ Error checking force navigation flag', { component: 'OnboardingPersonalizationScreen', data: e });
        await AsyncStorage.removeItem('force_navigate_to_main');
      }
    };

    checkForceNavigation();

    return () => {
      isActive = false;
    };
  }, [navigation, user?.id]);

  // Respond to orientation changes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  // Create dynamic styles based on screen size
  const dynamicStyles = React.useMemo(() => StyleSheet.create({
    logoImage: {
      width: isVerySmallPhone ? 100 : (isTablet ? 120 : 100),
      height: isVerySmallPhone ? 100 : (isTablet ? 120 : 100),
    },
    titleContainer: {
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: isVerySmallPhone ? 15 : (isSmallPhone ? 20 : 30),
      backgroundColor: Colors.anchorBlue,
    },
    scrollContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: isVerySmallPhone ? 28 : (isSmallPhone ? 34 : 44), // Reduced padding for small phones
    },
    stepTitle: {
      fontSize: 20,
      fontFamily: Fonts.bold,
      fontWeight: '600',
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? 12 : (isSmallPhone ? 15 : 20),
    },
    stepSubtitle: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      color: Colors.white,
      textAlign: 'center',
      marginBottom: isVerySmallPhone ? 20 : (isSmallPhone ? 25 : 30),
      opacity: 0.8,
      lineHeight: 20,
    },
  }), [isVerySmallPhone, isSmallPhone, isTablet]);

  // Debug effect for step rendering
  React.useEffect(() => {
    logger.onboarding.stepCompleted(`Render State - currentStep: ${currentStep}, registrationMethod: ${registrationMethod}`);
  }, [currentStep, registrationMethod]);

  // Handle route params and determine registration method
  React.useEffect(() => {
    logger.debug('Route params:', route.params);

    if (route.params && typeof route.params === 'object') {
      // Get registration method
      const method = (route.params as any).registrationMethod || 'email';

      logger.debug('Registration method:', method);
      setRegistrationMethod(method);

      // Extract name with fallback strategy - NEVER ask user per Apple requirements
      const extractNameWithFallback = async () => {
        console.log('🚀 extractNameWithFallback called - NEW CODE VERSION');
        try {
          if (method === 'oauth') {
            // CRITICAL: Fetch fresh user data to get latest metadata from Apple Sign-In
            console.log('🔍 Fetching fresh user data...');
            const { data: { user: freshUser } } = await supabase.auth.getUser();
            console.log('🔍 Fresh user fetched:', !!freshUser);

            // BACKUP: Query user_profiles table if auth.getUser() doesn't have metadata
            let currentUser = freshUser || user;
            if (currentUser && (!currentUser.user_metadata?.first_name && !currentUser.user_metadata?.full_name)) {
              console.log('🔍 No metadata in auth user, querying user_profiles table...');
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('first_name, last_name, full_name')
                .eq('id', currentUser.id)
                .single();

              if (profile && (profile.first_name || profile.full_name)) {
                console.log('🔍 Found name in user_profiles:', profile);
                // Merge profile names into user object
                currentUser = {
                  ...currentUser,
                  user_metadata: {
                    ...currentUser.user_metadata,
                    first_name: profile.first_name || currentUser.user_metadata?.first_name,
                    last_name: profile.last_name || currentUser.user_metadata?.last_name,
                    full_name: profile.full_name || currentUser.user_metadata?.full_name,
                  },
                };
              }
            }

            const provider = currentUser?.app_metadata?.provider || (currentUser as any)?.identities?.[0]?.provider;
            const paramNameRaw = (route.params as any)?.name;
            const paramName = typeof paramNameRaw === 'string' ? paramNameRaw.trim() : '';
            const metadataName = (currentUser?.user_metadata?.first_name || currentUser?.user_metadata?.full_name || '').trim();

            // DEBUG: Log name extraction process
            console.log('🔍 Name extraction debug:', {
              provider,
              paramName,
              metadataName,
              userMetadata: currentUser?.user_metadata,
              freshUserFetched: !!freshUser,
            });

          // IMPORTANT: Apple Private Relay ONLY hides email, NEVER names
          // Name hiding is a SEPARATE option during Apple Sign-In
          // Priority 1: Route params (includes Apple-provided name from signInWithApple)
          // Priority 2: User metadata (for subsequent logins)
          // Priority 3: Fallback to "Friend" (only when user explicitly chose "Hide My Name")
          let resolvedName = paramName || metadataName;

          // For Google users, if first_name contains spaces, use only the first part
          if (provider === 'google' && metadataName && metadataName.includes(' ')) {
            resolvedName = metadataName.split(' ')[0];
            logger.debug('🔍 Google user name correction applied', {
              originalMetadataName: metadataName,
              correctedName: resolvedName,
              lastName: user?.user_metadata?.last_name,
            });
          }

          if (resolvedName && resolvedName.length > 0) {
            logger.debug('✅ OAuth user has name from provider', { provider, resolvedName });
            setName(resolvedName);
          } else {
            // User explicitly chose "Hide My Name" during sign-in
            // (Private Relay does NOT hide name - this is a separate option)
            // Use "Friend" fallback - NEVER ask for input per Apple guidelines
            logger.debug('📝 OAuth user chose to hide name - using Friend fallback', { provider });
            setName('Friend');
          }
          return;
        }

        // For non-OAuth users (email/password), extract name from email or use "Friend"
        logger.debug('Non-OAuth user - checking email extraction');

        // Priority 1: Name from route params
        if (route.params && 'name' in route.params && route.params.name) {
          const providedName = route.params.name as string;
          setName(providedName);
          logger.onboarding.navigation('email_user', 'name_provided', { name: providedName });
          return;
        }

        // Priority 2: Extract from email
        if (user?.email) {
          const emailUsername = user.email.split('@')[0];
          const extractedName = extractNameFromEmail(emailUsername);

          if (extractedName && extractedName.length > 0) {
            setName(extractedName);
            logger.onboarding.navigation('email_extraction', 'name_set', { userId: user?.id, extractedName });
          } else {
            // Can't extract - use "Friend" fallback
            setName('Friend');
            logger.debug('🔄 Email user - using "Friend" fallback');
          }
        } else {
          // No email - use "Friend" fallback
          setName('Friend');
          logger.debug('🔄 No email available - using "Friend" fallback');
        }
        } catch (error) {
          console.error('❌ Error in extractNameWithFallback:', error);
          logger.error('Error extracting name', error as Error, { component: 'OnboardingPersonalization' });
          setName('Friend');
        }
      };

      extractNameWithFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]); // user.email intentionally excluded - checked within effect

  // Restore data when coming back from content blocked error for rewriting
  useEffect(() => {
    if (routeParams?.rewriteData) {
      const rewriteData = routeParams.rewriteData;

      // Restore all previous selections with correct mapping
      if (rewriteData.ageGroup) {
        setSelectedAgeGroup(rewriteData.ageGroup);
      }
      if (rewriteData.faithJourney) {
        setSelectedFaithJourney(rewriteData.faithJourney);
      }
      if (rewriteData.challenge) {
        setSelectedChallenge(rewriteData.challenge);
      }
      if (rewriteData.challengeDetails) {
        setChallengeDetails(rewriteData.challengeDetails);

        // Focus input and move cursor to end after restoration
        setTimeout(() => {
          detailsInputRef.current?.focus();
        }, 100);
      }

      logger.debug('Restored rewrite data:', rewriteData);
    }
  }, [routeParams?.rewriteData]);

  // Helper function to extract first name from email username
  const extractNameFromEmail = (emailUsername: string): string => {
    if (!emailUsername) {
      return '';
    }

    let cleanUsername = emailUsername.toLowerCase();

    // Remove common prefixes
    cleanUsername = cleanUsername.replace(/^(by|the|my|user|admin|contact)/, '');

    // Look for common name patterns
    if (cleanUsername.includes('nikki')) {
      return 'Nikki';
    } else if (cleanUsername.includes('john')) {
      return 'John';
    } else if (cleanUsername.includes('maria')) {
      return 'Maria';
    } else if (cleanUsername.includes('alex')) {
      return 'Alex';
    }

    // If username looks like it contains a first name (4-12 chars, mostly letters)
    if (cleanUsername.length >= 4 && cleanUsername.length <= 12 && /^[a-z]+$/.test(cleanUsername)) {
      // Capitalize first letter
      return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
    }

    // If all else fails, return the original username capitalized
    return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
  };

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>(detailsOnlyFlow ? 'adult' : '');
  const [selectedFaithJourney, setSelectedFaithJourney] = useState<string>(detailsOnlyFlow ? 'growing' : '');
  const [selectedChallenge, setSelectedChallenge] = useState<string>(detailsOnlyFlow ? 'relationships' : '');
  const [challengeDetails, setChallengeDetails] = useState('');
  const detailsInputRef = useRef<TextInput>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [showOptionalHelper, setShowOptionalHelper] = useState(false);
  const askBoxYRef = useRef(0);

  // Tooltip state
  const hintButtonRef = useRef<View>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(6)).current;

  // Keyboard handling state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const containerTranslateY = useRef(new Animated.Value(0)).current;

  const headerIntroOpacity = useRef(new Animated.Value(1)).current;
  const askBoxOpacity = useRef(new Animated.Value(1)).current;
  const askBoxTranslateY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(1)).current;

  // Transition animations (from UserInputScreen)
  const inputCollapseAnim = useRef(new Animated.Value(0)).current;
  const generatingFadeAnim = useRef(new Animated.Value(0)).current;
  const generatingScaleAnim = useRef(new Animated.Value(0.92)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  const genLogoEntryAnim = useRef(new Animated.Value(0)).current;
  const genCardEntryAnim = useRef(new Animated.Value(0)).current;
  const genHeadingEntryAnim = useRef(new Animated.Value(0)).current;
  const genStepsEntryAnim = useRef(new Animated.Value(0)).current;
  const genProgressEntryAnim = useRef(new Animated.Value(0)).current;

  // Progress animation system (from UserInputScreen)
  const PHASE_PROGRESS_TARGETS = [20, 50, 80, 95];
  const currentPhaseRef = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationAbortRef = useRef(false);
  const isMountedRef = useRef(true);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  // Generation steps tracking (from UserInputScreen)
  type StepStatus = 'completed' | 'active' | 'inactive';
  type GenerationStep = { key: string; title: string; status: StepStatus };

  const INITIAL_GENERATION_STEPS: GenerationStep[] = [
    { key: 'seeing', title: 'Seeing this moment clearly', status: 'inactive' },
    { key: 'naming', title: 'Naming what matters most', status: 'inactive' },
    { key: 'shaping', title: 'Shaping faithful next steps', status: 'inactive' },
    { key: 'preparing', title: 'Preparing your playbook', status: 'inactive' },
  ];

  const buildInitialGenerationSteps = () => INITIAL_GENERATION_STEPS.map((step) => ({ ...step }));

  const [isGenerating, setIsGenerating] = useState(false);
  const [buildingDots, setBuildingDots] = useState('');
  const [generationCurrentStep, setGenerationCurrentStep] = useState(1); // 1-4
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>(() => buildInitialGenerationSteps());
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Check icon animations for generation steps
  const checkIconAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // Per-step pulsing dots — one per step so the native driver never loses the binding
  const pulsingDotAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // Shimmer opacity pulse for "Building your playbook..." text
  const buildingTextOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      generationAbortRef.current = true;
    };
  }, []);

  // ── Per-step pulsing dot loops ───────────────────────────────────────────────
  useEffect(() => {
    if (isGenerating) {
      const loops = pulsingDotAnims.map((anim) => {
        anim.setValue(0);
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: 750, useNativeDriver: true }),
          ])
        );
      });
      loops.forEach((l) => l.start());
      return () => loops.forEach((l) => l.stop());
    } else {
      pulsingDotAnims.forEach((anim) => anim.setValue(0));
    }
  }, [isGenerating]);

  // ── Animated dots + text-opacity shimmer on "Building your playbook..." ──────
  useEffect(() => {
    if (!isGenerating) {
      setBuildingDots('');
      buildingTextOpacity.setValue(0.55);
      return;
    }

    // Cycling dots: '' → '.' → '..' → '...'
    const dotStates = ['', '.', '..', '...'];
    let di = 0;
    const dotInterval = setInterval(() => {
      di = (di + 1) % dotStates.length;
      setBuildingDots(dotStates[di]);
    }, 420);

    // Shimmer = the letters themselves breathing bright → dim → bright
    buildingTextOpacity.setValue(0.55);
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildingTextOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(buildingTextOpacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();

    return () => {
      clearInterval(dotInterval);
      shimmerLoop.stop();
    };
  }, [isGenerating]);

  const resetToInputState = () => {
    inputCollapseAnim.setValue(0);
    inputScaleAnim.setValue(1);
    headerIntroOpacity.setValue(1);
    askBoxOpacity.setValue(1);
    generatingFadeAnim.setValue(0);
    generatingScaleAnim.setValue(0.92);
    genLogoEntryAnim.setValue(0);
    genCardEntryAnim.setValue(0);
    genHeadingEntryAnim.setValue(0);
    genStepsEntryAnim.setValue(0);
    genProgressEntryAnim.setValue(0);
    setBuildingDots('');
    StatusBar.setBarStyle('light-content', true);
    setIsGenerating(false);
  };

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const animateProgressTo = (target: number, duration = 800) =>
    new Promise<void>((resolve) => {
      Animated.timing(progressAnim, {
        toValue: target,
        duration,
        useNativeDriver: false,
      }).start(() => resolve());
    });

  const completeProgress = async () => {
    // Mark all steps as completed and animate check icons
    setGenerationSteps((prev) =>
      prev.map((step, index) => {
        // Animate check icon for each completed step
        Animated.spring(checkIconAnims[index], {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }).start();
        return { ...step, status: 'completed' };
      })
    );
    setGenerationCurrentStep(4);
    await animateProgressTo(100, 600);
  };

  const updateStepStatus = (stepIndex: number) => {
    // Raise trickle ceiling so the bar is now allowed to approach this phase's target
    currentPhaseRef.current = stepIndex;

    setGenerationSteps((prev) =>
      prev.map((step, index) => {
        if (index < stepIndex) {
          // Animate check icon for completed steps
          Animated.spring(checkIconAnims[index], {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }).start();
          return { ...step, status: 'completed' };
        }
        if (index === stepIndex) {
          return { ...step, status: 'active' };
        }
        return { ...step, status: 'inactive' };
      })
    );
    setGenerationCurrentStep(Math.min(stepIndex + 1, 4));

    // Floor guarantee: when a phase completes, the bar must be at least at the
    // PREVIOUS phase's target so there's no backward drift between label and bar.
    if (stepIndex > 0) {
      const prevTarget = PHASE_PROGRESS_TARGETS[stepIndex - 1];
      const current = (progressAnim as any).__getValue?.() ?? 0;
      if (current < prevTarget) {
        animateProgressTo(prevTarget, 500);
      }
    }
  };

  const startProgressTrickle = () => {
    const TICK_MS = 300;
    let elapsed = 0;
    const tick = () => {
      elapsed += TICK_MS;
      const phaseCeiling = (PHASE_PROGRESS_TARGETS[currentPhaseRef.current] ?? 95) - 1;
      const current = (progressAnim as any).__getValue?.() ?? 0;
      if (current < phaseCeiling) {
        const remaining = phaseCeiling - current;
        const step = Math.max(0.3, remaining * 0.05);
        Animated.timing(progressAnim, {
          toValue: Math.min(current + step, phaseCeiling),
          duration: TICK_MS + 80,
          useNativeDriver: false,
        }).start();
      }
      if (elapsed < 120000) {
        trickleRef.current = setTimeout(tick, TICK_MS);
      }
    };
    trickleRef.current = setTimeout(tick, TICK_MS);
  };

  const stopProgressTrickle = () => {
    if (trickleRef.current) {
      clearTimeout(trickleRef.current);
      trickleRef.current = null;
    }
  };

  const resetGenerationSteps = () => {
    setGenerationSteps(() => buildInitialGenerationSteps());
    setGenerationCurrentStep(1);
    progressAnim.setValue(0);
    setGenerationMessage(null);
    generationAbortRef.current = false;
    currentPhaseRef.current = 0;
  };

  const handleGenerationFlow = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    resetGenerationSteps();
    startProgressTrickle();

    // Track current phase so timers and post-playbook advancement stay in sync
    let currentPhase = 0;

    const advanceToPhase = (phase: number) => {
      if (generationAbortRef.current || currentPhase >= phase) { return; }
      currentPhase = phase;
      updateStepStatus(phase);
      try { triggerLightHaptic(); } catch {}
    };

    // Step 0 active immediately — with haptic
    updateStepStatus(0);
    try { triggerLightHaptic(); } catch {}

    // ── Time-based step timers ───────
    const phaseTimers = [
      setTimeout(() => advanceToPhase(1), 4000),
      setTimeout(() => advanceToPhase(2), 8500),
      setTimeout(() => advanceToPhase(3), 13500),
    ];
    const clearPhaseTimers = () => phaseTimers.forEach(clearTimeout);

    const runGeneration = async () => {
      const response = await unifiedGenerationService.generatePlaybook({
        userId: user.id,
        userInput: challengeDetails,
        userName: name || 'Friend',
        isOnboarding: true,
      });

      if (!response.success) {
        throw Object.assign(new Error(response.message || 'Unable to generate playbook'), response);
      }

      let savedPlaybook: Playbook | null = null;

      const fetchLatestPlaybook = async () => {
        if (!user.id) { return null; }
        const { data: recentPlaybooks } = await supabase
          .from('playbooks')
          .select('id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!recentPlaybooks || recentPlaybooks.length === 0) {
          return null;
        }

        const { data: playbook } = await supabase
          .from('playbooks')
          .select('*')
          .eq('id', recentPlaybooks[0].id)
          .single();

        return playbook as Playbook;
      };

      if (response.queueId) {
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts && !savedPlaybook) {
          if (generationAbortRef.current) {
            return null;
          }

          attempts += 1;
          await wait(1000);

          const status = await unifiedGenerationService.checkGenerationStatus(response.queueId);

          if (status.status === 'failed') {
            throw new Error(status.message || 'Generation failed. Please try again.');
          }

          if (status.status === 'completed' && status.resultId && user.id) {
            const completePlaybook = await fetchLatestPlaybook();
            if (completePlaybook) {
              savedPlaybook = completePlaybook;
              break;
            }
          }

          if (status.status === 'processing' && attempts > 15) {
            try {
              const fallback = await fetchLatestPlaybook();
              if (fallback) {
                savedPlaybook = fallback;
                break;
              }
            } catch (fallbackError) {
              Logger.error('[OnboardingPersonalizationScreen] Fallback playbook fetch failed', fallbackError as Error);
            }
          }
        }
      } else {
        savedPlaybook = await fetchLatestPlaybook();
      }

      if (!savedPlaybook) {
        throw new Error('Playbook generation is taking longer than expected. Please try again.');
      }

      return savedPlaybook;
    };

    try {
      const playbook = await runGeneration();

      clearPhaseTimers();

      if (!playbook) {
        resetToInputState();
        return;
      }

      if (currentPhase < 1) {
        await wait(400);
        advanceToPhase(1);
      }
      if (currentPhase < 2) {
        await wait(1500);
        advanceToPhase(2);
      }
      if (currentPhase < 3) {
        await wait(1500);
        advanceToPhase(3);
      }

      await wait(1000);

      stopProgressTrickle();
      await completeProgress();
      try { triggerSuccessHaptic(); } catch {}

      if (user.id) {
        try {
          await faithPointsService.awardPoints(user.id, 'playbook_generated', {
            suppressNotification: true,
            isOnboarding: true,
          });
        } catch (pointsError) {
          Logger.error('[OnboardingPersonalizationScreen] Failed to award faith points', pointsError as Error);
        }

        try {
          await subscriptionService.trackUsage(user.id, 'playbook', 0, false);
        } catch (usageError) {
          Logger.error('[OnboardingPersonalizationScreen] Failed to track usage', usageError as Error);
        }
      }

      generationAbortRef.current = true;

      logger.debug('[OnboardingPersonalizationScreen] Navigating to playbook walkthrough', { playbookId: playbook?.id, playbookTitle: playbook?.title });

      (navigation as any).replace('PlaybookWalkthrough', {
        playbook,
        source: 'onboarding',
      });
    } catch (error) {
      clearPhaseTimers();
      stopProgressTrickle();
      Logger.error('[OnboardingPersonalizationScreen] Generation error', error as Error);
      try { triggerErrorHaptic(); } catch {}

      if ((error as any).contentBlocked) {
        Alert.alert(
          'Content Review',
          (error as any).christianMessage || 'Content blocked for review.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsGenerating(false);
                resetGenerationSteps();
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Generation Failed',
        (error as Error).message || 'Unable to generate playbook. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              generationAbortRef.current = false;
              handleGenerationFlow();
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              resetToInputState();
              resetGenerationSteps();
            },
          },
        ]
      );
    }
  };

  const inputBorderWidth = useRef(new Animated.Value(1.5)).current;

  // Pulsing animation for hint icon to draw attention
  const hintIconScale = useRef(new Animated.Value(1)).current;

  // Button expansion animation - starts as arrow icon, expands to text when typing
  const buttonWidthAnim = useRef(new Animated.Value(36)).current;
  const buttonHasText = useRef(false);

  useEffect(() => {
    const hasText = challengeDetails && challengeDetails.trim().length > 0;
    const hasTextBoolean = !!hasText;
    if (hasTextBoolean !== buttonHasText.current) {
      buttonHasText.current = hasTextBoolean;
      Animated.timing(buttonWidthAnim, {
        toValue: hasTextBoolean ? 240 : 36,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [challengeDetails, buttonWidthAnim]);

  useEffect(() => {
    // Start pulsing animation when on details step and tooltip is not shown
    if (!showTooltip) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(hintIconScale, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(hintIconScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
        hintIconScale.setValue(1);
      };
    } else {
      hintIconScale.setValue(1);
    }
  }, [showTooltip, hintIconScale]);
  const onPressHint = useCallback(() => {
    try { triggerLightHaptic(); } catch {}
    hintButtonRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      setTooltipAnchor({ x, y, width, height });
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
    });
  }, [tooltipOpacity, tooltipTranslateY]);

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
  // But don't clear if we're restoring from rewriteData
  React.useEffect(() => {
    // Only clear if not restoring data (avoid clearing restored input)
    if (!routeParams?.rewriteData) {
      setChallengeDetails('');
    }
    // Do not auto-focus per UX requirement
  }, [selectedChallenge, routeParams?.rewriteData]);

  // Do not auto-focus when entering the details step per UX requirement
  React.useEffect(() => {
    // no-op
  }, [currentStep]);

  // Always show the top content when entering a new step/page
  React.useEffect(() => {
    // Slight delay to allow layout to settle before scrolling
    const id = setTimeout(() => {
      try {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [currentStep]);

  // Track keyboard visibility and (legacy) slide container up only on details step
  React.useEffect(() => {
    const isDetailsStep = detailsOnlyFlow ? true : currentStep === 4;

    const onShow = (e: any) => {
      setKeyboardVisible(true);
      if (!isDetailsStep) {return;}

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
  }, [currentStep, containerTranslateY, detailsOnlyFlow, insets?.bottom]);

  // Always 4 steps: Age → Faith → Challenge → Details
  const totalSteps = detailsOnlyFlow ? 1 : 4;

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
        // Mark onboarding as completed using proper service method
        if (user) {
          logger.onboarding.stepCompleted('onboarding_completion', 1, { userId: user.id });
          try {
            // Use the onboarding service to properly complete onboarding
            // This now handles BOTH onboarding_progress AND user_profiles tables
            await onboardingService.completeOnboarding(user.id);
            logger.onboarding.stepCompleted('Onboarding marked as completed in both tables');

            // IMPORTANT: Save name to user metadata ONLY for non-OAuth users (email/password)
            // Apple/Google OAuth: Name already saved during sign-in - DO NOT re-save per Apple guidelines
            if (name && name.trim().length > 0) {
              const trimmedName = name.trim();
              const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;

              // Check if name was already provided by OAuth provider (Apple/Google)
              const hasOAuthName = user?.user_metadata?.first_name || user?.user_metadata?.full_name;

              // CRITICAL: Skip name save for Apple/Google users when they already provided name
              // This complies with Apple's guideline: "We continue to find that your app requires users
              // to provide their name after using Sign in with Apple"
              if (provider === 'apple' && hasOAuthName) {
                logger.debug('✅ Apple user - name already provided by Apple, skipping save', {
                  existingFirstName: user?.user_metadata?.first_name,
                  existingFullName: user?.user_metadata?.full_name,
                });
                // Do nothing - Apple already provided the name during sign-in
              } else if (provider === 'google' && hasOAuthName) {
                logger.debug('✅ Google user - name already provided by Google, skipping save', {
                  existingFirstName: user?.user_metadata?.first_name,
                  existingFullName: user?.user_metadata?.full_name,
                });
                // Do nothing - Google already provided the name during sign-in
              } else {
                // Only save name for email/password users or OAuth users without names
                const updateData: any = {
                  full_name: trimmedName,
                  first_name: trimmedName,
                };

                logger.debug('📝 Saving name for non-OAuth user', {
                  provider: provider || 'email',
                  trimmedName,
                });

                try {
                  const { error: updateError } = await supabase.auth.updateUser({
                    data: updateData,
                  });

                  if (updateError) {
                    Logger.error('❌ Error saving name to user metadata', updateError as Error, {
                      component: 'OnboardingPersonalizationScreen',
                    });
                  } else {
                    logger.debug('✅ Name saved successfully for non-OAuth user');
                  }
                } catch (nameError) {
                  Logger.error('❌ Error updating user metadata with name', nameError as Error, {
                    component: 'OnboardingPersonalizationScreen',
                  });
                }
              }
            }
          } catch (error) {
            logger.error('Error completing onboarding:', error as Error);
            // Continue with navigation even if onboarding update fails
          }
        }
        // Continue with navigation regardless of completion update success

        // Use main playbook generation UI with onboarding data
        const userInput = challengeDetails.trim();

        // Skip redundant screens and go directly to playbook generation
        logger.debug('Proceeding directly to Playbook Generation');

        const ageGroupForNavigation = selectedAgeGroup || 'adult';
        const faithJourneyForNavigation = selectedFaithJourney || 'growing';
        const challengeForNavigation = selectedChallenge || 'relationships';

        // Trigger transition animation before navigation
        Keyboard.dismiss();

        // Phase 1: footer shrinks + header content fades (0–260ms)
        generatingFadeAnim.setValue(0);
        generatingScaleAnim.setValue(0.92);
        genLogoEntryAnim.setValue(0);
        genCardEntryAnim.setValue(0);
        genHeadingEntryAnim.setValue(0);
        genStepsEntryAnim.setValue(0);
        genProgressEntryAnim.setValue(0);

        Animated.parallel([
          Animated.timing(inputCollapseAnim, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(inputScaleAnim, {
            toValue: 0.88,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(headerIntroOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(askBoxOpacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Phase 2: switch to generating mode; each element bounces in
          setIsGenerating(true);

          requestAnimationFrame(() => {
            // Container fades + scales in with spring bounce
            Animated.parallel([
              Animated.timing(generatingFadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.spring(generatingScaleAnim, {
                toValue: 1,
                tension: 45,
                friction: 7,
                useNativeDriver: true,
              }),
            ]).start();

            // Staggered element entrance — each springs up with its own delay
            const springConfig = { tension: 55, friction: 8, useNativeDriver: true as const };
            const entries: [Animated.Value, number][] = [
              [genLogoEntryAnim, 0],
              [genCardEntryAnim, 90],
              [genHeadingEntryAnim, 190],
              [genStepsEntryAnim, 300],
              [genProgressEntryAnim, 430],
            ];
            entries.forEach(([anim, delay]) => {
              setTimeout(() => {
                Animated.spring(anim, { toValue: 1, ...springConfig }).start();
              }, delay);
            });

            // Start the generation flow with polling and step-by-step animation
            handleGenerationFlow();
          });
        });
      } catch (error) {
        logger.error('Error in handleContinue:', error as Error);
        // Fallback: navigate to generation screen if generation failed
        (navigation as any).navigate('OnboardingPlaybookGeneration', {
          userName: name || 'Friend',
          userInput: challengeDetails,
          onboardingData: {
            ageGroup: selectedAgeGroup || 'adult',
            faithJourney: selectedFaithJourney || 'growing',
            challenge: selectedChallenge || 'relationships',
            challengeDetails,
          },
        });
      }
    }
  };

  const canContinue = () => {
    if (detailsOnlyFlow) {
      return challengeDetails.trim().length > 0;
    }

    // Always 4 steps: Age(1) → Faith(2) → Challenge(3) → Details(4)
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
  };

  const handleScroll = (event: any) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  const renderAgeStep = () => (
    <View style={styles.stepContainer}>
      <ThemedText weight="bold" style={dynamicStyles.stepTitle}>Which stage of life are you in right now?</ThemedText>
      <ThemedText style={dynamicStyles.stepSubtitle}>
        {'There are no right or wrong answers\nThis simply helps us guide the reflection.'}
      </ThemedText>
      <View style={styles.ageOptionsContainer}>
        {ageGroups.map((ageGroup) => (
          <TouchableOpacity
            key={ageGroup.value}
            style={[
              styles.ageOption,
              selectedAgeGroup === ageGroup.value && styles.selectedAgeOption,
            ]}
            onPress={async () => {
              try { triggerLightHaptic(); } catch {}
              setSelectedAgeGroup(ageGroup.value);
              // Persist ageGroup to Supabase auth metadata
              try {
                await supabase.auth.updateUser({
                  data: { ageGroup: ageGroup.value },
                });
                Logger.info('Age group saved to auth metadata', {
                  component: 'OnboardingPersonalizationScreen',
                  data: { ageGroup: ageGroup.value },
                });
              } catch (err) {
                Logger.warn('Failed to save ageGroup to auth metadata', {
                  component: 'OnboardingPersonalizationScreen',
                  data: { ageGroup: ageGroup.value },
                  error: err as Error,
                });
              }
            }}
          >
            <ThemedText weight="semiBold" style={styles.ageOptionTitle}>{ageGroup.label}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFaithJourneyStep = () => (
    <View style={styles.stepContainer}>
      <ThemedText weight="bold" style={dynamicStyles.stepTitle}>Where are you in your{`
`}walk with God?</ThemedText>
      <ThemedText
        style={dynamicStyles.stepSubtitle}>
        You are welcome here exactly as you are.
      </ThemedText>
      <View style={styles.optionsContainer}>
        {faithJourneyOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.faithOption,
              selectedFaithJourney === option.id && styles.selectedFaithOption,
            ]}
            onPress={() => { try { triggerLightHaptic(); } catch {} setSelectedFaithJourney(option.id); }}
          >
            <View style={styles.faithOptionIcon}>
              <Ionicons name={option.icon} size={24} color={Colors.alertCoral} />
            </View>
            <View style={styles.faithOptionText}>
              <ThemedText weight="semiBold" style={styles.faithOptionTitle}>{option.title}</ThemedText>
              <ThemedText style={styles.faithOptionDescription}>{option.description}</ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderChallengeStep = () => (
    <View style={styles.stepContainer}>
      <ThemedText weight="bold" style={dynamicStyles.stepTitle}>What feels hardest right now?</ThemedText>
      <ThemedText style={dynamicStyles.stepSubtitle}>
        {'Choose one area where you need clarity or support.\nWe\'ll start there.'}
      </ThemedText>

      <View style={styles.challengeOptionsContainer}>
        {challengeOptions.map((challenge) => (
          <TouchableOpacity
            key={challenge.id}
            style={[
              styles.challengeOption,
              selectedChallenge === challenge.id && styles.selectedChallengeOption,
            ]}
            onPress={() => { try { triggerLightHaptic(); } catch {} setSelectedChallenge(challenge.id); }}
          >
            <View style={styles.challengeOptionIcon}>
              <Ionicons name={challenge.icon} size={24} color={Colors.alertCoral} />
            </View>
            <View style={styles.challengeOptionText}>
              <ThemedText weight="semiBold" style={styles.challengeOptionTitle}>{challenge.title}</ThemedText>
              <ThemedText style={styles.challengeOptionDescription}>{challenge.description}</ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderChallengeDetailsStep = () => (
    <View style={styles.stepContainer}>
      {!detailsOnlyFlow ? (
        <>
          <ThemedText weight="bold" style={dynamicStyles.stepTitle}>Tell us more, if you'd like.</ThemedText>
          <ThemedText style={dynamicStyles.stepSubtitle}>
            {'You can be as honest or brief as you want.\nThis helps shape your first playbook.'}
          </ThemedText>
        </>
      ) : null}

      {!detailsOnlyFlow && selectedChallenge && (
        <View style={styles.challengeCard}>
          <View style={styles.challengeCardIcon}>
            <Ionicons
              name={challengeOptions.find(c => c.id === selectedChallenge)?.icon || 'help-outline'}
              size={24}
              color={Colors.alertCoral}
            />
          </View>
          <View style={styles.challengeCardText}>
            <ThemedText weight="semiBold" style={styles.challengeCardTitle}>
              {challengeOptions.find(c => c.id === selectedChallenge)?.title}
            </ThemedText>
            <ThemedText style={styles.challengeCardDescription}>
              {challengeOptions.find(c => c.id === selectedChallenge)?.description}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Examples label */}
      {!detailsOnlyFlow && challengeOptions.find(c => c.id === selectedChallenge)?.examples && (
        <View style={styles.examplesLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.hopeWhite} style={styles.iconWithMarginAndOpacity} />
          <ThemedText style={styles.examplesLabelText}>Suggested Prompts</ThemedText>
        </View>
      )}

      {!detailsOnlyFlow ? (
        <View style={styles.exampleTags}>
          {challengeOptions.find(c => c.id === selectedChallenge)?.examples?.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={styles.exampleTag}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setChallengeDetails(example.template);
                focusDetailsInput();
              }}
            >
              <ThemedText style={styles.exampleTagText}>{example.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.askWrapper}>
        <Animated.View
          style={[styles.askBox, { borderWidth: inputBorderWidth }]}
          onLayout={(e) => { askBoxYRef.current = e.nativeEvent.layout.y; }}
          // Provide light haptic feedback when the ask box area is tapped
          onTouchStart={() => { try { triggerLightHaptic(); } catch {} }}
        >
          <View style={styles.inputWithActions}>
            <ThemedTextInput
              ref={detailsInputRef}
              style={styles.askInput}
              value={challengeDetails}
              onChangeText={setChallengeDetails}
              multiline={true}
              placeholderTextColor={'rgba(255, 255, 255, 0.55)'}
              placeholder={(() => {
                if (detailsOnlyFlow) {
                  return 'Something happened and I don\'t know how to respond faithfully.';
                }
                const placeholders: Record<string, string> = {
                  relationships: "I'm struggling with communication in my marriage. I'd like biblical guidance.",
                  anxiety: 'I feel overwhelmed by work and worry. Help me find peace and trust.',
                  purpose: "I'm unsure about my career path and want godly direction.",
                  forgiveness: "I'm having trouble forgiving someone who hurt me. How do I begin?",
                  financial: "I'm stressed about debt and budgeting. Teach me stewardship.",
                  spiritual: 'I want to deepen prayer and Bible study habits.',
                };
                return placeholders[selectedChallenge] ?? 'What situation are you facing?';
              })()}
              autoFocus={false}
              scrollEnabled={true}
              keyboardAppearance="dark"
            />
            <View style={styles.actionsOverlay}>
              <TouchableOpacity
                ref={hintButtonRef}
                onPress={onPressHint}
                activeOpacity={0.9}
                style={[styles.askHintButton, !showTooltip && styles.disabledButton]}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Animated.View style={{ transform: [{ scale: hintIconScale }] }}>
                  <MaterialCommunityIcons
                    name="information"
                    size={20}
                    color={showTooltip ? Colors.alertCoral : 'rgba(255, 255, 255, 0.6)'}
                  />
                </Animated.View>
              </TouchableOpacity>
              {challengeDetails && challengeDetails.trim().length > 0 ? (
                <TouchableOpacity
                  style={[styles.askSendButtonExpanded, (!challengeDetails || !challengeDetails.trim()) && styles.disabledButton, styles.askSendButtonActive]}
                  onPress={handleContinue}
                  disabled={!challengeDetails || !challengeDetails.trim()}
                  activeOpacity={0.8}
                >
                  <ThemedText weight="medium" style={styles.askSendButtonText}>Create my first playbook</ThemedText>
                </TouchableOpacity>
              ) : (
                <View style={[styles.askSendButtonCircular, (!challengeDetails || !challengeDetails.trim()) && styles.disabledButton, styles.askSendButtonActive]}>
                  <TouchableOpacity
                    style={styles.circularButtonInner}
                    onPress={handleContinue}
                    disabled={!challengeDetails || !challengeDetails.trim()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-up" size={20} color={Colors.hopeWhite} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
        {detailsOnlyFlow ? (
          <View style={styles.optionalHelperContainer}>
            <TouchableOpacity
              style={styles.optionalHelperToggle}
              onPress={() => {
                try { triggerLightHaptic(); } catch {}
                setShowOptionalHelper(prev => !prev);
              }}
              activeOpacity={0.9}
            >
              <Ionicons
                name={showOptionalHelper ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={'rgba(255, 255, 255, 0.75)'}
              />
            </TouchableOpacity>

            {showOptionalHelper ? (
              <View style={styles.optionalHelperList}>
                <TouchableOpacity
                  style={styles.optionalHelperChip}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setChallengeDetails('We talked and now I feel unsettled.');
                    focusDetailsInput();
                  }}
                  activeOpacity={0.9}
                >
                  <ThemedText style={styles.optionalHelperChipText}>{'We talked and now I feel unsettled.'}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionalHelperChip}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setChallengeDetails('I reacted quickly and regret it.');
                    focusDetailsInput();
                  }}
                  activeOpacity={0.9}
                >
                  <ThemedText style={styles.optionalHelperChipText}>{'I reacted quickly and regret it.'}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionalHelperChip}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setChallengeDetails('I feel guilty but don\'t know why.');
                    focusDetailsInput();
                  }}
                  activeOpacity={0.9}
                >
                  <ThemedText style={styles.optionalHelperChipText}>{'I feel guilty but don\'t know why.'}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionalHelperChip}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setChallengeDetails('I’m afraid of making the wrong decision.');
                    focusDetailsInput();
                  }}
                  activeOpacity={0.9}
                >
                  <ThemedText style={styles.optionalHelperChipText}>{'I’m afraid of making the wrong decision.'}</ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  const tooltipWidth = 280;
  const screenWidth = Dimensions.get('window').width;
  const computedLeft = tooltipAnchor
    ? Math.min(Math.max(tooltipAnchor.x + tooltipAnchor.width - tooltipWidth, 10), screenWidth - tooltipWidth - 10)
    : 10;
  const computedTop = tooltipAnchor
    ? Math.max(tooltipAnchor.y - 330, (insets?.top ?? 0) + 10)
    : (insets?.top ?? 0) + 10;

  return (
    <OnboardingErrorBoundary>
      <KeyboardAvoidingView
        style={OnboardingStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={[OnboardingStyles.innerContainer, { width: contentWidth }, styles.innerContainerCentered]}>
      {/* Header with logo - animated during transition */}
      {!isGenerating && (
        <Animated.View style={[styles.header, { opacity: headerIntroOpacity, transform: [{ scale: headerScale }] }]}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/icons/siFia-logo-white.png')}
              style={[OnboardingStyles.logoImage, dynamicStyles.logoImage]}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      )}

      {/* "Building a playbook..." overlay */}
      {isGenerating && (
        <Animated.View style={[
          styles.generatingContainer,
          {
            opacity: generatingFadeAnim,
            transform: [{ scale: generatingScaleAnim }],
          },
        ]}>
          {/* Logo in generating state */}
          <Animated.Image
            source={require('../../../assets/icons/siFia-logo-white.png')}
            style={[
              styles.generatingLogo,
              {
                opacity: genLogoEntryAnim,
                transform: [{
                  translateX: genLogoEntryAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                }],
              },
            ]}
            resizeMode="contain"
          />

          {/* Situation card showing what user shared */}
          <Animated.View style={{
            opacity: genCardEntryAnim,
            transform: [{
              translateY: genCardEntryAnim.interpolate({
                inputRange: [0, 1], outputRange: [22, 0],
              }),
            }],
          }}>
            <View style={styles.situationCard}>
              <Text style={styles.situationLabel}>WHAT YOU'VE SHARED</Text>
              <Text style={styles.situationText} numberOfLines={3}>"{challengeDetails.length > 100 ? challengeDetails.slice(0, 100) + '…"' : challengeDetails + '"'}</Text>
            </View>
          </Animated.View>

          {/* "Building your playbook..." heading */}
          <Animated.View style={{
            opacity: genHeadingEntryAnim,
            transform: [{
              translateY: genHeadingEntryAnim.interpolate({
                inputRange: [0, 1], outputRange: [20, 0],
              }),
            }],
          }}>
            <Animated.Text style={[styles.buildingHeading, { opacity: buildingTextOpacity }]}>
              {'Building your playbook' + buildingDots}
            </Animated.Text>
            <Text style={styles.buildingSubtext}>Grounding this moment in Scripture and faithful next steps.</Text>
          </Animated.View>

          {/* Step indicators */}
          <Animated.View style={[
            styles.stepsContainer,
            {
              opacity: genStepsEntryAnim,
              transform: [{
                translateY: genStepsEntryAnim.interpolate({
                  inputRange: [0, 1], outputRange: [18, 0],
                }),
              }],
            },
          ]}>
            {generationSteps.map((step, index) => (
              <View key={step.key} style={[
                styles.stepCard,
                step.status === 'completed' && styles.stepCardCompleted,
                step.status === 'active' && styles.stepCardActive,
                step.status === 'inactive' && styles.stepCardDefault,
              ]}>
                <View style={styles.stepRow}>
                  <View style={[
                    styles.stepCircle,
                    step.status === 'completed' && styles.stepCompleted,
                    step.status === 'active' && styles.stepActive,
                    step.status === 'inactive' && styles.stepInactive,
                  ]}>
                    {step.status === 'completed' && (
                      <Animated.View style={{ transform: [{ scale: checkIconAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
                        <MaterialIcons name="check" size={16} color={Colors.hopeWhite} />
                      </Animated.View>
                    )}
                    {step.status === 'active' && (
                      <Animated.View style={[styles.pulsingDot, { opacity: pulsingDotAnims[index] }]} />
                    )}
                    {step.status === 'inactive' && (
                      <View style={styles.staticDot} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepText,
                    step.status === 'completed' && styles.stepTextCompleted,
                    step.status === 'active' && styles.stepTextActive,
                    step.status === 'inactive' && styles.stepTextInactive,
                  ]}>
                    {step.title}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Progress bar */}
          <Animated.View style={[
            styles.progressContainer,
            {
              opacity: genProgressEntryAnim,
              transform: [{
                translateY: genProgressEntryAnim.interpolate({
                  inputRange: [0, 1], outputRange: [14, 0],
                }),
              }],
            },
          ]}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>Phase {generationCurrentStep} of 4</Text>
          </Animated.View>
        </Animated.View>
      )}

      {!isGenerating && (
        <>
        <View style={[
          dynamicStyles.titleContainer,
          // Condense header further when keyboard is visible on details step to free vertical space
          ((detailsOnlyFlow || currentStep === 4) && keyboardVisible) && styles.noMarginBottom,
        ]}>
          {greetingName ? (
            <ThemedText weight="bold" style={styles.userGreeting}>Hi, {greetingName}.</ThemedText>
          ) : null}
          {detailsOnlyFlow ? (
            <>
              <ThemedText weight="bold" style={OnboardingStyles.mainTitle}>What just happened?</ThemedText>
              <ThemedText style={OnboardingStyles.subtitle}>
                {'Describe the moment that stayed with you.\nNot the whole story. Just enough to get it out of your head.'}
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText weight="bold" style={OnboardingStyles.mainTitle}>Let's make this yours.</ThemedText>
              <ThemedText style={OnboardingStyles.subtitle}>
                {'Tell us a little about your season of life\nSo we can create a playbook that speaks to what you\'re walking through.'}
              </ThemedText>
            </>
          )}
        </View>

        <Animated.View style={[
          styles.contentContainer,
          // Nudge container upward more to expand vertically toward the title when keyboard is visible on details step
          ((detailsOnlyFlow || currentStep === 4) && keyboardVisible) && styles.nudgeUpward,
        ]}>
          {!detailsOnlyFlow ? (
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
          ) : null}

          <ScrollView
            ref={scrollViewRef}
            style={dynamicStyles.scrollContainer}
            contentContainerStyle={styles.reducedPaddingBottom}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {detailsOnlyFlow ? (
              renderChallengeDetailsStep()
            ) : (
              <>
                {/* Always 4 steps: Age(1) → Faith(2) → Challenge(3) → Details(4) */}
                {currentStep === 1 && renderAgeStep()}
                {currentStep === 2 && renderFaithJourneyStep()}
                {currentStep === 3 && renderChallengeStep()}
                {currentStep === 4 && renderChallengeDetailsStep()}
              </>
            )}
          </ScrollView>
        </Animated.View>
        </>
      )}
      </View>

        <Modal
          visible={showTooltip}
          transparent
          animationType="none"
          onRequestClose={() => {
            Animated.parallel([
              Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
              Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
            ]).start(() => setShowTooltip(false));
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.tooltipModalBackdrop}
            onPress={() => {
              Animated.parallel([
                Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
                Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
              ]).start(() => setShowTooltip(false));
            }}
          >
            <Animated.View
              style={[
                styles.tooltip,
                {
                  left: computedLeft,
                  top: computedTop,
                  right: undefined,
                  bottom: undefined,
                  opacity: tooltipOpacity,
                  transform: [{ translateY: tooltipTranslateY }],
                },
              ]}
              pointerEvents="box-none"
            >
              <ThemedText weight="semiBold" style={styles.tooltipKicker}>How siFia can help</ThemedText>
              <ThemedText weight="bold" style={styles.tooltipTitle}>You don't need to explain everything perfectly.</ThemedText>
              <ThemedText weight="bold" style={styles.tooltipTitleSpaced}>Just share what feels important right now.</ThemedText>
              <ThemedText style={styles.tooltipSubtitle}>If it helps, you can mention:</ThemedText>
              <View style={styles.tooltipList}>
                <View style={styles.tooltipItemRow}>
                  <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>1</ThemedText></View>
                  <ThemedText style={styles.tooltipItemText}>What just happened</ThemedText>
                </View>
                <View style={styles.tooltipItemRow}>
                  <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>2</ThemedText></View>
                  <ThemedText style={styles.tooltipItemText}>What feels heavy or unclear</ThemedText>
                </View>
                <View style={styles.tooltipItemRow}>
                  <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>3</ThemedText></View>
                  <ThemedText style={styles.tooltipItemText}>A situation you’re sitting with</ThemedText>
                </View>
                <View style={styles.tooltipItemRow}>
                  <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>4</ThemedText></View>
                  <ThemedText style={styles.tooltipItemText}>A decision you don’t know how to respond to yet</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.tooltipFooter}>siFia will help you slow down and shape this into a playbook.</ThemedText>
              <TouchableOpacity
                onPress={onPressHint}
                style={styles.tooltipHelpButton}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.tooltipHelpButtonText}>Need help putting words to it?</ThemedText>
              </TouchableOpacity>
              <View style={styles.tooltipCaret} />
            </Animated.View>
          </TouchableOpacity>
        </Modal>
    </KeyboardAvoidingView>
    </OnboardingErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 28,
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
    marginTop: 10,
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
    width: 120,
    height: 120,
  },
  progressContainer: {
    marginBottom: 16,
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
    backgroundColor: Colors.anchorBlue,
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
    fontSize: 20,
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
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 700,
    paddingHorizontal: 20, // match continueButtonContainer side padding
  },
  faithOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignSelf: 'center',
    width: '100%',
    minHeight: 56,
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 700,
    paddingHorizontal: 20, // match continueButtonContainer side padding
    // Align spacing with faith journey options
    // Remove extra bottom margin to keep uniform spacing across steps
  },
  challengeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignSelf: 'center',
    width: '100%',
    minHeight: 56,
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
    borderRadius: 32,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 0,
    paddingBottom: 60, // Space for overlay icon
    width: '100%',
    minHeight: 150,
    position: 'relative',
    overflow: 'hidden',
  },
  askWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  optionalHelperContainer: {
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  optionalHelperToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  optionalHelperToggleText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
  },
  optionalHelperList: {
    marginTop: 6,
  },
  optionalHelperChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  optionalHelperChipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charCounterWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCounterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.regular,
  },
  askHintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  hintButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  askSendButton: {
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    minWidth: 36,
  },
  askSendButtonCircular: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  circularButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  askSendButtonExpanded: {
    width: 240,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askSendButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  askSendButtonActive: {
    backgroundColor: Colors.alertCoral,
  },
  askSendButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    maxWidth: 280,
    backgroundColor: Colors.alertCoral,
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  tooltipModalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tooltipTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipTitleSpaced: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 2,
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
  tooltipHelpButton: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  tooltipHelpButtonText: {
    color: Colors.hopeWhite,
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  askInput: {
    flex: 1,
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    padding: 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    minHeight: 150,
    maxHeight: 150,
    ...Platform.select({
      ios: {
        paddingTop: 16,
      },
      android: {
        textAlignVertical: 'top',
        paddingTop: 16,
      },
    }),
  },
  inputWithActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  continueButtonContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 700,
  },
  noMarginBottom: {
    marginBottom: 0,
  },
  nudgeUpward: {
    marginTop: -215,
  },
  reducedPaddingBottom: {
    paddingBottom: 10,
  },
  continueButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.25)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  continueButtonActive: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
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
  innerContainerCentered: {
    alignSelf: 'center',
  },
  // Styles for "Building a playbook..." overlay
  generatingContainer: {
    paddingHorizontal: 24,
    paddingTop: 210,
    paddingBottom: 40,
  },
  generatingLogo: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 60,
    height: 60,
    zIndex: 10,
  },
  situationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  situationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    fontFamily: Fonts.semiBold,
  },
  situationText: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.white,
    lineHeight: 24,
    fontFamily: Fonts.regular,
  },
  buildingHeading: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
    fontFamily: Fonts.bold,
  },
  buildingSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
    fontFamily: Fonts.regular,
  },
  stepsContainer: {
    marginBottom: 32,
  },
  stepCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  stepCardCompleted: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  stepCardActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepCardDefault: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepActive: {
    backgroundColor: Colors.anchorBlue,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stepCompleted: {
    backgroundColor: Colors.alertCoral,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  stepInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
  },
  staticDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: Fonts.regular,
  },
  stepTextActive: {
    color: Colors.white,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
  },
  stepTextCompleted: {
    color: Colors.alertCoral,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
  },
  stepTextInactive: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Fonts.regular,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});

export default withErrorBoundary(OnboardingPersonalizationScreen, 'OnboardingPersonalizationScreen');
