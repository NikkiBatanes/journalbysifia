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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import ThemedText from '../components/common/ThemedText';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { triggerLightHaptic, triggerMediumHaptic, triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../utils/date';
import { useCreatePrayer, useMarkPrayerRequestPrayed, useUpdatePrayer } from '../services/hooks/usePrayerData';
import { analytics } from '../utils/analytics';
import { Modal, KeyboardAvoidingView, Platform } from 'react-native';
import PlaybookMetaSection from '../components/journal/PlaybookMetaSection';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayersForPeopleWalkthrough'>;

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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
                      color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              autoFocus
              keyboardAppearance="dark"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : 'rgba(255,255,255,0.3)'} />
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              textAlignVertical="top"
              autoFocus
              keyboardAppearance="dark"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : 'rgba(255,255,255,0.3)'} />
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

// Step 2a3: Prayer Request - Track Option
const PrayerRequestTrackOptionStep: React.FC<{
  personName: string;
  prayerNeed: string;
  trackAnswered: boolean;
  onTrackAnsweredChange: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName: _personName, prayerNeed: _prayerNeed, trackAnswered, onTrackAnsweredChange, onNext, onBack: _onBack, insets, navigation }) => {
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
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAYER REQUEST</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Would you like to track this prayer when it's answered?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.trackOptionsContainer}>
            <TouchableOpacity
              style={[styles.trackOptionButton, trackAnswered && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color={trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.3)'} />
              <ThemedText style={[styles.trackOptionText, trackAnswered && styles.trackOptionTextSelected]}>
                Track if answered
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.trackOptionButton, !trackAnswered && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color={!trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.3)'} />
              <ThemedText style={[styles.trackOptionText, !trackAnswered && styles.trackOptionTextSelected]}>
                Not now
              </ThemedText>
            </TouchableOpacity>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
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
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              autoFocus
              keyboardAppearance="dark"
            />
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onNext();
          }}
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          disabled={!canProceed}
        >
          <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : 'rgba(255,255,255,0.3)'} />
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
  readOnly?: boolean;
  actionLabel?: string;
}> = ({ personName, prayerText, onPrayerTextChange, onNext, onBack: _onBack, insets, navigation, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample, readOnly = false, actionLabel }) => {
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 320 : 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAY FOR SOMEONE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Pray for {personName}
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.personalInput, styles.multilineInput]}
              value={prayerText}
              onChangeText={onPrayerTextChange}
              placeholder="Begin your prayer here..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              textAlignVertical="top"
              autoFocus={!readOnly}
              keyboardAppearance="dark"
              editable={!readOnly}
            />

            {playbookTitle && (
              <PlaybookMetaSection
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
        <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
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
        <Animated.View style={[styles.primaryButton, { bottom: buttonPosition, opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              triggerMediumHaptic();
              onNext();
            }}
            activeOpacity={0.7}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            disabled={!canProceed}
          >
            <Ionicons name="chevron-forward" size={24} color={canProceed ? Colors.hopeWhite : 'rgba(255,255,255,0.3)'} />
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Step 2b3: Pray for Someone - Track Option
const PrayForSomeoneTrackOptionStep: React.FC<{
  personName: string;
  prayerText: string;
  trackAnswered: boolean;
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0}>
          <View style={styles.focusLabelContainer}>
            <MaterialCommunityIcons name="hands-pray" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
            <ThemedText weight="semiBold" style={styles.focusLabel}>PRAY FOR SOMEONE</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Would you like to track this prayer when it's answered?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.trackOptionsContainer}>
            <TouchableOpacity
              style={[styles.trackOptionButton, trackAnswered && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color={trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.3)'} />
              <ThemedText style={[styles.trackOptionText, trackAnswered && styles.trackOptionTextSelected]}>
                Track if answered
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.trackOptionButton, !trackAnswered && styles.trackOptionButtonSelected]}
              onPress={() => {
                triggerLightHaptic();
                onTrackAnsweredChange(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color={!trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.3)'} />
              <ThemedText style={[styles.trackOptionText, !trackAnswered && styles.trackOptionTextSelected]}>
                Not now
              </ThemedText>
            </TouchableOpacity>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
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
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
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
  trackAnswered: boolean;
  onDone: () => void;
  onPrayNow: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
  isEditing: boolean;
}> = ({ prayerType, personName, prayerNeed, prayerText, trackAnswered, onDone, onPrayNow, insets, navigation: _navigation, isEditing }) => {
  // Animation refs
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(0)).current;
  const iconRotation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
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
        contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepFadeIn delay={0} style={styles.stepLabelRow}>
          <MaterialCommunityIcons name="hands-pray" size={18} color={Colors.alertCoral} />
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
              <MaterialCommunityIcons name="hands-pray" size={24} color={Colors.alertCoral} />
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

          {trackAnswered && (
            <>
              <View style={styles.divider} />
              <View style={[styles.completionSection, styles.completionSectionSmall]}>
                <View style={styles.trackingRow}>
                  <ThemedText weight="medium" style={styles.completionSectionLabel}>TRACKING</ThemedText>
                  <View style={styles.trackingBadgeContainer}>
                    <Ionicons name="notifications-outline" size={16} color={Colors.alertCoral} />
                    <ThemedText style={styles.trackingBadgeText}>Enabled</ThemedText>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={styles.completionFooter}>
            <ThemedText style={styles.completionFooterText}>
              {prayerType.id === 'prayer-request' ? 'A quiet act of love for someone who shared a need.' : 'A quiet act of faithfulness for someone God brought to mind.'}
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
        {prayerType.id === 'prayer-request' ? (
          // Prayer Request: Show Pray Now and Later buttons
          <View style={styles.completionButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                triggerMediumHaptic();
                onPrayNow();
              }}
              activeOpacity={0.85}
              style={[styles.completionButton, { flex: 1, backgroundColor: Colors.alertCoral }]}
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
              style={[styles.completionButton, { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }]}
            >
              <ThemedText weight="semiBold" style={[styles.completionButtonText, { color: Colors.hopeWhite }]}>
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const createPrayerMutation = useCreatePrayer();
  const updatePrayerMutation = useUpdatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();
  const { subtaskId, stepId, playbookId, playbookTitle, actionStepNumber, actionStepTitle, stepBody, stepExample, fromPlaybook } = route.params || {};
  const fromNotificationAnsweredCheck = (route.params as any)?.fromNotificationAnsweredCheck === true;

  // State for walkthrough steps
  const shouldSkipStep0 = route.params?.initialPrayerType || route.params?.initialPersonName;
  const [currentStep, setCurrentStep] = useState(fromNotificationAnsweredCheck ? 2 : shouldSkipStep0 ? 1 : 0);
  const [selectedType, setSelectedType] = useState<PrayerType | null>(null);
  const [personName, setPersonName] = useState('');
  const [prayerNeed, setPrayerNeed] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [trackAnswered, setTrackAnswered] = useState(true);
  const [editingPrayerId, setEditingPrayerId] = useState<string | undefined>(undefined);

  // State for prayer modal
  const [showPrayerEditorModal, setShowPrayerEditorModal] = useState(false);
  const [modalPrayerName, setModalPrayerName] = useState('');
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [selectedPrayerRequest, setSelectedPrayerRequest] = useState<any>(null);
  const [savedPrayerId, setSavedPrayerId] = useState<string | null>(null);
  const successModal = useSuccessModal(
    () => {
      navigation.navigate('MainTabs' as any, {
        screen: 'Journal',
        params: {
          selectedDate: route.params?.selectedDate,
          targetSection: 'prayer',
          targetPrayerCarouselIndex: 2,
          targetPrayerId: editingPrayerId,
        },
      });
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
    if (route.params?.initialTrackAnswered !== undefined) {
      setTrackAnswered(route.params.initialTrackAnswered);
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

  const savePrayer = useCallback(async () => {
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
      const prayerData = {
        user_id: user?.id || '',
        prayer_type: 'people' as const,
        content: selectedType?.id === 'prayer-request' ? prayerNeed : prayerText,
        person_name: personName,
        is_prayer_request: selectedType?.id === 'prayer-request',
        metadata: {
          prayer_type: selectedType?.id,
          track_answered: trackAnswered,
        },
        selected_date: dateStr,
      };

      let result;
      if (editingPrayerId) {
        // Update existing prayer
        result = await updatePrayerMutation.mutateAsync({
          id: editingPrayerId,
          updates: prayerData,
          _userId: user?.id || '',
          _dateStr: dateStr,
        });
      } else {
        // Create new prayer
        result = await createPrayerMutation.mutateAsync(prayerData);
      }

      // Store the saved prayer ID for marking as prayed later
      if (result?.id) {
        setSavedPrayerId(result.id);
      }

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
        return;
      }

      setCurrentStep(4); // Show completion screen

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
  }, [personName, selectedType, prayerNeed, prayerText, trackAnswered, dateStr, user, editingPrayerId, createPrayerMutation, updatePrayerMutation, fromPlaybook, playbookId, stepId, subtaskId, actionStepNumber, navigation]);

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
      // Prayer Request: Skip track option, go directly to completion
      // Pray for Someone: Go to track option step
      if (selectedType?.id === 'prayer-request') {
        savePrayer();
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      // Save and show completion (Pray for Someone only)
      savePrayer();
    }
  }, [currentStep, selectedType, personName, prayerNeed, prayerText, savePrayer]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleDone = () => {
    navigation.goBack();
  };

  const handleMarkAnsweredFromNotification = useCallback(async () => {
    if (!editingPrayerId) {
      return;
    }

    try {
      await updatePrayerMutation.mutateAsync({
        id: editingPrayerId,
        updates: {
          status: 'answered' as const,
          answered_date: new Date().toISOString(),
        },
        _userId: user?.id || '',
        _dateStr: dateStr,
      });
      triggerSuccessHaptic();
      successModal.showSuccess({
        title: 'Prayer Marked Answered',
        message: `${personName || 'This prayer'} has been marked as answered in your journal.`,
        showEditButton: false,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to mark prayer as answered. Please try again.');
    }
  }, [dateStr, editingPrayerId, personName, successModal, updatePrayerMutation, user?.id]);

  const handlePrayNow = () => {
    // Navigate to the PrayerEditorScreen for this prayer request
    navigation.navigate('PrayerEditor' as any, {
      prayerRequest: {
        person_name: personName,
        content: prayerNeed,
        id: savedPrayerId,
        user_id: user?.id,
        selected_date: dateStr,
      },
    });
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
        user_id: user!.id,
        prayer_type: 'people' as const,
        content: modalPrayerRequest,
        person_name: modalPrayerName,
        metadata: {
          prayer_type: 'prayer-request',
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
      <StatusBar hidden />

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
        <PrayerRequestTrackOptionStep
          personName={personName}
          prayerNeed={prayerNeed}
          trackAnswered={trackAnswered}
          onTrackAnsweredChange={setTrackAnswered}
          onNext={handleNext}
          onBack={handleBack}
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
          readOnly={fromNotificationAnsweredCheck}
          actionLabel={fromNotificationAnsweredCheck ? 'Mark Answered' : undefined}
        />
      )}

      {currentStep === 3 && selectedType?.id === 'pray-for-someone' && (
        <PrayForSomeoneTrackOptionStep
          personName={personName}
          prayerText={prayerText}
          trackAnswered={trackAnswered}
          onTrackAnsweredChange={setTrackAnswered}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 4 && selectedType && (
        <CompletionStep
          prayerType={selectedType}
          personName={personName}
          prayerNeed={prayerNeed}
          prayerText={prayerText}
          trackAnswered={trackAnswered}
          onDone={handleDone}
          onPrayNow={handlePrayNow}
          insets={insets}
          navigation={navigation}
          isEditing={!!editingPrayerId}
        />
      )}

      {/* Prayer Editor Modal */}
      <Modal
        visible={showPrayerEditorModal}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelModalPrayer}
      >
        <StatusBar hidden />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fullScreenModalContainer}
        >
          <View style={styles.fullScreenPrayerModalContainer}>
              <TouchableOpacity
                style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
                onPress={() => { triggerLightHaptic(); handleCancelModalPrayer(); }}
                disabled={savingModalPrayer}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>

              <View style={styles.prayerModalHeader}>
                <View style={styles.prayerModalHeaderLeft}>
                  <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
                  <ThemedText weight="bold" style={styles.prayerModalTitle}>PRAY FOR {modalPrayerName || 'Someone'}</ThemedText>
                </View>
              </View>

              <ThemedText weight="regular" style={styles.prayerModalSubtitle}>Lift up a prayer for {modalPrayerName || 'them'}</ThemedText>

              {/* Name field - pre-filled and non-editable */}
              <TextInput
                style={[styles.prayerModalNameInput, { fontFamily: Fonts.regular }]}
                value={modalPrayerName}
                onChangeText={setModalPrayerName}
                placeholder="Name (optional)"
                placeholderTextColor={Colors.placeholderText}
                keyboardAppearance="dark"
                editable={false}
              />

              {/* Combined field: Prayer input + Prayer Request inside same card */}
              <View style={styles.combinedPrayerField}>
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
                  keyboardAppearance="dark"
                />
                <View style={styles.combinedDivider} />
                <View style={styles.combinedReadOnlyInner}>
                  <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer Request</ThemedText>
                  <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{selectedPrayerRequest?.content || ''}</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.prayerModalSaveButton, { bottom: insets.bottom - 10, opacity: modalPrayerName.trim() && modalPrayerRequest.trim() ? 1 : 0 }]}
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
    color: Colors.hopeWhite,
    lineHeight: 30,
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
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 24,
    marginBottom: 16,
    marginTop: -12,
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  categoryName: {
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 6,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.hopeWhite,
  },
  categoryDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
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
    color: Colors.alertCoral,
    textTransform: 'uppercase',
  },
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'left',
  },
  metadataTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 20,
    marginBottom: 2,
  },
  metadataDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    marginTop: 2,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.alertCoral,
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  personalInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    color: Colors.hopeWhite,
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
    backgroundColor: Colors.alertCoral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    letterSpacing: 0.5,
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
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  trackingBadgeText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '600',
  },
  completionSectionLast: {
    marginBottom: 20,
    paddingBottom: 20,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionFooter: {
    marginTop: 20,
    paddingTop: 20,
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
    left: 20,
    right: 20,
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    width: '100%',
  },
  completionButtonsRow: {
    flexDirection: 'column',
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    marginBottom: 20,
  },
  // Full Screen Modal Styles
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    zIndex: 1,
  },
  fullScreenPrayerModalContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  prayerModalCancelButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerModalHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  prayerModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  prayerModalTitle: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerModalSubtitle: {
    color: Colors.secondaryText,
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
    color: Colors.hopeWhite,
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
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  combinedDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  combinedReadOnlyInner: {
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 8,
    padding: 12,
  },
  prayerModalFieldLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prayerModalReadOnlyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  prayerModalSaveButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  completionButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryRow: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.alertCoral,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  trackOptionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  trackOptionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 8,
  },
  trackOptionButtonSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  trackOptionText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  trackOptionTextSelected: {
    color: Colors.alertCoral,
  },
  completionNote: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});

export default withErrorBoundary(PrayersForPeopleWalkthroughScreen, 'PrayersForPeopleWalkthroughScreen');
