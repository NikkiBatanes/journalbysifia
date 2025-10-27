import { Logger } from "./utils/ProductionLogger";
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

// Production configuration - replace with your actual values
export const authConfig: AuthConfig = {
  apple: {
    // Your app's bundle identifier
    clientId: process.env.EXPO_PUBLIC_BUNDLE_ID || 'com.yourcompany.sifia',
    // Supabase redirect URL
    redirectUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
      ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/callback`
      : 'https://your-project.supabase.co/auth/v1/callback',
  },
  google: {
    // Replace with your actual Google OAuth client IDs
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'your-google-web-client-id.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'your-google-ios-client-id.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'your-google-android-client-id.googleusercontent.com',
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key',
  },
};

// Environment validation
export const validateAuthConfig = (): boolean => {
  const requiredEnvVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    Logger.warn('⚠️ Missing required environment variables', { component: 'auth-config', data: missing });
    return false;
  }

  return true;
};
