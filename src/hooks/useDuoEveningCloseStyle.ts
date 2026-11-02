import {Platform, useWindowDimensions, ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

// Match the floating close control in RoutineStepShell (Morning flow).
export const useDuoEveningCloseStyle = (enabled: boolean, contentLeft = 24): ViewStyle | undefined => {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const isDuoDisplay = Platform.OS === 'ios'
    && !Platform.isPad
    && (insets.left !== insets.right || Math.min(width, height) >= 600);

  return enabled && isDuoDisplay
    ? {left: contentLeft, right: undefined, top: insets.top + 16}
    : undefined;
};
