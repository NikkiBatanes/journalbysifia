const jwt = require('jsonwebtoken');
const fs = require('fs');

// REPLACE THESE WITH YOUR ACTUAL VALUES:
const TEAM_ID = 'L2AT73KSY8';     // From Apple Developer Console Membership (e.g., 'ABC123DEFG')
const KEY_ID = 'B99S3W8K2W';       // From your .p8 key in Apple Developer (e.g., 'XYZ789ABCD')
const BUNDLE_ID = 'app.sifia.com'; // Your app's bundle ID (e.g., 'com.yourcompany.sifia')
const P8_FILE_PATH = './AuthKey_B99S3W8K2W.p8'; // Path to your .p8 file (e.g., './AuthKey_XYZ789ABCD.p8')

// UPDATE THE VALUES ABOVE, then run: node generate-jwt.js

try {
  const privateKey = fs.readFileSync(P8_FILE_PATH, 'utf8');
  
  const token = jwt.sign({
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60), // 6 months
    aud: 'https://appleid.apple.com',
    sub: BUNDLE_ID
  }, privateKey, {
    algorithm: 'ES256',
    header: { kid: KEY_ID }
  });
  
  console.log('\n✅ JWT Token Generated:');
  console.log('\n' + token);
  console.log('\n📋 Copy this token to Supabase Apple Provider Client Secret field\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\n🔧 Steps to fix:');
  console.log('1. Update TEAM_ID, KEY_ID, BUNDLE_ID in this file');
  console.log('2. Update P8_FILE_PATH to point to your .p8 file');
  console.log('3. Run: node generate-jwt.js\n');
}
