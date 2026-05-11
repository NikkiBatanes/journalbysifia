import { Platform, NativeModules } from 'react-native';
import { logger } from '../services/enterpriseLoggingService';

/**
 * Get device locale for location detection
 * Uses device locale (not GPS) - works without location permission
 */
export function getDeviceLocale(): string {
  try {
    let locale = '';

    if (Platform.OS === 'ios') {
      // iOS: Get locale from settings
      locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
               NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || '';
    } else if (Platform.OS === 'android') {
      // Android: Get locale from I18nManager
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    }

    logger.info('[LocaleHelper] Detected device locale', {
      component: 'localeHelper',
      locale,
      platform: Platform.OS,
    });

    return locale;
  } catch (error) {
    logger.error('[LocaleHelper] Failed to get device locale', error as Error, {
      component: 'localeHelper',
    });
    return '';
  }
}

/**
 * Extract country code from locale (e.g., "en_PH" -> "PH", "en-PH" -> "PH")
 */
export function getCountryCodeFromLocale(locale: string): string {
  if (!locale) return '';
  
  const countryMatch = locale.match(/[-_]([A-Z]{2})$/i);
  const countryCode = countryMatch ? countryMatch[1].toUpperCase() : '';
  
  logger.info('[LocaleHelper] Extracted country code', {
    component: 'localeHelper',
    locale,
    countryCode,
  });
  
  return countryCode;
}

/**
 * Check if locale indicates Philippines
 */
export function isPhilippinesLocale(locale: string): boolean {
  if (!locale) return false;
  
  const countryCode = getCountryCodeFromLocale(locale);
  return countryCode === 'PH';
}
