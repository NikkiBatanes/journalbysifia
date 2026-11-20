import AsyncStorage from '@react-native-async-storage/async-storage';
import {localJournalMutations} from './journalMutationCoordinator';

export const setLocalJournalItem = (key: string, value: string): Promise<void> =>
  localJournalMutations.runExclusive(() => AsyncStorage.setItem(key, value));

export const removeLocalJournalItem = (key: string): Promise<void> =>
  localJournalMutations.runExclusive(() => AsyncStorage.removeItem(key));
