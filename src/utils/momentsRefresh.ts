import { DeviceEventEmitter } from 'react-native';

/** Notify the existing Moments listener that persisted timeline structure changed. */
export const emitMomentsStructuralRefresh = (type: string, date: string, canonicalIds: string[] = []): void => {
  DeviceEventEmitter.emit('reflection_saved', { type, date, canonicalIds });
};
