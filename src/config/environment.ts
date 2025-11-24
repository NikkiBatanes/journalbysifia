// =====================================================
// Environment Configuration for Bare React Native
// =====================================================
// This handles environment variables for bare RN (not Expo managed)

import Config from 'react-native-config';
import { Logger } from '../utils/ProductionLogger';

// For bare React Native, install react-native-config:
// npm install react-native-config
// cd ios && pod install (for iOS)

export const ENV = {
  // Supabase Configuration
  SUPABASE_URL: Config.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: Config.SUPABASE_ANON_KEY || '',

  // OpenAI Configuration
  OPENAI_API_KEY: Config.OPENAI_API_KEY || '',

  // Payment Configuration - US Market
  STRIPE_PUBLISHABLE_KEY: Config.STRIPE_PUBLISHABLE_KEY || '',

  // Payment Configuration - Philippines Market
  PAYMONGO_PUBLIC_KEY: Config.PAYMONGO_PUBLIC_KEY || '',

  // App Configuration
  APP_ENV: Config.APP_ENV || 'production',
  API_BASE_URL: Config.API_BASE_URL || 'https://api.sifia.app',

  // Sentry Error Monitoring
  SENTRY_DSN: Config.SENTRY_DSN || '',
  SENTRY_ORG: Config.SENTRY_ORG || '',
  SENTRY_PROJECT: Config.SENTRY_PROJECT || '',

  // Feature Flags
  ENABLE_TRIAL_SYSTEM: Config.ENABLE_TRIAL_SYSTEM !== 'false', // Default true
  ENABLE_ANALYTICS: Config.ENABLE_ANALYTICS === 'true', // Default false

  // Development helpers
  isDevelopment: Config.APP_ENV === 'development',
  isProduction: Config.APP_ENV === 'production',
};

// Validation function to ensure required env vars are set
export const validateEnvironment = () => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !(ENV as any)[key] || (ENV as any)[key].includes('your_'));

  if (missing.length > 0) {
    Logger.warn('⚠️ Missing environment variables', { component: 'environment', data: missing });
    Logger.warn('Please check your .env file and ensure all required variables are set.', { component: 'environment' });
  }

  return missing.length === 0;
};

// Alternative for Expo (if you switch back)
export const EXPO_ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  // ... other expo variables
};

// Auto-detect environment type
export const getEnvironmentConfig = () => {
  // Check if we're in Expo environment
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SUPABASE_URL) {
    return EXPO_ENV;
  }

  // Default to bare React Native config
  return ENV;
};
