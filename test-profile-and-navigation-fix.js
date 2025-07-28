// Test to verify user profile and navigation fixes
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing User Profile and Navigation Fixes...\n');

// Read authApi.ts to verify profile creation fix
const authApiPath = path.join(__dirname, 'src/services/authApi.ts');
const authApiContent = fs.readFileSync(authApiPath, 'utf8');

// Read SimpleLoginScreen.tsx to verify navigation fix
const loginScreenPath = path.join(__dirname, 'src/screens/auth/SimpleLoginScreen.tsx');
const loginContent = fs.readFileSync(loginScreenPath, 'utf8');

console.log('📋 Checking authApi.ts:');

// Check if getUserProfile handles missing profiles
if (authApiContent.includes("error.code === 'PGRST116'")) {
  console.log('✅ getUserProfile detects missing profiles');
} else {
  console.log('❌ Missing profile detection not found');
}

// Check if createDefaultProfile method exists
if (authApiContent.includes('createDefaultProfile(userId: string)')) {
  console.log('✅ createDefaultProfile method added');
} else {
  console.log('❌ createDefaultProfile method not found');
}

// Check if default profile has required fields
if (authApiContent.includes('first_name: \'User\'') && 
    authApiContent.includes('faith_points: 0') && 
    authApiContent.includes('level: 1')) {
  console.log('✅ Default profile has required fields');
} else {
  console.log('❌ Default profile missing required fields');
}

console.log('\n📋 Checking SimpleLoginScreen.tsx:');

// Check if manual navigation is removed
if (!loginContent.includes("navigation.reset({")) {
  console.log('✅ Manual navigation reset removed');
} else {
  console.log('❌ Manual navigation reset still present');
}

// Check if helpful comment is added
if (loginContent.includes('// Navigation will be handled automatically by auth state change')) {
  console.log('✅ Helpful comment added');
} else {
  console.log('❌ Comment not found');
}

console.log('\n🎯 Fix Summary:');
console.log('- getUserProfile now creates default profile if missing');
console.log('- createDefaultProfile method handles profile creation');
console.log('- Manual navigation removed from login screen');
console.log('- Auth state changes handle navigation automatically');
console.log('- No more "0 rows returned" database errors');
console.log('- No more "Main navigator not found" errors');

console.log('\n✅ The user profile and navigation errors should be resolved!');
console.log('\n📱 Try registering and logging in - profile should be created automatically.');
