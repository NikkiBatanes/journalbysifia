import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { initMorningWidgetSync, syncMorningWidget } from '../services/morningWidgetService';

const MORNING_LINK_PREFIX = 'sifia://morning';
const EVENING_LINK_PREFIX = 'sifia://evening';

/**
 * Wires the Morning and Evening Home Screen widgets into the app:
 * - forwards both widget URL families into notificationDeepLinkService
 *   (queued until the navigation ref is ready on cold start);
 * - reconciles pending widget check-ins and refreshes the widget snapshot on
 *   app launch and every foreground, then refreshes both projections.
 */
export const useMorningWidget = (): void => {
  useEffect(() => {
    if (Platform.OS !== 'ios') { return; }

    initMorningWidgetSync();

    const handleUrl = (url?: string | null) => {
      if (url && (url.startsWith(MORNING_LINK_PREFIX) || url.startsWith(EVENING_LINK_PREFIX))) {
        notificationDeepLinkService.handleExternalUrl(url);
      }
    };

    const linkSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then(handleUrl);

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        syncMorningWidget();
      }
    });

    return () => {
      linkSub.remove();
      appStateSub.remove();
    };
  }, []);
};
