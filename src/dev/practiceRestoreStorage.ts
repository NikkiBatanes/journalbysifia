import AsyncStorage from '@react-native-async-storage/async-storage';
import type {JournalBackupRestoreStorage} from '../services/journalBackupRestoreExecutor';

export function practiceRestoreStorage(prefix: `journal:dev:${string}:`): JournalBackupRestoreStorage {
  return {
    async getAllKeys() {
      return (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
    },
    async multiGet(keys) {
      return (await AsyncStorage.multiGet(keys.map(key => prefix + key)))
        .map(([key, value]) => [key.slice(prefix.length), value] as const);
    },
    multiSet(rows) {
      return AsyncStorage.multiSet(rows.map(([key, value]) => [prefix + key, value]));
    },
    async multiRemove(keys) {
      // Preserve the executor's cleanup order on platforms without atomic multiRemove.
      for (const key of keys) {await AsyncStorage.removeItem(prefix + key);}
    },
  };
}
