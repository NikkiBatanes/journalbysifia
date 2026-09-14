/**
 * JournalOnboardingScreen.tsx
 *
 * Journal by siFia first-launch flow.
 * Local-only onboarding state (AsyncStorage) — no account, no Supabase,
 * no siFia onboarding systems. Structurally independent from
 * OnboardingContext / onboardingService.
 */

import React, { useMemo, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../../components/common/ThemedText';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { triggerLightHaptic } from '../../utils/haptics';
import { markJournalOnboardingComplete } from '../../services/journalOnboardingState';

interface OnboardingStep {
  eyebrow?: string;
  title: string;
  body?: string;
  points?: { icon: string; heading: string; detail: string }[];
  cta: string;
}

const STEPS: OnboardingStep[] = [
  {
    eyebrow: 'JOURNAL BY SIFIA',
    title: 'A quiet place to remember, reflect, and return to Scripture.',
    body: 'Journal by siFia helps you build a daily rhythm of writing, reflection, Scripture, prayer, and remembering what God is doing.',
    cta: 'Continue',
  },
  {
    title: 'More than a blank page.',
    points: [
      {
        icon: 'sunny-outline',
        heading: 'Begin Today',
        detail: 'Set your focus and notice what is on your heart.',
      },
      {
        icon: 'book-outline',
        heading: 'Scripture & Reflection',
        detail: 'Slow down with Scripture and what you are learning.',
      },
      {
        icon: 'moon-outline',
        heading: 'Close the Day',
        detail: 'Remember the day, gratitude, prayers, and what you want to carry forward.',
      },
    ],
    cta: 'Continue',
  },
  {
    eyebrow: 'MADE TO COMPLEMENT SIFIA',
    title: 'Build the rhythm.\nProcess the moment.',
    body: 'Journal by siFia is your everyday space to write, remember, and reflect.\n\nsiFia is there when a specific situation needs deeper Scripture-rooted reflection.',
    cta: 'Continue',
  },
  {
    title: 'Your journal, your space.',
    body: 'Journal by siFia is being designed so your core journaling experience can work without depending on an internet connection.\n\nAccount and sync features can be added when you choose to connect your journal.',
    cta: 'Continue',
  },
  {
    eyebrow: 'YOUR JOURNAL IS READY',
    title: 'Begin with today.',
    body: 'You do not need to have the perfect words.\nStart with what is here.',
    cta: 'Begin Today',
  },
];

const JournalOnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const dots = useMemo(
    () =>
      STEPS.map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index === stepIndex && styles.dotActive]}
        />
      )),
    [stepIndex],
  );

  const enterJournal = async () => {
    await markJournalOnboardingComplete();
    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const handlePrimaryCta = async () => {
    triggerLightHaptic();
    if (!isLastStep) {
      setStepIndex(prev => prev + 1);
      return;
    }
    await enterJournal();
  };

  const handleSignIn = async () => {
    triggerLightHaptic();
    // Mark onboarding complete: reaching this step means the flow was seen.
    // Authentication state is intentionally separate from onboarding state.
    await markJournalOnboardingComplete();
    if (isAuthenticated) {
      // Already signed in — Auth stack is not registered in this state.
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      return;
    }
    (navigation as any).navigate('Auth', { screen: 'Login' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.sage} />
      <View style={styles.content}>
        <View style={styles.body}>
          {step.eyebrow ? (
            <ThemedText style={styles.eyebrow}>{step.eyebrow}</ThemedText>
          ) : null}
          <ThemedText style={styles.title}>{step.title}</ThemedText>
          {step.body ? (
            <ThemedText style={styles.bodyText}>{step.body}</ThemedText>
          ) : null}
          {step.points ? (
            <View style={styles.points}>
              {step.points.map(point => (
                <View key={point.heading} style={styles.pointRow}>
                  <View style={styles.pointIcon}>
                    <Ionicons name={point.icon} size={20} color={Colors.hopeWhite} />
                  </View>
                  <View style={styles.pointCopy}>
                    <ThemedText weight="semiBold" style={styles.pointHeading}>
                      {point.heading}
                    </ThemedText>
                    <ThemedText style={styles.pointDetail}>
                      {point.detail}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.dots}>{dots}</View>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={step.cta}
            onPress={handlePrimaryCta}
          >
            <ThemedText weight="semiBold" style={styles.primaryButtonText}>
              {step.cta}
            </ThemedText>
          </TouchableOpacity>
          {isLastStep ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Already use siFia? Sign in"
              onPress={handleSignIn}
            >
              <ThemedText style={styles.secondaryButtonText}>
                Already use siFia?{' '}
                <ThemedText weight="semiBold" style={styles.secondaryButtonLink}>
                  Sign in
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.sage,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  bodyText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  points: {
    marginTop: 8,
    gap: 18,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCopy: {
    flex: 1,
    gap: 2,
  },
  pointHeading: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 21,
  },
  pointDetail: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingTop: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: Colors.hopeWhite,
  },
  primaryButton: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.sage,
    fontSize: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  secondaryButtonLink: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
});

export default JournalOnboardingScreen;
