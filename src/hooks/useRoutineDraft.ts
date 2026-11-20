import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {localJournalMutations} from '../storage/journalMutationCoordinator';
import {removeLocalJournalItem, setLocalJournalItem} from '../storage/journalItemStorage';

export function useRoutineDraft<T>(
  routine: 'morning' | 'evening',
  selectedDate: string,
  step: string,
  value: T,
  restore: (draft: T) => void,
  enabled = true,
) {
  const key = `routine_draft:${routine}:${selectedDate}:${step}`;
  const sessionRef = React.useRef<{key: string; firstRender: boolean; edited: boolean; cleared: boolean} | null>(null);
  const restoreRef = React.useRef(restore);
  restoreRef.current = restore;
  const serialized = JSON.stringify(value);

  React.useEffect(() => {
    if (!enabled) {return;}
    const session = {key, firstRender: true, edited: false, cleared: false};
    sessionRef.current = session;
    localJournalMutations.runExclusive(() => AsyncStorage.getItem(key))
      .then(raw => {
        if (sessionRef.current === session && !session.edited && !session.cleared && raw) {
          restoreRef.current(JSON.parse(raw));
        }
      })
      .catch(error => console.warn('Error restoring routine draft:', error));
    return () => {sessionRef.current = null;};
  }, [enabled, key]);

  React.useEffect(() => {
    const session = sessionRef.current;
    if (!enabled || !session || session.cleared) {return;}
    if (session.firstRender) {
      session.firstRender = false;
      return;
    }
    session.edited = true;
    const timeout = setTimeout(() => {
      if (session.cleared) {return;}
      setLocalJournalItem(key, serialized).catch(error => console.warn('Error saving routine draft:', error));
    }, 350);
    return () => clearTimeout(timeout);
  }, [enabled, key, serialized]);

  return React.useCallback(async () => {
    if (!enabled) {return;}
    if (sessionRef.current?.key === key) {sessionRef.current.cleared = true;}
    await removeLocalJournalItem(key);
  }, [enabled, key]);
}
