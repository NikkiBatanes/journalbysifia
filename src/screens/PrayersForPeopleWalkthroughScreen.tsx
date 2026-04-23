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
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type Props = NativeStackScreenProps<RootStackParamList, 'PrayersForPeopleWalkthrough'>;

// Prayer Type Data
interface PrayerType {
  id: string;
  name: string;
  description: string;
  subtext: string;
  icon: string;
}

const PRAYER_TYPES: PrayerType[] = [
  {
    id: 'prayer-request',
    name: 'Prayer Request',
    description: 'Someone asked for prayer directly.',
    subtext: 'Someone asked you to pray for them',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    id: 'pray-for-someone',
    name: 'Pray for Someone',
    description: 'You want to pray for someone on your own.',
    subtext: 'You feel nudged to pray for someone on your own',
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
  }, []);

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
          {PRAYER_TYPES.map((type, index) => {
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
                    isSelected && styles.categoryIconCircleSelected
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
                {selectedType?.subtext}
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

// Step 2a: Prayer Request Details
const PrayerRequestDetailsStep: React.FC<{
  personName: string;
  prayerNeed: string;
  onPersonNameChange: (text: string) => void;
  onPrayerNeedChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, prayerNeed, onPersonNameChange, onPrayerNeedChange, onNext, onBack, insets, navigation }) => {
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

  const canProceed = personName.trim() !== '' && prayerNeed.trim() !== '';

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

        <StepFadeIn delay={80}>
          <ThemedText style={styles.stepDescription}>
            Enter their name below.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.inputContainer}>
            <ThemedText weight="semiBold" style={styles.inputLabel}>NAME</ThemedText>
            <TextInput
              style={styles.personalInput}
              value={personName}
              onChangeText={onPersonNameChange}
              placeholder="Enter their name"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              autoFocus
              keyboardAppearance="dark"
            />
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.inputContainer}>
            <ThemedText weight="semiBold" style={styles.inputLabel}>PRAYER FOCUS</ThemedText>
            <TextInput
              style={[styles.personalInput, styles.multilineInput]}
              value={prayerNeed}
              onChangeText={onPrayerNeedChange}
              placeholder="What do they need prayer for?"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              textAlignVertical="top"
              keyboardAppearance="dark"
            />
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

// Step 2b: Pray for Someone
const PrayForSomeoneStep: React.FC<{
  personName: string;
  prayerText: string;
  onPersonNameChange: (text: string) => void;
  onPrayerTextChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ personName, prayerText, onPersonNameChange, onPrayerTextChange, onNext, onBack, insets, navigation }) => {
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const buttonPosition = React.useRef(new Animated.Value(insets.bottom + 20)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: personName.trim() !== '' && prayerText.trim() !== '' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [personName, prayerText, buttonOpacity]);

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

        <StepFadeIn delay={80}>
          <ThemedText style={styles.stepDescription}>
            Enter their name below.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={120}>
          <View style={styles.inputContainer}>
            <ThemedText weight="semiBold" style={styles.inputLabel}>NAME</ThemedText>
            <TextInput
              style={styles.personalInput}
              value={personName}
              onChangeText={onPersonNameChange}
              placeholder="Enter their name"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              autoFocus
              keyboardAppearance="dark"
            />
          </View>
        </StepFadeIn>

        <StepFadeIn delay={160}>
          <View style={styles.inputContainer}>
            <ThemedText weight="semiBold" style={styles.inputLabel}>PRAYER FOCUS</ThemedText>
            <TextInput
              style={[styles.personalInput, styles.multilineInput]}
              value={prayerText}
              onChangeText={onPrayerTextChange}
              placeholder="Name the need clearly before the prayer is written."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              textAlignVertical="top"
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
          disabled={!personName.trim() || !prayerText.trim()}
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

// Step 3: Track Answered
const TrackAnsweredStep: React.FC<{
  prayerType: PrayerType;
  personName: string;
  prayerNeed: string;
  prayerText: string;
  onTrackAnswered: () => void;
  onSkip: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ prayerType, personName, prayerNeed, prayerText, onTrackAnswered, onSkip, insets, navigation }) => {
  const getPrayerContent = () => {
    if (prayerType.id === 'prayer-request') {
      return prayerNeed;
    } else {
      return prayerText;
    }
  };

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
            <ThemedText weight="semiBold" style={styles.focusLabel}>{prayerType.id === 'prayer-request' ? 'PRAYER REQUEST' : 'PRAY FOR SOMEONE'}</ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={40}>
          <View style={styles.titleRowLeft}>
            <ThemedText weight="semiBold" style={styles.stepTitleLeft}>
              Would you like to track this prayer?
            </ThemedText>
          </View>
        </StepFadeIn>

        <StepFadeIn delay={80}>
          <ThemedText style={styles.stepDescription}>
            You can choose to mark it later if it is answered.
          </ThemedText>
        </StepFadeIn>

        <StepFadeIn delay={120} style={styles.completionCard}>
          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PERSON</ThemedText>
            <ThemedText style={styles.completionSectionText}>{personName}</ThemedText>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER FOCUS</ThemedText>
            <ThemedText style={styles.completionSectionText}>{getPrayerContent()}</ThemedText>
          </View>
        </StepFadeIn>
      </ScrollView>

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerMediumHaptic();
            onTrackAnswered();
          }}
          activeOpacity={0.85}
          style={[styles.completionButton, { marginBottom: 12 }]}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            Track if answered
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            onSkip();
          }}
          activeOpacity={0.85}
          style={[styles.completionButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
        >
          <ThemedText weight="semiBold" style={[styles.completionButtonText, { color: Colors.hopeWhite }]}>
            Not now
          </ThemedText>
        </TouchableOpacity>
      </View>

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
  onDone: () => void;
  insets: { top: number; bottom: number };
  navigation: any;
}> = ({ prayerType, personName, prayerNeed, prayerText, onDone, insets, navigation }) => {
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
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>
                Prayer Saved
              </ThemedText>
              <ThemedText style={styles.completionSubtext}>A quiet act of faithfulness for someone God brought to mind.</ThemedText>
            </View>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PERSON</ThemedText>
            <ThemedText style={styles.completionSectionText}>{personName}</ThemedText>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>PRAYER FOCUS</ThemedText>
            <ThemedText style={styles.completionSectionText}>
              {prayerType.id === 'prayer-request' ? prayerNeed : prayerText}
            </ThemedText>
          </View>

          <View style={styles.completionSection}>
            <ThemedText style={styles.completionSectionText}>
              This prayer can be revisited later.
            </ThemedText>
          </View>
        </StepFadeIn>
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
            Done
          </ThemedText>
        </TouchableOpacity>
      </View>

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

// Main Screen Component
const PrayersForPeopleWalkthroughScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const createPrayerMutation = useCreatePrayer();

  // State for walkthrough steps
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<PrayerType | null>(null);
  const [personName, setPersonName] = useState('');
  const [prayerNeed, setPrayerNeed] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [trackAnswered, setTrackAnswered] = useState(false);

  // Get initial data from route params if provided
  useEffect(() => {
    if (route.params?.initialPersonName) {
      setPersonName(route.params.initialPersonName);
    }
    if (route.params?.initialPrayerRequest) {
      setPrayerNeed(route.params.initialPrayerRequest);
    }
  }, [route.params]);

  const handleNext = () => {
    if (currentStep === 0) {
      // Move to step 1 based on selected type
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // Move to track answered step
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleTrackAnswered = () => {
    setTrackAnswered(true);
    savePrayer();
  };

  const handleSkipTrack = () => {
    setTrackAnswered(false);
    savePrayer();
  };

  const savePrayer = async () => {
    try {
      const currentDate = new Date();
      const dateStr = toLocalDateString(currentDate);

      let content = '';
      if (selectedType?.id === 'prayer-request') {
        content = `🙏🏼 Prayer Request for ${personName}\n\nNeed: ${prayerNeed}`;
      } else {
        content = `🙏🏼 Prayer for ${personName}\n\n${prayerText}`;
      }

      const prayerData = {
        user_id: user!.id,
        prayer_type: 'people' as const,
        content: selectedType?.id === 'prayer-request' ? prayerNeed : prayerText,
        person_name: personName,
        metadata: {
          is_prayer_request: selectedType?.id === 'prayer-request',
          prayer_type: selectedType?.id,
        },
        selected_date: dateStr,
      };

      await createPrayerMutation.mutateAsync(prayerData);
      setCurrentStep(3); // Show completion screen

      // Track analytics
      analytics.trackPrayerEvent('prayer_created', {
        prayer_type: 'people',
        content_length: (selectedType?.id === 'prayer-request' ? prayerNeed : prayerText).length,
        is_request: selectedType?.id === 'prayer-request',
        date: dateStr,
      }, user?.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
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

      {currentStep === 1 && selectedType?.id === 'prayer-request' && (
        <PrayerRequestDetailsStep
          personName={personName}
          prayerNeed={prayerNeed}
          onPersonNameChange={setPersonName}
          onPrayerNeedChange={setPrayerNeed}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 1 && selectedType?.id === 'pray-for-someone' && (
        <PrayForSomeoneStep
          personName={personName}
          prayerText={prayerText}
          onPersonNameChange={setPersonName}
          onPrayerTextChange={setPrayerText}
          onNext={handleNext}
          onBack={handleBack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 2 && selectedType && (
        <TrackAnsweredStep
          prayerType={selectedType}
          personName={personName}
          prayerNeed={prayerNeed}
          prayerText={prayerText}
          onTrackAnswered={handleTrackAnswered}
          onSkip={handleSkipTrack}
          insets={insets}
          navigation={navigation}
        />
      )}

      {currentStep === 3 && selectedType && (
        <CompletionStep
          prayerType={selectedType}
          personName={personName}
          prayerNeed={prayerNeed}
          prayerText={prayerText}
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
    backgroundColor: Colors.anchorBlue,
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
    marginBottom: 16,
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
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 24,
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
  metadataText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    textAlign: 'left',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    minHeight: 56,
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
    marginBottom: 24,
  },
  stepLabelWhite: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  completionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
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
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  completionSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
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
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  completionButton: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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

export default withErrorBoundary(PrayersForPeopleWalkthroughScreen, 'PrayersForPeopleWalkthroughScreen');
