import React from 'react';
import {
  Keyboard,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import StepFadeIn from '../common/StepFadeIn';
import HeaderCloseButton from '../common/HeaderCloseButton';
import { useFloatingKeyboardButton } from '../../hooks/useFloatingKeyboardButton';
import { triggerLightHaptic } from '../../utils/haptics';

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
  stickyRightControls?: boolean;
  scrollWithHeader?: boolean;
  manageStatusBar?: boolean;
  extraScrollBottomPadding?: number;
  titleBottomSpacing?: number;
  scrollViewRef?: React.Ref<ScrollView>;
  onContentSizeChange?: (width: number, height: number) => void;
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
  stickyRightControls = false,
  scrollWithHeader = false,
  manageStatusBar = true,
  extraScrollBottomPadding = 0,
  titleBottomSpacing = 32,
  scrollViewRef,
  onContentSizeChange,
}) => {
  const insets = useSafeAreaInsets();
  const { bottom: buttonBottom, keyboardVisible } = useFloatingKeyboardButton(insets.bottom);
  const isLight = backgroundColor === Colors.lightBackground;

  useFocusEffect(
    React.useCallback(() => {
      if (!manageStatusBar) {return;}

      StatusBar.setHidden(true, 'slide');
      StatusBar.setBarStyle(isLight ? 'dark-content' : 'light-content');

      return () => {
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle('dark-content');
      };
    }, [isLight, manageStatusBar])
  );

  const dismissKeyboard = () => {
    if (!TextInput.State.currentlyFocusedInput()) {
      Keyboard.dismiss();
    }
  };

  const textColor = isLight ? Colors.text : Colors.hopeWhite;
  const mutedColor = isLight ? Colors.sageMuted : Colors.hopeWhite;

  const closeControl = onBack ? (
    <HeaderCloseButton
      onPress={() => { triggerLightHaptic(); onBack(); }}
      accessibilityLabel="Close"
    />
  ) : (
    <View style={styles.backPlaceholder} />
  );

  const headerControls = (
    <View style={styles.headerControls}>
      {rightControl}
      {closeControl}
    </View>
  );

  const header = (
    <View style={[styles.topRow, { paddingTop: insets.top + 8 }, { marginHorizontal: -24 }]}>
      <View style={[styles.backPlaceholder, rightControl ? { width: 92 } : null]} />

      <StepFadeIn delay={0} style={styles.eyebrowRow}>
        {eyebrowIcon}
        <ThemedText weight="semiBold" style={[styles.eyebrow, { color: mutedColor }]}>{eyebrow}</ThemedText>
      </StepFadeIn>

      {stickyRightControls
        ? <View style={{width: rightControl ? 92 : 42}} />
        : headerControls}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        ref={scrollViewRef}
        onContentSizeChange={onContentSizeChange}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (keyboardVisible ? 320 : 30) + extraScrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={dismissKeyboard}
      >
        {header}
        {title ? (
          <StepFadeIn delay={80} style={styles.titleRow}>
            <ThemedText weight="semiBold" style={[styles.title, { color: textColor, marginBottom: titleBottomSpacing }]}>{title}</ThemedText>
          </StepFadeIn>
        ) : null}
        {children}
      </ScrollView>
      {stickyRightControls ? (
        <View
          testID="routine-sticky-header-controls"
          style={[styles.stickyHeaderControls, {top: insets.top + 8}]}
        >
          {headerControls}
        </View>
      ) : null}
      <Animated.View pointerEvents="box-none" style={[styles.footer, { position: 'absolute', bottom: buttonBottom, left: 0, right: 0, justifyContent: onSkip ? 'space-between' : 'flex-end' }]}>
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
      </Animated.View>
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyHeaderControls: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
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
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
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
