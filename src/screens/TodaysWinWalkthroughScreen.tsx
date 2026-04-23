import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  UIManager,
  LayoutAnimation,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreateTodayWinEntry, useUpdateTodayWinEntry, useTodayWinData } from '../services/hooks/useJournalData';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodaysWinWalkthrough'>;

interface RouteParams {
  selectedDate?: string;
}

// Win Type Data
interface WinType {
  id: string;
  name: string;
  category: string;
}

const WIN_TYPES: WinType[] = [
  // Core 6 (shown by default)
  { id: 'followed-through', name: 'I followed through', category: 'Practical' },
  { id: 'chose-peace', name: 'I chose peace', category: 'Inner Life' },
  { id: 'told-truth', name: 'I told the truth', category: 'Relationships' },
  { id: 'showed-up', name: 'I showed up', category: 'Practical' },
  { id: 'chose-trust', name: 'I chose trust', category: 'Faith' },
  { id: 'kept-going', name: 'I kept going', category: 'Inner Life' },

  // Additional wins
  { id: 'took-next-step', name: 'I took the next step', category: 'Work' },
  { id: 'god-provided', name: 'God provided', category: 'Faith' },
  { id: 'asked-for-help', name: 'I asked for help', category: 'Inner Life' },
  { id: 'let-go', name: 'I let go', category: 'Inner Life' },
  { id: 'forgave', name: 'I forgave', category: 'Relationships' },
  { id: 'apologized', name: 'I apologized', category: 'Relationships' },
  { id: 'set-boundary', name: 'I set a boundary', category: 'Relationships' },
  { id: 'was-patient', name: 'I was patient', category: 'Relationships' },
  { id: 'showed-kindness', name: 'I showed kindness', category: 'Relationships' },
  { id: 'stayed-faithful', name: 'I stayed faithful', category: 'Faith' },
  { id: 'obeyed-hard', name: 'I obeyed when it was hard', category: 'Faith' },
  { id: 'brought-to-god', name: 'I brought it to God', category: 'Faith' },
  { id: 'prayed-panicking', name: 'I prayed instead of panicking', category: 'Faith' },
  { id: 'shared-gospel', name: 'I shared the gospel', category: 'Faith' },
  { id: 'shared-jesus', name: 'I shared Jesus', category: 'Faith' },
  { id: 'finished-hard', name: 'I finished something hard', category: 'Practical' },
  { id: 'rested-needed', name: 'I rested when I needed to', category: 'Health' },
  { id: 'took-care-body', name: 'I took care of my body', category: 'Health' },
  { id: 'worked-out', name: 'I worked out', category: 'Health' },
  { id: 'ate-well', name: 'I ate well today', category: 'Health' },
  { id: 'took-care-skin', name: 'I took care of my skin', category: 'Health' },
  { id: 'got-ready', name: 'I got ready for the day', category: 'Home' },
  { id: 'cared-home', name: 'I cared for my home', category: 'Home' },
  { id: 'cared-child', name: 'I cared for my child', category: 'Motherhood' },
  { id: 'stayed-present-motherhood', name: 'I stayed present in motherhood', category: 'Motherhood' },
  { id: 'handled-family', name: 'I handled what my family needed', category: 'Family' },
  { id: 'passed-exam', name: 'I passed the exam', category: 'School' },
  { id: 'finished-assignment', name: 'I finished my assignment', category: 'School' },
  { id: 'studied-needed', name: 'I studied when I needed to', category: 'School' },
  { id: 'showed-up-school', name: 'I showed up', category: 'School' },
  { id: 'kept-going-school', name: 'I kept going', category: 'School' },
  { id: 'made-progress-business', name: 'I made progress in business', category: 'Business' },
  { id: 'made-hard-decision', name: 'I made a hard decision', category: 'Business' },
  { id: 'showed-up-work', name: 'I showed up for my work', category: 'Work' },
  { id: 'followed-through-work', name: 'I followed through in work', category: 'Work' },
  { id: 'finished-hard-work', name: 'I finished something hard', category: 'Work' },
  { id: 'reached-out', name: 'I reached out', category: 'Relationships' },
  { id: 'encouraged-someone', name: 'I encouraged someone', category: 'Relationships' },
  { id: 'god-made-way', name: 'God made a way', category: 'Faith' },
  // Additional items to complete categories
  { id: 'handled-family-home', name: 'I handled what my family needed', category: 'Home' },
  { id: 'handled-family-motherhood', name: 'I handled what my family needed', category: 'Motherhood' },
  { id: 'showed-kindness-family', name: 'I showed kindness', category: 'Family' },
  { id: 'was-patient-family', name: 'I was patient', category: 'Family' },
  { id: 'reached-out-family', name: 'I reached out', category: 'Family' },
  { id: 'showed-kindness-motherhood', name: 'I showed kindness', category: 'Motherhood' },
  { id: 'was-patient-motherhood', name: 'I was patient', category: 'Motherhood' },
  { id: 'showed-up-business', name: 'I showed up for my work', category: 'Business' },
  { id: 'followed-through-business', name: 'I followed through in work', category: 'Business' },
  { id: 'finished-hard-business', name: 'I finished something hard', category: 'Business' },
];

