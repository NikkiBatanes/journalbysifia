
// src/screens/PlaybookWalkthroughScreen.tsx
import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Dimensions,
  TextInput,
  Alert,
  DeviceEventEmitter,
  Platform,
  LayoutAnimation,
  UIManager,
  Clipboard,
  PanResponder,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from '@react-native-community/blur';

import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import ThemedTextInput from '../components/common/ThemedTextInput';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import PlaybookSkeletonLoader from '../components/PlaybookSkeletonLoader';
import SmartJournalingReflectionModal from './SmartJournalingReflectionModal';
import SmartJournalingGratitudeModal from './SmartJournalingGratitudeModal';
import SmartJournalingTimeBlockModal from './SmartJournalingTimeBlockModal';
import HowToModal from '../components/HowToModal';
import { getActionWisdom } from '../services/actionWisdomService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { pdfExportService } from '../utils/pdfExportService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useCreateJournalEntry } from '../services/hooks/useJournalData';
import { useCreateDevotionalPrayer } from '../services/hooks/usePrayerData';
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';
import { toLocalDateString } from '../utils/date';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { PDF_EXPORT_UPGRADE_PROMPT } from '../services/tierRestrictionService';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlaybook } from '../services/apiIntegration';
import { updatePlaybookStatus, updateWalkthroughProgress, updateActionStepCompleted, updatePlaybookPrayerPrayed } from '../services/supabaseApiNormalized';
import { BibleCopyrightModal } from '../components/BibleCopyrightModal';
import DevotionalModal from '../components/DevotionalModal';
import PlaybookReadyOverlay from '../components/PlaybookReadyOverlay';
import ShareDropdownModal from '../components/ShareDropdownModal';
import { refinePlaybook, type PlaybookCorrectionType } from '../services/playbookRefinementService';

import type { RootStackParamList } from '../navigation/types';
import type { ActionStep } from '../interfaces/playbook';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PlaybookWalkthrough'>;

