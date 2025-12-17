/**
 * OnboardingPersonalizationScreen.tsx
 * Multi-step personalization screen matching exact design
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { OnboardingStyles } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { supabase } from '../../services/supabaseClient';
import { onboardingService } from '../../services/onboardingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [currentStep, setCurrentStep] = useState(routeParams?.step || 1);
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
          Logger.debug('Force navigation flag confirmed with completed onboarding. Redirecting to MainTabs.');
          await AsyncStorage.removeItem('force_navigate_to_main');
          (navigation as any).reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
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
  }), [isVerySmallPhone, isSmallPhone]);

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

  // Pulsing animation for hint icon to draw attention
  const hintIconScale = useRef(new Animated.Value(1)).current;

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
    const isDetailsStep = currentStep === 4;

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
  }, [currentStep, containerTranslateY, insets?.bottom]);

  // Always 4 steps: Age → Faith → Challenge → Details
  const totalSteps = 4;

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
        logger.error('Error in handleContinue:', error as Error);
        // Continue with navigation even if onboarding update fails
        logger.error('Error occurred, but continuing to Playbook Generation');

        // IMPORTANT: Save name ONLY for non-OAuth users (email/password) - same logic as success case
        if (name && name.trim().length > 0 && user) {
          const trimmedName = name.trim();
          const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
          const hasOAuthName = user?.user_metadata?.first_name || user?.user_metadata?.full_name;

          // Skip name save for Apple/Google OAuth users who already provided name
          if ((provider === 'apple' || provider === 'google') && hasOAuthName) {
            logger.debug('✅ OAuth user - name already provided, skipping save (error case)', {
              provider,
              existingFirstName: user?.user_metadata?.first_name,
            });
          } else {
            // Only save name for email/password users or OAuth users without names
            const updateData: any = {
              full_name: trimmedName,
              first_name: trimmedName,
            };

            try {
              const { error: updateError } = await supabase.auth.updateUser({
                data: updateData,
              });

              if (updateError) {
                Logger.error('❌ Error saving name to user metadata (error case)', updateError as Error, {
                  component: 'OnboardingPersonalizationScreen',
                });
              } else {
                logger.debug('✅ Name saved successfully (error case)');
              }
            } catch (nameError) {
              Logger.error('❌ Error updating user metadata with name (error case)', nameError as Error, {
                component: 'OnboardingPersonalizationScreen',
              });
            }
          }
        }

        const userInput = challengeDetails.trim();
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
        There's no wrong answer. {'\n'}He welcomes you exactly as you are.
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
      <ThemedText weight="bold" style={dynamicStyles.stepTitle}>What's your biggest{'\n'}challenge right now?</ThemedText>
      <ThemedText style={dynamicStyles.stepSubtitle}>
        Choose the area where you need the most guidance,{'\n'}
        and we'll create a personalized playbook just for you
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
      <ThemedText weight="bold" style={dynamicStyles.stepTitle}>Tell us more, if you'd like.</ThemedText>

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
      {challengeOptions.find(c => c.id === selectedChallenge)?.examples && (
        <View style={styles.examplesLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.hopeWhite} style={styles.iconWithMarginAndOpacity} />
          <ThemedText style={styles.examplesLabelText}>Suggested Prompts</ThemedText>
        </View>
      )}

      <View style={styles.exampleTags}>
        {challengeOptions.find(c => c.id === selectedChallenge)?.examples?.map((example, index) => (
          <TouchableOpacity
            key={index}
            style={styles.exampleTag}
            onPress={() => { try { triggerLightHaptic(); } catch {} setChallengeDetails(example.template); }}
          >
            <ThemedText style={styles.exampleTagText}>{example.label}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.askWrapper}>
        <Animated.View
          style={[styles.askBox, { borderWidth: inputBorderWidth }]}
          onLayout={(e) => { askBoxYRef.current = e.nativeEvent.layout.y; }}
          // Provide light haptic feedback when the ask box area is tapped
          onTouchStart={() => { try { triggerLightHaptic(); } catch {} }}
        >
          <ThemedTextInput
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
            onTouchStart={() => {
              focusDetailsInput();
              triggerLightHaptic();
            }}
            onFocus={handleDetailsFocus}
            onBlur={handleDetailsBlur}
            multiline
            textAlignVertical="top"
            scrollEnabled={true}
          />
          <View style={styles.actionsOverlay}>
            <TouchableOpacity
              onPress={onPressHint}
              activeOpacity={0.9}
              style={[styles.askHintButton, !showTooltip && styles.disabledButton]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Animated.View style={{ transform: [{ scale: hintIconScale }] }}>
                <MaterialCommunityIcons
                  name="information"
                  size={30}
                  color={showTooltip ? Colors.alertCoral : 'rgba(255, 255, 255, 0.6)'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        {/* Tooltip anchored above hint icon; placed outside askBox to avoid clipping */}
        {showTooltip && (
          <Animated.View style={[
            styles.tooltip,
            { opacity: tooltipOpacity, transform: [{ translateY: tooltipTranslateY }] },
          ]} pointerEvents="box-none">
            <ThemedText weight="semiBold" style={styles.tooltipKicker}>How Fia can help you.</ThemedText>
            <ThemedText weight="bold" style={styles.tooltipTitle}>Share what you're going through in detail. The more context, the better.</ThemedText>
            <ThemedText style={styles.tooltipSubtitle}>Helpful details to include:</ThemedText>
            <View style={styles.tooltipList}>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>1</ThemedText></View>
                <ThemedText style={styles.tooltipItemText}>What happened</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>2</ThemedText></View>
                <ThemedText style={styles.tooltipItemText}>Your pain</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>3</ThemedText></View>
                <ThemedText style={styles.tooltipItemText}>A situation or struggle</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={styles.tooltipBadge}><ThemedText weight="semiBold" style={styles.tooltipBadgeText}>4</ThemedText></View>
                <ThemedText style={styles.tooltipItemText}>A decision you need to make</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.tooltipFooter}>Then we'll turn this into a personalized playbook.</ThemedText>
            <View style={styles.tooltipCaret} />
          </Animated.View>
        )}
      </View>
    </View>
  );

  return (
    <OnboardingErrorBoundary>
      <KeyboardAvoidingView
        style={OnboardingStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
        <View style={[OnboardingStyles.innerContainer, { width: contentWidth }, styles.innerContainerCentered]}>
      <View style={[styles.header, scrollY > 50 ? styles.headerTransparent : null]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/siFia-logo-white.png')}
            style={OnboardingStyles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={[
        dynamicStyles.titleContainer,
        // Condense header further when keyboard is visible on details step to free vertical space
        (currentStep === 4 && keyboardVisible) && styles.noMarginBottom,
      ]}>
        {greetingName ? (
          <ThemedText weight="bold" style={styles.userGreeting}>Hi, {greetingName}.</ThemedText>
        ) : null}
        <ThemedText weight="bold" style={OnboardingStyles.mainTitle}>Let's make this yours.</ThemedText>
        <ThemedText style={OnboardingStyles.subtitle}>
          Tell us a little about your season of life so we can create a playbook that speaks right to your heart.
        </ThemedText>
      </View>

      <Animated.View style={[
        styles.contentContainer,
        // Nudge container upward more to expand vertically toward the title when keyboard is visible on details step
        (currentStep === 4 && keyboardVisible) && styles.nudgeUpward,
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
          style={dynamicStyles.scrollContainer}
          contentContainerStyle={styles.reducedPaddingBottom}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {/* Always 4 steps: Age(1) → Faith(2) → Challenge(3) → Details(4) */}
          {currentStep === 1 && renderAgeStep()}
          {currentStep === 2 && renderFaithJourneyStep()}
          {currentStep === 3 && renderChallengeStep()}
          {currentStep === 4 && renderChallengeDetailsStep()}
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
            <ThemedText weight="medium" style={styles.continueButtonText}>
              {(() => {
                // Safeguard to always show button text
                if (currentStep === totalSteps) {
                  return 'Create My Playbook';
                } else if (currentStep > 0 && currentStep <= totalSteps) {
                  return 'Continue';
                } else {
                  return 'Continue'; // Fallback
                }
              })()}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </Animated.View>
      </View>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 700,
    paddingHorizontal: 20, // match continueButtonContainer side padding
  },
  faithOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 0, // Remove padding to allow seamless scrolling
    paddingBottom: 60, // Space for overlay icon
    width: '100%',
    minHeight: 150,
    position: 'relative',
    overflow: 'hidden', // Clip content at container edges
  },
  askWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  askHintButton: {
    // positioned in actionsOverlay
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
    width: '100%',
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    padding: 16,
    paddingBottom: 0,
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
  innerContainerCentered: {
    alignSelf: 'center',
  },
});

export default withErrorBoundary(OnboardingPersonalizationScreen, 'OnboardingPersonalizationScreen');
