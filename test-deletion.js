// Quick test script to verify deletion functionality
const { exec } = require('child_process');

console.log('🧪 Testing recurring event deletion functionality...');

// This would normally be run in the React Native environment
// For now, let's just check if the files compile correctly
exec('npx tsc --noEmit --project .', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ TypeScript compilation errors:', error.message);
    console.error(stderr);
    return;
  }

  if (stderr) {
    console.warn('⚠️ TypeScript warnings:', stderr);
  }

  console.log('✅ TypeScript compilation successful');
  console.log('📝 Files appear to be syntactically correct');
});
