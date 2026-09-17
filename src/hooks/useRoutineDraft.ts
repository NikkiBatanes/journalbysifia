import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useRoutineDraft<T>(
  routine: 'morning' | 'evening',
  selectedDate: string,
  step: string,
  value: T,
  restore: (draft: T) => void,
  enabled = true,
) {
  const key = `routine_draft:${routine}:${selectedDate}:${step}`;
  const loaded = React.useRef(false);
  const cleared = React.useRef(false);
  const restoreRef = React.useRef(restore);
  restoreRef.current = restore;
  const serialized = JSON.stringify(value);

  React.useEffect(() => {
    if (!enabled) {return;}
    let active = true;
    AsyncStorage.getItem(key)
      .then(raw => {
        if (active && raw) {restoreRef.current(JSON.parse(raw));}
      })
      .catch(error => console.warn('Error restoring routine draft:', error))
      .finally(() => { loaded.current = true; });
    return () => { active = false; };
  }, [enabled, key]);

  React.useEffect(() => {
    if (!enabled || !loaded.current || cleared.current) {return;}
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(key, serialized).catch(error => console.warn('Error saving routine draft:', error));
    }, 350);
    return () => clearTimeout(timeout);
  }, [enabled, key, serialized]);

  return React.useCallback(async () => {
    if (!enabled) {return;}
    cleared.current = true;
    await AsyncStorage.removeItem(key);
  }, [enabled, key]);
}
