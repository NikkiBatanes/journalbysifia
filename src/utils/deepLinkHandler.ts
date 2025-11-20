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
    console.log('[DeepLink] 🔗 Parsing URL:', url);
    Logger.info('[DeepLink] Parsing URL', { url });

    // Handle both sifia:// scheme and https:// (Supabase might redirect through https first)
    if (url.startsWith('sifia://') || url.includes('reset-password')) {
      // Normalize URL to sifia:// scheme if needed
      let normalizedUrl = url;
      if (url.startsWith('https://') || url.startsWith('http://')) {
        // Extract the path and convert to sifia:// scheme
        const urlMatch = url.match(/\/reset-password/);
        if (urlMatch) {
          normalizedUrl = url.replace(/^https?:\/\/[^/]+/, 'sifia:/');
        }
      }

      console.log('[DeepLink] Normalized URL:', normalizedUrl);

      const urlObj = new URL(normalizedUrl);
      const host = urlObj.hostname || urlObj.pathname.split('/')[0].replace('/', '');
      const params: any = {};

      // Extract query parameters
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
        console.log('[DeepLink] Query param:', key, '=', value.substring(0, 30) + '...');
      });

      // Extract hash parameters (Supabase sends tokens in hash fragment)
      if (urlObj.hash) {
        console.log('[DeepLink] Hash found:', urlObj.hash.substring(0, 50) + '...');
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        hashParams.forEach((value, key) => {
          params[key] = value;
          console.log('[DeepLink] Hash param:', key, '=', value.substring(0, 20) + '...');
        });
      }

      // Also check if tokens are in the main URL (some formats)
      if (!params.access_token && url.includes('access_token=')) {
        const tokenMatch = url.match(/access_token=([^&]+)/);
        if (tokenMatch) {
          params.access_token = tokenMatch[1];
          console.log('[DeepLink] Extracted access_token from URL string');
        }
      }

      console.log('[DeepLink] ✅ Host:', host);
      console.log('[DeepLink] ✅ Has access_token:', !!params.access_token);
      Logger.info('[DeepLink] Parsed params', { host, hasAccessToken: !!params.access_token });

      // Determine link type
      if (host === 'reset-password' || url.includes('reset-password')) {
        return {
          type: 'reset-password',
          accessToken: params.access_token,
          refreshToken: params.refresh_token,
          ...params,
        };
      }

      return {
        type: 'unknown',
        ...params,
      };
    }

    console.warn('[DeepLink] ⚠️ Unsupported URL scheme:', url);
    Logger.warn('[DeepLink] Unsupported URL scheme', { url });
    return null;
  } catch (error) {
    console.error('[DeepLink] ❌ Error parsing URL:', error);
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
