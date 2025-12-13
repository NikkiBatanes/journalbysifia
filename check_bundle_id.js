// Add this to your app startup
import { DeviceInfo } from 'react-native-device-info';

console.log('=== BUNDLE ID DEBUG ===');
console.log('Current Bundle ID:', DeviceInfo.getBundleId());
console.log('Is Emulator:', DeviceInfo.isEmulator());

// Expected for sandbox testing:
// Should be something like: com.sifia.sandbox or com.company.app.debug
// NOT the production bundle ID like: com.sifia.app
