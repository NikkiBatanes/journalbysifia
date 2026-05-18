// Quick test to verify Apple API credentials
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// Test credentials come from local environment variables only.
const appleKeyId = Deno.env.get('APPLE_KEY_ID') ?? '';
const appleIssuerId = Deno.env.get('APPLE_ISSUER_ID') ?? '';
const applePrivateKey = Deno.env.get('APPLE_PRIVATE_KEY') ?? '';

async function testAppleAPI() {
  try {
    console.log('Testing Apple API credentials...');
    console.log('Key ID:', appleKeyId);
    console.log('Issuer ID:', appleIssuerId);

    // Convert PEM private key to CryptoKey
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = applePrivateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    console.log('Private key imported successfully');

    // Create JWT token
    const jwtToken = await create(
      { alg: 'ES256', kid: appleKeyId, typ: 'JWT' },
      {
        iss: appleIssuerId,
        iat: getNumericDate(0),
        exp: getNumericDate(60 * 60), // 1 hour
        aud: 'appstoreconnect-v1',
      },
      cryptoKey
    );

    console.log('JWT Token generated successfully');
    console.log('Token length:', jwtToken.length);
    console.log('Token preview:', jwtToken.substring(0, 50) + '...');

    // Test API call
    console.log('\nTesting API call...');
    const response = await fetch(
      'https://api.storekit.itunes.apple.com/inApps/v1/history/2000000000000000',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('API Response Status:', response.status);
    console.log('API Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('API Response Body:', responseText);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAppleAPI();
