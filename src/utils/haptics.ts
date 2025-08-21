import { NativeModules } from 'react-native';

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
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerMediumHaptic = () => {
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactMedium', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerHeavyHaptic = () => {
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('impactHeavy', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerSuccessHaptic = () => {
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerSelectionHaptic = () => {
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('selection', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};

export const triggerErrorHaptic = () => {
  const trigger = getTriggerFn();
  if (typeof trigger === 'function') {
    trigger('notificationError', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  }
};
