// Add this to your app to debug bundle ID
import { DeviceInfo } from 'react-native-device-info';

console.log('=== DEBUG INFO ===');
console.log('Bundle ID:', DeviceInfo.getBundleId());
console.log('Build Number:', DeviceInfo.getBuildNumber());
console.log('Version:', DeviceInfo.getVersion());
console.log('Is Emulator:', DeviceInfo.isEmulator());

// Also check if StoreKit config file exists
import { Platform } from 'react-native';
if (Platform.OS === 'ios') {
  try {
    const StoreKit = require('react-native-iap').StoreKit;
    console.log('StoreKit config exists:', !!StoreKit);
  } catch (e) {
    console.log('StoreKit config check failed:', e.message);
  }
}
