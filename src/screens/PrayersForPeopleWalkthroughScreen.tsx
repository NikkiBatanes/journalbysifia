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
  Keyboard,
  PanResponder,
  useWindowDimensions,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { getLocalPrayer } from '../storage/prayerStorage';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic, triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreatePrayer, useMarkPrayerRequestPrayed, useUpdatePrayer } from '../services/hooks/usePrayerData';
import { analytics } from '../utils/analytics';
import PlaybookMetaSection from '../components/journal/PlaybookMetaSection';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { clearPrayerDraft, getPrayerDraft, getPrayerDraftKey, savePrayerDraft } from '../storage/prayerDraftStorage';

import type { RootStackParamList } from '../navigation/types';
import { exitPrayerFlow } from '../navigation/exitPrayerFlow';
import { visibleStreakService } from '../services/visibleStreakService';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayersForPeopleWalkthrough'>;

const IS_IPAD = Platform.OS === 'ios' && (Platform as any).isPad === true;

// Prayer Type Data
interface PrayerType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const PRAYER_TYPES: PrayerType[] = [
  {
    id: 'prayer-request',
    name: 'Prayer Request',
    description: 'Someone asked for prayer directly.',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    id: 'pray-for-someone',
    name: 'Pray for Someone',
    description: 'You feel nudged to pray for someone on your own',
    icon: 'heart',
  },
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
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// Step 1: Prayer Type Selection
const PrayerTypeSelectionStep: React.FC<{
  selectedType: PrayerType | null;
  onSelect: (type: PrayerType) => void;
  onNext: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ selectedType, onSelect, onNext, insets, navigation }) => {
  const buttonScale = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (selectedType) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [selectedType, buttonScale]);

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYERS FOR PEOPLE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.titleRow}>
            <ThemedText weight="semiBold" style={styles.stepTitle}>
              Which kind of prayer{'\n'}is this?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160} style={styles.categoriesGrid}>
          {PRAYER_TYPES.map((type) => {
            const isSelected = selectedType?.id === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => {
                  triggerLightHaptic();
                  onSelect(type);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.categoryIconContainer}>
                  <View style={[
                    styles.categoryIconCircle,
                    isSelected && styles.categoryIconCircleSelected,
                  ]}>
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={isSelected ? Colors.hopeWhite : Colors.sage}
                    />
                  </View>
                </View>
                <ThemedText
                  weight="semiBold"
                  style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                >
                  {type.name}
                </ThemedText>
                <ThemedText style={[styles.categoryDescription, isSelected && styles.categoryDescriptionSelected]}>
                  {type.description}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </StepFadeIn>

        <StepFadeIn delay={240}>
          <View style={styles.metadataContainer}>
            <View style={styles.metadataContent}>
              <ThemedText style={styles.metadataText}>
                Choose the one that fits this moment.
              </ThemedText>
            </View>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom button */}
      {selectedType && (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: insets.bottom + 20, transform: [{ scale: buttonScale }] }]}>
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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2a1: Prayer Request - Name
const PrayerRequestNameStep: React.FC<{
  personName: string;
  onPersonNameChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, onPersonNameChange, onNext, onBack: _onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: personName.trim() !== '' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [personName, buttonOpacity]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const canProceed = personName.trim() !== '';

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER REQUEST</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Who asked for prayer?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.personalInput}
              value={personName}
              onChangeText={onPersonNameChange}
              placeholder="Enter their name..."
              placeholderTextColor={Colors.placeholderText}
              autoFocus
              keyboardAppearance="light"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : Colors.textGray} />
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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2a2: Prayer Request - Prayer Focus
const PrayerRequestPrayerFocusStep: React.FC<{
  personName: string;
  prayerNeed: string;
  onPrayerNeedChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, prayerNeed, onPrayerNeedChange, onNext, onBack: _onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: prayerNeed.trim() !== '' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [prayerNeed, buttonOpacity]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const canProceed = prayerNeed.trim() !== '';
  const sibilantEndings = ['s', 'S', 'z', 'Z', 'x', 'X'];
  const needsApostropheOnly = sibilantEndings.some(ending => personName.endsWith(ending));
  const possessiveName = needsApostropheOnly
    ? `${personName}'`
    : `${personName}'s`;

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER REQUEST</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              What is {personName} asking prayer for?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.personalInput, styles.multilineInput]}
              value={prayerNeed}
              onChangeText={onPrayerNeedChange}
              placeholder={`Write ${possessiveName} prayer request...`}
              placeholderTextColor={Colors.placeholderText}
              multiline
              textAlignVertical="top"
              autoFocus
              keyboardAppearance="light"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : Colors.textGray} />
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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2a3: Prayer Request - Next Action
const PrayerRequestActionStep: React.FC<{
  personName: string;
  onPrayNow: () => void;
  onSaveRequest: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, onPrayNow, onSaveRequest, insets, navigation }) => (
  <View style={styles.stepContainer}>
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
      showsVerticalScrollIndicator={false}
    >
      <StepFadeIn delay={0}>
        <View style={styles.focusLabelContainer}>
          <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
          <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER REQUEST</ThemedText>
        </View>
      </StepFadeIn>
      <StepFadeIn delay={40}>
        <View style={styles.titleRowLeft}>
          <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
            Would you like to pray for {personName} now?
          </ThemedText>
        </View>
      </StepFadeIn>
      <StepFadeIn delay={100} style={styles.requestActions}>
        <TouchableOpacity style={styles.requestPrimaryAction} onPress={onPrayNow} activeOpacity={0.8}>
          <Ionicons name="hand-left-outline" size={20} color={Colors.hopeWhite} style={{ transform: [{ rotate: '-28deg' }] }} />
          <ThemedText weight="semiBold" style={styles.requestPrimaryActionText}>Pray now</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.requestSecondaryAction} onPress={onSaveRequest} activeOpacity={0.8}>
          <Ionicons name="bookmark-outline" size={19} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.requestSecondaryActionText}>Save request</ThemedText>
        </TouchableOpacity>
      </StepFadeIn>
    </ScrollView>
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
        <Ionicons name="close" size={17} color={Colors.sage} />
      </TouchableOpacity>
    </View>
  </View>
);

