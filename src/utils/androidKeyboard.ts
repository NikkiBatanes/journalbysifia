import { NativeModules, Platform } from 'react-native';

const AndroidKeyboard = NativeModules.SifiaKeyboard as
  | { showSoftKeyboard?: () => void }
  | undefined;

let lastKeyboardRequestAt = 0;

export const requestAndroidSoftKeyboard = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const now = Date.now();
  if (now - lastKeyboardRequestAt < 350) {
    return;
  }
  lastKeyboardRequestAt = now;

  setTimeout(() => AndroidKeyboard?.showSoftKeyboard?.(), 60);
  setTimeout(() => AndroidKeyboard?.showSoftKeyboard?.(), 180);
};

export const shouldRequestAndroidSoftKeyboard = (props?: {
  editable?: boolean;
  sifiaDisableKeyboardForce?: boolean;
  showSoftInputOnFocus?: boolean;
}) => {
  if (Platform.OS !== 'android') {
    return false;
  }

  return props?.editable !== false &&
    props?.sifiaDisableKeyboardForce !== true &&
    props?.showSoftInputOnFocus !== false;
};