const TOTAL_STEPS = 7;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const REFINEMENT_OPTIONS: Array<{ type: PlaybookCorrectionType; label: string }> = [
  { type: 'missing_detail', label: 'Missing important detail' },
  { type: 'wrong_assumption', label: 'Wrong assumption' },
  { type: 'explain_more', label: 'I need to explain more' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const getDirectChallengeText = (
  dc: string | { text: string; summary: string } | undefined
): string => {
  if (!dc) { return ''; }
  if (typeof dc === 'string') { return dc; }
  return dc.text || dc.summary || '';
};

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);

const USER_NAME_PLACEHOLDER_REGEX = /\[(?:User's Name|First Name|Last Name)\](?:'s|’s)?/gi;

const nameReplacementFor = (match: string): string =>
  match.endsWith("'s") || match.endsWith('’s') ? 'your' : 'you';

const capitalizeFirstLetter = (text: string): string =>
  text.replace(/^(\s*)([a-z])/, (_match, space, letter) => `${space}${letter.toUpperCase()}`);

const userNameRegex = (userName: string): RegExp | null => {
  const cleanName = userName.trim();
  if (cleanName.length < 2) {
    return null;
  }

  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}('s|’s)?\\b`, 'gi');
};

const removeUserNameReferences = (text: string, userName: string): string => {
  let processed = text.replace(USER_NAME_PLACEHOLDER_REGEX, nameReplacementFor);
  const regex = userNameRegex(userName);
  if (!regex) {
    return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
  }

  processed = processed.replace(new RegExp(`\\b${userName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s+you\\b`, 'gi'), 'you');
  processed = processed.replace(regex, nameReplacementFor);
  return capitalizeFirstLetter(processed.replace(/^you,\s+/i, '').replace(/^you\b/i, 'you'));
};

const keepOnlyOpeningUserName = (text: string, userName: string): string => {
  const cleanName = userName.trim();
  let processed = replaceAllNamePlaceholders(
    text,
    { displayName: cleanName, firstName: cleanName },
    { replaceHardcodedNames: false }
  );

  if (cleanName.length < 2) {
    return processed.replace(USER_NAME_PLACEHOLDER_REGEX, nameReplacementFor);
  }

  // Simple approach: replace all occurrences of the name after the first one with "you"
  // First, find the first occurrence and keep it
  const nameRegex = new RegExp(`\\b${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let firstMatchFound = false;

  processed = processed.replace(nameRegex, (match, _offset) => {
    if (!firstMatchFound) {
      firstMatchFound = true;
      return match; // Keep the first occurrence
    }
    return 'you'; // Replace all subsequent occurrences with "you"
  });

  processed = processed.replace(USER_NAME_PLACEHOLDER_REGEX, (match, offset) =>
    offset <= 2 ? cleanName : nameReplacementFor(match)
  );

  return processed;
};

// ─── StepFadeIn — fades + slides content up on mount ────────────────────────

interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// ─── Step 0: Enter the Moment ────────────────────────────────────────────────

interface EnterMomentProps {
  title: string;
  userInput: string;
  summary: string;
  userName: string;
  transitionLine?: string;
  onContinue: () => void;
  onEditUserInput?: () => void;
  insets: { top: number };
}

const EnterMomentStep: React.FC<EnterMomentProps> = ({
  title,
  userInput,
  summary,
  userName,
  transitionLine,
  onContinue: _onContinue,
  onEditUserInput: _onEditUserInput,
  insets,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [showUserInput, setShowUserInput] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggleUserInput = () => {
    triggerLightHaptic();
    Animated.timing(chevronAnim, {
      toValue: showUserInput ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setShowUserInput(prev => !prev);
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const personalized = keepOnlyOpeningUserName(summary, userName);
  // Cap to 2 paragraphs — this is an entry moment, not the full truth section
  const paragraphs = splitParagraphs(personalized).slice(0, 2);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered PLAYBOOK label + animated chevron */}
      <StepFadeIn delay={0}>
        <TouchableOpacity
          style={styles.playbookLabelContainer}
          onPress={toggleUserInput}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <ThemedText weight="semiBold" style={styles.playbookLabel}>
            PLAYBOOK
          </ThemedText>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
          </Animated.View>
        </TouchableOpacity>

        {/* User input card — revealed when chevron is tapped */}
        {showUserInput && (
          <TouchableOpacity
            style={styles.userInputCard}
            onLongPress={() => {
              triggerLightHaptic();
              Alert.alert(
                'Moment you shared',
                'What would you like to do?',
                [
                  {
                    text: 'Copy',
                    onPress: () => {
                      triggerLightHaptic();
                      Clipboard.setString(userInput);
                      Alert.alert('Copied', 'Moment copied to clipboard');
                    },
                  },
                  {
                    text: 'Edit',
                    onPress: () => {
                      triggerLightHaptic();
                      _onEditUserInput?.();
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ],
                { cancelable: true }
              );
            }}
            activeOpacity={0.7}
          >
            {Platform.OS === 'ios' ? (
              <TextInput
                value={userInput}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                contextMenuHidden={true}
                selectTextOnFocus={false}
                pointerEvents="none"
                textAlignVertical="top"
                style={[styles.userInputText, { fontFamily, padding: 0, margin: 0 }]}
              />
            ) : (
              <ThemedText style={styles.userInputText} selectable={false}>{userInput}</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </StepFadeIn>

      <StepFadeIn delay={80}>
        {Platform.OS === 'ios' ? (
          <TextInput
            value={title}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            style={[styles.title, { fontWeight: '500' as any, fontFamily }]}
          />
        ) : (
          <ThemedText weight="medium" style={styles.title} selectable={true}>{title}</ThemedText>
        )}
      </StepFadeIn>

      <StepFadeIn delay={160} style={{ marginTop: 40 }}>
        {paragraphs.map((paragraph, index) => (
          Platform.OS === 'ios' ? (
            <TextInput
              key={index}
              value={paragraph}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.summaryLead, (index === 1 || index === 2) && { fontSize: 16 }, index === 1 && { marginBottom: 4 }, index === 0 && { fontWeight: '600' as any }, { fontFamily }]}
            />
          ) : (
            <ThemedText key={index} style={[styles.summaryLead, (index === 1 || index === 2) && { fontSize: 16 }, index === 1 && { marginBottom: 4 }]} weight={index === 0 ? 'semiBold' : undefined} selectable={true}>
              {paragraph}
            </ThemedText>
          )
        ))}
      </StepFadeIn>

      {transitionLine ? (
        <StepFadeIn delay={500} style={styles.transitionLineContainer}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={transitionLine}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.transitionLineText, { fontFamily }]}
            />
          ) : (
            <ThemedText style={styles.transitionLineText} selectable={true}>{transitionLine}</ThemedText>
          )}
        </StepFadeIn>
      ) : null}

    </ScrollView>
  );
};

// ─── Step 1: Truth in Love ───────────────────────────────────────────────────

interface TruthStepProps {
  text: string;
  userName: string;
  onNext: () => void;
  insets: { top: number; bottom: number };
}

const TRUTH_PREVIEW_COUNT = 2; // paragraphs visible before "Read more"
const MAX_PARAGRAPH_LENGTH = 300; // Maximum characters for paragraphs when collapsed

const TruthInLoveStep: React.FC<TruthStepProps> = ({
  text,
  userName,
  onNext: _onNext,
  insets,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const personalized = removeUserNameReferences(text, userName);
  const paragraphs = splitParagraphs(personalized);
  const [expanded, setExpanded] = useState(false);
  const hasMore = paragraphs.length > TRUTH_PREVIEW_COUNT;

  // Truncate paragraphs when collapsed to prevent overlap with buttons
  const visible = expanded || !hasMore ? paragraphs : paragraphs.slice(0, TRUTH_PREVIEW_COUNT).map((para, index) => {
    if (index === TRUTH_PREVIEW_COUNT - 1 && para.length > MAX_PARAGRAPH_LENGTH) {
      return para.substring(0, MAX_PARAGRAPH_LENGTH).trim() + '...';
    }
    return para;
  });

  const readMoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasMore && !expanded) {
      Animated.spring(readMoreAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 600,
        useNativeDriver: true,
      }).start();
    } else {
      readMoreAnim.setValue(0);
    }
  }, [hasMore, expanded, readMoreAnim]);

  return (
    <>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="heart" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Truth in Love
          </ThemedText>
        </StepFadeIn>

        <View style={styles.textBlock}>
          {visible.map((para, i) => (
            <StepFadeIn key={i} delay={100 + (i * 80)}>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={para}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.bodyText, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.bodyText} selectable={true}>{para}</ThemedText>
              )}
            </StepFadeIn>
          ))}
        </View>
      </ScrollView>

      {/* Floating "Read more" pill — only visible when collapsed */}
      {hasMore && !expanded && (
        <Animated.View
          style={[
            styles.prayerActionButtonFloating,
            { bottom: insets.bottom + 20 },
            {
              opacity: readMoreAnim,
              transform: [
                {
                  scale: readMoreAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => { triggerLightHaptic(); setExpanded(true); }}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons name="chevron-down" size={16} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.prayerActionText}>
              Read more
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

interface FloatingRefinementControlProps {
  active: boolean;
  refinementsRemaining: number;
  isRefining: boolean;
  insets: { bottom: number };
  onRefineSubmit: (correctionType: PlaybookCorrectionType, clarification: string) => Promise<boolean>;
  onUpgradeNeeded: () => void;
}

const FloatingRefinementControl: React.FC<FloatingRefinementControlProps> = ({
  active,
  refinementsRemaining,
  isRefining,
  insets,
  onRefineSubmit,
  onUpgradeNeeded,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [visible, setVisible] = useState(false);
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [selectedRefinementType, setSelectedRefinementType] = useState<PlaybookCorrectionType | null>(null);
  const [refinementText, setRefinementText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const refiningAnim = useRef(new Animated.Value(1)).current;
  const [dotIndex, setDotIndex] = useState(0);
  const selectedOption = REFINEMENT_OPTIONS.find(option => option.type === selectedRefinementType);
  const canShowButton = active;
  const bottomOffset = insets.bottom + 20;
  const keyboardLift = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom - 12) : 0;
  const panelGap = keyboardHeight > 0 ? 10 : 56;
  const panelWidth = Math.min(SCREEN_WIDTH - 40, 360);
  const panelMaxHeight = keyboardHeight > 0
    ? Math.max(260, SCREEN_HEIGHT - keyboardHeight - 72)
    : SCREEN_HEIGHT - bottomOffset - 100;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (canShowButton) {
      revealAnim.setValue(0);
      setVisible(false);
      timeout = setTimeout(() => {
        setVisible(true);
        Animated.spring(revealAnim, {
          toValue: 1,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }).start();
      }, 3000);
    } else {
      setVisible(false);
      setRefinementOpen(false);
      setSelectedRefinementType(null);
      setRefinementText('');
      revealAnim.setValue(0);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [canShowButton, revealAnim]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(refiningAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(refiningAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    if (isRefining) {
      animation.start();
    } else {
      animation.stop();
      refiningAnim.setValue(1);
    }

    return () => {
      animation.stop();
    };
  }, [isRefining, refiningAnim]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isRefining) {
      interval = setInterval(() => {
        setDotIndex(prev => (prev + 1) % 3);
      }, 500);
    } else {
      setDotIndex(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRefining]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (selectedRefinementType && inputRef.current) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedRefinementType]);

  const handleToggle = () => {
    triggerLightHaptic();
    if (isRefining) {
      return;
    }

    if (refinementsRemaining === 0) {
      onUpgradeNeeded();
      return;
    }

    setRefinementOpen(prev => {
      const next = !prev;
      if (!next) {
        setSelectedRefinementType(null);
        setRefinementText('');
      }
      return next;
    });
  };

  const handleCloseRefinement = () => {
    if (isRefining) {
      return;
    }

    triggerLightHaptic();
    Keyboard.dismiss();
    setRefinementOpen(false);
    setSelectedRefinementType(null);
    setRefinementText('');
  };

  const handleReasonPress = (type: PlaybookCorrectionType) => {
    triggerLightHaptic();
    setSelectedRefinementType(type);
  };

  const handleSubmit = async () => {
    if (!selectedRefinementType || isRefining) {
      return;
    }

    triggerMediumHaptic();
    const refined = await onRefineSubmit(selectedRefinementType, refinementText);
    if (refined) {
      setRefinementOpen(false);
      setSelectedRefinementType(null);
      setRefinementText('');
    }
  };

  if (!visible || !canShowButton) {
    return null;
  }

  return (
    <>
      {refinementOpen ? (
        <TouchableOpacity
          style={styles.refinementBackdrop}
          activeOpacity={1}
          onPress={handleCloseRefinement}
          disabled={isRefining}
        >
          <BlurView
            style={styles.refinementBackdropBlur}
            blurType="dark"
            blurAmount={9}
            reducedTransparencyFallbackColor="rgba(0,0,0,0.58)"
          />
          <View style={styles.refinementBackdropTint} />
        </TouchableOpacity>
      ) : null}

      {refinementOpen ? (
        <Animated.View
          style={[
            styles.floatingRefinementPanel,
            {
              bottom: bottomOffset + panelGap + keyboardLift,
              width: panelWidth,
              maxHeight: panelMaxHeight,
              opacity: revealAnim,
              transform: [
                {
                  translateY: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.floatingRefinementReasons}>
              {REFINEMENT_OPTIONS.map((option, index) => {
                const selected = selectedRefinementType === option.type;
                return (
                  <StepFadeIn key={option.type} delay={index * 45}>
                    <TouchableOpacity
                      style={[styles.refinementReasonButton, selected && styles.refinementReasonButtonSelected]}
                      onPress={() => handleReasonPress(option.type)}
                      activeOpacity={0.82}
                      disabled={isRefining}
                    >
                      <ThemedText weight={selected ? 'semiBold' : 'regular'} style={[styles.refinementReasonText, selected && styles.refinementReasonTextSelected]}>
                        {option.label}
                      </ThemedText>
                      {selected ? (
                        <Ionicons name="checkmark" size={16} color={Colors.hopeWhite} />
                      ) : null}
                    </TouchableOpacity>
                  </StepFadeIn>
                );
              })}
            </View>

            {selectedRefinementType ? (
              <StepFadeIn delay={260} style={styles.refinementFloatingInputBlock}>
                <TextInput
                  ref={inputRef}
                  value={refinementText}
                  onChangeText={setRefinementText}
                  editable={!isRefining}
                  multiline
                  placeholder={`What should siFia understand about "${selectedOption?.label || 'this'}"?`}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardAppearance="dark"
                  textAlignVertical="top"
                  autoFocus
                  style={[styles.refinementInput, { fontFamily }]}
                />

                <TouchableOpacity
                  style={[styles.refinementSubmitButton, (!refinementText.trim() || isRefining) && styles.refinementSubmitButtonDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.82}
                  disabled={!refinementText.trim() || isRefining}
                >
                  {isRefining ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Animated.Text
                        style={[styles.refinementSubmitButtonText, { opacity: refiningAnim, fontFamily, fontWeight: '500' }]}
                      >
                        Refining
                      </Animated.Text>
                      <Animated.Text
                        style={[styles.refinementSubmitButtonText, { opacity: refiningAnim, fontFamily, width: 20, textAlign: 'left', fontWeight: '500' }]}
                      >
                        {'.'.repeat(dotIndex + 1)}
                      </Animated.Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color={Colors.hopeWhite} />
                      <ThemedText weight="semiBold" style={styles.refinementSubmitButtonText}>Refine Playbook</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </StepFadeIn>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}

      {keyboardHeight === 0 ? (
        <Animated.View
          style={[
            styles.floatingRefinementButtonWrap,
            {
              bottom: bottomOffset,
              opacity: revealAnim,
              transform: [
                {
                  scale: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.floatingRefinementButton, refinementOpen && styles.floatingRefinementButtonOpen]}
            onPress={handleToggle}
            activeOpacity={0.82}
            disabled={isRefining}
          >
            <Ionicons name="refresh-outline" size={15} color="rgba(255,255,255,0.9)" />
            {refinementsRemaining > 0 && (
              <View style={styles.refinementCountBadge}>
                <ThemedText weight="semiBold" style={styles.refinementCountBadgeText}>
                  {refinementsRemaining === Number.MAX_SAFE_INTEGER ? '∞' : refinementsRemaining}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </>
  );
};

// ─── Step 2: Scripture Anchor ────────────────────────────────────────────────

interface ScriptureStepProps {
  reference: string;
  text: string;
  version?: string;
  reflection?: string;
  onNext: () => void;
  insets: { top: number };
}

const ScriptureAnchorStep: React.FC<ScriptureStepProps> = ({ reference, text, version, reflection, onNext: _onNext, insets }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [showCopyright, setShowCopyright] = useState(false);
  const reflectionLines = reflection ? splitParagraphs(reflection) : [];

  return (
    <View style={[styles.stepScroll, styles.stepContent, { paddingTop: insets.top + 8 }]}>
      <StepFadeIn delay={0} style={styles.stepLabelRow}>
        <MaterialCommunityIcons name="script-text" size={18} color={Colors.alertCoral} />
        <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
          Scripture to Anchor
        </ThemedText>
      </StepFadeIn>

      {/* Verse card */}
      <StepFadeIn delay={100} style={styles.verseCard}>
        <View style={styles.verseRefRow}>
          <Ionicons name="book-outline" size={13} color={Colors.alertCoral} />
          {Platform.OS === 'ios' ? (
            <TextInput
              value={reference}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.scriptureRef, { fontWeight: '600' as any, fontFamily }]}
            />
          ) : (
            <ThemedText weight="semiBold" style={styles.scriptureRef} selectable={true}>
              {reference}
            </ThemedText>
          )}
          <View style={styles.versionAndInfoRow}>
            {version ? (
              <View style={styles.versionBadge}>
                {Platform.OS === 'ios' ? (
                  <TextInput
                    value={version.toUpperCase()}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.versionText, { fontWeight: '600' as any, fontFamily }]}
                  />
                ) : (
                  <ThemedText weight="semiBold" style={styles.versionText} selectable={true}>
                    {version.toUpperCase()}
                  </ThemedText>
                )}
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => { triggerLightHaptic(); setShowCopyright(true); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: -4 }}
            >
              <Ionicons name="information-circle-outline" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
        {Platform.OS === 'ios' ? (
          <TextInput
            value={`"${text}"`}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            style={[styles.scriptureText, { fontWeight: '500' as any, fontFamily }]}
          />
        ) : (
          <ThemedText weight="medium" style={styles.scriptureText} selectable={true}>
            "{text}"
          </ThemedText>
        )}
      </StepFadeIn>

      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={version || 'NASB'}
      />

      <View style={[styles.reflectionBlock, { marginLeft: 12 }]}>
        {reflectionLines.map((line, i) => (
          <StepFadeIn key={i} delay={190 + i * 60}>
            <View style={styles.completionActionItem}>
              <View style={[styles.completionActionCircle, { width: 22, height: 22, borderRadius: 11 }]}>
                <Ionicons name="sparkles" size={11} color={Colors.alertCoral} />
              </View>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={line}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.completionActionLine, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.completionActionLine} selectable={true}>
                  {line}
                </ThemedText>
              )}
            </View>
          </StepFadeIn>
        ))}
      </View>

      <View style={{ height: 80 }} />
    </View>
  );
};

// ─── Step 3: Faithful Actions ────────────────────────────────────────────────

// ─── Smart body-line detection ───────────────────────────────────────────────

type BodyLineType = 'intro' | 'quote' | 'choice' | 'bullet' | 'body';

interface BodyLine {
  text: string;
  type: BodyLineType;
}

function detectBodyLines(lines: string[], actionType: string): BodyLine[] {
  return lines.map((raw, idx) => {
    const line = raw.trim();

    // Bullet items from Format B/D — lines starting with '* '
    if (/^\* /.test(line)) {
      return { text: line.replace(/^\* /, '').trim(), type: 'bullet' };
    }

    // Intro / label line ending with colon — check BEFORE quote detection
    // so lines like "'Stop' doing this:" are treated as intro, not quote
    if (line.endsWith(':') && line.length < 90) {
      return { text: line, type: 'intro' };
    }

    // Quoted text — only double-quote chars, NOT single quotes.
    // Single quotes wrap emphasis words (e.g. 'Stop') and must not be treated as quotes.
    if (/^["\u201C\u201D]/.test(line)) {
      return { text: line, type: 'quote' };
    }

    // For 'choose' type: candidate list items are short, not the first line, no trailing period
    if (
      actionType === 'choose' &&
      idx > 0 &&
      line.length < 42 &&
      !line.endsWith('.') &&
      !line.endsWith('?') &&
      !line.endsWith(':')
    ) {
      return { text: line, type: 'choice' };
    }

    return { text: line, type: 'body' };
  });
}

function cleanWisdomDisplayText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .trim();
}

function isWisdomLeadInLine(value: string): boolean {
  return /^(?:here\s+(?:are|is)|these\s+are|some\s+(?:examples|actionable\s+steps)|actionable\s+steps|examples)(?:\s+are|\s+is)?[\w\s,'-]*:?$/i.test(value.trim());
}


function isWisdomOutroLine(value: string): boolean {
  return /^(?:remember|as you|this simple|these steps|by doing|through this|over time|with each|even small|start small|you can|may this|let this|trust that)\b/i.test(value.trim());
}

function splitWisdomItemTitle(value: string): { title: string; body: string } | null {
  const match = value.match(/^([^:]{3,64}):\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    title: match[1].trim(),
    body: match[2].trim(),
  };
}

function parseWisdomText(text?: string): { intro: string; items: string[]; blocks: Array<{ intro: string; items: string[]; outro: string }> } {
  if (!text?.trim()) {
    return { intro: '', items: [], blocks: [] };
  }

  if (text.includes('--- siFia wisdom response ---')) {
    const parsedBlocks = text
      .split(/--- siFia wisdom response ---/g)
      .map(block => parseWisdomText(block.trim()).blocks)
      .flat()
      .filter(block => block.intro || block.items.length > 0 || block.outro);
    return {
      intro: parsedBlocks.map(block => block.intro).filter(Boolean).join('\n\n'),
      items: parsedBlocks.flatMap(block => block.items),
      blocks: parsedBlocks,
    };
  }

  const lines = text
    .split(/\n+/)
    .map(line => cleanWisdomDisplayText(line))
    .filter(Boolean);
  const listStartIndex = lines.findIndex(line => /^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/.test(line));

  if (listStartIndex === -1) {
    const intro = cleanWisdomDisplayText(text);
    return { intro, items: [], blocks: intro ? [{ intro, items: [], outro: '' }] : [] };
  }

  const blocks: Array<{ intro: string; items: string[]; outro: string }> = [];
  let currentIntroLines = lines.slice(0, listStartIndex);
  let currentItems: string[] = [];
  let currentOutroLines: string[] = [];
  const items: string[] = [];

  const pushCurrentBlock = () => {
    const intro = currentIntroLines.join('\n\n');
    const outro = currentOutroLines.join('\n\n');
    if (intro || currentItems.length > 0 || outro) {
      blocks.push({ intro, items: currentItems, outro });
    }
    currentIntroLines = [];
    currentItems = [];
    currentOutroLines = [];
  };

  lines.slice(listStartIndex).forEach(line => {
    const isListLine = /^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/.test(line);

    if (!isListLine) {
      if (currentItems.length > 0) {
        currentOutroLines.push(line);
      } else {
        currentIntroLines.push(line);
      }
      return;
    }

    const item = cleanWisdomDisplayText(line.replace(/^(?:\d+(?:\.\d+)?[.)]|[-*•])\s+/, ''));
    if (!item) {
      return;
    }

    if (isWisdomLeadInLine(item)) {
      if (currentItems.length > 0) {
        currentOutroLines.push(item);
        return;
      }
      currentIntroLines.push(item);
      return;
    }
    if (currentItems.length > 0 && isWisdomOutroLine(item)) {
      currentOutroLines.push(item);
      return;
    }
    if (currentItems.length >= 3 && !splitWisdomItemTitle(item)) {
      currentOutroLines.push(item);
      return;
    }
    currentItems.push(item);
    items.push(item);
  });
  pushCurrentBlock();

  return {
    intro: blocks.map(block => block.intro).filter(Boolean).join('\n\n'),
    items,
    blocks,
  };
}

interface FaithfulActionsStepProps {
  steps: ActionStep[];
  intro?: string;
  playbookId?: string;
  playbookTitle?: string;
  playbookStatus?: string;
  userId: string;
  onNext: () => void;
  onGoBack?: () => void;
  insets: { top: number; bottom: number };
  actionStepIndex: number;
  setActionStepIndex: (index: number) => void;
  onStepCommit?: (stepIndex: number) => void;
  onJournalExpanded?: (expanded: boolean) => void;
  onJournalCollapseComplete?: () => void;
  navigation?: any;
  collapseAnimRef?: React.RefObject<Animated.Value>;
}

type JournalModalType = 'reflection' | 'prayer' | 'gratitude' | 'timeblock' | null;

// Module-level flag — persists across remounts so the nudge only fires once per session
let journalNudgeFired = false;

// Module-level committed steps — persists across remounts within the same playbook session
let persistedCommittedSteps: Record<number, boolean> = {};
let persistedActionStepIndex = 0;
let persistedPlaybookId: string | undefined;
let persistedHasPrayed = false;
let persistedHasRead = false;
let persistedCompletionChoice: string | null = null;

// ─── AsyncStorage session persistence ───────────────────────────────────────
// Saves module-level vars to AsyncStorage so state survives Metro hot reloads
// and full navigation exits.

const getSessionKey = (id: string) => `playbook_session_${id}`;

const saveCurrentSession = () => {
  if (!persistedPlaybookId) { return; }
  AsyncStorage.setItem(
    getSessionKey(persistedPlaybookId),
    JSON.stringify({
      committedSteps: persistedCommittedSteps,
      actionStepIndex: persistedActionStepIndex,
      hasPrayed: persistedHasPrayed,
      hasRead: persistedHasRead,
      completionChoice: persistedCompletionChoice,
    })
  ).catch(() => {});
};

const clearSessionStorage = (id: string) => {
  AsyncStorage.removeItem(getSessionKey(id)).catch(() => {});
};

const JOURNAL_ICONS: { type: Exclude<JournalModalType, null>; icon: string; color: string; label: string }[] = [
  { type: 'reflection', icon: 'feather', color: Colors.faithGold, label: 'Journal' },
  { type: 'prayer', icon: 'hands-pray', color: '#87CEEB', label: 'Pray' },
  { type: 'gratitude', icon: 'heart', color: Colors.alertCoral, label: 'Gratitude' },
  { type: 'timeblock', icon: 'clock', color: Colors.growthGreen, label: 'Schedule' },
];

type WisdomThreadEntry = {
  question: string;
  wisdom: string;
};

let persistedWisdomThreads: Record<string, WisdomThreadEntry[]> = {};

const serializeWisdomThread = (thread: WisdomThreadEntry[]): string =>
  thread
    .filter(entry => entry.question.trim() && entry.wisdom.trim())
    .map(entry => `User: ${entry.question.trim()}\nsiFia: ${entry.wisdom.trim()}`)
    .join('\n\n');

const parseWisdomThread = (value: string): WisdomThreadEntry[] => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const matches = [...trimmed.matchAll(/User:\s*([\s\S]*?)\nsiFia:\s*([\s\S]*?)(?=\n\nUser:|$)/g)];
  if (!matches.length) {
    return [];
  }

  return matches
    .map(match => ({
      question: match[1].trim(),
      wisdom: match[2].trim(),
    }))
    .filter(entry => entry.question && entry.wisdom);
};

const getDisplayWisdomThread = (currentWisdom: string, restoredThread: WisdomThreadEntry[]): WisdomThreadEntry[] => {
  const parsedThread = parseWisdomThread(currentWisdom);
  if (parsedThread.length > 0) {
    return parsedThread;
  }

  if (restoredThread.length > 0) {
    return restoredThread;
  }

  const legacyWisdom = currentWisdom.trim();
  return legacyWisdom
    ? [{ question: '', wisdom: legacyWisdom }]
    : [];
};

const FaithfulActionsStep: React.FC<FaithfulActionsStepProps> = ({
  steps,
  intro,
  playbookId,
  playbookTitle,
  playbookStatus,
  userId,
  onNext,
  onGoBack,
  insets,
  actionStepIndex,
  setActionStepIndex,
  onStepCommit,
  onJournalExpanded,
  onJournalCollapseComplete,
  navigation,
  collapseAnimRef,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [committedSteps, setCommittedSteps] = useState<Record<number, boolean>>(persistedCommittedSteps);
  const [journalText, setJournalText] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [activeJournalModal, setActiveJournalModal] = useState<JournalModalType>(null);
  const [, setJournalExpanded] = useState(false);
  const [howToModalVisible, setHowToModalVisible] = useState(false);
  const [wisdomCount, setWisdomCount] = useState(0);
  const [wisdomLimit, setWisdomLimit] = useState(0);
  const [currentActionWisdom, setCurrentActionWisdom] = useState('');
  const [wisdomThread, setWisdomThread] = useState<WisdomThreadEntry[]>([]);
  const [wisdomExpanded, setWisdomExpanded] = useState(true);
  const createPrayerMutation = useCreateDevotionalPrayer();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const triggerRotation = useRef(new Animated.Value(0)).current;
  const triggerScale = useRef(new Animated.Value(1)).current;
  const iconAnims = useRef(JOURNAL_ICONS.map(() => new Animated.Value(0))).current;
  const rowHeight = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(0)).current;
  const howToButtonAnim = useRef(new Animated.Value(0)).current;
  const wisdomChevronAnim = useRef(new Animated.Value(0)).current;
  // Ref tracks real expanded state to avoid stale closure in toggle
  const journalExpandedRef = useRef(false);
  // Tracks all timers spawned by the auto-nudge so they can be cancelled on unmount
  const nudgeTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const collapseAnimFallback = useRef(new Animated.Value(0)).current;
  const collapseAnim = collapseAnimRef?.current || collapseAnimFallback;
  const lastScrollYRef = useRef(0);
  const fabBarHiddenRef = useRef(false);
  const scrollViewRef = useRef<any>(null);
  const [fabCollapsed, setFabCollapsed] = React.useState(false);

  const ICON_ROW_HEIGHT = 76; // circle 44 + label ~14 + gap 5 + padding 12

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const loadWisdomUsage = React.useCallback(() => {
    if (user?.id) {
      NewSubscriptionService.getUserSubscription(user.id).then(subscription => {
        const limits = NewSubscriptionService.getTierLimits(subscription.tier, subscription);
        setWisdomCount((subscription as any).wisdom_count || 0);
        setWisdomLimit(limits.wisdom_limit ?? 0);
      });
    }
  }, [user?.id]);

  // Load wisdom counts
  React.useEffect(() => {
    loadWisdomUsage();
  }, [loadWisdomUsage]);

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('wisdomUsageReset', (payload?: { wisdomCount?: number; wisdomLimit?: number }) => {
      setWisdomCount(payload?.wisdomCount ?? 0);
      if (typeof payload?.wisdomLimit === 'number') {
        setWisdomLimit(payload.wisdomLimit);
      } else {
        loadWisdomUsage();
      }
    });

    return () => subscription.remove();
  }, [loadWisdomUsage]);

  // Animate How to button appearance with 2 second delay
  React.useEffect(() => {
    // Reset animation to 0 when step changes
    howToButtonAnim.setValue(0);

    const timer = setTimeout(() => {
      Animated.spring(howToButtonAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 2000);

    return () => clearTimeout(timer);
  }, [actionStepIndex, howToButtonAnim]);

  const rotateInterpolate = triggerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const toggleJournalIcons = useCallback(() => {
    // Use ref so we always read the real current value, not a stale closure
    const expanding = !journalExpandedRef.current;
    journalExpandedRef.current = expanding;
    setJournalExpanded(expanding);
    onJournalExpanded?.(expanding);
    triggerLightHaptic();

    Animated.parallel([
      Animated.timing(triggerRotation, {
        toValue: expanding ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(triggerScale, {
        toValue: expanding ? 1.15 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 7,
      }),
    ]).start();

    if (expanding) {
      scrollViewRef.current?.scrollTo({ y: lastScrollYRef.current + 82, animated: true });
      Animated.parallel([
        Animated.timing(rowHeight, { toValue: ICON_ROW_HEIGHT, duration: 260, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        Animated.stagger(50, iconAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 })
        )).start();
      });
    } else {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, lastScrollYRef.current - 82), animated: true });
      Animated.stagger(35, [...iconAnims].reverse().map(anim =>
        Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 12 })
      )).start(() => {
        Animated.parallel([
          Animated.timing(rowHeight, { toValue: 0, duration: 220, useNativeDriver: false }),
          Animated.timing(rowOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
        ]).start(() => {
          // Notify parent that collapse is complete
          onJournalCollapseComplete?.();
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onJournalExpanded, onJournalCollapseComplete]);

  const createJournalEntry = useCreateJournalEntry();

  const currentStep = steps[actionStepIndex];

  React.useEffect(() => {
    const storedWisdom = currentStep?.wisdom_text || '';
    const parsedThread = parseWisdomThread(storedWisdom);
    const restoredThread = currentStep?.id
      ? persistedWisdomThreads[currentStep.id] || parsedThread
      : parsedThread;

    setCurrentActionWisdom(storedWisdom);
    setWisdomThread(restoredThread);
    setWisdomExpanded(false);
  }, [currentStep?.id, currentStep?.wisdom_text]);

  // Animate wisdom chevron rotation when expanded/collapsed
  React.useEffect(() => {
    Animated.timing(wisdomChevronAnim, {
      toValue: wisdomExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [wisdomExpanded, wisdomChevronAnim]);

  const wisdomChevronRotate = wisdomChevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const isLastStep = actionStepIndex >= steps.length - 1;

  useEffect(() => {
    if (activeJournalModal !== 'prayer') {
      return;
    }

    const rawDescription = currentStep.description ?? currentStep.subTasks?.map(s => s.text).join('\n') ?? '';
    const exampleSplit = rawDescription.split(/Example:\s*/i);
    const stepBody = exampleSplit[0]?.replace(/\*\*|__|\*/g, '').trim() || undefined;
    const stepExample = exampleSplit.length > 1
      ? exampleSplit.slice(1).join('Example: ').replace(/\*\*|__|\*/g, '').trim()
      : undefined;

    const metadata = {
      playbookId,
      playbookTitle,
      playbookStatus,
      actionStepNumber: actionStepIndex + 1,
      actionStepTitle: currentStep.title,
      subtaskTitle: currentStep.title,
      subtaskId: currentStep.id,
      selectedDate: toLocalDateString(new Date()),
      stepBody,
      stepExample,
    };

    setActiveJournalModal(null);
    (navigation as any).navigate('UnifiedPrayerSelection', { metadata, fromPlaybook: true });
  }, [activeJournalModal, actionStepIndex, currentStep, navigation, playbookId, playbookTitle, playbookStatus]);

  // Reset journal + choice state when step changes
  useEffect(() => {
    setJournalText('');
    setJournalSaved(false);
    setSelectedChoice(null);
  }, [actionStepIndex, ICON_ROW_HEIGHT, iconAnims, rowHeight, rowOpacity, triggerRotation, triggerScale]);

  // Reset FAB bar visibility when action step changes; animate expand on mount if not provided by parent
  useEffect(() => {
    fabBarHiddenRef.current = false;
    lastScrollYRef.current = 0;
    setFabCollapsed(false);
    if (!collapseAnimRef) {
      collapseAnim.setValue(1);
      Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
  }, [actionStepIndex, collapseAnim, collapseAnimRef]);

  // Auto-nudge: expand journal icons on first step, then collapse — one time only per session.
  // ALL inner timers are tracked in nudgeTimerRefs so they can be cancelled on unmount or
  // if the user interacts before the nudge completes (preventing stale state updates).
  useEffect(() => {
    if (actionStepIndex !== 0 || journalNudgeFired) {return;}
    journalNudgeFired = true;

    const t1 = setTimeout(() => {
      // Expand
      journalExpandedRef.current = true;
      setJournalExpanded(true);
      scrollViewRef.current?.scrollTo({ y: lastScrollYRef.current + 82, animated: true });
      Animated.parallel([
        Animated.timing(rowHeight, { toValue: ICON_ROW_HEIGHT, duration: 260, useNativeDriver: false }),
        Animated.timing(rowOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(triggerRotation, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(triggerScale, { toValue: 1.15, useNativeDriver: true, tension: 200, friction: 7 }),
      ]).start(() => {
        Animated.stagger(50, iconAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 })
        )).start(() => {
          // Hold 1.4s then auto-collapse
          const t2 = setTimeout(() => {
            nudgeTimerRefs.current = nudgeTimerRefs.current.filter(id => id !== t2);
            // Only auto-collapse if the user hasn't manually interacted
            if (!journalExpandedRef.current) { return; } // user already closed it
            journalExpandedRef.current = false;
            setJournalExpanded(false);
            Animated.parallel([
              Animated.timing(triggerRotation, { toValue: 0, duration: 220, useNativeDriver: true }),
              Animated.spring(triggerScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }),
            ]).start();
            Animated.stagger(35, [...iconAnims].reverse().map(anim =>
              Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 12 })
            )).start(() => {
              Animated.parallel([
                Animated.timing(rowHeight, { toValue: 0, duration: 220, useNativeDriver: false }),
                Animated.timing(rowOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
              ]).start();
            });
          }, 1400);
          nudgeTimerRefs.current.push(t2);
        });
      });
    }, 900);
    nudgeTimerRefs.current.push(t1);

    return () => {
      nudgeTimerRefs.current.forEach(id => clearTimeout(id));
      nudgeTimerRefs.current = [];
    };
  }, [actionStepIndex, ICON_ROW_HEIGHT, iconAnims, rowHeight, rowOpacity, triggerRotation, triggerScale]);

  const animateToNext = useCallback(
    (callback: () => void) => {
      // Exit: fade + slide up
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: -14, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        callback();
        // Enter from below with spring bounce
        cardTranslateY.setValue(22);
        Animated.parallel([
          Animated.spring(fadeAnim, { toValue: 1, tension: 75, friction: 8, useNativeDriver: true }),
          Animated.spring(cardTranslateY, { toValue: 0, tension: 75, friction: 8, useNativeDriver: true }),
        ]).start();
      });
    },
    [fadeAnim, cardTranslateY]
  );

  const commitCurrentStep = useCallback(() => {
    if (persistedCommittedSteps[actionStepIndex]) {
      return;
    }

    persistedCommittedSteps = { ...persistedCommittedSteps, [actionStepIndex]: true };
    setCommittedSteps({ ...persistedCommittedSteps });
    saveCurrentSession();
    onStepCommit?.(actionStepIndex);
  }, [actionStepIndex, onStepCommit]);

  const advanceStep = useCallback(
    (markDone: boolean) => {
      if (markDone) {
        commitCurrentStep();
        triggerMediumHaptic();
      } else {
        triggerLightHaptic();
      }

      if (isLastStep) {
        onNext();
        return;
      }

      animateToNext(() => {
        const next = actionStepIndex + 1;
        persistedActionStepIndex = next;
        setActionStepIndex(next);
        saveCurrentSession();
      });
    },
    [isLastStep, onNext, animateToNext, actionStepIndex, setActionStepIndex, commitCurrentStep]
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('playbookPrayerSaved', (payload: {
      playbookId?: string;
      actionStepNumber?: number;
      isEditing?: boolean;
    }) => {
      if (payload.playbookId && payload.playbookId !== playbookId) {
        return;
      }

      const completedIndex = payload.actionStepNumber !== undefined && payload.actionStepNumber > 0
        ? payload.actionStepNumber - 1
        : actionStepIndex;

      if (completedIndex === actionStepIndex) {
        commitCurrentStep();
      } else {
        persistedCommittedSteps = { ...persistedCommittedSteps, [completedIndex]: true };
        setCommittedSteps({ ...persistedCommittedSteps });
        saveCurrentSession();
        onStepCommit?.(completedIndex);
      }

      setActiveJournalModal(null);
      // Advance directly — no extra success modal needed (prayer screen already
      // showed its own confirmation before dismissing back here).
      setTimeout(() => advanceStep(true), 420);
    });

    return () => {
      subscription.remove();
    };
  }, [actionStepIndex, commitCurrentStep, onStepCommit, playbookId, advanceStep]);

  const handleSaveJournal = useCallback(() => {
    const trimmed = journalText.trim();
    if (!trimmed) {
      advanceStep(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    createJournalEntry.mutate(
      {
        user_id: userId,
        content_type: 'todays_focus',
        content: trimmed,
        selected_date: today,
      },
      {
        onSuccess: () => {
          triggerMediumHaptic();
          setJournalSaved(true);
          setTimeout(() => advanceStep(true), 600);
        },
        onError: () => {
          Alert.alert('Oops', 'Could not save to journal. Try again.');
        },
      }
    );
  }, [journalText, userId, createJournalEntry, advanceStep]);

  const handleActionScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const isScrollingUp = currentY < lastScrollYRef.current;
    lastScrollYRef.current = currentY;
    if (currentY > 60 && !fabBarHiddenRef.current) {
      fabBarHiddenRef.current = true;
      setFabCollapsed(true);
      Animated.spring(collapseAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
      // Auto-collapse journal icons on scroll
      if (journalExpandedRef.current) {
        toggleJournalIcons();
      }
    } else if (isScrollingUp && currentY <= 0 && fabBarHiddenRef.current) {
      fabBarHiddenRef.current = false;
      setFabCollapsed(false);
      Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
  }, [collapseAnim, toggleJournalIcons]);

  if (!currentStep) {
    return (
      <View style={[styles.stepScroll, styles.stepContent]}>
        <TouchableOpacity style={styles.primaryButton} onPress={onNext} activeOpacity={0.85}>
          <ThemedText weight="semiBold" style={styles.primaryButtonText}>Next</ThemedText>
          <Ionicons name="arrow-forward" size={18} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
    );
  }

  const stepNumber = actionStepIndex + 1;
  const totalSteps = steps.length;

  // Button labels from actionType
  const actionType = currentStep.actionType ?? 'done_skip';

  // Strip bold/italic markdown markers only — bullet '* ' lines are handled separately below
  const stripMd = (s: string) => s.replace(/\*\*|__|\*/g, '').trim();

  // Split body into main text and example (split on "Example:" marker)
  const rawDescription = currentStep.description ?? currentStep.subTasks?.map(s => s.text).join('\n') ?? '';
  const exampleSplit = rawDescription.split(/Example:\s*/i);
  const rawMainBody = exampleSplit[0] ?? '';
  const exampleText = exampleSplit.length > 1 ? capitalizeFirstLetter(stripMd(exampleSplit.slice(1).join('Example: '))) : null;

  // Process lines individually — preserve '* ' bullet markers, strip inline markers from the rest
  const rawBodyLines: string[] = rawMainBody
    .split('\n')
    .map(l => {
      const trimmed = l.trim();
      if (!trimmed) { return ''; }
      // Bullet lines: preserve the '* ' prefix so detectBodyLines can identify them
      if (/^\* /.test(trimmed)) { return trimmed.replace(/\*\*/g, '').replace(/__/g, ''); }
      return stripMd(trimmed);
    })
    .filter(Boolean);

  // Full plain text for prayer saving and body-start detection (strips bullet markers)
  const mainBodyText = rawBodyLines.map(l => l.replace(/^\* /, '')).join(' ');

  const smartBodyLines = detectBodyLines(rawBodyLines, actionType);
  console.log('[FaithfulActions] rawDescription:', JSON.stringify(rawDescription));
  console.log('[FaithfulActions] rawBodyLines:', rawBodyLines);
  console.log('[FaithfulActions] smartBodyLines:', smartBodyLines);
  const hasActionWisdom = Boolean(currentActionWisdom || wisdomThread.length > 0);
  const displayWisdomThread = getDisplayWisdomThread(currentActionWisdom, wisdomThread);
  const wisdomContext = wisdomThread.length > 0
    ? wisdomThread.map(entry => `User: ${entry.question}\nsiFia: ${entry.wisdom}`).join('\n\n')
    : currentActionWisdom;

  const primaryLabel = currentStep.primaryButton ?? (
    actionType === 'choose' ? "I've chosen" :
    actionType === 'text_input' ? 'Save to Journal' :
    'Done'
  );

  const isCommitted = !!committedSteps[actionStepIndex];

  const secondaryLabel = isCommitted ? 'Next' : (
    currentStep.secondaryButton ?? (
      actionType === 'choose' ? "I'm still unsure" :
      actionType === 'text_input' ? 'Skip' :
      'Skip'
    )
  );

  // Detect special step types — check label, title, AND body content so old playbooks
  // without AI-generated primary_button still work correctly
  const stepTitle = (currentStep.title || '').toLowerCase();
  const bodyStart = mainBodyText.trim().slice(0, 60).toLowerCase();
  const isPrayerStep =
    /pray/i.test(primaryLabel) ||
    /\bpray(er|ing)?\b/.test(stepTitle) ||
    /^(lord|father|heavenly father|dear (lord|god|father)|god,|jesus)/.test(bodyStart);
  const isReadAloudStep =
    /aloud|read.*aloud/i.test(primaryLabel) ||
    /\b(speak|declare|say.*aloud|read.*aloud)\b/.test(stepTitle);

  const handlePrimaryPress = async () => {
    const nowCommitted = !isCommitted;
    persistedCommittedSteps = { ...persistedCommittedSteps, [actionStepIndex]: nowCommitted };
    setCommittedSteps({ ...persistedCommittedSteps });
    saveCurrentSession();
    triggerMediumHaptic();

    if (nowCommitted) {
      // Persist action step completion to DB so the list card reflects the count
      onStepCommit?.(actionStepIndex);
      // Prayer step → save to prayers table
      if (isPrayerStep) {
        createPrayerMutation.mutate({
          content: mainBodyText,
          userId,
          dateStr: toLocalDateString(new Date()),
          devotionalTitle: playbookTitle ?? '',
          dayNumber: actionStepIndex + 1,
          dayTitle: currentStep.title ?? '',
          totalDays: steps.length,
          prayer_type: 'guided_playbook',
        });
      }

      // Read aloud step → award affirmation faith points
      if (isReadAloudStep) {
        try {
          await faithPointsService.awardPoints(userId, 'affirmation_read_aloud', {
            playbookId,
            playbookTitle,
            source: 'playbook_walkthrough',
          });

          // Check if streak celebration should show for affirmation read aloud
          // Only show streak if playbook is completed
          if (playbookStatus === 'completed') {
            const shouldShowStreak = await visibleStreakService.shouldShowCelebration(userId, 'affirmation_read_aloud');
            if (shouldShowStreak) {
              (navigation as any).navigate('StreakPlan', {
                userId,
                source: 'affirmation_read_aloud',
              });
            }
          }
        } catch (_) {}
      }

      // Brief pause so the committed (orange) state is visible, then advance
      setTimeout(() => advanceStep(true), 420);
    }
  };

  const FAB_PILL_WIDTH = SCREEN_WIDTH - 32;
  const FAB_CIRCLE_RATIO = 56 / FAB_PILL_WIDTH;
  const fabContentOpacity = collapseAnim.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' });
  const fabShapeOpacity = collapseAnim.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const fabCircleOpacity = collapseAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const fabShapeScaleX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, FAB_CIRCLE_RATIO], extrapolate: 'clamp' });
  const fabShapeTranslateX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(FAB_PILL_WIDTH / 2) * (1 - FAB_CIRCLE_RATIO)], extrapolate: 'clamp' });

  return (
    <>
    <ScrollView
      ref={scrollViewRef}
      style={styles.stepScroll}
      onScroll={handleActionScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 140 }]}
      scrollEnabled={true}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <FontAwesome6 name="list-check" size={16} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            {steps.length} Faithful Actions
          </ThemedText>
        </StepFadeIn>

        {/* Intro framing line (shown only on first step) */}
        {intro && actionStepIndex === 0 && (
          <StepFadeIn delay={60}>
            {Platform.OS === 'ios' ? (
              <TextInput
                value={intro}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.actionIntro, { fontFamily }]}
              />
            ) : (
              <ThemedText style={styles.actionIntro} selectable={true}>{intro}</ThemedText>
            )}
          </StepFadeIn>
        )}

        <StepFadeIn delay={80}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={`${Object.values(committedSteps).filter(v => v).length} of ${totalSteps} completed`}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.actionCounter, { fontFamily }]}
            />
          ) : (
            <ThemedText style={styles.actionCounter} selectable={true}>
              {Object.values(committedSteps).filter(v => v).length} of {totalSteps} completed
            </ThemedText>
          )}
        </StepFadeIn>

        <StepFadeIn delay={100}>
          <View style={styles.actionProgressBar}>
            <View style={[
              styles.actionProgressFill,
              { width: `${(Object.values(committedSteps).filter(v => v).length / totalSteps) * 100}%` },
            ]} />
          </View>
        </StepFadeIn>

        <StepFadeIn delay={130}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: cardTranslateY }] }}>
          <View style={styles.actionStepCard}>
            <Animated.View
              style={[
                styles.actionHowToButton,
                {
                  opacity: howToButtonAnim,
                  transform: [{ scale: howToButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setHowToModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.actionHowToButtonContent}>
                  <Ionicons name="help-circle-outline" size={14} color={Colors.hopeWhite} />
                  <ThemedText style={styles.actionHowToButtonText}>How to</ThemedText>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Step number circle — matches ActionStepsCard design */}
            <View style={styles.stepNumberContainer}>
              <View style={styles.stepCircle}>
                <ThemedText weight="bold" style={styles.stepNumber}>
                  {stepNumber}
                </ThemedText>
              </View>
            </View>

            {/* Step title */}
            <View style={styles.actionTitleContainer}>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={stripMd(currentStep.title)}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.actionTitle, { fontWeight: '600' as any, fontFamily }]}
                />
              ) : (
                <ThemedText weight="semiBold" style={styles.actionTitle} selectable={true}>
                  {stripMd(currentStep.title)}
                </ThemedText>
              )}
            </View>

            {/* Smart body lines */}
            {smartBodyLines.map((item, idx) => {
              if (item.type === 'quote') {
                return Platform.OS === 'ios' ? (
                  <TextInput
                    key={idx}
                    value={item.text}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.bodyLineQuote, { fontFamily }]}
                  />
                ) : (
                  <ThemedText key={idx} style={styles.bodyLineQuote} selectable={true}>
                    {item.text}
                  </ThemedText>
                );
              }
              if (item.type === 'intro') {
                return Platform.OS === 'ios' ? (
                  <TextInput
                    key={idx}
                    value={item.text}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.bodyLineIntro, { fontFamily }]}
                  />
                ) : (
                  <ThemedText key={idx} style={styles.bodyLineIntro} selectable={true}>
                    {item.text}
                  </ThemedText>
                );
              }
              if (item.type === 'choice') {
                const isSelected = selectedChoice === item.text;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.choicePill, isSelected && styles.choicePillSelected]}
                    onPress={() => { triggerLightHaptic(); setSelectedChoice(item.text); }}
                    activeOpacity={0.75}
                  >
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={item.text}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.choicePillText, isSelected && styles.choicePillTextSelected, isSelected && { fontWeight: '600' as any }, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText
                        weight={isSelected ? 'semiBold' : undefined}
                        style={[styles.choicePillText, isSelected && styles.choicePillTextSelected]}
                        selectable={true}
                      >
                        {item.text}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                );
              }
              if (item.type === 'bullet') {
                return (
                  <View key={idx} style={styles.bodyLineBulletRow}>
                    <View style={styles.bodyLineBulletDot} />
                    {Platform.OS === 'ios' ? (
                      <TextInput
                        value={item.text}
                        editable={false}
                        multiline={true}
                        scrollEnabled={false}
                        style={[styles.bodyLineBullet, { fontFamily }]}
                      />
                    ) : (
                      <ThemedText style={styles.bodyLineBullet} selectable={true}>
                        {item.text}
                      </ThemedText>
                    )}
                  </View>
                );
              }
              return Platform.OS === 'ios' ? (
                <TextInput
                  key={idx}
                  value={item.text}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.actionBodyLine, { fontFamily }]}
                />
              ) : (
                <ThemedText key={idx} style={styles.actionBodyLine} selectable={true}>
                  {item.text}
                </ThemedText>
              );
            })}

            {/* Example block — matches ActionStepsCard original design */}
            {exampleText && (
              <StepFadeIn key={`example-${actionStepIndex}`} delay={300}>
                <View style={styles.exampleContainer}>
                  <View style={styles.exampleHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="rgba(255,255,255,0.6)" />
                  </View>
                  {Platform.OS === 'ios' ? (
                    <TextInput
                      value={exampleText}
                      editable={false}
                      multiline={true}
                      scrollEnabled={false}
                      style={[styles.exampleText, { fontFamily }]}
                    />
                  ) : (
                    <ThemedText style={styles.exampleText} selectable={true}>{exampleText}</ThemedText>
                  )}
                </View>
              </StepFadeIn>
            )}

            {hasActionWisdom ? (
              <StepFadeIn key={`wisdom-${currentStep.id}`} delay={160}>
                <View style={styles.actionWisdomContainer}>
                  <TouchableOpacity
                    style={styles.actionWisdomHeader}
                    activeOpacity={0.75}
                    onPress={() => {
                      triggerLightHaptic();
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setWisdomExpanded(prev => !prev);
                    }}
                  >
                    <View style={styles.actionWisdomHeaderTitle}>
                      <ThemedText weight="semiBold" style={styles.actionWisdomLabel}>
                        Wisdom thread
                      </ThemedText>
                      {displayWisdomThread.length > 0 ? (
                        <ThemedText style={styles.actionWisdomCount}>
                          {displayWisdomThread.length}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Animated.View style={{ transform: [{ rotate: wisdomChevronRotate }] }}>
                      <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
                    </Animated.View>
                  </TouchableOpacity>

                  {wisdomExpanded ? (
                    <View style={styles.actionWisdomThreadList} collapsable={false}>
                      {(displayWisdomThread.length > 0 ? displayWisdomThread : [{ question: '', wisdom: currentActionWisdom }]).map((entry, threadIndex) => {
                        const entryWisdom = parseWisdomText(entry.wisdom);
                        return (
                          <View key={`wisdom-thread-${threadIndex}-${entry.question}-${entry.wisdom}`} style={styles.actionWisdomThreadItem} collapsable={false}>
                            <View style={styles.actionWisdomThreadRail}>
                              <View style={styles.actionWisdomThreadDot} />
                              {threadIndex < (displayWisdomThread.length > 0 ? displayWisdomThread.length : 1) - 1 ? (
                                <View style={styles.actionWisdomThreadLine} />
                              ) : null}
                            </View>

                            <View style={styles.actionWisdomThreadContent}>
                              {entry.question ? (
                                <View style={styles.actionWisdomUserRow}>
                                  <View style={styles.actionWisdomUserBubble} collapsable={false}>
                                    <ThemedText style={styles.actionWisdomUserText} selectable={true}>
                                      {entry.question}
                                    </ThemedText>
                                  </View>
                                </View>
                              ) : null}

                              <View style={styles.actionWisdomAssistantRow}>
                                <View style={styles.actionWisdomAssistantBubble} collapsable={false}>
                                <View style={styles.actionWisdomAssistantLabelRow}>
                                  <MaterialCommunityIcons name="head-heart-outline" size={14} color={Colors.alertCoral} />
                                </View>

                                {entryWisdom.blocks.map((block, blockIndex) => (
                            <View key={`wisdom-block-${blockIndex}`} collapsable={false}>
                              {block.intro ? (
                                <View style={styles.actionWisdomTextWrapper}>
                                  {Platform.OS === 'ios' ? (
                                    <ThemedTextInput
                                      value={block.intro}
                                      editable={false}
                                      multiline={true}
                                      scrollEnabled={false}
                                      underlineColorAndroid="transparent"
                                      pointerEvents="none"
                                      contextMenuHidden={true}
                                      caretHidden={true}
                                      style={styles.actionWisdomIntroTextInput}
                                    />
                                  ) : (
                                    <ThemedText style={styles.actionWisdomIntro} selectable={true}>
                                      {block.intro}
                                    </ThemedText>
                                  )}
                                </View>
                              ) : null}

                              {blockIndex > 0 && block.intro && (
                                <View style={styles.actionWisdomBlockDivider} />
                              )}

                              {block.items.map((item, idx) => {
                                const titledItem = splitWisdomItemTitle(item);

                                return (
                                  <React.Fragment key={`wisdom-item-${blockIndex}-${idx}-${item}`}>
                                    <View style={styles.actionWisdomStepRow}>
                                      <View style={styles.actionWisdomStepTextWrapper}>
                                        {titledItem ? (
                                          <>
                                            {Platform.OS === 'ios' ? (
                                              <>
                                                <ThemedTextInput
                                                  value={titledItem.title}
                                                  weight="bold"
                                                  editable={false}
                                                  multiline={true}
                                                  scrollEnabled={false}
                                                  underlineColorAndroid="transparent"
                                                  pointerEvents="none"
                                                  contextMenuHidden={true}
                                                  caretHidden={true}
                                                  style={styles.actionWisdomStepTitleTextInput}
                                                />
                                                <ThemedTextInput
                                                  value={titledItem.body}
                                                  editable={false}
                                                  multiline={true}
                                                  scrollEnabled={false}
                                                  underlineColorAndroid="transparent"
                                                  pointerEvents="none"
                                                  contextMenuHidden={true}
                                                  caretHidden={true}
                                                  style={styles.actionWisdomStepTextInput}
                                                />
                                              </>
                                            ) : (
                                              <>
                                                <ThemedText weight="bold" style={styles.actionWisdomStepTitle} selectable={true}>
                                                  {titledItem.title}
                                                </ThemedText>
                                                <ThemedText style={styles.actionWisdomStepText} selectable={true}>
                                                  {titledItem.body}
                                                </ThemedText>
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          Platform.OS === 'ios' ? (
                                            <ThemedTextInput
                                              value={item}
                                              editable={false}
                                              multiline={true}
                                              scrollEnabled={false}
                                              underlineColorAndroid="transparent"
                                              pointerEvents="none"
                                              contextMenuHidden={true}
                                              caretHidden={true}
                                              style={styles.actionWisdomStepTextInput}
                                            />
                                          ) : (
                                            <ThemedText style={styles.actionWisdomStepText} selectable={true}>
                                              {item}
                                            </ThemedText>
                                          )
                                        )}
                                      </View>
                                    </View>
                                  </React.Fragment>
                                );
                              })}

                              {block.outro ? (
                                <View style={styles.actionWisdomOutroWrapper}>
                                  {Platform.OS === 'ios' ? (
                                    <ThemedTextInput
                                      value={block.outro}
                                      editable={false}
                                      multiline={true}
                                      scrollEnabled={false}
                                      underlineColorAndroid="transparent"
                                      pointerEvents="none"
                                      contextMenuHidden={true}
                                      caretHidden={true}
                                      style={styles.actionWisdomIntroTextInput}
                                    />
                                  ) : (
                                    <ThemedText style={styles.actionWisdomIntro} selectable={true}>
                                      {block.outro}
                                    </ThemedText>
                                  )}
                                </View>
                              ) : null}

                              {blockIndex < entryWisdom.blocks.length - 1 && (
                                <View style={styles.actionWisdomBlockDivider} />
                              )}
                            </View>
                                ))}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={styles.actionWisdomCollapseButton}
                        onPress={() => {
                          triggerLightHaptic();
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setWisdomExpanded(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <ThemedText weight="semiBold" style={styles.actionWisdomCollapseButtonText}>
                          Collapse
                        </ThemedText>
                        <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </StepFadeIn>
            ) : null}

            {/* TextInput for text_input type */}
            {actionType === 'text_input' && (
              <View style={styles.journalInputWrapper}>
                <TextInput
                  style={styles.journalInput}
                  value={journalText}
                  onChangeText={setJournalText}
                  placeholder="Write your response here…"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {journalSaved && (
                  <ThemedText style={styles.journalSavedLabel}>✓ Saved to Journal</ThemedText>
                )}
              </View>
            )}
          </View>
        </Animated.View>
        </StepFadeIn>

    </ScrollView>

      {/* Floating action bar — collapses to circle on scroll, matches bottom nav behavior */}
      <Animated.View style={[styles.actionFABContainer, { bottom: insets.bottom + 16 }]}>
        {/* Journal expanded icons — float above FAB row */}
        <Animated.View style={[styles.journalExpandedRow, { height: rowHeight, opacity: rowOpacity }]}>
          {JOURNAL_ICONS.map(({ type, icon, color, label }, idx) => (
            <Animated.View
              key={type}
              style={{
                opacity: iconAnims[idx],
                transform: [{ scale: iconAnims[idx] }],
                alignItems: 'center',
              }}
            >
              <TouchableOpacity
                style={styles.journalIconButton}
                onPress={() => { journalExpandedRef.current = false; setJournalExpanded(false); setActiveJournalModal(type); triggerLightHaptic(); }}
                activeOpacity={0.75}
              >
                <View style={[styles.journalIconCircle, { backgroundColor: color + '28', borderColor: color + '20' }]}>
                  <MaterialCommunityIcons name={icon} size={20} color={color} />
                </View>
                <ThemedText style={[styles.journalIconLabel, { color }]}>{label}</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Full pill: shape contracts left→circle, content fades independently */}
        <Animated.View
          style={[
            styles.actionFABRow,
            {
              opacity: fabShapeOpacity,
              transform: [{ translateX: fabShapeTranslateX }, { scaleX: fabShapeScaleX }],
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: fabContentOpacity }}>
            {/* Journal trigger FAB */}
            <TouchableOpacity
              style={styles.actionFABCircle}
              onPress={toggleJournalIcons}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }, { scale: triggerScale }] }}>
                <MaterialCommunityIcons
                  name="pencil-plus-outline"
                  size={20}
                  color="rgba(255,255,255,0.55)"
                />
              </Animated.View>
            </TouchableOpacity>

            {/* Done FAB */}
            <TouchableOpacity
              style={[styles.actionFABDone, isCommitted && styles.doneButtonCommitted]}
              onPress={() => {
                if (actionType === 'text_input') {
                  handleSaveJournal();
                } else {
                  handlePrimaryPress();
                }
              }}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={[styles.actionFABDoneText, isCommitted && styles.doneButtonTextCommitted]} numberOfLines={1}>
                {primaryLabel}
              </ThemedText>
            </TouchableOpacity>

            {/* Skip FAB */}
            <TouchableOpacity
              onPress={() => advanceStep(false)}
              activeOpacity={0.7}
              style={styles.actionFABSkip}
            >
              <ThemedText style={styles.skipButtonText} numberOfLines={1}>
                {secondaryLabel}
              </ThemedText>
            </TouchableOpacity>

            {/* Back FAB — beside Skip, visible from step 2 onwards */}
            {actionStepIndex >= 1 && onGoBack && (
              <TouchableOpacity
                style={styles.actionFABCircle}
                onPress={onGoBack}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>

        {/* Collapsed circle — fades in as pill contracts; tap to re-expand */}
        <Animated.View
          style={[styles.actionFABCollapsedCircle, { opacity: fabCircleOpacity }]}
          pointerEvents={fabCollapsed ? 'box-none' : 'none'}
        >
          <TouchableOpacity
            style={styles.actionFABCollapsedCircleTouchable}
            activeOpacity={0.8}
            onPress={() => {
              setFabCollapsed(false);
              fabBarHiddenRef.current = false;
              Animated.spring(collapseAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {activeJournalModal === 'reflection' && (
        <SmartJournalingReflectionModal
          visible={true}
          subtaskTitle={currentStep.title ?? ''}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={playbookStatus}
          actionStepNumber={stepNumber}
          actionStepTitle={currentStep.title ?? ''}
          stepBody={mainBodyText || undefined}
          stepExample={exampleText || undefined}
          onSave={() => { setActiveJournalModal(null); advanceStep(true); }}
          onCancel={() => setActiveJournalModal(null)}
        />
      )}
      {activeJournalModal === 'gratitude' && (
        <SmartJournalingGratitudeModal
          visible={true}
          subtaskTitle={currentStep.title ?? ''}
          subtaskId={currentStep.id}
          stepId={currentStep.id}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={playbookStatus}
          actionStepNumber={stepNumber}
          actionStepTitle={currentStep.title ?? ''}
          stepBody={mainBodyText || undefined}
          stepExample={exampleText || undefined}
          onSave={() => { setActiveJournalModal(null); advanceStep(true); }}
          onClose={() => setActiveJournalModal(null)}
        />
      )}
      {activeJournalModal === 'timeblock' && (
        <SmartJournalingTimeBlockModal
          visible={true}
          subtaskTitle={currentStep.title ?? ''}
          playbookId={playbookId}
          onSave={() => { setActiveJournalModal(null); advanceStep(true); }}
          onCancel={() => setActiveJournalModal(null)}
        />
      )}

      <HowToModal
        visible={howToModalVisible}
        actionTitle={currentStep.title || ''}
        actionNumber={stepNumber}
        onDismiss={() => setHowToModalVisible(false)}
        onSubmit={async (question) => {
          try {
            const response = await getActionWisdom({
              playbookId: playbookId || '',
              userId: userId,
              userName: (user as any)?.user_metadata?.full_name?.split(' ')[0] || (user as any)?.email?.split('@')[0] || '',
              actionId: currentStep.id || '',
              actionTitle: currentStep.title || '',
              actionBody: mainBodyText || '',
              userQuestion: question,
              truthSummary: '',
              truthInLove: '',
              previousWisdom: wisdomContext,
            });

            if (response.success && response.wisdom) {
              const returnedWisdom = response.wisdom.trim();
              const threadEntry = { question: question.trim(), wisdom: returnedWisdom };
              const existingThread = currentStep.id
                ? persistedWisdomThreads[currentStep.id] || wisdomThread || parseWisdomThread(currentActionWisdom)
                : wisdomThread || parseWisdomThread(currentActionWisdom);
              const nextThread = response.wisdomThread?.length
                ? response.wisdomThread
                : [threadEntry, ...existingThread];
              const serializedThread = response.storedWisdom || serializeWisdomThread(nextThread);

              if (currentStep.id) {
                persistedWisdomThreads = {
                  ...persistedWisdomThreads,
                  [currentStep.id]: nextThread,
                };
              }
              setWisdomThread(nextThread);
              setCurrentActionWisdom(serializedThread);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setWisdomExpanded(false);
              setWisdomCount(response.wisdomCount || wisdomCount + 1);
              if (playbookId && user?.id) {
                queryClient.setQueryData(['playbook', playbookId, user.id], (cachedPlaybook: any) => {
                  if (!cachedPlaybook?.actionSteps) {
                    return cachedPlaybook;
                  }

                  return {
                    ...cachedPlaybook,
                    actionSteps: cachedPlaybook.actionSteps.map((step: any) =>
                      step.id === currentStep.id
                        ? { ...step, wisdom_text: serializedThread }
                        : step
                    ),
                  };
                });
                queryClient.invalidateQueries({ queryKey: ['playbook', playbookId, user.id] });
              }
              triggerSuccessHaptic();
            }

            return response;
          } catch (error) {
            return {
              success: false,
              error: 'ERROR',
              message: 'Something went wrong. Please try again.',
            };
          }
        }}
        wisdomCount={wisdomCount}
        wisdomLimit={wisdomLimit}
      />

    </>
  );
};

// ─── Step 4: Prayer ──────────────────────────────────────────────────────────

interface PrayerStepProps {
  prayer: string;
  playbookTitle?: string;
  playbookId?: string;
  userId: string;
  onNext: () => void;
  insets: { top: number; bottom: number };
}

const PrayerStep: React.FC<PrayerStepProps> = ({ prayer, playbookTitle, playbookId, userId, insets }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [hasPrayed, setHasPrayed] = useState(persistedHasPrayed);
  const [showButton, setShowButton] = useState(persistedHasPrayed); // show immediately if already prayed
  const fadeAnim = useRef(new Animated.Value(persistedHasPrayed ? 1 : 0)).current;
  const createPrayerMutation = useCreateDevotionalPrayer();

  useEffect(() => {
    if (persistedHasPrayed) { return; } // already visible, skip delay
    const timer = setTimeout(() => {
      setShowButton(true);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  // Ensure prayer always ends with the closing — append for old playbooks that don't have it
  const fullPrayer = /In Jesus'? [Nn]ame|[Aa]men/i.test(prayer)
    ? prayer
    : prayer.trimEnd() + "\n\nIn Jesus' Name,\nAmen";

  const handlePrayed = () => {
    const nowPrayed = !hasPrayed;
    if (nowPrayed) {
      triggerSuccessHaptic();
    } else {
      triggerLightHaptic();
    }
    persistedHasPrayed = nowPrayed;
    setHasPrayed(nowPrayed);
    saveCurrentSession();

    // Notify dashboard about prayer update
    DeviceEventEmitter.emit('playbookPrayerReadUpdated', {
      playbookId: playbookId,
      hasPrayed: nowPrayed,
      hasRead: persistedHasRead,
    });

    if (nowPrayed) {
      // Update prayer_prayed field in playbooks table
      if (playbookId) {
        updatePlaybookPrayerPrayed(playbookId, true).catch(error => {
          console.warn('Failed to update prayer_prayed in playbooks table', error);
        });
      }

      createPrayerMutation.mutate({
        content: fullPrayer,
        userId,
        dateStr: toLocalDateString(new Date()),
        devotionalTitle: playbookTitle ?? '',
        dayNumber: 1,
        dayTitle: 'Prayer',
        totalDays: 1,
        prayer_type: 'guided_playbook',
      });

      faithPointsService.awardPoints(userId, 'prayer_playbook_prayed', {
        suppressNotification: true,
        source: 'playbook_prayer',
        playbookId,
        playbookTitle,
      }).catch(error => {
        console.warn('Failed to award faith points for playbook prayer', error);
      });
    }
  };

  // Split "In Jesus' Name, Amen" out so we can add a clear gap before it
  const jesusNameIdx = fullPrayer.search(/In Jesus'? [Nn]ame/i);
  const prayerBodyText = jesusNameIdx > 0 ? capitalizeFirstLetter(fullPrayer.slice(0, jesusNameIdx).trimEnd()) : capitalizeFirstLetter(fullPrayer);
  const prayerClosing = jesusNameIdx > 0 ? fullPrayer.slice(jesusNameIdx) : null;

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, { paddingTop: insets.top + 8 }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Prayer
          </ThemedText>
        </StepFadeIn>

        {/* Vertically centered prayer block — sits in the space between label and floating button */}
        <StepFadeIn delay={100} style={styles.prayerBlock}>
          {splitParagraphs(prayerBodyText).map((line, i) => (
            <View key={i}>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={line}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.prayerText, { fontFamily }]}
                />
              ) : (
                <ThemedText style={styles.prayerText} selectable={true}>{line}</ThemedText>
              )}
              {i === 0 && <View style={{ height: 16 }} />}
            </View>
          ))}
          {prayerClosing && (
            <>
              <View style={{ height: 24 }} />
              {splitParagraphs(prayerClosing).map((line, i) => (
                Platform.OS === 'ios' ? (
                  <TextInput
                    key={`closing-${i}`}
                    value={line}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.prayerText, { fontFamily }]}
                  />
                ) : (
                  <ThemedText key={`closing-${i}`} style={styles.prayerText} selectable={true}>{line}</ThemedText>
                )
              ))}
            </>
          )}
        </StepFadeIn>

        {/* Spacer so prayer text isn't hidden behind the floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View
          style={[
            styles.prayerActionButtonFloating,
            { bottom: insets.bottom + 20, opacity: fadeAnim },
            hasPrayed && styles.prayerActionButtonActive,
            {
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={handlePrayed}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="hands-pray"
              size={18}
              color={hasPrayed ? Colors.alertCoral : Colors.hopeWhite}
            />
            <ThemedText
              weight="medium"
              style={[styles.prayerActionText, hasPrayed && styles.prayerActionTextActive]}
            >
              {hasPrayed ? 'Prayed' : 'I prayed this'}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 5: Word to Speak ───────────────────────────────────────────────────

interface WordToSpeakStepProps {
  word: string;
  playbookId?: string;
  onNext: () => void;
  insets: { top: number; bottom: number };
}

const WordToSpeakStep: React.FC<WordToSpeakStepProps> = ({ word, playbookId, insets }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [hasRead, setHasRead] = useState(persistedHasRead);
  const [showButton, setShowButton] = useState(persistedHasRead); // show immediately if already read
  const fadeAnim = useRef(new Animated.Value(persistedHasRead ? 1 : 0)).current;

  useEffect(() => {
    if (persistedHasRead) { return; } // already visible, skip delay
    const timer = setTimeout(() => {
      setShowButton(true);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  const handleRead = () => {
    const nowRead = !hasRead;
    if (nowRead) {
      triggerSuccessHaptic();
    } else {
      triggerLightHaptic();
    }
    persistedHasRead = nowRead;
    setHasRead(nowRead);
    saveCurrentSession();

    // Notify dashboard about read update
    DeviceEventEmitter.emit('playbookPrayerReadUpdated', {
      playbookId: playbookId,
      hasPrayed: persistedHasPrayed,
      hasRead: nowRead,
    });
  };

  return (
    <>
      <View style={[styles.stepScroll, styles.prayerStepOuter, { paddingTop: insets.top + 8 }]}>
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            Words to Speak over Myself
          </ThemedText>
        </StepFadeIn>

        {/* Word card */}
        <StepFadeIn delay={100} style={[styles.wordBlock, { marginTop: 32 }]}>
          {splitParagraphs(word).map((line, i) => (
            <View key={i} style={styles.wordLineRow}>
              <View style={styles.wordNumberContainer}>
                <View style={styles.wordNumberCircle}>
                  <ThemedText weight="bold" style={styles.wordNumber}>
                    {i + 1}
                  </ThemedText>
                </View>
              </View>
              {Platform.OS === 'ios' ? (
                <TextInput
                  value={line}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.wordText, { fontWeight: '500' as any, fontFamily }]}
                />
              ) : (
                <ThemedText weight="medium" style={styles.wordText} selectable={true}>
                  {line}
                </ThemedText>
              )}
            </View>
          ))}
        </StepFadeIn>

        {/* Space for floating button */}
        <View style={{ height: 80 }} />
      </View>

      {/* Floating action button — bottom-left, aligned with Next button */}
      {showButton && (
        <Animated.View
          style={[
            styles.prayerActionButtonFloating,
            { bottom: insets.bottom + 20, opacity: fadeAnim },
            hasRead && styles.prayerActionButtonActive,
            {
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={handleRead}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={hasRead ? Colors.alertCoral : Colors.hopeWhite}
            />
            <ThemedText
              weight="medium"
              style={[styles.prayerActionText, hasRead && styles.prayerActionTextActive]}
            >
              {hasRead ? 'Read aloud' : "I've read this aloud"}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

// ─── Step 6: Completion ──────────────────────────────────────────────────────

interface CompletionStepProps {
  title: string;
  closingText: string;
  pastoralClosing?: string;
  onFinish: () => void;
  insets: { top: number };
  onTurnIntoDevotional?: () => void;
  devotionalGenerated?: boolean;
  isCompleted?: boolean;
  isOnboarding?: boolean;
  navigation: any;
  fromNotification?: boolean;
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  title,
  closingText,
  pastoralClosing,
  onFinish,
  insets,
  onTurnIntoDevotional,
  devotionalGenerated = false,
  isCompleted = false,
  isOnboarding = false,
  navigation,
  fromNotification = false,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(persistedCompletionChoice);
  const headerAnim = useRef(new Animated.Value(40)).current;
  const buttonsAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  useEffect(() => {
    Animated.spring(buttonsAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [buttonsAnim]);

  // Parse completion text to extract question and action lines
  const parseCompletionText = (text: string) => {
    // Normalize old challenge format — strip section labels, remove opener line
    const normalized = text
      .replace(/^.+?,\s+complete\s+this\s+.+?challenge:\s*/gim, '')
      .replace(/^SPIRITUAL:\s*/gim, '')
      .replace(/^TACTICAL(?:\s*\([^)]*\))?:\s*/gim, '')
      .replace(/^TACTICAL\s+DEADLINE:\s*/gim, '')
      .replace(/\*\*|__|\*/g, '');

    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

    // Always show context line — inject if not already present
    // Use "Final reflection:" for completed playbooks, "Before you close:" for new ones
    // Hide context line if coming from notification
    const hasContext = lines.some(l => /^before you/i.test(l) || /^final reflection/i.test(l));
    const contextLine = fromNotification ? undefined : (
      hasContext ? lines.find(l => /^before you/i.test(l) || /^final reflection/i.test(l)) :
      (isCompleted ? 'Final reflection:' : 'Before you close:')
    );
    const questionLine = lines.find(l => l.endsWith('?'));
    const actionLines = lines.filter(l =>
      l.length > 0 && !/^before you/i.test(l) && !/^final reflection/i.test(l) && !l.endsWith('?')
    );

    // Choice pills: 2-4 short mutually-exclusive options.
    // Require the *question* to explicitly ask for a selection, OR the items to use "or"
    // as an explicit alternative connector — never trigger on imperative-step verbs like
    // "Choose patience…" which are sequential actions, not selectable options.
    const isChoicePills = actionLines.length >= 2 && actionLines.length <= 4 &&
                          actionLines.every(l => l.split(' ').length <= 6) &&
                          (
                            (questionLine !== undefined &&
                              /\bwhich\b|\bpick one\b|\bchoose one\b|\bwhat will you choose\b/i.test(questionLine)) ||
                            actionLines.some(l => /\bor\b/i.test(l))
                          );

    return { contextLine, questionLine, actionLines, isChoicePills };
  };

  const { contextLine, questionLine, actionLines, isChoicePills } = parseCompletionText(closingText);

  return (
    <View style={[styles.stepScroll, styles.stepContent, { paddingTop: insets.top }]}>
      <StepFadeIn delay={0}>
        <Animated.View style={{ transform: [{ translateY: headerAnim }] }}>
          <View style={styles.completionHeaderContainer}>
            <View style={styles.stepLabelRow}>
              <Ionicons name="flash" size={18} color={Colors.alertCoral} />
              {!fromNotification && (
                Platform.OS === 'ios' ? (
                  <TextInput
                    value="You've completed"
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    style={[styles.stepLabelWhite, { fontWeight: '600' as any, fontFamily }]}
                  />
                ) : (
                  <ThemedText weight="semiBold" style={styles.stepLabelWhite} selectable={true}>
                    You've completed
                  </ThemedText>
                )
              )}
            </View>
            {Platform.OS === 'ios' ? (
              <TextInput
                value={title}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.completionTitle, { fontWeight: '700' as any, fontFamily }]}
              />
            ) : (
              <ThemedText weight="bold" style={styles.completionTitle} selectable={true}>
                {title}
              </ThemedText>
            )}
            <ThemedText style={styles.completionPlaybookLabel}>PLAYBOOK</ThemedText>
          </View>
        </Animated.View>
      </StepFadeIn>

      {pastoralClosing ? (
        <StepFadeIn delay={80}>
          {Platform.OS === 'ios' ? (
            <TextInput
              value={pastoralClosing}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.completionPastoralClosing, { fontFamily }]}
            />
          ) : (
            <ThemedText style={styles.completionPastoralClosing} selectable={true}>{pastoralClosing}</ThemedText>
          )}
        </StepFadeIn>
      ) : null}

      <StepFadeIn delay={100}>
        <>
          {contextLine && (
            Platform.OS === 'ios' ? (
              <TextInput
                value={contextLine}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.completionContext, { fontFamily }]}
              />
            ) : (
              <ThemedText style={styles.completionContext} selectable={true}>{contextLine}</ThemedText>
            )
          )}
          {questionLine && (
            Platform.OS === 'ios' ? (
              <TextInput
                value={questionLine}
                editable={false}
                multiline={true}
                scrollEnabled={false}
                style={[styles.completionQuestion, { fontFamily }]}
              />
            ) : (
              <ThemedText style={styles.completionQuestion} selectable={true}>{questionLine}</ThemedText>
            )
          )}
        </>
      </StepFadeIn>

      <StepFadeIn delay={160}>
        <>
          {isChoicePills && actionLines.length > 0 ? (
            <View style={styles.completionChoicesContainer}>
              {actionLines.map((choice, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.completionChoicePill,
                    selectedChoice === choice && styles.completionChoicePillActive,
                  ]}
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedChoice(choice);
                    persistedCompletionChoice = choice;
                    saveCurrentSession();
                  }}
                  activeOpacity={0.8}
                >
                  {Platform.OS === 'ios' ? (
                    <TextInput
                      value={choice}
                      editable={false}
                      multiline={true}
                      scrollEnabled={false}
                      style={[
                        styles.completionChoiceText,
                        selectedChoice === choice && styles.completionChoiceTextActive,
                        selectedChoice === choice && { fontWeight: '600' as any },
                        { fontFamily },
                      ]}
                    />
                  ) : (
                    <ThemedText
                      weight={selectedChoice === choice ? 'semiBold' : undefined}
                      style={[
                        styles.completionChoiceText,
                        selectedChoice === choice && styles.completionChoiceTextActive,
                      ]}
                      selectable={true}
                    >
                      {choice}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : actionLines.length > 0 && (
            <View style={styles.completionActionsContainer}>
              {actionLines.map((line, index) => (
                <View key={index} style={styles.completionActionItem}>
                  <View style={styles.completionActionCircle}>
                    <Ionicons name="sparkles" size={14} color={Colors.alertCoral} />
                  </View>
                  {Platform.OS === 'ios' ? (
                    <TextInput
                      value={line}
                      editable={false}
                      multiline={true}
                      scrollEnabled={false}
                      style={[styles.completionActionLine, { fontFamily }]}
                    />
                  ) : (
                    <ThemedText style={styles.completionActionLine} selectable={true}>
                      {line}
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      </StepFadeIn>

      <StepFadeIn delay={220}>
        <Animated.View style={{ transform: [{ translateY: buttonsAnim }] }}>
          {!fromNotification && (
            <ThemedText style={styles.completionStayNote}>
              Need to stay with this a little longer?
            </ThemedText>
          )}

          {!fromNotification && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.finishButton]}
              onPress={isCompleted ? () => {
                triggerLightHaptic();
                (navigation as any)?.goBack();
              } : onFinish}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                {isCompleted ? 'Done' : isOnboarding ? 'Continue' : 'Save & Finish'}
              </ThemedText>
            </TouchableOpacity>
          )}

          {!devotionalGenerated && (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.devotionalButton]}
              onPress={() => {
                triggerLightHaptic();
                onTurnIntoDevotional?.();
              }}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
                Turn this into a devotional
              </ThemedText>
            </TouchableOpacity>
          )}
        </Animated.View>
      </StepFadeIn>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PlaybookWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const routePlaybook = route.params?.playbook;
  const source = route.params?.source;
  const initialStep = route.params?.initialStep;
  const initialActionIndex = route.params?.initialActionIndex;
  const fromNotification = route.params?.fromNotification;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });
  const fabCollapseAnimRef = useRef(new Animated.Value(1));
  const [stepIndex, setStepIndex] = useState(() => {
    if (initialStep !== undefined && initialStep >= 0 && initialStep < TOTAL_STEPS) {
      return initialStep;
    }
    if (!routePlaybook || routePlaybook.status === 'completed') { return 0; }
    const wp = routePlaybook.walkthroughProgress ?? -1;
    if (wp < 0) { return 0; }
    // wp = last step where Next was pressed → resume at wp + 1, capped at step 5 (never auto-land on completion)
    return Math.min(wp + 1, TOTAL_STEPS - 2);
  });
  const [actionStepIndex, setActionStepIndex] = useState(() => {
    if (initialActionIndex !== undefined && initialActionIndex >= 0) {
      return initialActionIndex;
    }
    return persistedActionStepIndex;
  });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const [showDevotionalModal, setShowDevotionalModal] = useState(false);
  const [devotionalGenerated, setDevotionalGenerated] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [refinedPlaybookOverride, setRefinedPlaybookOverride] = useState<typeof routePlaybook | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);
  const [refinementLimit, setRefinementLimit] = useState(0);


  // ── Onboarding "playbook ready" overlay — shown for all onboarding users ──
  const [showReadyOverlay, setShowReadyOverlay] = useState(false);

  useEffect(() => {
    if (source === 'onboarding') {
      setShowReadyOverlay(true);
    }

  }, [source]);

  const handleDismissReadyOverlay = useCallback(() => {
    setShowReadyOverlay(false);
  }, []);

  const [journalExpanded, setJournalExpanded] = useState(false);
  const [, setJournalCollapseComplete] = useState(true);

  const userName: string = React.useMemo(
    () =>
      (user as any)?.user_metadata?.full_name?.split(' ')[0] ||
      (user as any)?.email?.split('@')[0] ||
      '',
    [user]
  );
  const userId: string = user?.id || '';

  // Detect if the route playbook is a lightweight list object (missing full content).
  // Lightweight mode includes truth_in_love but NOT bible_verse text, prayer, wordToSpeak, etc.
  // So we check bibleVerse.text (empty string in lightweight, actual content in full).
  // Also accept if prayer key is a string (only set in full fetches).
  const isFullPlaybook =
    routePlaybook &&
    (
      (
        routePlaybook.bibleVerse &&
        typeof routePlaybook.bibleVerse === 'object' &&
        (routePlaybook.bibleVerse as any).text &&
        (routePlaybook.bibleVerse as any).text.length > 0
      ) ||
      typeof (routePlaybook as any).prayer === 'string'
    );

  console.log('[PlaybookWalkthrough] isFullPlaybook:', isFullPlaybook, 'bibleVerse.text length:', (routePlaybook?.bibleVerse as any)?.text?.length, 'prayer type:', typeof (routePlaybook as any)?.prayer);

  const playbookId = routePlaybook?.id;
  const shouldFetch = !isFullPlaybook && !!playbookId && !!userId;
  console.log('[PlaybookWalkthrough] shouldFetch:', shouldFetch, 'playbookId:', playbookId, 'userId:', userId);

  const { data: fetchedPlaybook, isLoading } = useQuery({
    queryKey: ['playbook', playbookId, userId],
    queryFn: async () => {
      const result = await getPlaybook(userId, playbookId!);
      return result;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const playbook = (refinedPlaybookOverride || (isFullPlaybook ? routePlaybook : fetchedPlaybook)) as typeof routePlaybook;

  const refinementsRemaining = refinementLimit === -1
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, refinementLimit - refinementCount);

  const loadRefinementUsage = useCallback(() => {
    if (!userId) {
      setRefinementCount(0);
      setRefinementLimit(0);
      return;
    }

    NewSubscriptionService.getUserSubscription(userId)
      .then(subscription => {
        const limits = NewSubscriptionService.getTierLimits(subscription.tier, subscription);
        setRefinementCount((subscription as any).refinement_count || 0);
        setRefinementLimit(limits.refinement_limit ?? 0);
      })
      .catch(() => {
        setRefinementCount(0);
        setRefinementLimit(0);
      });
  }, [userId]);

  useEffect(() => {
    loadRefinementUsage();
  }, [loadRefinementUsage]);

  useEffect(() => {
    if (!userId || !playbookId || !playbook) {
      return;
    }

    const activity = playbook.status === 'completed' ? 'playbook_revisited_completed' : 'playbook_opened';

    faithPointsService.hasActivityTodayForPlaybook(userId, activity, playbookId)
      .then(alreadyAwarded => {
        if (alreadyAwarded) {
          return;
        }

        return faithPointsService.awardPoints(userId, activity as any, {
          suppressNotification: true,
          source: 'playbook_open',
          playbookId,
          playbookTitle: playbook.title,
          status: playbook.status,
        });
      })
      .catch(error => {
        console.warn('Failed to award playbook open faith points', error);
      });
  }, [userId, playbookId, playbook]);

  // Load session state from AsyncStorage on mount / playbook change.
  // We gate rendering on sessionLoaded so child components always initialize
  // from the correct (AsyncStorage-hydrated) module-level vars.
  useEffect(() => {
    const sessionStart = Date.now();
    console.log('[PlaybookWalkthrough] Starting AsyncStorage session load at', sessionStart - mountTimeRef.current, 'ms after mount');
    
    if (!playbookId) {
      setSessionLoaded(true);
      console.log('[PlaybookWalkthrough] No playbookId - sessionLoaded set immediately at', Date.now() - mountTimeRef.current, 'ms');
      return;
    }

    AsyncStorage.getItem(getSessionKey(playbookId))
      .then(raw => {
        const sessionEnd = Date.now();
        console.log('[PlaybookWalkthrough] AsyncStorage.getItem completed in', sessionEnd - sessionStart, 'ms (total:', sessionEnd - mountTimeRef.current, 'ms after mount)');
        
        if (raw) {
          try {
            const session = JSON.parse(raw);
            persistedPlaybookId = playbookId;
            persistedCommittedSteps = session.committedSteps ?? {};
            persistedActionStepIndex = session.actionStepIndex ?? 0;
            persistedHasPrayed = session.hasPrayed ?? false;
            persistedHasRead = session.hasRead ?? false;
            persistedCompletionChoice = session.completionChoice ?? null;
            // Don't restore journalNudgeFired — always let the nudge run fresh
            journalNudgeFired = false;
            // If we navigated here with a specific action index, honor it instead of session
            if (initialActionIndex !== undefined && initialActionIndex >= 0) {
              persistedActionStepIndex = initialActionIndex;
            }
            setActionStepIndex(persistedActionStepIndex);
          } catch (_) {
            // Corrupted data — fall through to reset below
          }
        } else if (playbookId !== persistedPlaybookId) {
          // Different (or new) playbook — clear all state
          persistedPlaybookId = playbookId;
          persistedCommittedSteps = {};
          persistedActionStepIndex = initialActionIndex !== undefined && initialActionIndex >= 0
            ? initialActionIndex
            : 0;
          persistedHasPrayed = false;
          persistedHasRead = false;
          persistedCompletionChoice = null;
          journalNudgeFired = false;
          setActionStepIndex(persistedActionStepIndex);
        }
        setSessionLoaded(true);
        console.log('[PlaybookWalkthrough] sessionLoaded set to true at', Date.now() - mountTimeRef.current, 'ms after mount');
      })
      .catch(() => {
        // Storage failure — still render with whatever state we have
        setSessionLoaded(true);
        console.log('[PlaybookWalkthrough] AsyncStorage failed - sessionLoaded set to true at', Date.now() - mountTimeRef.current, 'ms after mount');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbookId]);

  // ── Slide animation between steps ──────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Share button scales + fades in when completion page is reached
  const shareButtonAnim = useRef(new Animated.Value(0)).current;
  // Screen 0 close and next buttons animate in with fade + scale
  const screen0CloseAnim = useRef(new Animated.Value(0)).current;
  const screen0NextAnim = useRef(new Animated.Value(0)).current;
  // Scripture anchor (step 2) next button animates out when pressed
  const scriptureNextAnim = useRef(new Animated.Value(1)).current;
  // Prayer (step 4) next button animates in
  const prayerNextAnim = useRef(new Animated.Value(0)).current;


  // Animate share button in when we hit step 6
  useEffect(() => {
    if (stepIndex === 6) {
      shareButtonAnim.setValue(0);
      Animated.spring(shareButtonAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 350,
        useNativeDriver: true,
      }).start();
    } else {
      shareButtonAnim.setValue(0);
    }
  }, [stepIndex, shareButtonAnim]);

  // Animate screen 0 close and next buttons with staggered timing
  useEffect(() => {
    if (stepIndex === 0) {
      screen0CloseAnim.setValue(0);
      screen0NextAnim.setValue(0);
      Animated.parallel([
        Animated.spring(screen0CloseAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.spring(screen0NextAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          delay: 800,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      screen0CloseAnim.setValue(0);
      screen0NextAnim.setValue(0);
    }
  }, [stepIndex, screen0CloseAnim, screen0NextAnim]);


  // Reset journalCollapseComplete when journal expands
  useEffect(() => {
    if (journalExpanded) {
      setJournalCollapseComplete(false);
    }
  }, [journalExpanded]);

  // Reset scriptureNextAnim when not on step 2
  useEffect(() => {
    if (stepIndex !== 2) {
      scriptureNextAnim.setValue(1);
    }
  }, [stepIndex, scriptureNextAnim]);

  // Animate prayerNextAnim when entering step 4
  useEffect(() => {
    if (stepIndex === 4) {
      prayerNextAnim.setValue(0);
      Animated.spring(prayerNextAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 400,
        useNativeDriver: true,
      }).start();
    } else {
      prayerNextAnim.setValue(0);
    }
  }, [stepIndex, prayerNextAnim]);

  const animateStep = useCallback(
    (nextStep: number, direction: 'forward' | 'back') => {
      const exitX = direction === 'forward' ? -SCREEN_WIDTH * 0.25 : SCREEN_WIDTH * 0.25;
      const entryX = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;

      // 1. Slide current content out
      Animated.timing(slideAnim, {
        toValue: exitX,
        duration: 160,
        useNativeDriver: true,
      }).start(() => {
        // 2. Snap animated value to entry side, THEN update step
        //    so the new content is mounted already off-screen
        slideAnim.setValue(entryX);
        setStepIndex(nextStep);

        // 3. One frame later: new content is painted — spring it in
        requestAnimationFrame(() => {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        });
      });
    },
    [slideAnim]
  );

  const handleExportPDF = useCallback(async () => {
    // Check feature access
    if (!pdfExportAccess.hasAccess) {
      const upgradePrompt = pdfExportAccess.accessResult?.upgradePrompt;
      const upgradeMessage = typeof upgradePrompt?.message === 'string'
        ? upgradePrompt.message
        : typeof upgradePrompt === 'object' && upgradePrompt?.message
          ? (upgradePrompt as any).message
          : PDF_EXPORT_UPGRADE_PROMPT;

      Alert.alert(
        'Upgrade Required',
        upgradeMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Upgrade',
            onPress: () => {
              (navigation as any).navigate('OnboardingSalesOffer' as any, {
                upgradeMode: true,
                currentTier: pdfExportAccess.accessResult?.requiredTier,
                skipNotificationPreference: true,
                featureType: 'export_pdf',
                source: 'playbook_walkthrough',
              });
            },
          },
        ]
      );
      return;
    }

    if (!playbook) { return; }

    // Get user metadata for name replacement
    const metaUser: any = (user as any)?.user_metadata || {};
    const metaFirstName = metaUser.first_name || (user as any)?.displayName?.split(' ')[0] || '';
    const metaDisplayName = (user as any)?.displayName ||
                          metaUser.full_name ||
                          [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ').trim() ||
                          '';

    // Get bible version from user preferences or default to NASB
    const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

    pdfExportService.exportPlaybookPDF({
      title: playbook.title,
      truthInLove: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? playbook.truthInLove : playbook.truthInLove?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: false }
      ),
      truthInLoveSummary: replaceAllNamePlaceholders(
        typeof playbook.truthInLove === 'string' ? '' : playbook.truthInLove?.summary || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: false }
      ),
      bibleVerse: {
        ...playbook.bibleVerse,
        version: bibleVersion,
      },
      bibleVerseReflection: playbook.bibleVerseReflection || '',
      actionSteps: playbook.actionSteps?.map(step => {
        // Derive examples similar to ActionStepsCard
        let examples: string[] = [];

        const rawExamples: any = (step as any).examples;

        if (rawExamples && typeof rawExamples === 'string') {
          if (/Example:\s*/i.test(rawExamples)) {
            const exampleMatches = rawExamples
              .split(/Example:\s*/i)
              .filter((text: string) => text.trim().length > 0);
            examples = exampleMatches.map((ex: string) => ex.replace(/^Example:\s*/i, '').trim());
          } else if (rawExamples.includes(';')) {
            examples = rawExamples
              .split(';')
              .map((ex: string) => ex.trim())
              .filter(Boolean);
          } else if (rawExamples.trim()) {
            examples = [rawExamples.trim()];
          }
        } else if (Array.isArray(rawExamples)) {
          examples = rawExamples.map((ex: string) => ex.replace(/^"+|"+$/g, '').replace(/^Example:\s*/i, '').trim());
        } else if (step.subTasks && step.subTasks.length > 0) {
          // Extract examples from subtasks that have is_example flag OR start with "example:"
          examples = step.subTasks
            .filter((st: any) =>
              (typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:')) ||
              st.is_example === true ||
              st.isExample === true
            )
            .map((st: any) => st.text.replace(/^Example:\s*/i, '').trim());
        }

        return {
          title: step.title,
          description: step.description || '',
          subtasks: step.subTasks?.map((st: any) => st.text || st.title || st) || [],
          examples,
        };
      }),
      affirmations: playbook.affirmations?.map(a =>
        replaceAllNamePlaceholders(
          a.text,
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        )
      ) || [],
      prayer: playbook.prayer || '',
      wordsToSpeak: playbook.wordToSpeak || '',
      directChallenge: replaceAllNamePlaceholders(
        typeof playbook.directChallenge === 'string' ? playbook.directChallenge : playbook.directChallenge?.text || '',
        { firstName: metaFirstName, displayName: metaDisplayName },
        { replaceHardcodedNames: true }
      ),
      createdAt: playbook.createdAt,
    });
  }, [playbook, user, pdfExportAccess, navigation]);

  const handleRefinePlaybook = useCallback(async (
    correctionType: PlaybookCorrectionType,
    clarificationInput: string
  ): Promise<boolean> => {
    if (!playbook?.id || !userId) {
      Alert.alert('Unable to refine', 'This playbook is still loading.');
      return false;
    }

    const clarification = clarificationInput.trim();
    if (clarification.length < 8) {
      Alert.alert('Add a little more', 'Share what siFia missed before refining this playbook.');
      return false;
    }

    setIsRefining(true);
    try {
      const metadata = (user as any)?.user_metadata || {};
      const dateOfBirth = metadata.birth_date || metadata.dateOfBirth || metadata.birthDate;
      const result = await refinePlaybook({
        playbookId: playbook.id,
        userId,
        userName: userName || 'Friend',
        correctionType,
        clarification,
        dateOfBirth,
      });

      setRefinedPlaybookOverride(result.playbook as any);
      setRefinementCount(result.refinementCount);
      setRefinementLimit(result.refinementLimit);
      setStepIndex(0);
      setActionStepIndex(0);

      persistedCommittedSteps = {};
      persistedActionStepIndex = 0;
      persistedHasPrayed = false;
      persistedHasRead = false;
      persistedCompletionChoice = null;
      if (playbook.id) {
        clearSessionStorage(playbook.id);
      }

      queryClient.invalidateQueries({ queryKey: ['playbook', playbook.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      DeviceEventEmitter.emit('playbook_refined', { playbookId: playbook.id });
      DeviceEventEmitter.emit('playbookProgressUpdate', { playbookId: playbook.id });
      triggerSuccessHaptic();
      Alert.alert('Playbook refined', 'siFia revised this playbook with your clarification.');
      return true;
    } catch (error: any) {
      const message = error?.code === 'REFINEMENT_LIMIT_REACHED'
        ? error.message || 'You have used your playbook refinements this month.'
        : error?.message || 'siFia could not revise this playbook right now. Your current playbook is still here. Please try again in a moment.';
      Alert.alert('Could not refine playbook', message);
      return false;
    } finally {
      setIsRefining(false);
    }
  }, [playbook, userId, user, userName, queryClient]);

  const handleFinish = useCallback(async () => {
    triggerMediumHaptic();

    // Clear persisted state immediately
    if (persistedPlaybookId) { clearSessionStorage(persistedPlaybookId); }
    persistedPlaybookId = undefined;
    persistedCommittedSteps = {};
    persistedActionStepIndex = 0;
    persistedHasPrayed = false;
    persistedHasRead = false;
    journalNudgeFired = false;

    // Perform async operations in background without blocking navigation
    (async () => {
      // Mark the playbook as completed now that the user pressed Save & Finish
      if (playbookId) {
        updatePlaybookStatus(playbookId, 'completed').catch(() => {});
        try {
          const alreadyAwarded = await faithPointsService.hasActivityTodayForPlaybook(userId, 'playbook_completed', playbookId);
          if (!alreadyAwarded) {
            await faithPointsService.awardPoints(userId, 'playbook_completed', {
              suppressNotification: true,
              source: 'playbook_completion',
              playbookId,
              playbookTitle: playbook?.title,
            });
          }
        } catch (error) {
          console.warn('Failed to award playbook completion faith points', error);
        }
        // Optimistically update query cache so list reflects completion immediately
        queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
      }
    })();

    // Navigate immediately without waiting for async operations
    const shouldShowStreakPlan = userId
      ? await visibleStreakService.shouldShowCelebration(userId, 'playbook_completed')
      : true;

    if (shouldShowStreakPlan && userId) {
    }

    if (!shouldShowStreakPlan) {
      if (source === 'onboarding') {
        (navigation as any).navigate('OnboardingSalesOffer', {
          playbookId,
          source: 'playbook_walkthrough',
          onboardingFlow: true,
        });
      } else {
        navigation.goBack();
      }
      return;
    }

    if (source === 'onboarding') {
      // Onboarding flow: go to StreakPlanScreen with onboarding flag
      (navigation as any).navigate('StreakPlan', {
        playbookId,
        userId,
        source,
        onboarding: true,
      });
    } else {
      // Normal flow: navigate to StreakPlanScreen, which will goBack() on Done
      (navigation as any).navigate('StreakPlan', {
        playbookId,
        userId,
        source,
      });
    }
  }, [navigation, playbook?.title, playbookId, userId, queryClient, source]);

  const goNext = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex < TOTAL_STEPS - 1) {
      // Record this step as completed (Next was pressed)
      if (playbookId) {
        updateWalkthroughProgress(playbookId, stepIndex).catch(() => {});
      }
      // Animate next button out on scripture anchor step (step 2)
      if (stepIndex === 2) {
        Animated.parallel([
          Animated.timing(scriptureNextAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Skip prayer step (4) if this playbook has no prayer
          const hasPrayer = (playbook?.prayer || '').length > 0;
          const next = !hasPrayer ? 3 : 3;
          animateStep(next, 'forward');
        });
      } else {
        // Collapse FAB when leaving Faithful Actions (step 3)
        if (stepIndex === 3) {
          Animated.spring(fabCollapseAnimRef.current, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
        }
        // Skip prayer step (4) if this playbook has no prayer
        const hasPrayer = (playbook?.prayer || '').length > 0;
        const next = !hasPrayer && stepIndex === 3 ? 5 : stepIndex + 1;
        animateStep(next, 'forward');
      }
    }
  }, [stepIndex, animateStep, playbook?.prayer, scriptureNextAnim, playbookId]);

  const goBack = useCallback(() => {
    triggerLightHaptic();
    if (stepIndex === 0) {
      navigation.goBack();
    } else {
      // Collapse FAB when leaving Faithful Actions (step 3) via back
      if (stepIndex === 3) {
        Animated.spring(fabCollapseAnimRef.current, { toValue: 1, useNativeDriver: true, tension: 55, friction: 14 }).start();
      }
      // Skip back over prayer step (4) if this playbook has no prayer
      const hasPrayer = (playbook?.prayer || '').length > 0;
      const prev = !hasPrayer && stepIndex === 5 ? 3 : stepIndex - 1;
      animateStep(prev, 'back');
    }
  }, [stepIndex, animateStep, navigation, playbook?.prayer]);

  // Back within faithful actions sub-steps (or go to previous main step if at sub-step 0)
  const goBackActionStep = useCallback(() => {
    triggerLightHaptic();
    if (actionStepIndex > 0) {
      const prev = actionStepIndex - 1;
      persistedActionStepIndex = prev;
      setActionStepIndex(prev);
      saveCurrentSession();
    } else {
      goBack();
    }
  }, [actionStepIndex, goBack]);

  const prevStepIndexRef = useRef(stepIndex);
  useEffect(() => {
    const prevStep = prevStepIndexRef.current;
    // Expand FAB when entering Faithful Actions (step 3)
    if (stepIndex === 3 && prevStep !== 3) {
      Animated.spring(fabCollapseAnimRef.current, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    }
    prevStepIndexRef.current = stepIndex;
  }, [stepIndex]);

  // Animate FAB expansion on mount if starting on step 3
  useEffect(() => {
    if (stepIndex === 3) {
      const timer = setTimeout(() => {
        Animated.spring(fabCollapseAnimRef.current, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSkipWalkthrough = useCallback(() => {
    if (source === 'onboarding') {
      triggerLightHaptic();
      // Skip walkthrough and go directly to trial offer
      (navigation as any).replace('OnboardingTrialOffer', {
        source: 'onboarding',
        skipNotificationPreference: true,
      });
    } else {
      // Normal flow: go back
      navigation.goBack();
    }
  }, [source, navigation]);

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > SCREEN_WIDTH * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            // Swipe right - go back
            goBack();
            triggerMediumHaptic();
          } else if (gestureState.dx < 0) {
            // Swipe left - go next
            if (stepIndex < TOTAL_STEPS - 1) {
              goNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [stepIndex, goBack, goNext]
  );

  // Show loading state while fetching the full playbook from DB or awaiting session load
  const loadingGatePassed = sessionLoaded && !isLoading && !(shouldFetch && !playbook);
  console.log('[PlaybookWalkthrough] Loading gate check:', {
    sessionLoaded,
    isLoading,
    shouldFetch,
    hasPlaybook: !!playbook,
    loadingGatePassed,
    timeSinceMount: Date.now() - mountTimeRef.current + 'ms'
  });
  
  if (!loadingGatePassed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a3c6d' }}>
        <StatusBar hidden={true} />
        <PlaybookSkeletonLoader />
      </View>
    );
  }

  if (!playbook) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
          Could not load playbook.
        </ThemedText>
      </View>
    );
  }

  // Derive data
  const prayerText = playbook.prayer || '';

  const transitionLine: string = playbook.transitionLine?.trim() || '';

  const wordToSpeak =
    playbook.wordToSpeak ||
    (Array.isArray((playbook as any).wordsToSpeak) && (playbook as any).wordsToSpeak.length > 0
      ? (playbook as any).wordsToSpeak.join('\n')
      : (playbook.affirmations && playbook.affirmations.length > 0
          ? playbook.affirmations.map((a: any) => a.text).join('\n')
          : ''));

  const pastoralClosing = playbook.challengeCTA || '';
  const closingText =
    getDirectChallengeText(playbook.directChallenge) ||
    'Carry what God has shown you into the room.';

  // Only Completion (step 6) handles its own CTA — all other steps get the floating next
  // Faithful Actions (step 3) has its own Done/Skip buttons, so hide the floating next
  const hasFloatingNext = stepIndex !== 6 && stepIndex !== 3;

  return (
    <>
    <StatusBar hidden />
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Step content */}
      {/* Animated slide container */}
      <Animated.View
        style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}
      >
            {stepIndex === 0 && (
              <EnterMomentStep
                title={playbook.title}
                userInput={playbook.userInput}
                summary={playbook.truthInLove?.summary || ''}
                userName={userName}
                transitionLine={transitionLine}
                onContinue={goNext}
                onEditUserInput={() => {
                  navigation.navigate('UserInput' as any, { initialText: playbook.userInput });
                }}
                insets={insets}
              />
            )}

            {stepIndex === 1 && (
              <TruthInLoveStep
                text={playbook.truthInLove?.text || ''}
                userName={userName}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 2 && (
              <ScriptureAnchorStep
                reference={playbook.bibleVerse?.reference || ''}
                text={playbook.bibleVerse?.text || ''}
                version={playbook.bibleVerse?.version}
                reflection={playbook.bibleVerseReflection}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 3 && (
              <FaithfulActionsStep
                steps={playbook.actionSteps || []}
                intro={playbook.faithfulActionsIntro}
                playbookId={playbook.id}
                playbookTitle={playbook.title}
                playbookStatus={playbook.status}
                userId={userId}
                onNext={goNext}
                onGoBack={goBackActionStep}
                insets={insets}
                actionStepIndex={actionStepIndex}
                setActionStepIndex={setActionStepIndex}
                onStepCommit={(stepIdx) => {
                  const stepId = playbook?.actionSteps?.[stepIdx]?.id;
                  if (!stepId) { return; }
                  updateActionStepCompleted(stepId).catch(() => {});
                  queryClient.invalidateQueries({ queryKey: ['playbooks', userId, 'lightweight'] });
                  queryClient.invalidateQueries({ queryKey: ['playbooks', userId] });
                  DeviceEventEmitter.emit('playbookProgressUpdate', { stepId, playbookId: playbook?.id });
                }}
                onJournalExpanded={setJournalExpanded}
                onJournalCollapseComplete={() => setJournalCollapseComplete(true)}
                navigation={navigation}
                collapseAnimRef={fabCollapseAnimRef}
              />
            )}

            {stepIndex === 4 && (
              <PrayerStep
                prayer={prayerText}
                playbookTitle={playbook.title}
                playbookId={playbook.id}
                userId={userId}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 5 && (
              <WordToSpeakStep
                word={wordToSpeak}
                playbookId={playbook.id}
                onNext={goNext}
                insets={insets}
              />
            )}

            {stepIndex === 6 && (
              <CompletionStep
                title={playbook.title}
                closingText={closingText}
                pastoralClosing={pastoralClosing}
                onFinish={handleFinish}
                insets={insets}
                onTurnIntoDevotional={() => setShowDevotionalModal(true)}
                devotionalGenerated={devotionalGenerated}
                isCompleted={routePlaybook?.status === 'completed'}
                isOnboarding={source === 'onboarding'}
                navigation={navigation}
                fromNotification={fromNotification}
              />
            )}
          </Animated.View>

      {/* Floating close button — top left (steps 0–5), always closes the screen */}
      {stepIndex !== 6 && (source as any) !== 'onboarding' && (
        <Animated.View
          style={[
            styles.closeButton,
            { top: insets.top + 8 },
            {
              opacity: stepIndex === 0 ? screen0CloseAnim : 1,
              transform: [
                {
                  scale: stepIndex === 0 ? screen0CloseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : 1,
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={source === 'onboarding' ? handleSkipWalkthrough : () => { triggerLightHaptic(); navigation.goBack(); }}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={source === 'onboarding' ? 'close-outline' : 'close'} size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Animated share button — top left, completion page only */}
      {stepIndex === 6 && (
        <>
          {/* Close button for notification deep links — beside share button */}
          {fromNotification && (
            <Animated.View
              style={[
                styles.closeButton,
                { top: insets.top + 8, right: 20 },
                {
                  opacity: shareButtonAnim,
                  transform: [
                    {
                      scale: shareButtonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  navigation.goBack();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            </Animated.View>
          )}
          <Animated.View
            style={[
              styles.closeButton,
              { top: insets.top + 8, right: fromNotification ? 70 : 20 },
              {
                opacity: shareButtonAnim,
                transform: [
                  {
                    scale: shareButtonAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setShowShareDropdown(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-outline" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}


      <FloatingRefinementControl
        active={stepIndex === 1}
        refinementsRemaining={refinementsRemaining}
        isRefining={isRefining}
        insets={insets}
        onRefineSubmit={handleRefinePlaybook}
        onUpgradeNeeded={() => {
          navigation.navigate('OnboardingSalesOffer' as any, {
            upgradeMode: true,
            source: 'refinement_limit',
            feature: 'refinement',
            featureType: 'refinement',
            skipNotificationPreference: true,
            dismissBehavior: 'goBack',
          });
        }}
      />


      {/* Floating coral next button — bottom right */}
      {hasFloatingNext && (
        <Animated.View
          style={[
            styles.nextButton,
            { bottom: insets.bottom + 20 },
            {
              opacity: stepIndex === 0 ? screen0NextAnim : stepIndex === 2 ? scriptureNextAnim : stepIndex === 4 ? prayerNextAnim : 1,
              transform: [
                {
                  scale: stepIndex === 0 ? screen0NextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : stepIndex === 2 ? scriptureNextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : stepIndex === 4 ? prayerNextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }) : 1,
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={goNext}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>

    <DevotionalModal
      visible={showDevotionalModal}
      onClose={() => setShowDevotionalModal(false)}
      playbookId={playbook?.id}
      playbookInfo={playbook?.title}
      userInput={playbook?.userInput}
      isOnboarding={source === 'onboarding'}
      onDevotionalCreated={(devotionalId) => {
        setShowDevotionalModal(false);
        setDevotionalGenerated(true);
        navigation.navigate('DevotionalDetail', { devotionalId });
      }}
    />

    <ShareDropdownModal
      visible={showShareDropdown}
      onClose={() => setShowShareDropdown(false)}
      onExportPDF={handleExportPDF}
      playbookTitle={playbook?.title}
    />

    {/* Onboarding-only "Your playbook is ready" overlay — appears once */}
    <PlaybookReadyOverlay
      visible={showReadyOverlay}
      onDismiss={handleDismissReadyOverlay}
    />
    </>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  // Dots — matches original PlaybookDetailGuided pagination style
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 10,
    backgroundColor: Colors.anchorBlue,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: Colors.growthGreen,
    width: 24,
  },
  // Close/share — top-right circle
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
  // Back button below skip button — aligned with close button
  backButtonBelowSkip: {
    position: 'absolute',
    right: -8,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    top: 56,
  },
  // Onboarding-specific UI
  onboardingTopBar: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  skipButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  progressIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 20,
  },
  progressText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  // Next — matches original: absolute, bottom-right, coral circle
  nextButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: SCREEN_HEIGHT * 0.7,
    justifyContent: 'flex-start',
  },

  // Enter the Moment
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  playbookLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  userInputCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 20,
    minHeight: 60,
  },
  userInputText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  title: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  summaryBlock: {
    gap: 16,
    marginTop: 'auto',
    marginBottom: 36,
  },
  // Line 0: personalized sentence — large + bold, like the hero title
  summaryLead: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 34,
    marginBottom: 36,
  },
  // Lines 1+: pause + Jesus line — smaller, muted, left-aligned
  summaryMuted: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 22,
  },

  // Shared label row (icon + text)
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 48,
  },
  stepLabelWhite: {
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },

  // Truth in Love
  textBlock: {
    gap: 14,
    marginTop: 28,
    marginBottom: 36,
  },
  bodyText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },
  refinementBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
  refinementBackdropBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  refinementBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  floatingRefinementButtonWrap: {
    position: 'absolute',
    right: 72,
    zIndex: 130,
  },
  floatingRefinementButton: {
    minHeight: 40,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 7,
  },
  floatingRefinementButtonOpen: {
    backgroundColor: 'rgba(230, 90, 70, 0.28)',
    borderColor: 'rgba(230, 90, 70, 0.48)',
  },
  floatingRefinementButtonText: {
    color: Colors.hopeWhite,
    fontSize: 13,
  },
  floatingRefinementPanel: {
    position: 'absolute',
    right: 20,
    zIndex: 125,
    borderRadius: 28,
    backgroundColor: Colors.anchorBlue,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  floatingRefinementReasons: {
    gap: 8,
  },
  refinementCountBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(230, 90, 70, 0.34)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refinementCountBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 11,
  },
  refinementReasonButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  refinementReasonButtonSelected: {
    backgroundColor: 'rgba(230, 90, 70, 0.22)',
    borderColor: 'rgba(230, 90, 70, 0.58)',
  },
  refinementReasonText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    flexShrink: 1,
  },
  refinementReasonTextSelected: {
    color: Colors.hopeWhite,
  },
  refinementFloatingInputBlock: {
    marginTop: 10,
  },
  refinementInput: {
    minHeight: 112,
    maxHeight: 170,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  refinementSubmitButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  refinementSubmitButtonDisabled: {
    opacity: 0.52,
  },
  refinementSubmitButtonText: {
    color: Colors.hopeWhite,
    fontSize: 15,
  },

  // Scripture
  // alertCoral vertical bar on the left — blockquote style
  verseCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.alertCoral,
    borderRadius: 2,
    paddingLeft: 18,
    paddingVertical: 4,
    marginTop: 28,
    marginBottom: 28,
  },
  verseRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  scriptureRef: {
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.alertCoral,
  },
  versionBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  versionAndInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  versionText: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
  },
  scriptureText: {
    fontSize: 19,
    color: Colors.hopeWhite,
    lineHeight: 28,
  },
  reflectionBlock: {
    gap: 8,
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  reflectionNote: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
    opacity: 0.7,
  },

  // Faithful Actions
  actionIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  stepNumberContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  // Body line styles — smart rendering
  actionBodyLine: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 25,
  },
  bodyLineQuote: {
    fontSize: 16,
    color: Colors.faithGold,
    lineHeight: 24,
    fontStyle: 'italic',
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.faithGold,
  },
  bodyLineIntro: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.90)',
    lineHeight: 25,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  bodyLineBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginTop: 4,
    paddingLeft: 16,
  },
  bodyLineBulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,107,107,0.4)',
    marginTop: 8,
    marginRight: 10,
    flexShrink: 0,
  },
  bodyLineBullet: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
  // Example block — matches ActionStepsCard original design
  exampleContainer: {
    marginTop: 12,
    marginLeft: 28,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 12,
    paddingRight: 4,
  },
  exampleHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  actionWisdomContainer: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  actionWisdomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionWisdomHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionWisdomLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionWisdomCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center' as const,
    fontSize: 11,
    color: Colors.alertCoral,
    backgroundColor: 'rgba(255,107,107,0.16)',
    paddingHorizontal: 6,
    lineHeight: 20,
  },
  actionWisdomIntro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
  },
  actionWisdomThreadList: {
    gap: 16,
  },
  actionWisdomThreadItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  actionWisdomThreadRail: {
    width: 18,
    alignItems: 'center',
  },
  actionWisdomThreadDot: {
    width: 9,
    height: 9,
    backgroundColor: Colors.alertCoral,
    marginTop: 6,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  actionWisdomThreadLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 6,
  },
  actionWisdomThreadContent: {
    flex: 1,
    paddingBottom: 2,
  },
  actionWisdomThreadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionWisdomThreadMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.54)',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  actionWisdomQuestionBlock: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionWisdomResponseBlock: {
    paddingTop: 0,
  },
  actionWisdomUserRow: {
    alignItems: 'stretch',
    marginBottom: 14,
  },
  actionWisdomAssistantRow: {
    alignItems: 'stretch',
  },
  actionWisdomUserBubble: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionWisdomAssistantBubble: {
    paddingTop: 0,
  },
  actionWisdomAssistantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  actionWisdomThreadLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  actionWisdomUserText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 21,
  },
  actionWisdomThreadDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 14,
  },
  actionWisdomCollapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  actionWisdomCollapseButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  actionWisdomOutroWrapper: {
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  actionWisdomTextWrapper: {
    minHeight: 22,
    overflow: 'visible',
  },
  actionWisdomIntroTextInput: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    minHeight: 22,
  },
  actionWisdomBlockDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
  },
  actionWisdomStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  actionWisdomStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionWisdomStepNumber: {
    fontSize: 10,
    color: Colors.alertCoral,
    lineHeight: 14,
  },
  actionWisdomStepTextWrapper: {
    flex: 1,
    paddingTop: 3,
  },
  actionWisdomStepTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 21,
    marginBottom: 2,
  },
  actionWisdomStepTitleTextInput: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 21,
    padding: 0,
    margin: 0,
    marginBottom: 2,
    backgroundColor: 'transparent',
    minHeight: 21,
  },
  actionWisdomStepText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 22,
  },
  actionWisdomStepTextInput: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 22,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    minHeight: 22,
  },
  // Choice pills — for 'choose' type steps
  choicePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'flex-start',
    marginVertical: 3,
  },
  choicePillSelected: {
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderColor: Colors.alertCoral,
  },
  choicePillText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 21,
  },
  choicePillTextSelected: {
    color: Colors.hopeWhite,
  },
  journalInputWrapper: {
    marginTop: 8,
    gap: 6,
  },
  journalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    minHeight: 100,
    maxHeight: 200,
  },
  journalSavedLabel: {
    fontSize: 13,
    color: Colors.faithGold,
    alignSelf: 'flex-start',
  },
  actionCounter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
  actionProgressBar: {
    height: 6,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden' as const,
    alignSelf: 'center' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
  },
  actionStepCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 22,
    paddingTop: 14,
    marginBottom: 32,
    gap: 12,
    position: 'relative',
    overflow: 'visible',
  },
  actionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  actionTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 24,
    flex: 1,
  },
  actionTitleContainer: {
    marginBottom: 6,
  },
  actionHowToButton: {
    position: 'absolute',
    top: -15,
    right: 18,
    backgroundColor: '#2c4b78',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
    elevation: 10,
  },
  actionHowToButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionHowToButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  actionBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 23,
  },
  buttonArea: {
    marginTop: 20,
  },
  backButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionFABContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,
  },
  actionFABRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  actionFABCollapsedCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFABCollapsedCircleTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(38, 71, 119, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFABCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c4b78',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionFABDone: {
    flex: 1,
    height: 44,
    backgroundColor: '#2c4b78',
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionFABDoneText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  actionFABSkip: {
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: '#2c4b78',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  savedFeedbackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  savedFeedbackText: {
    fontSize: 12,
    color: Colors.growthGreen,
    opacity: 0.9,
  },
  journalExpandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  journalTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  journalIconButton: {
    alignItems: 'center',
    gap: 5,
  },
  journalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  journalIconLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  doneSkipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  doneButtonCommitted: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  doneButtonTextCommitted: {
    color: Colors.alertCoral,
  },
  doneButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },

  // Outer container for Prayer + Word to Speak — flex column so content can center
  prayerStepOuter: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 0,
  },

  // Prayer
  prayerBlock: {
    marginTop: 28,
  },
  prayerText: {
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    opacity: 0.9,
  },
  // "I prayed this" — devotional-style toggleable pill
  prayerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  prayerActionButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  prayerActionButtonFloating: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  prayerActionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  prayerActionTextActive: {
    color: Colors.alertCoral,
  },

  // Word to Speak
  wordBlock: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 36,
    gap: 14,
  },
  wordLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  wordNumberContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  wordNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  wordText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.hopeWhite,
    lineHeight: 32,
    textAlign: 'left',
    flex: 1,
  },

  // Completion
  completionHeaderContainer: {
    gap: 8,
    marginBottom: 28,
    alignItems: 'center',
    marginTop: -8,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  howToButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  howToButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  completionPlaybookLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 0,
  },
  completionTitle: {
    fontSize: 22,
    color: Colors.hopeWhite,
    lineHeight: 28,
    textAlign: 'center',
  },
  completionPastoralClosing: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginBottom: 28,
    opacity: 0.88,
  },
  completionContext: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.hopeWhite,
    lineHeight: 20,
    marginBottom: 16,
  },
  completionQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginBottom: 20,
  },
  completionChoicesContainer: {
    gap: 12,
    marginBottom: 32,
  },
  completionActionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  completionActionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  completionActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  completionActionNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  completionActionLine: {
    flex: 1,
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionStayNote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: -4,
    marginTop: 32,
  },
  completionChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  completionChoicePillActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  completionChoiceText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  completionChoiceTextActive: {
    color: Colors.alertCoral,
  },
  completionBody: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 25,
    marginBottom: 10,
  },
  finishButton: {
    marginTop: 32,
    justifyContent: 'center',
  },

  // Shared buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  devotionalButton: {
    marginTop: 8,
  },

  // Transition line — calm bridge shown at bottom of Step 0
  transitionLineContainer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  transitionLineText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  confirmButton: {
    borderWidth: 1.5,
    borderColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 'auto',
  },
  confirmButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(PlaybookWalkthroughScreen, 'PlaybookWalkthroughScreen');
