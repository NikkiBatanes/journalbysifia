import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, useWindowDimensions } from 'react-native';

// For floating actions outside a KeyboardAvoidingView; do not apply both offsets.
export const useFloatingKeyboardButton = (bottomInset: number) => {
  const { height } = useWindowDimensions();
  const bottom = useRef(new Animated.Value(bottomInset + 20)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const move = (keyboardHeight: number, duration: number) => {
      setKeyboardVisible(keyboardHeight > 0);
      Animated.timing(bottom, {
        toValue: keyboardHeight > 0 ? keyboardHeight + 16 : bottomInset + 20,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {
      move(Math.max(0, height - event.endCoordinates.screenY), event.duration || 250);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => move(0, event.duration || 200));
    // A newly mounted step may inherit an already-open keyboard.
    const metrics = Keyboard.metrics?.();
    if (metrics) { move(Math.max(0, height - metrics.screenY), 0); }
    return () => { show.remove(); hide.remove(); bottom.stopAnimation(); };
  }, [bottom, bottomInset, height]);
  return { bottom, keyboardVisible };
};
