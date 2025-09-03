// Debug script to test authentication configuration
const { GoogleSignin } = require('@react-native-google-signin/google-signin');

console.log('🔍 Testing Google Sign-In Configuration...');

// Test Google Sign-In setup
GoogleSignin.configure({
  webClientId: '1062728638095-qqvkdh9rnp0v5ql2jnb0kcj6h9kf9dq3.apps.googleusercontent.com',
  offlineAccess: true,
});

console.log('✅ Google Sign-In configured');
console.log('📱 Configuration details:');
console.log('- Web Client ID: 1062728638095-qqvkdh9rnp0v5ql2jnb0kcj6h9kf9dq3.apps.googleusercontent.com');
console.log('- Offline Access: true');

// Test if Google Play Services are available (Android only)
GoogleSignin.hasPlayServices()
  .then(() => {
    console.log('✅ Google Play Services available');
  })
  .catch((error) => {
    console.log('⚠️ Google Play Services check:', error.message);
  });

console.log('\n🍎 Apple Sign-In is iOS only - will be tested on device');
console.log('\n🔧 Next steps:');
console.log('1. Make sure you added the JWT token to Supabase Apple Provider');
console.log('2. Test on iOS device/simulator for Apple Sign-In');
console.log('3. Test on Android device/emulator for Google Sign-In');
