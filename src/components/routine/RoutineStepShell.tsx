import React from 'react';
import {
  Keyboard,
  Animated,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
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
  onSwipeBack?: () => void;
  onSwipeForward?: () => void;
  canSwipeForward?: boolean;
  overlay?: React.ReactNode;
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
  scrollWithHeader: _scrollWithHeader = false,
  manageStatusBar = true,
  extraScrollBottomPadding = 0,
  titleBottomSpacing = 32,
  scrollViewRef,
  onContentSizeChange,
  onSwipeBack,
  onSwipeForward,
  canSwipeForward = true,
  overlay,
}) => {
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
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

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > 18
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      if (!horizontal) {return false;}
      return gestureState.dx > 0
        ? Boolean(onSwipeBack)
        : Boolean(onSwipeForward && canSwipeForward);
    },
    onPanResponderRelease: (_, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      const farEnough = Math.abs(gestureState.dx) > screenWidth * 0.15;
      const fastEnough = Math.abs(gestureState.vx) > 0.45;
      if (!horizontal || (!farEnough && !fastEnough)) {return;}
      if (gestureState.dx > 0 && onSwipeBack) {
        triggerLightHaptic();
        onSwipeBack();
      } else if (gestureState.dx < 0 && onSwipeForward && canSwipeForward) {
        onSwipeForward();
      }
    },
  }), [canSwipeForward, onSwipeBack, onSwipeForward, screenWidth]);

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
      {rightControl ? <HeaderControlPop delay={620}>{rightControl}</HeaderControlPop> : null}
      <HeaderControlPop delay={rightControl ? 740 : 620}>{closeControl}</HeaderControlPop>
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
    <View style={[styles.container, { backgroundColor }]} {...panResponder.panHandlers}>
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
      {overlay ? (
        <View pointerEvents="box-none" style={[styles.overlay, {top: insets.top + 56}]}>
          {overlay}
        </View>
      ) : null}
      <Animated.View pointerEvents="box-none" style={[styles.footer, { position: 'absolute', bottom: buttonBottom, left: 0, right: 0, justifyContent: onSkip ? 'space-between' : 'flex-end' }]}>
        {onSkip ? (
          <HeaderControlPop delay={860}>
            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <ThemedText style={[styles.skipText, { color: isLight ? Colors.textGray : Colors.hopeWhite }]}>Skip</ThemedText>
            </TouchableOpacity>
          </HeaderControlPop>
        ) : null}
        <HeaderControlPop delay={980} style={styles.footerPop}>{footer}</HeaderControlPop>
      </Animated.View>
    </View>
  );
};

const HeaderControlPop: React.FC<{ delay: number; style?: any; children: React.ReactNode }> = ({ delay, style, children }) => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.spring(anim, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    });
    const t = setTimeout(() => animation.start(), delay);
    return () => {
      clearTimeout(t);
      animation.stop();
    };
  }, [anim, delay]);

  return (
    <Animated.View style={[style, {
      opacity: anim,
      transform: [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      ],
    }]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footerPop: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 95,
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