const CORE_WIN_TYPES = WIN_TYPES.slice(0, 6);

const CATEGORIES = [
  'Faith',
  'Inner Life',
  'Relationships',
  'Practical',
  'Home',
  'Family',
  'Motherhood',
  'Health',
  'School',
  'Work',
  'Business',
];

// StepFadeIn component
interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
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
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// Step 1: Win Type Selection
const WinTypeSelectionStep: React.FC<{
  selectedWinType: WinType | null;
  onSelect: (winType: WinType) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ selectedWinType, onSelect, onNext, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Faith');
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const screenHeight = useRef(0).current;

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    if (selectedWinType) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedWinType, buttonScale]);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 325,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="emoji-events" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>TODAY'S WIN</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              What kind of win did{'\n'}today hold?
            </ThemedText>
          </View>
        </StepFadeIn>

        {/* Category filter row - shown when expanded */}
        {isExpanded && (
          <StepFadeIn delay={100}>
            <View style={styles.categoryFilterScroll}>
              <View style={styles.categoryFilterContent}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryFilterChip,
                      selectedCategory === category && styles.categoryFilterChipSelected,
                    ]}
                    onPress={() => {
                      triggerLightHaptic();
                      setSelectedCategory(category);
                    }}
                    activeOpacity={0.75}
                  >
                    <ThemedText
                      style={[
                        styles.categoryFilterText,
                        selectedCategory === category && styles.categoryFilterTextSelected,
                      ]}
                    >
                      {category}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </StepFadeIn>
        )}

        {/* Win type chips */}
        <StepFadeIn delay={120} style={styles.winTypesGrid}>
          {!isExpanded ? (
            // Collapsed state: Show only 6 core wins
            CORE_WIN_TYPES.map((winType, index) => {
              const isSelected = selectedWinType?.id === winType.id;
              return (
                <TouchableOpacity
                  key={winType.id}
                  style={[styles.winTypeCard, isSelected && styles.winTypeCardSelected]}
                  onPress={() => {
                    triggerLightHaptic();
                    onSelect(winType);
                  }}
                  activeOpacity={0.75}
                >
                  <ThemedText
                    style={[styles.winTypeName, isSelected && styles.winTypeNameSelected]}
                    numberOfLines={2}
                  >
                    {winType.name}
                  </ThemedText>
                </TouchableOpacity>
              );
            })
          ) : (
            // Expanded state: Show filtered win types
            WIN_TYPES.filter(
              (winType) => winType.category === selectedCategory
            ).map((winType, index) => {
              const isSelected = selectedWinType?.id === winType.id;
              return (
                <TouchableOpacity
                  key={winType.id}
                  style={[styles.winTypeCard, isSelected && styles.winTypeCardSelected]}
                  onPress={() => {
                    triggerLightHaptic();
                    onSelect(winType);
                  }}
                  activeOpacity={0.75}
                >
                  <ThemedText
                    style={[styles.winTypeName, isSelected && styles.winTypeNameSelected]}
                    numberOfLines={2}
                  >
                    {winType.name}
                  </ThemedText>
                </TouchableOpacity>
              );
            })
          )}
        </StepFadeIn>

        {/* Show more/less button */}
        <StepFadeIn delay={160}>
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => {
              triggerLightHaptic();
              setIsExpanded(!isExpanded);
              if (!isExpanded) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              }
            }}
            activeOpacity={0.75}
          >
            <ThemedText style={styles.showMoreButtonText}>
              {isExpanded ? 'Show less' : 'Show more'}
            </ThemedText>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.alertCoral}
              style={styles.showMoreButtonIcon}
            />
          </TouchableOpacity>
        </StepFadeIn>

        <StepFadeIn delay={200}>
          <View style={styles.metadataContainer}>
            <View style={styles.verticalLine} />
            <View style={styles.metadataContent}>
              <ThemedText weight="medium" style={styles.fromText}>
                TIP
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                Choose the one that feels closest, then continue.
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom button */}
      {selectedWinType && (
        <Animated.View style={[styles.primaryButton, { bottom: insets.bottom + 20, transform: [{ scale: buttonScale }] }]}>
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onNext();
            }}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2: Quiet Win Description
