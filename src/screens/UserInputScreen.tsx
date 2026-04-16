import * as React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic } from '../utils/haptics';
import { useTheme } from '../theme/ThemeContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useNewSubscription } from '../hooks/useNewSubscription';
import { checkAndRecordRequest, type SubscriptionTier } from '../utils/rateLimiting';
import { Alert } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'> & {
  navigate: (screen: 'GeneratingPlaybook', params: { userInput: string; userName: string }) => void;
  reset: (state: any) => void; // Add reset method to navigation prop
};

const MAX_USER_INPUT_LENGTH = 2000;

const UserInputScreen: React.FC = () => {
  const navigation = useNavigation<UserInputScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'UserInput'>>();
  const inputRef = useRef<TextInput | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const font = React.useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);
  const isLandscape = width > height;
  const isPad = Platform.OS === 'ios' && (Platform as any).isPad === true;

  useScreenStatusBar('light', Colors.anchorBlue);

  // No scrolling needed; content is static and footer is fixed

  const [userInput, setUserInput] = useState('');
  // Typing, cycling placeholder for guided, non-chat input
  const [placeholderText, setPlaceholderText] = useState('What happened?');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Navigation reveal state
  const [showNavigation, setShowNavigation] = useState(false);
  const navButtonAnim = useRef(new Animated.Value(0)).current;

  // Auto-save draft to prevent data loss
  const DRAFT_KEY = '@siFia:userInputDraft';

  // Load saved draft or initial text on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        // Check if we have initial text from route params (for editing)
        if (route.params?.initialText) {
          setUserInput(route.params.initialText);
          // Focus input and position cursor at end with multiple attempts for reliability
          const focusWithCursor = () => {
            if (inputRef.current) {
              inputRef.current.focus();
              // Position cursor at the end
              const textLength = route.params?.initialText?.length || 0;
              inputRef.current.setSelection(textLength, textLength);
            }
          };

          // Try immediately
          setTimeout(focusWithCursor, 100);
          // Try again after animation
          setTimeout(focusWithCursor, 500);
          return;
        }

        // Otherwise load saved draft
        const draft = await AsyncStorage.getItem(DRAFT_KEY);
        if (draft && draft.trim()) {
          setUserInput(draft);
        }
      } catch (error) {
        // Silent fail - draft is not critical
      }
    };
    loadDraft();
  }, [route.params?.initialText]);

  useEffect(() => {
    if (!route.params?.autoFocus) { return; }
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput();
    autoFocusTimer.current = setTimeout(focusInput, 120);

    return () => {
      if (autoFocusTimer.current) {
        clearTimeout(autoFocusTimer.current);
        autoFocusTimer.current = null;
      }
    };
  }, [route.params?.autoFocus]);

  // Auto-save draft when user types (debounced)
  const saveDraftTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveDraftTimer.current) {
      clearTimeout(saveDraftTimer.current);
    }

    saveDraftTimer.current = setTimeout(async () => {
      try {
        if (userInput.trim()) {
          await AsyncStorage.setItem(DRAFT_KEY, userInput);
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY);
        }
      } catch (error) {
        // Silent fail - draft is not critical
      }
    }, 1000); // Save 1 second after user stops typing

    return () => {
      if (saveDraftTimer.current) {
        clearTimeout(saveDraftTimer.current);
      }
    };
  }, [userInput]);
  useEffect(() => {
    const prompts = [
      'What happened?',
      'How is it affecting you?',
      'What are you struggling with?',
      'What decision is ahead?',
    ];

    let isMounted = true;
    let promptIndex = 0;
    let charIndex = prompts[0].length; // start at full first prompt so placeholder is visible initially

    const clearTimer = () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    };

    const typeNext = () => {
      if (!isMounted) {return;}
      const current = prompts[promptIndex];
      if (charIndex <= current.length) {
        setPlaceholderText(current.slice(0, charIndex));
        charIndex += 1;
        typingTimer.current = setTimeout(typeNext, 60);
      } else {
        // Pause, then erase and move to next prompt
        typingTimer.current = setTimeout(() => {
          const erase = () => {
            if (!isMounted) {return;}
            if (charIndex >= 0) {
              setPlaceholderText(current.slice(0, charIndex));
              charIndex -= 1;
              typingTimer.current = setTimeout(erase, 35);
            } else {
              promptIndex = (promptIndex + 1) % prompts.length;
              charIndex = 0;
              typeNext();
            }
          };
          erase();
        }, 1600);
      }
    };

    typeNext();

    return () => {
      isMounted = false;
      clearTimer();
    };
  }, []);

  const { user } = useAuth();
  const subscriptionData = useNewSubscription(user?.id || '');
  const { hasAccess } = useFeatureAccess({
    feature: 'playbook_generation',
  });

  // Override hasAccess based on actual usage data
  const canGeneratePlaybook = hasAccess && (subscriptionData.isUnlimited || subscriptionData.playbooksRemaining > 0);

  // Determine seeker type based on subscription history
  const getSeekerType = () => {
    const { subscription } = subscriptionData;
    if (!subscription) {return 'fresh';}

    const hasTrialHistory = subscription.trial_start_date && subscription.trial_end_date;
    const hasPaidHistory = subscription.subscription_start_date;

    if (hasPaidHistory) {
      return 'cancelled_subscription'; // Had paid plan, now cancelled
    } else if (hasTrialHistory) {
      return 'expired_trial'; // Used trial, didn't convert
    } else {
      return 'fresh'; // Never tried trial
    }
  };

  const getSeekerDisplayText = () => {
    const seekerType = getSeekerType();

    switch (seekerType) {
      case 'fresh':
        return 'No Playbooks'; // Never had access to playbooks
      case 'expired_trial':
        return 'No Playbooks Remaining'; // Had access during trial
      case 'cancelled_subscription':
        return 'No Playbooks Remaining'; // Had access with paid plan
      default:
        return 'No Playbooks'; // Default to no access message
    }
  };

  const getTierDisplayName = (subscription: any) => {
    // Use subscription_display_name if available (e.g., "siFia Spark Trial")
    if (subscription?.subscription_display_name) {

      return subscription.subscription_display_name;
    }

    // Fallback to tier-based logic
    const tier = subscription?.tier;
    const chosenTier = subscription?.trial_chosen_tier;

    // Handle trial display logic with chosen tier
    if (tier === 'free_trial' && chosenTier) {
      const tierName = chosenTier.charAt(0).toUpperCase() + chosenTier.slice(1);

      return `siFia ${tierName} Trial`;
    } else if (tier === 'free_trial') {
      return 'siFia Trial';
    }

    // Handle other tier displays using consistent naming
    const tierDisplayMap: Record<string, string> = {
      'seeker': 'siFia Seeker',
      'spark': 'siFia Spark',
      'growth': 'siFia Growth',
      'transformation': 'siFia Transformation',
      'family': 'siFia Family',
    };

    const displayName = tierDisplayMap[tier] || tier?.replace('_', ' ') || 'siFia Seeker';

    return displayName;
  };

  // const userId = user?.id; // Unused, commented out
  const fullName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userName = fullName.split(' ')[0] || 'User';

  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(6)).current;
  const headerTranslateY = useRef(new Animated.Value(isPad && isLandscape ? -50 : -16)).current; // Adjusted iPad landscape position
  const headerScale = useRef(new Animated.Value(0.45)).current;
  const headerIntroOpacity = useRef(new Animated.Value(0.8)).current; // Start visible but with subtle fade-in
  const askBoxTranslateY = useRef(new Animated.Value(16)).current;
  const askBoxOpacity = useRef(new Animated.Value(0)).current;
  const autoFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simple chat input - no complex height calculations needed

  // Intro animation when screen first opens
  useEffect(() => {
    // Skip animation if editing existing text - show immediately
    if (route.params?.initialText) {
      headerTranslateY.setValue(isPad && isLandscape ? 20 : 0);
      headerIntroOpacity.setValue(1);
      askBoxOpacity.setValue(1);
      askBoxTranslateY.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.delay(220), // small delay to let modal finish sliding
      Animated.parallel([
        Animated.timing(
          headerTranslateY,
          { toValue: isPad && isLandscape ? 20 : 0, duration: 320, useNativeDriver: true }
        ),
        // Keep opacity animation for smoothness, but start from 0.8 to 1
        Animated.timing(headerIntroOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(askBoxOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(askBoxTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, [askBoxOpacity, askBoxTranslateY, headerIntroOpacity, headerTranslateY, isLandscape, isPad, route.params?.initialText]);
  const handleFocus = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 2,
      duration: 120,
      useNativeDriver: false,
    }).start();
    // Animate logo position when keyboard opens
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: isPad && isLandscape ? 45 : 25,
        useNativeDriver: true,
        stiffness: 180,
        damping: 18,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
      ]).start(() => setShowTooltip(false));
    }
  };
  const handleBlur = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 1,
      duration: 120,
      useNativeDriver: false,
    }).start();
    // Return logo to original position when keyboard closes
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: isPad && isLandscape ? 15 : 0,
        useNativeDriver: true,
        stiffness: 200,
        damping: 20,
        mass: 0.9,
      }),
      Animated.timing(headerScale, {
        toValue: 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButton = () => {
    // Simple button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Use the real generatePlaybook from the API service
  // Remove the local mock implementation.

  const handleInputChange = (text: string) => {
    if (text.length > MAX_USER_INPUT_LENGTH) {
      text = text.slice(0, MAX_USER_INPUT_LENGTH);
    }
    setUserInput(text);
  };

  const handleGeneratePlaybook = async () => {
    try { triggerLightHaptic(); } catch {}
    animateButton();

    if (!userInput.trim()) {
      // Show error animation
      Animated.sequence([
        Animated.timing(inputBorderWidth, {
          toValue: 2,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(inputBorderWidth, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
      // Input validation - could show inline error instead of alert

      return;
    }

    // Check subscription access before proceeding
    if (!canGeneratePlaybook) {
      const { subscription, playbooksRemaining, isSeeker } = subscriptionData;

      if (isSeeker) {
        // Navigate directly to sales offer screen - no alerts
        (navigation as any).navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: 'seeker',
          skipNotificationPreference: true,
          source: 'user_input_seeker_limit',
          feature: 'playbooks',
        });
      } else if (playbooksRemaining === 0) {
        // Navigate to sales offer for usage limit reached
        (navigation as any).navigate('OnboardingSalesOffer', {
          upgradeMode: true,
          currentTier: subscription?.tier || 'seeker',
          skipNotificationPreference: true,
          source: 'user_input_usage_limit',
          feature: 'playbooks',
        });
      }
      return;
    }

    // ENTERPRISE: Check rate limiting before generation
    if (user?.id && subscriptionData?.subscription?.tier) {
      try {
        const tier = subscriptionData.subscription.tier as SubscriptionTier;
        const rateLimitCheck = await checkAndRecordRequest(user.id, tier, 'playbook');

        if (!rateLimitCheck.allowed) {
          // Show user-friendly rate limit message
          Alert.alert(
            'Please Wait',
            rateLimitCheck.message || 'Please wait before generating another playbook.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      } catch (rateLimitError) {
        // If rate limiting fails, log but don't block the user
        Logger.warn('Rate limiting check failed', { errorMessage: String(rateLimitError) });
        // Continue with generation - better UX than crashing
      }
    }

    // Navigate directly to GeneratingPlaybookScreen - it will handle the generation and usage tracking
    navigation.navigate('GeneratingPlaybook', {
      userInput,
      userName: userName || 'Friend',
    });

    // Clear draft after successful navigation (generation will handle clearing input on success)
    // Note: Draft is preserved if generation fails, so user can try again
};

  const handleInputPress = () => {
    inputRef.current?.focus();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(tooltipTranslateY, { toValue: 6, duration: 120, useNativeDriver: true }),
      ]).start(() => setShowTooltip(false));
    }
  };

  const handleNavigationToggle = () => {
    try { triggerLightHaptic(); } catch {}
    setShowNavigation(!showNavigation);
    Animated.spring(navButtonAnim, {
      toValue: showNavigation ? 0 : 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const onPressHint = () => {
    try { triggerLightHaptic(); } catch {}
    setShowTooltip((v) => {
      const next = !v;
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
  };

  // Rely on KeyboardAvoidingView for precise avoidance; no manual listeners

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: insets.bottom || 0, android: 0 })}
        style={styles.container}
      >
        <View style={[styles.content, isPad && isLandscape && styles.contentLandscape]}>
          {/* Expandable navigation bar */}
          <Animated.View style={[styles.navButtonContainer, { transform: [{ rotate: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }]}>
            <TouchableOpacity
              onPress={handleNavigationToggle}
              style={styles.navButton}
              activeOpacity={0.8}
            >
              <Ionicons name="ellipsis-horizontal-outline" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </Animated.View>

          {/* Navigation icons when expanded */}
          <Animated.View style={[styles.expandedNavContainer, { opacity: navButtonAnim, transform: [{ translateX: navButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
            <TouchableOpacity style={styles.navIconItem} onPress={() => navigation.navigate('MainTabs')}>
              <MaterialIcons name="space-dashboard" size={24} color={theme.colors.anchorBlueLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navIconItem} onPress={() => navigation.navigate('MainTabs')}>
              <MaterialCommunityIcons name="clipboard-text-play" size={24} color={theme.colors.anchorBlueLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navIconItem} onPress={() => navigation.navigate('MainTabs')}>
              <MaterialCommunityIcons name="book" size={26} color={theme.colors.anchorBlueLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navIconItem} onPress={() => navigation.navigate('MainTabs')}>
              <MaterialCommunityIcons name="notebook-edit" size={24} color={theme.colors.anchorBlueLight} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.header, { transform: [{ translateY: headerTranslateY }] }]}>
            <Animated.Image source={require('../../assets/icons/siFia-logo-white.png')} style={[styles.logo, { opacity: headerIntroOpacity, transform: [{ scale: headerScale }] }]} resizeMode="contain" />
            <Animated.Text style={[styles.questionText, font, { opacity: askBoxOpacity, transform: [{ translateY: askBoxTranslateY }] }]}>
              {placeholderText}
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Fixed footer input anchored to safe area */}
        <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 20 }]}>
          <View style={styles.inputContainer}>
            <Animated.View style={[{ opacity: askBoxOpacity, transform: [{ translateY: askBoxTranslateY }] }]}>
              <View style={styles.askWrapper}>
                <Animated.View style={[styles.askBox, { borderWidth: inputBorderWidth }]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.askInput, font]}
                    placeholder="Create a Playbook with siFia"
                    placeholderTextColor={'rgba(255,255,255,0.7)'}
                    value={userInput}
                    onChangeText={handleInputChange}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={true}
                    autoCapitalize="sentences"
                    keyboardAppearance="dark"
                    underlineColorAndroid="transparent"
                    autoCorrect={true}
                    autoFocus={false}
                    onTouchStart={handleInputPress}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    blurOnSubmit={false}
                  />
                  {/* Bottom row overlays: status on left, buttons on right */}
                  <View style={styles.bottomRow} pointerEvents="box-none">
                    {!subscriptionData.isUnlimited && (
                      <View style={styles.statusInlineWithMinWidth} pointerEvents="none">
                        <Text style={[styles.statusText, font]} numberOfLines={1} ellipsizeMode="tail">
                          {subscriptionData.isLoading
                            ? 'Loading subscription...'
                            : !subscriptionData.subscription || subscriptionData.isSeeker
                              ? getSeekerDisplayText()
                              : subscriptionData.playbooksRemaining === 0
                                ? 'No Playbooks Remaining'
                                : `${subscriptionData.playbooksRemaining} of ${subscriptionData.subscription?.playbooks_limit || 0} Playbooks Remaining`}
                        </Text>
                        <Text style={[styles.tierBadgeInline, font]} numberOfLines={1} ellipsizeMode="tail">
                          {getTierDisplayName(subscriptionData.subscription)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.actionsRight}>
                      <View style={styles.charCounterWrapper}>
                        <Text style={[styles.charCounterText, font]}>
                          {userInput.length}/{MAX_USER_INPUT_LENGTH}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={onPressHint}
                        activeOpacity={0.9}
                        style={[styles.askHintButton, !showTooltip && styles.disabledButton]}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialCommunityIcons
                          name="information"
                          size={34}
                          color={showTooltip ? Colors.alertCoral : 'rgba(255, 255, 255, 0.5)'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.askSendButton, (!userInput || !userInput.trim()) && styles.disabledButton]}
                        onPress={handleGeneratePlaybook}
                        disabled={!userInput || !userInput.trim()}
                      >
                        <Ionicons
                          name="arrow-up-circle"
                          size={34}
                          color={userInput.trim() ? Colors.hopeWhite : 'rgba(255, 255, 255, 0.5)'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
                {/* Tooltip anchored above hint icon; placed outside askBox to avoid clipping */}
                {showTooltip && (
                  <Animated.View style={[styles.tooltip, { opacity: tooltipOpacity, transform: [{ translateY: tooltipTranslateY }] }]} pointerEvents="box-none">
                    <Text style={[styles.tooltipKicker, font]}>How siFia can help</Text>
                    <Text style={[styles.tooltipTitle, font]}>You don't need to explain everything perfectly.</Text>
                    <Text style={[styles.tooltipTitleSpaced, font]}>Just share what feels important right now.</Text>
                    <Text style={[styles.tooltipSubtitle, font]}>If it helps, you can mention:</Text>
                    <View style={styles.tooltipList}>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>1</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>What just happened</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>2</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>What feels heavy or unclear</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>3</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A situation you’re sitting with</Text>
                      </View>
                      <View style={styles.tooltipItemRow}>
                        <View style={styles.tooltipBadge}><Text style={[styles.tooltipBadgeText, font]}>4</Text></View>
                        <Text style={[styles.tooltipItemText, font]}>A decision you don’t know how to respond to yet</Text>
                      </View>
                    </View>
                    <Text style={[styles.tooltipFooter, font]}>siFia will help you slow down and shape this into a playbook.</Text>
                    <View style={styles.tooltipCaret} />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingBottom: 0,
  },
  // Inline status inside ask box
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 1,
    maxWidth: '75%',
    overflow: 'hidden',
  },
  statusInlineWithMinWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 1,
    maxWidth: '75%',
    minWidth: 80,
    overflow: 'hidden',
  },
  statusText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '100%',
  },
  tierBadgeInline: {
    color: Colors.hopeWhite,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 9,
    overflow: 'hidden',
    textAlign: 'center',
    maxWidth: 120,
    flexShrink: 0,
  },
  askHintButtonInline: {
    opacity: 1,
  },
  askSendButtonInline: {
    opacity: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  contentLandscape: {
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
    gap: 0,
  },
  logo: {
    width: '70%',
    height: 100,
    alignSelf: 'center',
  },
  questionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -30,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  navButtonContainer: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedNavContainer: {
    position: 'absolute',
    top: 60,
    left: 80,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    paddingHorizontal: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  navIconItem: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 38,
    height: 38,
  },
  guidanceSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  spacer: {
    flex: 0,
  },
  footer: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  inputContainer: {
    paddingBottom: 24,
    marginBottom: Platform.OS === 'ios' ? 0 : 20, // Add some bottom margin on Android
  },
  usageCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  usageText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  tierBadge: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: 100,
  },
  askWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  askBox: {
    borderRadius: 32,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 0, // Remove padding to allow seamless scrolling
    paddingBottom: 60, // Space for overlay icons
    width: '100%',
    minHeight: 60,
    position: 'relative',
    overflow: 'hidden', // Clip content at container edges
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12 as any,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  charCounterWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  charCounterText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '600',
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
    minHeight: 120,
    maxHeight: 120,
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
  askSendButton: {
    // positioned in bottomRow
  },
  askHintButton: {
    // positioned in bottomRow
  },
  tooltip: {
    position: 'absolute',
    right: 48, // align above hint icon more closely
    bottom: 62, // above icons
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
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
    right: 24, // tuned to point towards the hint icon
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.alertCoral,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  tooltipClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Slight background for better visibility
  },
  debugInfo: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  debugText: {
    color: Colors.hopeWhite,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default withErrorBoundary(UserInputScreen, 'UserInputScreen');
