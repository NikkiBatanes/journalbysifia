/**
 * Session management constants
 * Centralized constants to ensure consistency across the application
 */

// AsyncStorage keys
export const SESSION_STORAGE_KEY = '@supabase_session';

// Session validation settings
export const SESSION_VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const SESSION_REFRESH_RETRY_ATTEMPTS = 3;
export const SESSION_REFRESH_RETRY_DELAY = 1000; // 1 second

// Operation timeouts
export const OPERATION_TIMEOUT = 30 * 1000; // 30 seconds
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 2000; // 2 seconds

// Auth error messages (standardized)
export const AUTH_ERROR_MESSAGES = {
  NO_SESSION: 'No active session. Please login.',
  SESSION_EXPIRED: 'Session expired. Please login again.',
  INVALID_TOKEN: 'Invalid authentication token. Please login again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// Auth error patterns for detection
export const AUTH_ERROR_PATTERNS = [
  'No active session',
  'Please sign in',
  'Please login',
  'Session expired',
  'Invalid token',
  'Authentication required',
  'Unauthorized',
  'Token expired',
  'Access denied',
] as const;
