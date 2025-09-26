/**
 * Apple JWT Generator for Supabase
 * Generates a JWT token from your Apple .p8 private key
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Configuration - UPDATE THESE VALUES
const TEAM_ID = 'YOUR_TEAM_ID';        // From Apple Developer Console
const KEY_ID = 'YOUR_KEY_ID';          // From your .p8 key
const CLIENT_ID = 'YOUR_BUNDLE_ID';    // Your app's bundle ID
const P8_FILE_PATH = './AuthKey_XXXXXXXXXX.p8'; // Path to your .p8 file

function generateAppleJWT() {
  try {
    // Read the private key
    const privateKey = fs.readFileSync(P8_FILE_PATH, 'utf8');

    // Create JWT payload
    const payload = {
      iss: TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60), // 6 months
      aud: 'https://appleid.apple.com',
      sub: CLIENT_ID,
    };

    // Generate JWT
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        kid: KEY_ID,
        typ: 'JWT',
      },
    });

    console.log('✅ Apple JWT Generated Successfully!');
    console.log('📋 Copy this JWT token to Supabase:');
    console.log('');
    console.log(token);
    console.log('');
    console.log('🔧 Paste this token in Supabase → Authentication → Providers → Apple → Client Secret');

    return token;

  } catch (error) {
    console.error('❌ Error generating Apple JWT:', error.message);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('1. Make sure your .p8 file path is correct');
    console.log('2. Update TEAM_ID, KEY_ID, and CLIENT_ID in this script');
    console.log('3. Ensure you have jsonwebtoken installed: npm install jsonwebtoken');
  }
}

// Run the generator
generateAppleJWT();