const QuietWinStep: React.FC<{
  quietWin: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  winType: WinType;
}> = ({ quietWin, onChange, onNext, onBack, insets, navigation, winType }) => {
  const verticalLineHeight = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const buttonPosition = useRef(new Animated.Value(insets.bottom + 20)).current;

  useEffect(() => {
    Animated.timing(verticalLineHeight, {
      toValue: 60,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 325,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialIcons name="emoji-events" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>TODAY'S WIN</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              What felt like a quiet win today?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <TextInput
            style={styles.quietWinInput}
            value={quietWin}
            onChangeText={onChange}
            placeholder="Name one moment from today and thank God for it..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="dark"
          />
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.metadataContainer}>
            <Animated.View style={[styles.verticalLine, { height: verticalLineHeight }]} />
            <View style={styles.metadataContent}>
              <MaterialCommunityIcons name="trophy" size={18} color={Colors.alertCoral} style={styles.metadataIcon} />
              <ThemedText weight="medium" style={styles.fromText}>
                KIND OF WIN
              </ThemedText>
              <ThemedText style={styles.metadataText}>
                <ThemedText weight="semiBold">{winType.name}</ThemedText>
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </Animated.View>

      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 3: Completion Screen
const CompletionStep: React.FC<{
  winType: WinType;
  quietWin: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ winType, quietWin, onDone, insets, navigation }) => {
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate checkmark
    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Animate icon container with rotation
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialIcons name="emoji-events" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            TODAY'S WIN
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={80} style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Animated.View style={[
              styles.completionIconContainer,
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
              <MaterialIcons name="emoji-events" size={24} color={Colors.alertCoral} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>
                {winType.name}
              </ThemedText>
              <ThemedText style={styles.completionSubtext}>Your win is saved for today</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] }
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          {quietWin.trim() && (
            <View style={styles.completionSection}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>Quiet Win</ThemedText>
              <ThemedText style={styles.completionSectionText}>{quietWin}</ThemedText>
            </View>
          )}

          <View style={styles.completionFooter}>
            <ThemedText style={styles.completionFooterText}>
              A small moment named with gratitude.
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onDone();
          }}
          activeOpacity={0.85}
          style={styles.completionButton}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            Save for today
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Screen Component
const TodaysWinWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = { top: 50, bottom: 34 };
  const { user } = useAuth();
  const { selectedDate: selectedDateStr } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWinType, setSelectedWinType] = useState<WinType | null>(null);
  const [quietWin, setQuietWin] = useState('');
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);

  const dateStr = toLocalDateString(selectedDate);

  const createMutation = useCreateTodayWinEntry();
  const updateMutation = useUpdateTodayWinEntry();

  // Fetch existing Today's Win data when component mounts
  const { data: existingEntries } = useTodayWinData(user?.id || '', dateStr);
  const existingEntry = existingEntries?.[0] || null;

  React.useEffect(() => {
    if (existingEntry) {
      try {
        const content = typeof existingEntry.content === 'string' ? JSON.parse(existingEntry.content) : existingEntry.content;
        if (content.winType) {
          const winType = WIN_TYPES.find(wt => wt.id === content.winType);
          if (winType) {
            setSelectedWinType(winType);
          }
        }
        if (content.quietWin) {
          setQuietWin(content.quietWin);
        }
        setExistingEntryId(existingEntry.id);
      } catch (error) {
        console.error('Error parsing existing win data:', error);
      }
    }
  }, [existingEntry]);

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleDone = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save your win.');
      return;
    }

    try {
      console.log('🏆 Saving win:', { userId: user.id, dateStr, winType: selectedWinType?.id, quietWin, existingEntryId });

      if (existingEntryId) {
        // Update existing entry
        const result = await updateMutation.mutateAsync({
          id: existingEntryId,
          updates: {
            content: JSON.stringify({
              winType: selectedWinType?.id,
              quietWin: quietWin,
            }),
          },
        });
        console.log('🏆 Win updated successfully:', result);
      } else {
        // Create new entry
        const result = await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          content: JSON.stringify({
            winType: selectedWinType?.id,
            quietWin: quietWin,
          }),
        });
        console.log('🏆 Win created successfully:', result);
      }

      triggerMediumHaptic();
      navigation.goBack();
    } catch (error) {
      console.error('🏆 Error saving win:', error);
      Alert.alert('Error', 'Failed to save your win. Please try again.');
    }
  };

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('light-content');
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      {currentStep === 1 && (
        <WinTypeSelectionStep
          selectedWinType={selectedWinType}
          onSelect={setSelectedWinType}
          onNext={handleNext}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 2 && selectedWinType && (
        <QuietWinStep
          quietWin={quietWin}
          onChange={setQuietWin}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          winType={selectedWinType}
        />
      )}

      {currentStep === 3 && selectedWinType && (
        <CompletionStep
          winType={selectedWinType}
          quietWin={quietWin}
          onDone={handleDone}
          insets={insets}
          navigation={navigation}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  labelIcon: {
    marginTop: 1,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  titleRowLeft: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 32,
    textAlign: 'center',
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 24,
    marginBottom: 32,
  },
  winTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 48,
  },
  winTypeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  winTypeCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  winTypeName: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  winTypeNameSelected: {
    color: Colors.hopeWhite,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    marginTop: 48,
  },
  stepLabelWhite: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  completionCard: {
    borderRadius: 50,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  completionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completionHeaderContent: {
    flex: 1,
  },
  completionCategory: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    marginBottom: 20,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '500',
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionFooter: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  completionFooterText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  quietWinInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    minHeight: 140,
  },
  metadataContainer: {
    marginTop: 48,
    marginBottom: 24,
    flexDirection: 'row',
  },
  verticalLine: {
    width: 1,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.3,
    marginRight: 12,
    borderRadius: 2,
  },
  metadataContent: {
    flex: 1,
  },
  metadataIcon: {
    marginBottom: 4,
    opacity: 0.8,
  },
  fromText: {
    fontSize: 8,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    opacity: 0.6,
    marginBottom: 4,
    lineHeight: 16,
  },
  categoryFilterScroll: {
    marginBottom: 32,
  },
  categoryFilterContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryFilterChipSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  categoryFilterText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  categoryFilterTextSelected: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  showMoreButtonText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  showMoreButtonIcon: {
    marginLeft: 4,
  },
  completionContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  checkmarkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  completionSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  summaryContainer: {
    gap: 24,
  },
  summarySection: {
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  doneButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  doneButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
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
});

export default withErrorBoundary(TodaysWinWalkthroughScreen, 'TodaysWinWalkthrough');
