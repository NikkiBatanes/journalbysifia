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
  SUPABASE_SERVICE_ROLE_KEY: Config.SUPABASE_SERVICE_ROLE_KEY || '',

  // Note: OpenAI API keys are managed in Supabase Edge Functions secrets
  // No OPENAI_API_KEY needed in client environment for security

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

  // Meta App Events / Facebook SDK
  FACEBOOK_APP_ID: Config.FACEBOOK_APP_ID || '966515746211770',
  FACEBOOK_CLIENT_TOKEN: Config.FACEBOOK_CLIENT_TOKEN || '',
  META_ADVERTISER_ID_COLLECTION_ENABLED: Config.META_ADVERTISER_ID_COLLECTION_ENABLED === 'true',

  // Feature Flags
  ENABLE_TRIAL_SYSTEM: Config.ENABLE_TRIAL_SYSTEM !== 'false', // Default true
  ENABLE_ANALYTICS: Config.ENABLE_ANALYTICS === 'true', // Default false

  // Development helpers
  isDevelopment: Config.APP_ENV === 'development',
  isProduction: Config.APP_ENV === 'production',
} as const;

// Validation function to ensure required env vars are set
export const validateEnvironment = () => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];

  const optional = [
    'SENTRY_DSN',
  ];

  const missing = required.filter(key => !(ENV as any)[key] || (ENV as any)[key].includes('your_'));
  const missingOptional = optional.filter(key => !(ENV as any)[key] || (ENV as any)[key].includes('your_'));

  if (missing.length > 0) {
    Logger.error('CRITICAL: Missing required environment variables', { component: 'environment', data: missing });
    Logger.error('App cannot function without these variables. Please check your .env file.', { component: 'environment' });
  }

  if (missingOptional.length > 0) {
    Logger.warn('Missing optional environment variables', { component: 'environment', data: missingOptional });
    Logger.warn('Some features may not work without these variables.', { component: 'environment' });
  }

  return missing.length === 0;
};

// Alternative for Expo (if you switch back)
export const EXPO_ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
  // ... other expo variables
} as const;

// Auto-detect environment type
export const getEnvironmentConfig = () => {
  // Check if we're in Expo environment
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SUPABASE_URL) {
    return EXPO_ENV;
  }

  // Default to bare React Native config
  return ENV;
};