// Step 2b1: Pray for Someone - Name
const PrayForSomeoneNameStep: React.FC<{
  personName: string;
  onPersonNameChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, onPersonNameChange, onNext, onBack: _onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: personName.trim() !== '' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [personName, buttonOpacity]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const canProceed = personName.trim() !== '';

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAY FOR SOMEONE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Who are you being nudged to pray for?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.personalInput}
              value={personName}
              onChangeText={onPersonNameChange}
              placeholder="Enter their name..."
              placeholderTextColor={Colors.placeholderText}
              autoFocus
              keyboardAppearance="light"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : Colors.textGray} />
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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2b2: Pray for Someone - Prayer Focus
const PrayForSomeonePrayerFocusStep: React.FC<{
  personName: string;
  prayerText: string;
  onPrayerTextChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  playbookTitle?: string;
  actionStepNumber?: number;
  actionStepTitle?: string;
  stepBody?: string;
  stepExample?: string | null;
  requestContext?: string;
  readOnly?: boolean;
  actionLabel?: string;
}> = ({ personName, prayerText, onPrayerTextChange, onNext, onBack: _onBack, insets, navigation, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample, requestContext, readOnly = false, actionLabel }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: prayerText.trim() !== '' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [prayerText, buttonOpacity]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + ((e.endCoordinates.height || 325) * 0.95),
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.spring(buttonPosition, {
        toValue: insets.bottom + 20,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom, buttonPosition]);

  const canProceed = prayerText.trim() !== '';

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAY FOR SOMEONE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              {readOnly ? `Prayer for ${personName}` : `Pray for ${personName}`}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          {!!requestContext && <View style={{ marginBottom: 14, padding: 14, borderRadius: 16, backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder }}><ThemedText weight="semiBold" style={styles.focusLabel}>HIS REQUEST</ThemedText><ThemedText style={{ color: Colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{requestContext}</ThemedText></View>}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.personalInput, styles.multilineInput]}
              value={prayerText}
              onChangeText={onPrayerTextChange}
              placeholder="Begin your prayer here..."
              placeholderTextColor={Colors.placeholderText}
              multiline
              textAlignVertical="top"
              autoFocus={!readOnly}
              keyboardAppearance="light"
              editable={!readOnly}
            />

            {playbookTitle && (
              <PlaybookMetaSection
                  light
                playbookTitle={playbookTitle}
                actionLabel={actionStepNumber && actionStepTitle
                  ? `Action ${actionStepNumber}: ${actionStepTitle}`
                  : undefined}
                stepBody={stepBody}
                stepExample={stepExample}
              />
            )}
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {actionLabel ? (
        <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onNext();
            }}
            activeOpacity={0.85}
            style={styles.completionButton}
            disabled={!canProceed}
          >
            <ThemedText weight="semiBold" style={styles.completionButtonText}>
              {actionLabel}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: buttonPosition, opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onNext();
            }}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            disabled={!canProceed}
          >
            <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : Colors.textGray} />
          </TouchableOpacity>
        </Animated.View>
      )}

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2b3: Pray for Someone - Track Option
const PrayForSomeoneTrackOptionStep: React.FC<{
  personName: string;
  prayerText: string;
  trackAnswered: boolean | undefined;
  onTrackAnsweredChange: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName: _personName, prayerText: _prayerText, trackAnswered, onTrackAnsweredChange, onNext, onBack: _onBack, insets, navigation }) => {
  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <Ionicons name="hand-left-outline" size={16} color={Colors.sage} style={[styles.labelIcon, { transform: [{ rotate: '-28deg' }] }]} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAY FOR SOMEONE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Do you want to keep praying about this?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.trackOptionsContainer}>
            <TouchableOpacity
              style={[styles.trackOptionButton, trackAnswered === true && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(true);
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="semiBold" style={[styles.trackOptionText, trackAnswered === true && styles.trackOptionTextSelected]}>
                Keep praying
              </ThemedText>
              <ThemedText style={[styles.trackOptionDescription, trackAnswered === true && styles.trackOptionDescriptionSelected]}>
                Add this to Still Praying so you can return to it.
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.trackOptionButton, trackAnswered === false && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(false);
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="semiBold" style={[styles.trackOptionText, trackAnswered === false && styles.trackOptionTextSelected]}>
                Just save this
              </ThemedText>
              <ThemedText style={[styles.trackOptionDescription, trackAnswered === false && styles.trackOptionDescriptionSelected]}>
                Keep this prayer in your journal.
              </ThemedText>
            </TouchableOpacity>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.primaryButton, IS_IPAD && styles.primaryButtonPad, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          disabled={trackAnswered === undefined}
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

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
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 4: Completion Screen
const CompletionStep: React.FC<{
  prayerType: PrayerType;
  personName: string;
  prayerNeed: string;
  prayerText: string;
  onDone: () => void;
  onPrayNow: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  isEditing: boolean;
}> = ({ prayerType, personName, prayerNeed, prayerText, onDone, onPrayNow, insets, navigation: _navigation, isEditing }) => {
  // Animation refs
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Animate checkmark
    const checkmarkAnim = Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 400,
      useNativeDriver: true,
    });

    // Animate icon container with rotation
    const iconAnim = Animated.parallel([
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
    ]);

    checkmarkAnim.start();
    iconAnim.start();

    return () => {
      checkmarkAnim.stop();
      iconAnim.stop();
    };
  }, [checkmarkScale, iconRotation, iconScale]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const prayerContent = prayerType.id === 'prayer-request' ? prayerNeed : prayerText;

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, IS_IPAD && styles.stepContentPad, { paddingTop: insets.top + (IS_IPAD ? 28 : 8), paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <Ionicons name="hand-left-outline" size={18} color={Colors.sage} style={{ transform: [{ rotate: '-28deg' }] }} />
          <ThemedText weight="semiBold" style={styles.stepLabelWhite}>
            PRAYERS FOR PEOPLE
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
              <Ionicons name="hand-left-outline" size={24} color={Colors.sage} style={{ transform: [{ rotate: '-28deg' }] }} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>
                {isEditing
                  ? (prayerType.id === 'prayer-request' ? 'Prayer Request Updated' : `Prayer for ${personName} Updated`)
                  : (prayerType.id === 'prayer-request' ? 'Prayer Request Saved' : `Prayer for ${personName}`)
                }
              </ThemedText>
              <ThemedText style={styles.completionSubtext}>
                {isEditing
                  ? (prayerType.id === 'prayer-request' ? 'You can return to this request anytime and pray' : 'Your prayer has been updated')
                  : (prayerType.id === 'prayer-request' ? 'You can return to this request anytime and pray' : 'Your prayer has been recorded')
                }
              </ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          {prayerType.id === 'prayer-request' ? (
            // Prayer Request: Show PERSON and PRAYER REQUEST sections
            <>
              <View style={styles.completionSection}>
                <ThemedText weight="medium" style={styles.completionSectionLabel}>PERSON</ThemedText>
                <ThemedText style={styles.completionSectionText}>{personName}</ThemedText>
              </View>
              <View style={styles.divider} />
              <View style={styles.completionSection}>
                <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER REQUEST</ThemedText>
                <ThemedText style={styles.completionSectionText}>{prayerContent}</ThemedText>
              </View>
            </>
          ) : (
            // Pray for Someone: Show only Prayer section
            <View style={styles.completionSection}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>Prayer</ThemedText>
              <ThemedText style={styles.completionSectionText}>{prayerContent}</ThemedText>
            </View>
          )}

          <View style={styles.completionFooter}>
            <ThemedText style={styles.completionFooterText}>
              {prayerType.id === 'prayer-request' ? 'A quiet act of love for someone who shared a need.' : 'A quiet act of faithfulness for someone God brought to mind.'}
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, IS_IPAD && styles.completionButtonContainerPad, { bottom: insets.bottom + 20 }]}>
        {prayerType.id === 'prayer-request' ? (
          // Prayer Request: Show Pray Now and Later buttons
          <View style={styles.completionButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                triggerMediumHaptic();
                onPrayNow();
              }}
              activeOpacity={0.85}
              style={[styles.completionButton, { flex: 1, backgroundColor: Colors.sage }]}
            >
              <ThemedText weight="semiBold" style={styles.completionButtonText}>
                Pray for {personName} Now
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                triggerMediumHaptic();
                onDone();
              }}
              activeOpacity={0.85}
              style={[styles.completionButton, { flex: 1, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.cardBorder }]}
            >
              <ThemedText weight="semiBold" style={[styles.completionButtonText, { color: Colors.sage }]}>
                Later
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          // Pray for Someone: Show Done button
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onDone();
            }}
            activeOpacity={0.85}
            style={styles.completionButton}
          >
            <ThemedText weight="semiBold" style={styles.completionButtonText}>
              Done
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Main Screen Component
const PrayersForPeopleWalkthroughScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const prayerUserId = user?.id || 'local';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();
  const queryClient = useQueryClient();
  const { subtaskId, stepId, playbookId, playbookTitle, playbookStatus, actionStepNumber, actionStepTitle, stepBody, stepExample, fromPlaybook } = route.params || {};
  const fromNotificationAnsweredCheck = (route.params as any)?.fromNotificationAnsweredCheck === true;

  // State for walkthrough steps
  const shouldSkipStep0 = route.params?.initialPrayerType || route.params?.initialPersonName;
  const [currentStep, setCurrentStep] = useState(fromNotificationAnsweredCheck ? 2 : shouldSkipStep0 ? 1 : 0);
  const [selectedType, setSelectedType] = useState<PrayerType | null>(null);
  const [personName, setPersonName] = useState('');
  const [prayerNeed, setPrayerNeed] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [trackAnswered, setTrackAnswered] = useState<boolean | undefined>(route.params?.editingPrayerId ? true : undefined);
  const [editingPrayerId, setEditingPrayerId] = useState<string | undefined>(undefined);
  const requestPrayerCreatedRef = useRef(false);

  // State for prayer modal
  const [showPrayerEditorModal, setShowPrayerEditorModal] = useState(false);
  const [modalPrayerName, setModalPrayerName] = useState('');
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [selectedPrayerRequest, setSelectedPrayerRequest] = useState<any>(null);
  const successModal = useSuccessModal(
    () => {
      if (fromPlaybook) {
        // Return to PlaybookWalkthroughScreen and signal step completion
        navigation.pop(2);
        setTimeout(() => {
          DeviceEventEmitter.emit('playbookPrayerSaved', {
            playbookId,
            stepId,
            subtaskId,
            actionStepNumber,
            isEditing: !!editingPrayerId,
          });
        }, 300);
      } else {
        const fromNotification = route.params?.fromNotificationAnsweredCheck === true;
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs' as any,
              params: {
                screen: 'Journal',
                params: {
                  screen: 'JournalMain',
                  params: fromNotification ? {
                    selectedDate: route.params?.selectedDate,
                    targetSection: 'prayer',
                    targetPrayerCarouselIndex: 2,
                    targetPrayerId: editingPrayerId,
                  } : {
                    selectedDate: route.params?.selectedDate,
                  },
                },
              },
            },
          ],
        });
      }
    },
    undefined
  );

  // Get initial data from route params if provided
  useEffect(() => {
    if (route.params?.initialPersonName) {
      setPersonName(route.params.initialPersonName);
    }
    if (route.params?.initialPrayerRequest) {
      setPrayerNeed(route.params.initialPrayerRequest);
    }
    if (route.params?.initialPrayerText) {
      setPrayerText(route.params.initialPrayerText);
    }
    if (route.params?.editingPrayerId) {
      setEditingPrayerId(route.params.editingPrayerId);
    }
    // Pre-select prayer type if provided (editing mode or notification)
    if (route.params?.initialPrayerType) {
      const type = PRAYER_TYPES.find(t => t.id === route.params?.initialPrayerType);
      if (type) {
        setSelectedType(type);
        setCurrentStep(fromNotificationAnsweredCheck ? 2 : 1);
      }
    }
    // Skip step 0 (prayer type selection) when coming from notification with person name
    if (route.params?.initialPersonName && !route.params?.initialPrayerType) {
      setCurrentStep(fromNotificationAnsweredCheck ? 2 : 1);
    }
  }, [route.params, fromNotificationAnsweredCheck]);

  // Use selectedDate from route params or today's date
  const currentDate = new Date();
  const selectedDate = route.params?.selectedDate ? new Date(route.params.selectedDate) : currentDate;
  const dateStr = toLocalDateString(selectedDate);
  const draftType = selectedType?.id === 'prayer-request' || selectedType?.id === 'pray-for-someone' ? selectedType.id : null;
  const draftKey = draftType ? getPrayerDraftKey(draftType, dateStr, subtaskId) : null;
  const loadedDraftKey = useRef<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    if (!editingPrayerId) return;
    let active = true;
    getLocalPrayer(editingPrayerId, dateStr).then(p => { if (active && p) setTrackAnswered(p.metadata?.track_answered !== false); });
    return () => { active = false; };
  }, [editingPrayerId, dateStr]);

  useEffect(() => {
    if (!draftKey || editingPrayerId || fromNotificationAnsweredCheck || loadedDraftKey.current === draftKey) {return;}
    loadedDraftKey.current = draftKey;
    setDraftReady(false);
    getPrayerDraft(draftKey).then((draft) => {
      if (draft) {
        setPersonName(draft.data.personName || '');
        setPrayerNeed(draft.data.prayerNeed || '');
        setPrayerText(draft.data.prayerText || '');
        setTrackAnswered(draft.data.trackAnswered !== false);
        setCurrentStep(draft.data.currentStep || 1);
      }
      setDraftReady(true);
    });
  }, [draftKey, editingPrayerId, fromNotificationAnsweredCheck]);

  useEffect(() => {
    if (!draftKey || !draftType || !draftReady || editingPrayerId || fromNotificationAnsweredCheck) {return;}
    if (!personName.trim() && !prayerNeed.trim() && !prayerText.trim()) {return;}
    const timeout = setTimeout(() => {
      savePrayerDraft({
        key: draftKey,
        type: draftType,
        selectedDate: dateStr,
        data: { currentStep, personName, prayerNeed, prayerText, trackAnswered },
      });
    }, 800);
    return () => clearTimeout(timeout);
  }, [currentStep, dateStr, draftKey, draftReady, draftType, editingPrayerId, fromNotificationAnsweredCheck, personName, prayerNeed, prayerText, trackAnswered]);

  const savePrayer = useCallback(async (openEditorAfterSave = false) => {
    if (!personName.trim()) {
      return;
    }
    if (selectedType?.id === 'prayer-request' && !prayerNeed.trim()) {
      return;
    }
    if (selectedType?.id === 'pray-for-someone' && !prayerText.trim()) {
      return;
    }

    try {
      const existing = editingPrayerId ? await getLocalPrayer(editingPrayerId, dateStr) : null;
      const prayerData = {
        user_id: prayerUserId,
        prayer_type: 'people' as const,
        content: selectedType?.id === 'prayer-request' ? prayerNeed : prayerText,
        person_name: personName,
        status: existing?.status || 'pending' as const,
        is_prayer_request: selectedType?.id === 'prayer-request',
        prayed: existing?.prayed ?? selectedType?.id === 'pray-for-someone',
        prayer_count: existing?.prayer_count ?? (selectedType?.id === 'pray-for-someone' ? 1 : 0),
        last_prayed_at: existing?.last_prayed_at || (selectedType?.id === 'pray-for-someone' ? new Date().toISOString() : undefined),
        metadata: {
          prayer_type: selectedType?.id,
          track_answered: trackAnswered === true,
          ...(selectedType?.id === 'pray-for-someone' && route.params?.originalRequestId ? {
            origin: 'prayer_request',
            source: 'prayer_request',
            original_request_id: route.params.originalRequestId,
            original_request_content: route.params.originalRequestText || '',
            prayer_request_display: route.params.originalRequestText || '',
            ...(route.params.originalRequestContext ? { request_context: route.params.originalRequestContext } : {}),
          } : {}),
          ...(fromPlaybook ? { origin: 'playbook', source: 'playbook', playbook_id: playbookId, playbook_title: playbookTitle, step_id: stepId, subtask_id: subtaskId, action_step_number: actionStepNumber, action_step_title: actionStepTitle } : {}),
        },
        selected_date: dateStr,
      };

      let result;
      if (editingPrayerId) {
        // Update existing prayer
        result = await updatePrayerMutation.mutateAsync({
          id: editingPrayerId,
          updates: prayerData,
          _userId: prayerUserId,
          _dateStr: dateStr,
        });
      } else if (!(selectedType?.id === 'pray-for-someone' && route.params?.originalRequestId && requestPrayerCreatedRef.current)) {
        // Create new prayer
        result = await createPrayerMutation.mutateAsync(prayerData);
        if (selectedType?.id === 'pray-for-someone' && route.params?.originalRequestId) requestPrayerCreatedRef.current = true;
      }

      // A Request becomes prayed only after its linked Prayer is durably created.
      if (!editingPrayerId && selectedType?.id === 'pray-for-someone' && route.params?.originalRequestId) {
        await markPrayedMutation.mutateAsync({
          id: route.params.originalRequestId,
          isPrayed: true,
          _userId: prayerUserId,
          _dateStr: dateStr,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allEntries(prayerUserId) });
      }

      if (draftKey) {await clearPrayerDraft(draftKey);}

      // Check if streak celebration should show for pray for someone.
      // When opened from faithful actions (fromPlaybook), only trigger if the
      // playbook is already completed — not mid-walkthrough.
      const shouldCheckPeopleStreak = selectedType?.id === 'pray-for-someone' && (!fromPlaybook || playbookStatus === 'completed');
      if (shouldCheckPeopleStreak && user?.id) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'prayer_saved');
        if (shouldShowStreak) {
          await visibleStreakService.markShownToday(user.id);
          if (fromPlaybook) {
            navigation.pop(2);
            setTimeout(() => {
              DeviceEventEmitter.emit('playbookPrayerSaved', {
                playbookId,
                stepId,
                subtaskId,
                actionStepNumber,
                isEditing: !!editingPrayerId,
              });
            }, 300);
          }
          (navigation as any).navigate('StreakPlan', {
            userId: user.id,
            source: 'prayer_saved',
            dismissRouteCount: fromPlaybook ? 1 : 2,
          });
          return;
        }
      }

      if (fromPlaybook) {
        // Show success modal inside this screen; Done handler will pop + emit
        triggerSuccessHaptic();
        successModal.showSuccess({
          title: editingPrayerId ? 'Prayer Updated' : 'Prayer Saved',
          message: editingPrayerId ? 'Your prayer has been updated.' : 'Your prayer has been saved to your journal.',
          showEditButton: false,
        });
        return;
      }

      if (openEditorAfterSave && result?.id) {
        navigation.navigate('PrayerEditor' as any, {
          prayerRequest: {
            person_name: personName,
            content: prayerNeed,
            id: result.id,
            user_id: prayerUserId,
            selected_date: dateStr,
          },
        });
      } else {
        triggerSuccessHaptic();
        DeviceEventEmitter.emit('prayerSaved');
        exitPrayerFlow(navigation as any);
      }

      // Track analytics
      analytics.trackPrayerEvent(editingPrayerId ? 'prayer_updated' : 'prayer_created', {
        prayer_type: 'people',
        content_length: (selectedType?.id === 'prayer-request' ? prayerNeed : prayerText).length,
        is_request: selectedType?.id === 'prayer-request',
        date: dateStr,
      }, user?.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  }, [personName, selectedType, prayerNeed, prayerText, trackAnswered, dateStr, draftKey, user, editingPrayerId, createPrayerMutation, updatePrayerMutation, markPrayedMutation, queryClient, prayerUserId, route.params, fromPlaybook, playbookId, playbookStatus, stepId, subtaskId, actionStepNumber, navigation, successModal]);

  const handleNext = useCallback(() => {
    if (currentStep === 0) {
      if (!selectedType) {
        return;
      }
      // Move to name input step
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!personName.trim()) {
        return;
      }
      // Move to prayer focus step
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedType?.id === 'prayer-request' && !prayerNeed.trim()) {
        return;
      }
      if (selectedType?.id === 'pray-for-someone' && !prayerText.trim()) {
        return;
      }
      setCurrentStep(3);
    }
  }, [currentStep, selectedType, personName, prayerNeed, prayerText]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleMarkAnsweredFromNotification = useCallback(async () => {
    if (!editingPrayerId) {
      return;
    }

    const answeredDate = new Date().toISOString();

    queryClient.setQueryData(
      queryKeys.prayers.people(prayerUserId, dateStr),
      (old: any[] | undefined) => {
        if (!Array.isArray(old)) {
          return old;
        }

        return old.map(prayer =>
          prayer.id === editingPrayerId
            ? {
                ...prayer,
                status: 'answered' as const,
                answered_date: answeredDate,
              }
            : prayer
        );
      }
    );

    triggerSuccessHaptic();
    successModal.showSuccess({
      title: 'Prayer Marked Answered',
      message: `${personName || 'This prayer'} has been marked as answered in your journal.`,
      showEditButton: false,
    });

    updatePrayerMutation.mutateAsync({
        id: editingPrayerId,
        updates: {
          status: 'answered' as const,
          answered_date: answeredDate,
        },
        _userId: prayerUserId,
        _dateStr: dateStr,
      }).then(() => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.people(prayerUserId, dateStr),
        });
      }).catch(_error => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.people(prayerUserId, dateStr),
        });
        Alert.alert('Error', 'Failed to mark prayer as answered. Please try again.');
      });
  }, [editingPrayerId, queryClient, user?.id, dateStr, updatePrayerMutation, successModal, personName]);

  const handlePrayNow = () => {
    triggerMediumHaptic();
    void savePrayer(true);
  };

  const handleSaveRequest = () => {
    triggerMediumHaptic();
    void savePrayer();
  };

  const handleSaveModalPrayer = async () => {
    if (!modalPrayerName.trim()) {
      Alert.alert('Missing Name', 'Please enter who this prayer is for before saving.');
      return;
    }

    if (!modalPrayerRequest.trim()) {
      Alert.alert('Missing Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setSavingModalPrayer(true);
    try {
      // Create the prayer
      await createPrayerMutation.mutateAsync({
        user_id: user?.id || 'local',
        prayer_type: 'people' as const,
        content: modalPrayerRequest,
        person_name: modalPrayerName,
        prayed: true,
        prayer_count: 1,
        last_prayed_at: new Date().toISOString(),
        status: 'pending',
        metadata: {
          prayer_type: 'pray-for-someone',
          track_answered: true,
          original_request_id: selectedPrayerRequest?.id,
          original_request_content: selectedPrayerRequest?.content,
          prayer_request_display: selectedPrayerRequest?.content,
        },
        selected_date: dateStr,
      });

      // Mark the prayer request as prayed (skip if still an optimistic temp ID)
      if (selectedPrayerRequest?.id && !selectedPrayerRequest.id.startsWith('temp-')) {
        await markPrayedMutation.mutateAsync({
          id: selectedPrayerRequest.id,
          isPrayed: true,
          _userId: selectedPrayerRequest.user_id,
          _dateStr: selectedPrayerRequest.selected_date,
        });
      }

      // Close modal and navigate back
      setShowPrayerEditorModal(false);
      setSelectedPrayerRequest(null);
      setModalPrayerName('');
      setModalPrayerRequest('');
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save prayer', e);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setSavingModalPrayer(false);
    }
  };

  const handleCancelModalPrayer = () => {
    setShowPrayerEditorModal(false);
    setSelectedPrayerRequest(null);
    setModalPrayerName('');
    setModalPrayerRequest('');
    setSavingModalPrayer(false);
  };

  // Swipe gesture handlers
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
        },
        onPanResponderRelease: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          const hasEnoughDistance = Math.abs(gestureState.dx) > screenWidth * 0.15;
          const hasEnoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!isHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
            return;
          }

          if (gestureState.dx > 0) {
            handleBack();
            triggerMediumHaptic();
          } else if (gestureState.dx < 0) {
            if (currentStep === 0 && !selectedType) {
              return;
            }
            if (currentStep < 4) {
              handleNext();
              triggerMediumHaptic();
            }
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth, selectedType]
  );

  return (
    <>
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar hidden barStyle="dark-content" />

      {currentStep === 0 && (
        <PrayerTypeSelectionStep
          selectedType={selectedType}
          onSelect={setSelectedType}
          onNext={handleNext}
          insets={insets}
          navigation={navigation}
        />
      )}

      {/* Prayer Request Steps */}
      {currentStep === 1 && selectedType?.id === 'prayer-request' && (
        <PrayerRequestNameStep
          personName={personName}
          onPersonNameChange={setPersonName}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 2 && selectedType?.id === 'prayer-request' && (
        <PrayerRequestPrayerFocusStep
          personName={personName}
          prayerNeed={prayerNeed}
          onPrayerNeedChange={setPrayerNeed}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 3 && selectedType?.id === 'prayer-request' && (
        <PrayerRequestActionStep
          personName={personName}
          onPrayNow={handlePrayNow}
          onSaveRequest={handleSaveRequest}
          insets={insets}
          navigation={navigation}
        />
      )}

      {/* Pray for Someone Steps */}
      {currentStep === 1 && selectedType?.id === 'pray-for-someone' && (
        <PrayForSomeoneNameStep
          personName={personName}
          onPersonNameChange={setPersonName}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 2 && selectedType?.id === 'pray-for-someone' && (
        <PrayForSomeonePrayerFocusStep
          personName={personName}
          prayerText={prayerText}
          onPrayerTextChange={setPrayerText}
          onNext={fromNotificationAnsweredCheck ? handleMarkAnsweredFromNotification : handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
          playbookTitle={playbookTitle}
          actionStepNumber={actionStepNumber}
          actionStepTitle={actionStepTitle}
          stepBody={stepBody}
          stepExample={stepExample}
          requestContext={route.params?.originalRequestText}
          readOnly={fromNotificationAnsweredCheck}
          actionLabel={fromNotificationAnsweredCheck ? 'Mark Answered' : undefined}
        />
      )}

      {currentStep === 3 && selectedType?.id === 'pray-for-someone' && <PrayForSomeoneTrackOptionStep personName={personName} prayerText={prayerText} trackAnswered={trackAnswered} onTrackAnsweredChange={setTrackAnswered} onNext={() => { void savePrayer(); }} onBack={handleBack} insets={insets} navigation={navigation} />}
      {/* Prayer Editor Modal */}
      <Modal
        visible={showPrayerEditorModal}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelModalPrayer}
      >
        <StatusBar hidden barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fullScreenModalContainer}
        >
          <View style={[styles.fullScreenPrayerModalContainer, IS_IPAD && styles.fullScreenPrayerModalContainerPad]}>
              <TouchableOpacity
                style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
                onPress={() => { triggerLightHaptic(); handleCancelModalPrayer(); }}
                disabled={savingModalPrayer}
              >
                <Ionicons name="close" size={17} color={Colors.sage} />
              </TouchableOpacity>

              <View style={[styles.prayerModalHeader, IS_IPAD && styles.prayerModalContentWidth]}>
                <View style={styles.prayerModalHeaderLeft}>
                  <Ionicons name="hand-left-outline" size={20} color={Colors.sage} style={{ transform: [{ rotate: '-28deg' }] }} />
                  <ThemedText weight="bold" style={styles.prayerModalTitle}>PRAY FOR {modalPrayerName || 'Someone'}</ThemedText>
                </View>
              </View>

              <ThemedText weight="regular" style={[styles.prayerModalSubtitle, IS_IPAD && styles.prayerModalContentWidth]}>Lift up a prayer for {modalPrayerName || 'them'}</ThemedText>

              {/* Name field - pre-filled and non-editable */}
              <TextInput
                style={[styles.prayerModalNameInput, IS_IPAD && styles.prayerModalContentWidth, { fontFamily: Fonts.regular }]}
                value={modalPrayerName}
                onChangeText={setModalPrayerName}
                placeholder="Name (optional)"
                placeholderTextColor={Colors.placeholderText}
                keyboardAppearance="light"
                editable={false}
              />

              {/* Combined field: Prayer input + Prayer Request inside same card */}
              <View style={[styles.combinedPrayerField, IS_IPAD && styles.prayerModalContentWidth]}>
                <TextInput
                  style={[styles.combinedPrayerInput, { fontFamily: Fonts.regular }]}
                  placeholder={`Write a prayer for ${modalPrayerName || 'them'}…`}
                  placeholderTextColor={Colors.placeholderText}
                  value={modalPrayerRequest}
                  onChangeText={setModalPrayerRequest}
                  onFocus={triggerSelectionHaptic}
                  multiline
                  numberOfLines={6}
                  autoFocus
                  keyboardAppearance="light"
                />
                <View style={styles.combinedDivider} />
                <View style={styles.combinedReadOnlyInner}>
                  <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer Request</ThemedText>
                  <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{selectedPrayerRequest?.content || ''}</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.prayerModalSaveButton, IS_IPAD && styles.prayerModalSaveButtonPad, { bottom: insets.bottom - 10, opacity: modalPrayerName.trim() && modalPrayerRequest.trim() ? 1 : 0 }]}
                onPress={() => { triggerLightHaptic(); handleSaveModalPrayer(); }}
                disabled={savingModalPrayer || !modalPrayerName.trim() || !modalPrayerRequest.trim()}
              >
                <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    <NewSuccessModal
      visible={successModal.isVisible}
      config={successModal.config}
      onDone={successModal.handleDone}
      onEdit={successModal.handleEdit}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
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
  stepContentPad: {
    paddingHorizontal: 160,
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
    color: Colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 0,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    textAlign: 'center',
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 16,
    textAlign: 'left',
  },
  stepSubtitle: {
    fontSize: 16,
    color: Colors.textGray,
    lineHeight: 22,
    marginTop: -8,
    marginBottom: 16,
    textAlign: 'left',
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.textGray,
    lineHeight: 24,
    marginBottom: 16,
    marginTop: -12,
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  categoryCardSelected: {
    backgroundColor: Colors.actionBackground,
    borderColor: Colors.sage,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.sage,
  },
  categoryName: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.text,
  },
  categoryDescription: {
    fontSize: 15,
    color: Colors.textGray,
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryDescriptionSelected: {
    color: Colors.text,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  metadataContent: {
    flex: 1,
    gap: 4,
  },
  metadataLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.sage,
    textTransform: 'uppercase',
  },
  metadataText: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    textAlign: 'left',
  },
  metadataTitle: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  metadataDescription: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
    marginTop: 2,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.sage,
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  personalInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    color: Colors.text,
    fontSize: 18,
    minHeight: 56,
    fontFamily: Fonts.regular,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sage,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonPad: {
    right: 48,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    zIndex: 100,
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
    color: Colors.text,
    letterSpacing: 0.5,
  },
  completionCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  completionHeaderContent: {
    flex: 1,
  },
  completionCategory: {
    fontSize: 20,
    color: Colors.text,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 14,
    color: Colors.textGray,
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    marginBottom: 20,
    paddingBottom: 20,
  },
  completionSectionSmall: {
    marginBottom: 8,
    paddingBottom: 8,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.actionBackground,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  trackingBadgeText: {
    fontSize: 14,
    color: Colors.sage,
    fontWeight: '600',
  },
  completionSectionLast: {
    marginBottom: 20,
    paddingBottom: 20,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: Colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  completionFooter: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  completionFooterText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  completionButtonContainerPad: {
    paddingHorizontal: 160,
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    width: '100%',
  },
  completionButtonsRow: {
    flexDirection: 'column',
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBackground,
    marginTop: 8,
    marginBottom: 20,
  },
  // Full Screen Modal Styles
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
    zIndex: 1,
  },
  fullScreenPrayerModalContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  fullScreenPrayerModalContainerPad: {
    paddingHorizontal: 160,
  },
  prayerModalCancelButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerModalHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  prayerModalContentWidth: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  prayerModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  prayerModalTitle: {
    color: Colors.text,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerModalSubtitle: {
    color: Colors.textGray,
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 30,
  },
  prayerModalNameInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    marginBottom: 20,
    color: Colors.text,
    fontSize: 14,
  },
  combinedPrayerField: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    minHeight: 150,
  },
  combinedPrayerInput: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  combinedDivider: {
    height: 1,
    backgroundColor: Colors.cardBackground,
    marginVertical: 12,
  },
  combinedReadOnlyInner: {
    backgroundColor: Colors.actionBackground,
    borderRadius: 8,
    padding: 12,
  },
  prayerModalFieldLabel: {
    color: Colors.text,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prayerModalReadOnlyText: {
    color: Colors.textGray,
    fontSize: 14,
    lineHeight: 20,
  },
  prayerModalSaveButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  prayerModalSaveButtonPad: {
    right: 160,
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryRow: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.sage,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  requestActions: {
    gap: 12,
    marginTop: 8,
  },
  requestPrimaryAction: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  requestPrimaryActionText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
  requestSecondaryAction: {
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  requestSecondaryActionText: {
    color: Colors.text,
    fontSize: 16,
  },
  trackOptionsContainer: {
    gap: 14,
    marginTop: 48,
    width: '100%',
  },
  trackOptionButton: {
    width: '100%',
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  trackOptionButtonSelected: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  trackOptionText: {
    fontSize: 17,
    color: Colors.text,
  },
  trackOptionDescription: { fontSize: 14, lineHeight: 21, color: Colors.textGray, marginTop: 5 },
  trackOptionTextSelected: {
    color: Colors.hopeWhite,
  },
  trackOptionDescriptionSelected: { color: 'rgba(255, 255, 255, 0.86)' },
  completionNote: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});

export default withErrorBoundary(PrayersForPeopleWalkthroughScreen, 'PrayersForPeopleWalkthroughScreen');
