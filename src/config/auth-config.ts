import { Logger } from '../utils/ProductionLogger';
import { getEnvironmentConfig } from './environment';
/**
 * Enterprise Authentication Configuration
 * Contains all authentication provider settings for production deployment
 */

export interface AuthConfig {
  apple: {
    clientId: string;
    redirectUrl: string;
  };
  google: {
    webClientId: string;
    iosClientId: string;
    androidClientId: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
}

const env = getEnvironmentConfig();

export const authConfig: AuthConfig = {
  apple: {
    // Your app's bundle identifier
    clientId: 'app.journal.sifia',
    // Supabase redirect URL
    redirectUrl: 'https://aesmrjinczhknchlrsmt.supabase.co/auth/v1/callback',
  },
  google: {
    // Replace with your actual Google OAuth client IDs
    webClientId: '158783468776-nl9jnprt6mu0qhkq4lba6l3gn2adtfgi.apps.googleusercontent.com',
    iosClientId: '158783468776-1at3oeuablle65rvtsjqeqhv6qc40me8.apps.googleusercontent.com',
    androidClientId: 'your-google-android-client-id.googleusercontent.com',
  },
  supabase: {
    url: env.SUPABASE_URL ?? '',
    anonKey: env.SUPABASE_ANON_KEY ?? '',
  },
};

// Environment validation for bare React Native
export const validateAuthConfig = (): boolean => {
  const requiredValues = [
    authConfig.supabase.url,
    authConfig.supabase.anonKey,
    authConfig.google.webClientId,
    authConfig.google.iosClientId,
  ];

  const missing = requiredValues.filter(value => !value || value.includes('your-'));

  if (missing.length > 0) {
    Logger.warn('⚠️ Missing required auth configuration values', { component: 'auth-config', data: missing });
    return false;
  }

  return true;
};
