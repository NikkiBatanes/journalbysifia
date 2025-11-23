/**
 * Deep Link Handler
 * Handles deep links for password reset and other app navigation
 */

import { Linking } from 'react-native';
import { Logger } from './ProductionLogger';

export interface DeepLinkParams {
  type: 'reset-password' | 'unknown';
  accessToken?: string;
  refreshToken?: string;
  [key: string]: any;
}

/**
 * Parse a deep link URL and extract parameters
 */
export const parseDeepLink = (url: string): DeepLinkParams | null => {
  try {
    Logger.info('DeepLink: Parsing URL', { url });
    Logger.info('[DeepLink] Parsing URL', { url });

    // Handle both sifia:// scheme and https:// (Supabase might redirect through https first)
    if (url.startsWith('sifia://') || url.includes('reset-password')) {
      const params: any = {};

      // CRITICAL FIX: Extract tokens from hash fragment using regex
      // Supabase sends: sifia://reset-password#access_token=xxx&refresh_token=yyy&type=recovery
      // The URL API doesn't reliably parse hash fragments in custom schemes

      // Extract from hash fragment (after #)
      const hashMatch = url.match(/#(.+)$/);
      if (hashMatch) {
        const hashString = hashMatch[1];
        Logger.info('DeepLink: Hash fragment found', { fragment: hashString.substring(0, 50) + '...' });

        // Parse hash parameters manually
        const hashPairs = hashString.split('&');
        hashPairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[key] = decodeURIComponent(value);
            Logger.info('DeepLink: Hash param', { key, value: value.substring(0, 20) + '...' });
          }
        });
      }

      // Also try URL API as fallback
      try {
        let normalizedUrl = url;
        if (url.startsWith('https://') || url.startsWith('http://')) {
          const urlMatch = url.match(/\/reset-password/);
          if (urlMatch) {
            normalizedUrl = url.replace(/^https?:\/\/[^/]+/, 'sifia:/');
          }
        }

        Logger.info('DeepLink: Normalized URL', { url: normalizedUrl });

        const urlObj = new URL(normalizedUrl);

        // Extract query parameters (if any)
        urlObj.searchParams.forEach((value, key) => {
          if (!params[key]) { // Don't override hash params
            params[key] = value;
            Logger.info('DeepLink: Query param', { key, value: value.substring(0, 30) + '...' });
          }
        });

        // Try URL API hash parsing as fallback
        if (urlObj.hash && !params.access_token) {
          Logger.info('DeepLink: URL API hash found', { hash: urlObj.hash.substring(0, 50) + '...' });
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          hashParams.forEach((value, key) => {
            if (!params[key]) {
              params[key] = value;
              Logger.info('DeepLink: URL API hash param', { key, value: value.substring(0, 20) + '...' });
            }
          });
        }
      } catch (urlError) {
        Logger.warn('DeepLink: URL API parsing failed', { error: String(urlError) });
      }

      // Final fallback: regex extraction from full URL string
      if (!params.access_token && url.includes('access_token=')) {
        const tokenMatch = url.match(/access_token=([^&#]+)/);
        if (tokenMatch) {
          params.access_token = decodeURIComponent(tokenMatch[1]);
          Logger.info('DeepLink: Extracted access_token from regex');
        }
      }

      if (!params.refresh_token && url.includes('refresh_token=')) {
        const tokenMatch = url.match(/refresh_token=([^&#]+)/);
        if (tokenMatch) {
          params.refresh_token = decodeURIComponent(tokenMatch[1]);
          Logger.info('DeepLink: Extracted refresh_token from regex');
        }
      }

      Logger.info('DeepLink: Has access_token', { hasAccessToken: !!params.access_token });
      Logger.info('DeepLink: Has refresh_token', { hasRefreshToken: !!params.refresh_token });
      Logger.info('DeepLink: Type', { type: params.type });
      Logger.info('[DeepLink] Parsed params', {
        hasAccessToken: !!params.access_token,
        hasRefreshToken: !!params.refresh_token,
        type: params.type,
      });

      // Determine link type
      if (url.includes('reset-password')) {
        return {
          type: 'reset-password',
          accessToken: params.access_token,
          refreshToken: params.refresh_token,
          recoveryType: params.type,
          ...params,
        };
      }

      return {
        type: 'unknown',
        ...params,
      };
    }

    Logger.warn('DeepLink: Unsupported URL scheme', { url });
    Logger.warn('[DeepLink] Unsupported URL scheme', { url });
    return null;
  } catch (error) {
    Logger.error('DeepLink: Error parsing URL', error as Error, { url });
    Logger.error('[DeepLink] Error parsing URL', error as Error, { url });
    return null;
  }
};

/**
 * Get the initial deep link URL (if app was opened via deep link)
 */
export const getInitialDeepLink = async (): Promise<string | null> => {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      Logger.info('[DeepLink] Initial URL detected', { url });
    }
    return url;
  } catch (error) {
    Logger.error('[DeepLink] Error getting initial URL', error as Error);
    return null;
  }
};

/**
 * Listen for deep link events
 */
export const addDeepLinkListener = (
  callback: (url: string) => void
): { remove: () => void } => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    Logger.info('[DeepLink] URL event received', { url });
    callback(url);
  });

  return {
    remove: () => {
      subscription.remove();
    },
  };
};
