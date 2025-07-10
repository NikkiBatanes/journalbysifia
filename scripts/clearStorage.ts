import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
    console.log('✅ AsyncStorage cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing AsyncStorage:', error);
  } finally {
    // Exit the process after clearing
    process.exit(0);
  }
}

clearStorage();
