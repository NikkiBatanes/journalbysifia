import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreatePrayer } from '../services/hooks/usePrayerData';
import { analytics } from '../utils/analytics';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayerJournalWalkthrough'>;

// Prayer Path Data
interface PrayerPath {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const PRAYER_PATHS: PrayerPath[] = [
  { 
    id: 'acts', 
    name: 'CAST Method', 
    description: 'Confession · Adoration · Supplication · Thanksgiving',
    icon: 'layers',
  },
  { 
    id: 'open', 
    name: 'Open Prayer', 
    description: 'Pray in your own words without a fixed structure.',
    icon: 'chatbubble-ellipses-outline',
  },
];

// ACTS Prayer Steps
const ACTS_STEPS = [
  { key: 'confession', label: 'CONFESSION', title: 'Confession', description: 'Tell the truth about what you need to lay down.' },
  { key: 'adoration', label: 'ADORATION', title: 'Adoration', description: 'Name who God is in the middle of this.' },
  { key: 'supplication', label: 'SUPPLICATION', title: 'Supplication', description: 'Ask for what you need from the Lord.' },
  { key: 'thanksgiving', label: 'THANKSGIVING', title: 'Thanksgiving', description: 'Thank Him for what is already true and given.' },
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

// Step 1: Prayer Path Selection
const PrayerPathSelectionStep: React.FC<{
  selectedPath: PrayerPath | null;
  onSelect: (path: PrayerPath) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ selectedPath, onSelect, onNext, insets, navigation }) => {
  const buttonScale = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (selectedPath) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedPath, buttonScale]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER JOURNAL</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              Which prayer path do you want today?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160} style={styles.pathsGrid}>
          {PRAYER_PATHS.map((path, index) => {
            const isSelected = selectedPath?.id === path.id;
            return (
              <TouchableOpacity
                key={path.id}
                style={[styles.pathCard, isSelected && styles.pathCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(path);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.pathIconContainer}>
                  <View style={[
                    styles.pathIconCircle,
                    isSelected && styles.pathIconCircleSelected
                  ]}>
                    <Ionicons
                      name={path.icon as any}
                      size={18}
                      color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
                    />
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.pathName, isSelected && styles.pathNameSelected]}
                >
                  {path.name}
                </ThemedText>
                <ThemedText style={[styles.pathDescription, isSelected && styles.pathDescriptionSelected]}>
                  {path.description}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </StepFadeIn>

        <StepFadeIn delay={240}>
          <View style={styles.metadataContainer}>
            <View style={styles.metadataContent}>
              <ThemedText style={styles.metadataText}>
                Choose a structure if it helps, or pray openly.
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom button */}
      {selectedPath && (
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

// Step 2: ACTS Prayer Flow
const ACTSPrayerStep: React.FC<{
  stepIndex: number;
  prayerTexts: { [key: string]: string };
  onChange: (key: string, text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ stepIndex, prayerTexts, onChange, onNext, onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const currentStep = ACTS_STEPS[stepIndex];

  React.useEffect(() => {
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER JOURNAL</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              {currentStep.title}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <ThemedText style={styles.stepDescription}>
            {currentStep.description}
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.actsStepIndicator}>
            <ThemedText weight="semiBold" style={styles.actsStepLabel}>{currentStep.label}</ThemedText>
            <ThemedText style={styles.actsStepNumber}>
              {stepIndex + 1} of {ACTS_STEPS.length}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <TextInput
            style={styles.personalInput}
            value={prayerTexts[currentStep.key] || ''}
            onChangeText={(text) => onChange(currentStep.key, text)}
            placeholder="Write your prayer here..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="dark"
          />
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

// Step 3: Open Prayer
const OpenPrayerStep: React.FC<{
  prayerText: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ prayerText, onChange, onNext, onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;

  React.useEffect(() => {
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER JOURNAL</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Write your prayer
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <ThemedText style={styles.stepDescription}>
            Pray openly in your own words.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.actsStepIndicator}>
            <ThemedText weight="semiBold" style={styles.actsStepLabel}>OPEN PRAYER</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <TextInput
            style={styles.personalInput}
            value={prayerText}
            onChangeText={onChange}
            placeholder="Write your prayer here..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            multiline
            textAlignVertical="top"
            autoFocus
            keyboardAppearance="dark"
          />
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

// Step 4: Completion Screen
const CompletionStep: React.FC<{
  prayerPath: PrayerPath;
  prayerTexts: { [key: string]: string };
  openPrayerText: string;
  onDone: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ prayerPath, prayerTexts, openPrayerText, onDone, insets, navigation }) => {
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    }).start();

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

  const renderACTSPrayer = () => {
    return ACTS_STEPS.map((step, index) => {
      const text = prayerTexts[step.key];
      if (!text || text.trim() === '') return null;

      return (
        <View key={step.key} style={styles.completionSection}>
          <ThemedText weight="medium" style={styles.completionSectionLabel}>{step.label}</ThemedText>
          <ThemedText style={styles.completionSectionText}>{text}</ThemedText>
          {step.key === 'supplication' && (
            <TouchableOpacity style={styles.markAnsweredButton}>
              <ThemedText style={styles.markAnsweredButtonText}>Mark as Answered</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  const renderOpenPrayer = () => {
    if (!openPrayerText || openPrayerText.trim() === '') return null;

    return (
      <View style={styles.completionSection}>
        <ThemedText weight="medium" style={styles.completionSectionLabel}>OPEN PRAYER</ThemedText>
        <ThemedText style={styles.completionSectionText}>{openPrayerText}</ThemedText>
      </View>
    );
  };

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            PRAYER JOURNAL
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
              <MaterialCommunityIcons name="hands-pray" size={24} color={Colors.alertCoral} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>Saved Prayer</ThemedText>
              <ThemedText style={styles.completionSubtext}>A place to return to what you placed before God.</ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER PATH</ThemedText>
            <ThemedText style={styles.completionSectionText}>{prayerPath.name}</ThemedText>
          </View>

          {prayerPath.id === 'acts' ? renderACTSPrayer() : renderOpenPrayer()}
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
            Save Prayer
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Screen Component
const PrayerJournalWalkthroughScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedDate: selectedDateStr } = route.params || {};
  const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPath, setSelectedPath] = useState<PrayerPath | null>(null);
  const [actsStepIndex, setActsStepIndex] = useState(0);
  const [prayerTexts, setPrayerTexts] = useState<{ [key: string]: string }>({});
  const [openPrayerText, setOpenPrayerText] = useState('');

  const createMutation = useCreatePrayer();
  const dateStr = toLocalDateString(selectedDate);

  // Hide status bar for translucent scrolling effect
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle('light-content');
      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('light-content');
      };
    }, [])
  );

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save your prayer.');
      return;
    }

    try {
      if (selectedPath?.id === 'acts') {
        // Save each ACTS prayer as separate entries
        for (const step of ACTS_STEPS) {
          const text = prayerTexts[step.key];
          if (text && text.trim()) {
            await createMutation.mutateAsync({
              user_id: user.id,
              selected_date: dateStr,
              prayer_type: 'journal',
              journal_category: step.key as 'adoration' | 'confession' | 'thanksgiving' | 'supplication',
              content: text.trim(),
              status: step.key === 'supplication' ? 'pending' : undefined,
            });
          }
        }
      } else if (selectedPath?.id === 'open' && openPrayerText.trim()) {
        // Save open prayer
        await createMutation.mutateAsync({
          user_id: user.id,
          selected_date: dateStr,
          prayer_type: 'journal',
          journal_category: 'personal_prayer',
          content: openPrayerText.trim(),
          status: 'pending',
        });
      }

      // Invalidate cache to ensure UI updates with new data
      await queryClient.invalidateQueries({ queryKey: ['prayers', 'acts', user.id, dateStr] });
      await queryClient.invalidateQueries({ queryKey: ['journal', 'all'] });

      analytics.trackPrayerEvent('prayer_created', {
        prayer_type: selectedPath?.id === 'acts' ? 'supplication' : 'adoration',
        content_length: selectedPath?.id === 'acts' 
          ? Object.values(prayerTexts).join('').length 
          : openPrayerText.length,
        date: dateStr,
      }, user.id);

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedPath?.id === 'acts') {
      setCurrentStep(1); // Go to ACTS flow
    } else if (currentStep === 1 && actsStepIndex < ACTS_STEPS.length - 1) {
      setActsStepIndex(actsStepIndex + 1);
    } else if (currentStep === 1 && actsStepIndex === ACTS_STEPS.length - 1) {
      setCurrentStep(2); // Go to completion
    } else if (currentStep === 0 && selectedPath?.id === 'open') {
      setCurrentStep(2); // Go directly to completion for open prayer
    }
  };

  const handleBack = () => {
    if (currentStep === 1 && actsStepIndex > 0) {
      setActsStepIndex(actsStepIndex - 1);
    } else if (currentStep === 1 && actsStepIndex === 0) {
      setCurrentStep(0);
      setActsStepIndex(0);
    } else if (currentStep === 2) {
      // Go back to appropriate step
      if (selectedPath?.id === 'acts') {
        setCurrentStep(1);
        setActsStepIndex(ACTS_STEPS.length - 1);
      } else {
        setCurrentStep(0);
      }
    } else {
      navigation.goBack();
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Swipe gesture handlers
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onEnd((event) => {
      const { translationX } = event;

      // Swipe right to go back
      if (translationX > screenWidth * 0.3) {
        runOnJS(handleBack)();
        runOnJS(triggerMediumHaptic)();
      }
      // Swipe left to go forward
      else if (translationX < -screenWidth * 0.3) {
        // Prevent forward swipe on step 0 if no path is selected
        if (currentStep === 0 && !selectedPath) {
          return;
        }
        runOnJS(handleNext)();
        runOnJS(triggerMediumHaptic)();
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        {currentStep === 0 && (
          <PrayerPathSelectionStep
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            onNext={handleNext}
            insets={insets}
            navigation={navigation}
          />
        )}

        {currentStep === 1 && selectedPath?.id === 'acts' && (
          <ACTSPrayerStep
            stepIndex={actsStepIndex}
            prayerTexts={prayerTexts}
            onChange={(key, text) => {
              setPrayerTexts(prev => ({ ...prev, [key]: text }));
            }}
            onNext={handleNext}
            onBack={handleBack}
            insets={insets}
            navigation={navigation}
          />
        )}

        {currentStep === 2 && selectedPath && (
          <CompletionStep
            prayerPath={selectedPath}
            prayerTexts={prayerTexts}
            openPrayerText={openPrayerText}
            onDone={handleSave}
            insets={insets}
            navigation={navigation}
          />
        )}
      </View>
    </GestureDetector>
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
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 32,
    textAlign: 'center',
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 16,
    textAlign: 'left',
  },
  stepDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  labelIcon: {
    marginTop: 1,
  },
  metadataContainer: {
    marginTop: 32,
    marginBottom: 24,
  },
  metadataContent: {
    flex: 1,
  },
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'center',
  },
  pathsGrid: {
    gap: 16,
  },
  pathCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pathCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: Colors.alertCoral,
  },
  pathIconContainer: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pathIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  pathName: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  pathNameSelected: {
    color: Colors.alertCoral,
  },
  pathDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  pathDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actsStepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actsStepLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.alertCoral,
  },
  actsStepNumber: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  personalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: Colors.hopeWhite,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  primaryButton: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 32,
  },
  stepLabelWhite: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  completionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionHeaderContent: {
    flex: 1,
    marginLeft: 16,
  },
  completionCategory: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  completionSectionLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.alertCoral,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  markAnsweredButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  markAnsweredButtonText: {
    fontSize: 12,
    color: '#FF9500',
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  completionButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default withErrorBoundary(PrayerJournalWalkthroughScreen);
