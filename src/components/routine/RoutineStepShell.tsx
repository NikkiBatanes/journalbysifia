import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';

interface RoutineStepShellProps {
  step: number;
  totalSteps: number;
  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  backgroundColor?: string;
  rightControl?: React.ReactNode;
}

const RoutineStepShell: React.FC<RoutineStepShellProps> = ({
  step: _step,
  totalSteps: _totalSteps,
  eyebrow = 'MORNING',
  eyebrowIcon,
  title,
  children,
  footer,
  onBack,
  onSkip,
  backgroundColor = Colors.sage,
  rightControl,
}) => {
  const insets = useSafeAreaInsets();
  const isLight = backgroundColor === Colors.lightBackground;

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle(isLight ? 'dark-content' : 'light-content');

      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('dark-content');
      };
    }, [isLight])
  );

  const dismissKeyboard = () => {
    if (!TextInput.State.currentlyFocusedInput()) {
      Keyboard.dismiss();
    }
  };

  const textColor = isLight ? Colors.text : Colors.hopeWhite;
  const mutedColor = isLight ? Colors.sage : Colors.hopeWhite;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
        <View style={styles.backPlaceholder} />

        <View style={styles.eyebrowRow}>
          {eyebrowIcon}
          <ThemedText weight="semiBold" style={[styles.eyebrow, { color: mutedColor }]}>{eyebrow}</ThemedText>
        </View>

        {rightControl ? rightControl : onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.closeButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissKeyboard}
        >
          {title ? (
            <View style={styles.titleRow}>
              <ThemedText weight="semiBold" style={[styles.title, { color: textColor }]}>{title}</ThemedText>
            </View>
          ) : null}
          {children}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), justifyContent: onSkip ? 'space-between' : 'flex-end' }]}>
          {onSkip && (
            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <ThemedText style={[styles.skipText, { color: isLight ? Colors.textGray : Colors.hopeWhite }]}>Skip</ThemedText>
            </TouchableOpacity>
          )}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
    marginTop: 32,
    marginBottom: 8,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 42,
    height: 42,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  keyboardAvoider: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    paddingHorizontal: 24,
  },
  titleRow: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  skipButton: {
    alignSelf: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
});

export default RoutineStepShell;
