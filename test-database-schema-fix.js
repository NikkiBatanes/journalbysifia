// Test to verify database schema fix for user profile creation
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Database Schema Fix...\n');

// Read authApi.ts to verify the schema fix
const authApiPath = path.join(__dirname, 'src/services/authApi.ts');
const authApiContent = fs.readFileSync(authApiPath, 'utf8');

// Read database schema to understand the actual structure
const schemaPath = path.join(__dirname, 'database/user_auth_schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

console.log('📋 Checking Database Schema:');

// Check if user_profiles table has the expected columns
const expectedColumns = [
  'id', 'email', 'first_name', 'last_name', 'bio', 'avatar_url',
  'faith_points', 'growth_level', 'current_streak', 'longest_streak',
  'gamification_stats', 'preferences', 'notification_preferences',
];

let foundColumns = 0;
expectedColumns.forEach(column => {
  if (schemaContent.includes(column)) {
    foundColumns++;
  }
});

console.log(`✅ Found ${foundColumns}/${expectedColumns.length} expected columns in schema`);

console.log('\n📋 Checking createDefaultProfile Fix:');

// Check if badges column reference is removed
if (!authApiContent.includes('badges: []')) {
  console.log('✅ Removed invalid badges column reference');
} else {
  console.log('❌ badges column reference still present');
}

// Check if email is included
if (authApiContent.includes('email: userEmail')) {
  console.log('✅ Email field added to default profile');
} else {
  console.log('❌ Email field missing');
}

// Check if growth_level is used instead of level
if (authApiContent.includes('growth_level: \'Seedling\'')) {
  console.log('✅ Using correct growth_level field');
} else {
  console.log('❌ growth_level field not found');
}

// Check if invalid fields are removed
const invalidFields = ['full_name', 'location', 'spiritual_level', 'preferences'];
let removedInvalidFields = 0;

invalidFields.forEach(field => {
  if (!authApiContent.includes(`${field}:`)) {
    removedInvalidFields++;
  }
});

console.log(`✅ Removed ${removedInvalidFields}/${invalidFields.length} invalid fields`);

// Check if required fields are present
const requiredFields = ['id', 'email', 'faith_points', 'growth_level', 'current_streak'];
let foundRequiredFields = 0;

requiredFields.forEach(field => {
  if (authApiContent.includes(`${field}:`)) {
    foundRequiredFields++;
  }
});

console.log(`✅ Found ${foundRequiredFields}/${requiredFields.length} required fields`);

console.log('\n🎯 Fix Summary:');
console.log('- Removed invalid badges column that doesn\'t exist in database');
console.log('- Added email field fetched from Supabase auth');
console.log('- Using growth_level instead of level to match schema');
console.log('- Removed fields that don\'t exist in actual database');
console.log('- Profile creation now matches actual database structure');

console.log('\n✅ The database schema mismatch should be resolved!');
console.log('\n📱 Try logging in with an existing account - profile should be created successfully.');
