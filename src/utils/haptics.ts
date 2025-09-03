import { NativeModules } from 'react-native';
import { isHapticsEnabled } from '../services/experiencePreferences';

// Safe haptic triggers (no-op if module not linked)
const getTriggerFn = () => {
  try {
    const { RNHapticFeedback } = NativeModules as any;
    if (!RNHapticFeedback) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptic = require('react-native-haptic-feedback');
    return Haptic?.default?.trigger || Haptic?.trigger || null;
  } catch {
    return null;
  }
};

export const triggerLightHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerMediumHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactMedium', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerHeavyHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactHeavy', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerSuccessHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerSelectionHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('selection', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerErrorHaptic = () => {
  if (!isHapticsEnabled()) return;
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('notificationError', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};
