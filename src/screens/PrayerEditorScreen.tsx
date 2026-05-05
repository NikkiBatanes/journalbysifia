import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, TextInput, StatusBar, Animated, ScrollView, PanResponder, useWindowDimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerSelectionHaptic, triggerSuccessHaptic, triggerMediumHaptic, triggerLightHaptic } from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '../components/common/ThemedText';
import { useCreatePrayer, useMarkPrayerRequestPrayed } from '../services/hooks/usePrayerData';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { visibleStreakService } from '../services/visibleStreakService';

type RootStackParamList = {
  PrayerEditor: {
    prayerRequest: {
      person_name: string;
      content: string;
      id: string;
      user_id: string;
      selected_date: string;
    };
  };
};

type PrayerEditorScreenProps = NativeStackScreenProps<RootStackParamList, 'PrayerEditor'>;

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

const PrayerEditorScreen: React.FC<PrayerEditorScreenProps> = ({ route, navigation }) => {
  const { prayerRequest } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(1);
  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);
  const [trackAnswered, setTrackAnswered] = useState(true);

  // Hide status bar when screen is mounted
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  const createPrayerMutation = useCreatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();

  // Animation refs for completion step
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStep === 3) {
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
    }
  }, [currentStep, checkmarkScale, iconRotation, iconScale]);

  const iconRotateInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSavePrayer = useCallback(() => {
    // Step 1 → Step 2: just validate and advance to tracking question
    if (!prayerRequest.person_name?.trim() || !modalPrayerRequest.trim()) { return; }
    triggerLightHaptic();
    setCurrentStep(2);
  }, [prayerRequest.person_name, modalPrayerRequest]);

  const handleTrackingNext = useCallback(async () => {
    // Step 2 → Step 3: save the prayer NOW with the chosen trackAnswered value
    if (!prayerRequest.person_name?.trim() || !modalPrayerRequest.trim()) { return; }

    try {
      triggerMediumHaptic();
      setSavingModalPrayer(true);

      // Use the prayer request's selected_date if available, otherwise use today's date
      const dateStr = prayerRequest.selected_date || new Date().toLocaleDateString('en-CA');

      // Create the prayer with the tracking choice already made
      await createPrayerMutation.mutateAsync({
        user_id: user!.id,
        prayer_type: 'people' as const,
        content: modalPrayerRequest,
        person_name: prayerRequest.person_name,
        metadata: {
          prayer_type: 'pray-for-someone',
          original_request_id: prayerRequest.id,
          original_request_content: prayerRequest.content,
          prayer_request_display: prayerRequest.content,
          track_answered: trackAnswered,
        },
        selected_date: dateStr,
      });

      // Mark the original prayer request as prayed (skip if still an optimistic temp ID)
      if (prayerRequest?.id && !prayerRequest.id.startsWith('temp-')) {
        await markPrayedMutation.mutateAsync({
          id: prayerRequest.id,
          isPrayed: true,
          _userId: prayerRequest.user_id,
          _dateStr: prayerRequest.selected_date,
        });
      }

      triggerSuccessHaptic();
      setSavingModalPrayer(false);

      // Check if streak celebration should show for praying for someone (journal screen)
      if (user?.id) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'prayer_for_now');
        if (shouldShowStreak) {
          await visibleStreakService.markShownToday(user.id);
          (navigation as any).navigate('StreakPlan', {
            userId: user.id,
            source: 'prayer_for_now',
          });
          return;
        }
      }

      setCurrentStep(3); // Move to completion step
    } catch (e) {
      console.error('Failed to save prayer', e);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
      setSavingModalPrayer(false);
    }
  }, [prayerRequest.person_name, prayerRequest.content, prayerRequest.id, prayerRequest.user_id, prayerRequest.selected_date, modalPrayerRequest, trackAnswered, user, createPrayerMutation, markPrayedMutation, navigation]);

  const handleCompletionDone = () => {
    triggerMediumHaptic();
    navigation.popToTop();
  };

  const handleCancel = useCallback(() => {
    triggerSelectionHaptic();
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      triggerMediumHaptic();
      setCurrentStep(currentStep - 1);
    } else {
      handleCancel();
    }
  }, [currentStep, handleCancel]);

  const handleNext = useCallback(() => {
    if (currentStep === 1) {
      handleSavePrayer();
    } else if (currentStep === 2) {
      handleTrackingNext();
    }
  }, [currentStep, handleSavePrayer, handleTrackingNext]);

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
          } else if (gestureState.dx < 0 && currentStep < 3) {
            handleNext();
          }
        },
      }),
    [currentStep, handleBack, handleNext, screenWidth]
  );

  // Step 1: Prayer Input
  const renderStep1 = () => (
    <View style={styles.fullScreenPrayerModalContainer}>
      <TouchableOpacity
        style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
        onPress={handleCancel}
        disabled={savingModalPrayer}
      >
        <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
      </TouchableOpacity>

      <View style={styles.prayerModalHeader}>
        <View style={styles.prayerModalHeaderLeft}>
          <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
          <ThemedText weight="bold" style={styles.prayerModalTitle}>
            PRAY FOR {prayerRequest.person_name || 'Someone'}
          </ThemedText>
        </View>
      </View>

      <ThemedText weight="semiBold" style={styles.prayerModalSubtitle}>
        Lift up a prayer for {prayerRequest.person_name || 'them'}
      </ThemedText>

      {/* Name field - pre-filled and non-editable */}
      <TextInput
        style={[styles.prayerModalNameInput, { fontFamily: Fonts.regular }]}
        value={prayerRequest.person_name}
        placeholder="Name (optional)"
        placeholderTextColor={Colors.placeholderText}
        keyboardAppearance="dark"
        editable={false}
      />

      {/* Combined field: Prayer input + Prayer Request inside same card */}
      <View style={styles.combinedPrayerField}>
        <TextInput
          style={[styles.combinedPrayerInput, { fontFamily: Fonts.regular }]}
          placeholder={`Write a prayer for ${prayerRequest.person_name || 'them'}…`}
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
          <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{prayerRequest.content || ''}</ThemedText>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.prayerModalSaveButton, { bottom: insets.bottom - 10, opacity: modalPrayerRequest.trim() ? 1 : 0 }]}
        onPress={handleSavePrayer}
        disabled={savingModalPrayer || !modalPrayerRequest.trim()}
      >
        <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </View>
  );

  // Step 2: Tracking Confirmation (exactly like walkthrough)
  const renderStep2 = () => (
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
              onPress={() => { triggerLightHaptic(); setTrackAnswered(true); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.5)'}
              />
              <ThemedText style={[styles.trackOptionText, trackAnswered && styles.trackOptionTextSelected]}>
                Track if answered
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.trackOptionButton, !trackAnswered && styles.trackOptionButtonSelected]}
              onPress={() => { triggerLightHaptic(); setTrackAnswered(false); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={!trackAnswered ? Colors.alertCoral : 'rgba(255,255,255,0.5)'}
              />
              <ThemedText style={[styles.trackOptionText, !trackAnswered && styles.trackOptionTextSelected]}>
                Not now
              </ThemedText>
            </TouchableOpacity>
          </View>
        </StepFadeIn>
      </ScrollView>

      <View style={[styles.primaryButton, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleTrackingNext}
          activeOpacity={0.7}
          disabled={savingModalPrayer}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          {savingModalPrayer
            ? <Ionicons name="hourglass-outline" size={20} color={Colors.hopeWhite} />
            : <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={handleCancel}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Step 3: Completion (exactly like walkthrough)
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <StatusBar hidden />
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
                Prayer for {prayerRequest.person_name} Saved
              </ThemedText>
              <ThemedText style={styles.completionSubtext}>
                Your prayer has been recorded
              </ThemedText>
            </View>
            <Animated.View style={[
              styles.completionCheckmark,
              { transform: [{ scale: checkmarkScale }] },
            ]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.growthGreen} />
            </Animated.View>
          </View>

          <View style={styles.completionSection}>
            <ThemedText weight="medium" style={styles.completionSectionLabel}>Prayer</ThemedText>
            <ThemedText style={styles.completionSectionText}>{modalPrayerRequest}</ThemedText>
          </View>

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
              A quiet act of faithfulness for someone God brought to mind.
            </ThemedText>
          </View>
        </StepFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.completionButtonContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleCompletionDone}
          activeOpacity={0.85}
          style={styles.completionButton}
        >
          <ThemedText weight="semiBold" style={styles.completionButtonText}>
            Done
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      {...panResponder.panHandlers}
    >
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
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
  // Walkthrough styles
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
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 0,
  },
  stepTitleLeft: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    marginBottom: 16,
    textAlign: 'left',
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
    color: 'rgba(255,255,255,0.5)',
  },
  trackOptionTextSelected: {
    color: Colors.hopeWhite,
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
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  // Completion styles
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
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
    right: 20,
    left: 20,
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
  completionButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
  },
});

export default PrayerEditorScreen;
